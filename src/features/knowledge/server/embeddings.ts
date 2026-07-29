import { createHash, randomUUID } from "node:crypto";
import { openai } from "@ai-sdk/openai";
import { propagateAttributes, startActiveObservation, updateActiveObservation } from "@langfuse/tracing";
import { embed, embedMany } from "ai";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { lockedNodeIds } from "./locked-nodes";

// OpenAI's small embedding model: 1536 dims, cheap, and good enough for
// personal-note semantic search. The dimension count is baked into the
// NodeChunk.embedding column (vector(1536)) — changing the model to one with a
// different size means a migration + full re-embed.
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

// Target size (in characters) for each chunk. ~1500 chars ≈ ~400 tokens, small
// enough that a hit points at a focused passage but large enough to keep context.
const CHUNK_SIZE = 1500;

/**
 * The exact text we embed for a node: its title followed by its body. Including
 * the title means a note is findable by its heading even when the body doesn't
 * repeat those words.
 */
const buildSource = (title: string, body: string | null) => `${title}\n\n${body ?? ""}`.trim();

/**
 * Splits text into chunks of roughly CHUNK_SIZE characters, preferring paragraph
 * boundaries so chunks stay coherent. Paragraphs longer than a chunk are hard-
 * split. Simple on purpose — we can add sentence-aware splitting/overlap later.
 */
export const chunkText = (text: string): string[] => {
  const normalized = text.trim();
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > CHUNK_SIZE) {
      flush();
      for (let i = 0; i < paragraph.length; i += CHUNK_SIZE) {
        chunks.push(paragraph.slice(i, i + CHUNK_SIZE));
      }
      continue;
    }

    if (current.length + paragraph.length + 2 > CHUNK_SIZE) flush();
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }

  flush();
  return chunks;
};

/** Stable hash of the embedded content, used to detect whether a node changed. */
export const hashContent = (source: string) => createHash("sha256").update(source).digest("hex");

/** Formats an embedding as a pgvector literal, e.g. "[0.1,0.2,...]". */
const toVectorLiteral = (embedding: number[]) => `[${embedding.join(",")}]`;

export type EmbedNodeResult = { status: "missing" } | { status: "unchanged" } | { status: "embedded"; chunkCount: number };

/**
 * (Re)builds the vector chunks for a single node.
 *
 * - Skips work when the content hash matches what we last embedded (only bumps
 *   `embeddedAt` so the sync scan stops re-checking it).
 * - Otherwise embeds every chunk, then replaces the node's chunks and records
 *   the new hash + timestamp in one transaction.
 *
 * The OpenAI call happens BEFORE the transaction so we never hold a DB
 * transaction open across a network round-trip.
 */
export const embedNode = async (nodeId: string): Promise<EmbedNodeResult> => {
  const node = await prisma.node.findUnique({
    where: { id: nodeId },
    select: {
      id: true,
      userId: true,
      section: true,
      title: true,
      body: true,
      embeddedHash: true,
    },
  });
  if (!node) return { status: "missing" };

  const source = buildSource(node.title, node.body);
  const hash = hashContent(source);

  if (node.embeddedHash === hash) {
    await prisma.node.update({
      where: { id: nodeId },
      data: { embeddedAt: new Date() },
    });
    return { status: "unchanged" };
  }

  // Trace the re-embed as one pipeline: a node comes in, gets chunked,
  // embedded, and stored. The `embedMany` generation nests under this span so
  // model + token usage show up in Langfuse. Unchanged/missing nodes bail out
  // above, so a trace only exists when real embedding work happens.
  return startActiveObservation(
    "embed-node",
    () =>
      propagateAttributes({ userId: node.userId, tags: ["embeddings"], metadata: { section: node.section } }, async () => {
        const chunks = chunkText(source);

        updateActiveObservation({
          input: { nodeId, title: node.title, section: node.section },
          metadata: { chunkCount: chunks.length },
        });

        const embeddings = chunks.length
          ? (
              await embedMany({
                model: openai.embedding(EMBEDDING_MODEL),
                values: chunks,
                experimental_telemetry: {
                  isEnabled: true,
                  functionId: "embed-node-chunks",
                  // The 1536-dim vectors are just noise in the trace UI — keep
                  // the chunk text as input but drop the embedding output.
                  recordOutputs: false,
                  metadata: { nodeId, section: node.section },
                },
              })
            ).embeddings
          : [];

        await prisma.$transaction(async (tx) => {
          await tx.nodeChunk.deleteMany({ where: { nodeId } });

          for (let i = 0; i < chunks.length; i++) {
            await tx.$executeRaw`
              INSERT INTO "NodeChunk" ("id", "nodeId", "userId", "section", "chunkIndex", "content", "embedding", "createdAt")
              VALUES (
                ${randomUUID()}, ${nodeId}, ${node.userId}, ${node.section}, ${i}, ${chunks[i]},
                ${toVectorLiteral(embeddings[i])}::vector, NOW()
              )
            `;
          }

          await tx.node.update({
            where: { id: nodeId },
            data: { embeddedAt: new Date(), embeddedHash: hash },
          });
        });

        const result = { status: "embedded", chunkCount: chunks.length } as const;
        updateActiveObservation({ output: result });
        return result;
      }),
    { asType: "span" },
  );
};

