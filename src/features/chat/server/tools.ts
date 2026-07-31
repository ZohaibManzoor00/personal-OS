import { tool } from "ai";
import z from "zod";
import { searchChunks } from "@/features/knowledge/server/embeddings";
import { lockedNodeIds } from "@/features/knowledge/server/locked-nodes";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

// How many note chunks semantic search pulls into a single tool result.
const RETRIEVAL_LIMIT = 8;

// A note the assistant surfaced through a tool, plus the citation number the
// model uses to reference it inline ([n]) and the UI renders in the Sources
// strip. Numbers are assigned once per note per turn (see `register`) so the
// same note keeps the same number no matter how many tools return it.
export type ToolSource = { id: string; title: string; section: string };

/**
 * Builds the toolset the chat agent can call for one turn, scoped to a single
 * reader (whose notes, and whether they may see locked ones). All retrieval the
 * model does flows through here, so the tools share one citation registry: any
 * note a tool returns is assigned a stable 1-based number, and `getSources()`
 * hands back the ordered, de-duplicated list the router emits for the UI. That
 * keeps the model's inline [n] citations lined up with the rendered Sources.
 */
export const createChatTools = ({ ownerUserId, isOwner }: { ownerUserId: string; isOwner: boolean }) => {
  const sourceOrder: ToolSource[] = [];
  const numberByNodeId = new Map<string, number>();

  const register = (note: ToolSource): number => {
    const existing = numberByNodeId.get(note.id);
    if (existing) return existing;
    const number = sourceOrder.length + 1;
    numberByNodeId.set(note.id, number);
    sourceOrder.push(note);
    return number;
  };

  const tools = {
    searchNotes: tool({
      description:
        "Semantic search over Zo's notes. Use for specific or conceptual questions about what Zo has done, built, learned, or thinks — e.g. 'how does Streamr handle backpressure?' or 'what has Zo learned about React?'.",
      inputSchema: z.object({
        query: z.string().min(1).describe("What to search for, phrased as a rich descriptive query rather than a few keywords."),
      }),
      execute: async ({ query }) => {
        const chunks = await searchChunks({
          userId: ownerUserId,
          query,
          isOwner,
          limit: RETRIEVAL_LIMIT,
        });
        return chunks.map((chunk) => ({
          citation: register({
            id: chunk.nodeId,
            title: chunk.title,
            section: chunk.section,
          }),
          noteId: chunk.nodeId,
          title: chunk.title,
          section: chunk.section,
          score: Number(chunk.score.toFixed(3)),
          content: chunk.content,
        }));
      },
    }),

    browseTopics: tool({
      description:
        "List the titles of ALL of Zo's notes, grouped by section, without their contents. Use for broad or overview questions ('what topics does Zo write about?', 'tell me about Zo', 'what does he cover?'), or to get a map of the knowledge base before deciding what to search in depth.",
      inputSchema: z.object({
        section: z.string().optional().describe("Optional: restrict to one section — learnings, career, projects, or workflows."),
      }),
      execute: async ({ section }) => {
        const lockedIds = await lockedNodeIds({ ownerUserId, isOwner });
        const notes = await prisma.node.findMany({
          where: {
            userId: ownerUserId,
            archivedAt: null,
            ...(section ? { section } : {}),
            ...(lockedIds.length ? { id: { notIn: lockedIds } } : {}),
          },
          orderBy: [{ section: "asc" }, { sortOrder: "asc" }],
          take: 300,
          select: { title: true, section: true },
        });

        const bySection: Record<string, string[]> = {};
        for (const note of notes) {
          if (!bySection[note.section]) bySection[note.section] = [];
          bySection[note.section].push(note.title);
        }
        return { totalNotes: notes.length, sections: bySection };
      },
    }),

    listRecentNotes: tool({
      description:
        "List Zo's most recently created or updated notes. Use for time-based questions like 'what has Zo written this week / lately / recently?' or 'what's he been working on?'.",
      inputSchema: z.object({
        days: z
          .number()
          .int()
          .positive()
          .max(365)
          .optional()
          .describe("Only include notes updated within this many days (e.g. 7 for 'this week')."),
        section: z.string().optional().describe("Optional: restrict to one section — learnings, career, projects, or workflows."),
        limit: z.number().int().positive().max(25).optional().describe("Max notes to return (default 15)."),
      }),
      execute: async ({ days, section, limit }) => {
        const lockedIds = await lockedNodeIds({ ownerUserId, isOwner });
        const notes = await prisma.node.findMany({
          where: {
            userId: ownerUserId,
            archivedAt: null,
            ...(section ? { section } : {}),
            ...(days ? { updatedAt: { gte: new Date(Date.now() - days * 86_400_000) } } : {}),
            ...(lockedIds.length ? { id: { notIn: lockedIds } } : {}),
          },
          orderBy: { updatedAt: "desc" },
          take: limit ?? 15,
          select: { id: true, title: true, section: true, updatedAt: true },
        });

        return notes.map((note) => ({
          citation: register({
            id: note.id,
            title: note.title,
            section: note.section,
          }),
          noteId: note.id,
          title: note.title,
          section: note.section,
          updatedAt: note.updatedAt.toISOString(),
        }));
      },
    }),

    keywordSearch: tool({
      description:
        "Full-text keyword search over Zo's notes for exact terms, names, acronyms, or jargon that semantic search might miss (e.g. a specific library, product, or person's name).",
      inputSchema: z.object({
        terms: z.string().min(1).describe("The exact words or phrase to match."),
      }),
      execute: async ({ terms }) => {
        const lockedIds = await lockedNodeIds({ ownerUserId, isOwner });
        const lockedFilter = lockedIds.length ? Prisma.sql`AND n."id" NOT IN (${Prisma.join(lockedIds)})` : Prisma.empty;
        const rows = await prisma.$queryRaw<{ id: string; title: string; section: string; snippet: string }[]>`
          SELECT
            n."id",
            n."title",
            n."section",
            ts_headline('english', coalesce(n."body", ''), websearch_to_tsquery('english', ${terms}), 'MaxFragments=2, MaxWords=28, MinWords=8') AS snippet
          FROM "Node" n
          WHERE n."userId" = ${ownerUserId}
            AND n."archivedAt" IS NULL
            AND n."searchVector" @@ websearch_to_tsquery('english', ${terms})
            ${lockedFilter}
          ORDER BY ts_rank(n."searchVector", websearch_to_tsquery('english', ${terms})) DESC
          LIMIT 8
        `;

        return rows.map((row) => ({
          citation: register({
            id: row.id,
            title: row.title,
            section: row.section,
          }),
          noteId: row.id,
          title: row.title,
          section: row.section,
          snippet: row.snippet,
        }));
      },
    }),
  };

  return { tools, getSources: () => [...sourceOrder] };
};

export type ChatTools = ReturnType<typeof createChatTools>["tools"];