export type SearchChunk = {
  nodeId: string;
  title: string;
  section: string;
  content: string;
  score: number;
};

/**
 * Selects the final chunks from a ranked candidate pool (best-first) so a single
 * large note can't monopolize the limited context window.
 *
 * Two passes, no extra I/O:
 *   1. Coverage — guarantee the top-scoring chunk of the top `minDistinctNodes`
 *      distinct notes, so every strongly-matching note gets a seat. This is what
 *      keeps a flagship note from being buried when a wordier note happens to
 *      own several of the highest-scoring chunks.
 *   2. Depth — fill the remaining slots with the highest-scoring chunks left,
 *      which lets the single most relevant note contribute several chunks on a
 *      focused deep-dive question.
 */
const diversifyCandidates = (
  candidates: SearchChunk[],
  { limit, minDistinctNodes }: { limit: number; minDistinctNodes: number },
): SearchChunk[] => {
  const picked: SearchChunk[] = [];
  const pickedRefs = new Set<SearchChunk>();
  const seenNodes = new Set<string>();

  for (const chunk of candidates) {
    if (picked.length >= limit || seenNodes.size >= minDistinctNodes) break;
    if (seenNodes.has(chunk.nodeId)) continue;
    seenNodes.add(chunk.nodeId);
    picked.push(chunk);
    pickedRefs.add(chunk);
  }

  for (const chunk of candidates) {
    if (picked.length >= limit) break;
    if (pickedRefs.has(chunk)) continue;
    picked.push(chunk);
    pickedRefs.add(chunk);
  }

  return picked;
};

/**
 * Semantic search over a user's embedded note chunks.
 *
 * Embeds the query with the same model used for indexing, pulls a wide candidate
 * pool ranked by cosine similarity via the HNSW index (nearest first), then
 * diversifies it in memory (see `diversifyCandidates`) so the returned set spans
 * the most relevant *notes* rather than being dominated by whichever single note
 * has the most matching chunks. The wide pool + in-memory selection add no extra
 * round-trips, so latency stays essentially flat versus a plain top-`limit`.
 *
 * Everything is indexed regardless of privacy; locked content is only *hidden at
 * read time* from non-owners. When `isOwner` is false we exclude locked notes
 * AND their entire subtree (locking only flags the node itself, so we expand it
 * to every descendant via `lockedNodeIds`) — otherwise a locked folder's
 * children would leak into a public search. The authenticated owner sees
 * everything, so their AI can reason over locked notes too.
 */
export const searchChunks = async ({
  userId,
  query,
  isOwner,
  limit = 8,
  // Cosine-similarity floor a chunk must clear to be a candidate. Tuned for
  // text-embedding-3-small, whose genuinely-relevant matches sit around 0.3+
  // while loosely-related notes trail below — a lower floor (e.g. 0.15) let
  // almost every note through and padded answers with off-topic sources.
  minScore = 0.3,
  poolLimit = 40,
  minDistinctNodes = 4,
}: {
  userId: string;
  query: string;
  isOwner: boolean;
  limit?: number;
  minScore?: number;
  // How many candidates to pull before diversifying. Kept well above `limit` so
  // notes whose relevance is spread across many narrow chunks still make the cut.
  poolLimit?: number;
  // How many distinct notes are guaranteed a chunk before slots are filled by
  // raw score. Caps any one note's dominance of the context.
  minDistinctNodes?: number;
}): Promise<SearchChunk[]> => {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { embedding } = await embed({
    model: openai.embedding(EMBEDDING_MODEL),
    value: trimmed,
    experimental_telemetry: {
      isEnabled: true,
      functionId: "embed-search-query",
      // Keep the query text as input; the vector output is noise in the UI.
      recordOutputs: false,
    },
  });
  const literal = toVectorLiteral(embedding);

  // Owners get []; non-owners get the full locked subtree to exclude.
  const lockedIds = await lockedNodeIds({ ownerUserId: userId, isOwner });
  const lockedFilter = lockedIds.length ? Prisma.sql`AND c."nodeId" NOT IN (${Prisma.join(lockedIds)})` : Prisma.empty;

  const candidates = await prisma.$queryRaw<SearchChunk[]>`
    SELECT
      c."nodeId",
      n."title",
      c."section",
      c."content",
      1 - (c."embedding" <=> ${literal}::vector) AS score
    FROM "NodeChunk" c
    JOIN "Node" n ON n."id" = c."nodeId"
    WHERE c."userId" = ${userId}
      AND n."archivedAt" IS NULL
      ${lockedFilter}
      AND 1 - (c."embedding" <=> ${literal}::vector) >= ${minScore}
    ORDER BY c."embedding" <=> ${literal}::vector
    LIMIT ${poolLimit}
  `;

  return diversifyCandidates(candidates, { limit, minDistinctNodes });
};
