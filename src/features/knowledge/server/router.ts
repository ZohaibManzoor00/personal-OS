import { openai } from "@ai-sdk/openai";
import { propagateAttributes, startActiveObservation, updateActiveObservation } from "@langfuse/tracing";
import { TRPCError } from "@trpc/server";
import { generateObject } from "ai";
import { after } from "next/server";
import z from "zod";
import { Prisma } from "@/generated/prisma/client";
import { inngest } from "@/inngest/client";
import { langfuseSpanProcessor } from "@/instrumentation.node";
import { prisma } from "@/lib/db";
import { deleteObject, getPresignedUploadUrl, getPublicUrl } from "@/lib/r2";
import { createTRPCRouter, ownerProcedure, publicProcedure } from "@/trpc/init";
import { HIGHLIGHT_END, HIGHLIGHT_START } from "../lib/search-highlight";
import { isSectionLocked, KNOWLEDGE_SECTIONS, LOCKED_SECTIONS } from "../lib/sections";
import { slugify } from "../lib/slug";
import { lockedNodeIds, type ReaderCtx } from "./locked-nodes";

const SEARCH_LIMIT = 20;
const RECENT_LIMIT = 5;

// GPT-4.1 nano: OpenAI's fastest/cheapest model, plenty capable for
// reformatting prose into Markdown.
const FORMAT_MODEL = "gpt-4.1-nano";
const FORMAT_MAX_CHARS = 50_000;

const FORMAT_SYSTEM_PROMPT = `You reformat raw notes into clean Markdown for a strong mid-level software engineer's personal knowledge hub.

The reader is the engineer themselves — NOT a general audience. Optimize for fast skimming and recall, not polish or hand-holding.

Rules:
- Preserve ALL information, meaning, code, commands, links, and image markdown (![...](...)). Never invent, remove, or "improve" facts.
- Improve structure and readability only: sensible headings, tight bullet lists, numbered steps for sequences, tables for comparisons.
- Put code, commands, file paths, and identifiers in fenced code blocks with the correct language tag (or inline code where appropriate).
- Be concise and technical. Do not add fluff, intros, conclusions, or explanatory commentary that wasn't in the original.
- Keep the author's own wording where it's already clear; only rewrite for clarity or brevity.
- Output GitHub-Flavored Markdown only. Do NOT wrap the whole document in a code fence and do NOT add any commentary before or after it.`;

const nodeType = z.enum(["SPACE", "PAGE"]);
const knowledgeSection = z.enum(KNOWLEDGE_SECTIONS);

const coverInclude = {
  images: { orderBy: { createdAt: "desc" }, take: 1 },
} as const;

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

const buildImageKey = ({ userId, nodeId, contentType }: { userId: string; nodeId: string; contentType: string }) => {
  const ext = IMAGE_EXTENSIONS[contentType] ?? "bin";
  return `nodes/${userId}/${nodeId}/${crypto.randomUUID()}.${ext}`;
};

const uniqueSlug = async ({
  userId,
  section,
  parentId,
  title,
  excludeId,
}: {
  userId: string;
  section: string;
  parentId: string | null;
  title: string;
  excludeId?: string;
}) => {
  const base = slugify(title);
  let slug = base;
  let attempt = 1;

  while (true) {
    const existing = await prisma.node.findFirst({
      where: {
        userId,
        section,
        parentId,
        slug,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return slug;
    attempt += 1;
    slug = `${base}-${attempt}`;
  }
};

/** Prisma `where` fragment that hides the locked subtree from non-owners. */
const excludeLockedFilter = (lockedIds: string[]): Prisma.NodeWhereInput =>
  lockedIds.length ? { id: { notIn: lockedIds } } : {};

/** A locked section is invisible to non-owners (nothing is ever pulled). */
const sectionHidden = (ctx: ReaderCtx, section: string) => !ctx.isOwner && isSectionLocked(section);

/**
 * Walks a node's parent chain to check whether any ancestor is locked, so a
 * non-owner can't reach a node nested inside a locked folder via a direct link.
 */
const hasLockedAncestor = async (userId: string, parentId: string | null): Promise<boolean> => {
  let current = parentId;
  while (current) {
    const parent = await prisma.node.findFirst({
      where: { id: current, userId },
      select: { parentId: true, locked: true },
    });
    if (!parent) break;
    if (parent.locked) return true;
    current = parent.parentId;
  }
  return false;
};

export const knowledgeRouter = createTRPCRouter({
  listChildren: publicProcedure
    .input(z.object({ section: knowledgeSection, parentId: z.string().nullable() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.ownerUserId || sectionHidden(ctx, input.section)) return [];
      const lockedIds = await lockedNodeIds(ctx);
      return await prisma.node.findMany({
        where: {
          userId: ctx.ownerUserId,
          section: input.section,
          parentId: input.parentId,
          archivedAt: null,
          ...excludeLockedFilter(lockedIds),
        },
        orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
        include: coverInclude,
      });
    }),

  get: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    if (!ctx.ownerUserId) throw new TRPCError({ code: "NOT_FOUND" });

    const node = await prisma.node.findFirst({
      where: { id: input.id, userId: ctx.ownerUserId },
      include: coverInclude,
    });
    if (!node) throw new TRPCError({ code: "NOT_FOUND" });

    // Non-owners can never open locked content, a locked section, or anything
    // nested inside a locked folder.
    if (!ctx.isOwner) {
      if (node.locked || isSectionLocked(node.section) || (await hasLockedAncestor(ctx.ownerUserId, node.parentId))) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
    }

    return node;
  }),

  listSpaces: publicProcedure.input(z.object({ section: knowledgeSection })).query(async ({ ctx, input }) => {
    if (!ctx.ownerUserId || sectionHidden(ctx, input.section)) return [];
    const lockedIds = await lockedNodeIds(ctx);
    return await prisma.node.findMany({
      where: { userId: ctx.ownerUserId, section: input.section, type: "SPACE", archivedAt: null, ...excludeLockedFilter(lockedIds) },
      orderBy: { title: "asc" },
    });
  }),

  listTree: publicProcedure.input(z.object({ section: knowledgeSection })).query(async ({ ctx, input }) => {
    if (!ctx.ownerUserId || sectionHidden(ctx, input.section)) return [];
    const lockedIds = await lockedNodeIds(ctx);
    return await prisma.node.findMany({
      where: { userId: ctx.ownerUserId, section: input.section, archivedAt: null, ...excludeLockedFilter(lockedIds) },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      select: { id: true, title: true, type: true, parentId: true },
    });
  }),

  listRecent: publicProcedure.input(z.object({ section: knowledgeSection })).query(async ({ ctx, input }) => {
    if (!ctx.ownerUserId || sectionHidden(ctx, input.section)) return [];
    const lockedIds = await lockedNodeIds(ctx);
    return await prisma.node.findMany({
      where: {
        userId: ctx.ownerUserId,
        section: input.section,
        archivedAt: null,
        lastViewedAt: { not: null },
        ...excludeLockedFilter(lockedIds),
      },
      orderBy: { lastViewedAt: "desc" },
      take: RECENT_LIMIT,
      include: coverInclude,
    });
  }),

  recordView: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    // Only the owner's own views count — non-owners browsing the showcase must
    // not bump the owner's "recently viewed".
    if (!ctx.isOwner || !ctx.ownerUserId) return { id: input.id };

    // Raw update so we only touch lastViewedAt — a Prisma update would also bump the @updatedAt column.
    await prisma.$executeRaw`
      UPDATE "Node"
      SET "lastViewedAt" = NOW()
      WHERE "id" = ${input.id} AND "userId" = ${ctx.ownerUserId}
    `;

    return { id: input.id };
  }),

  getAncestors: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const userId = ctx.ownerUserId;
    if (!userId) throw new TRPCError({ code: "NOT_FOUND" });

    const node = await prisma.node.findFirst({
      where: { id: input.id, userId },
    });
    if (!node) throw new TRPCError({ code: "NOT_FOUND" });

    const ancestors = [node];
    let parentId = node.parentId;

    while (parentId) {
      const parent = await prisma.node.findFirst({
        where: { id: parentId, userId },
      });
      if (!parent) break;
      ancestors.unshift(parent);
      parentId = parent.parentId;
    }

    // A non-owner may not see the trail of anything locked anywhere in the chain.
    if (!ctx.isOwner && ancestors.some((n) => n.locked || isSectionLocked(n.section))) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    return ancestors;
  }),

  create: ownerProcedure
    .input(
      z.object({
        section: knowledgeSection,
        parentId: z.string().nullable(),
        type: nodeType,
        title: z.string().min(1).max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.user.id;

      // Nested nodes always inherit their parent's section; only root-level
      // nodes take the section from the input.
      let section: string = input.section;

      if (input.parentId) {
        const parent = await prisma.node.findFirst({
          where: { id: input.parentId, userId },
        });
        if (!parent)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Parent not found",
          });
        if (parent.type !== "SPACE")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Pages cannot contain other nodes",
          });
        section = parent.section;
      }

      const [slug, siblingCount] = await Promise.all([
        uniqueSlug({ userId, section, parentId: input.parentId, title: input.title }),
        prisma.node.count({ where: { userId, section, parentId: input.parentId } }),
      ]);

      return await prisma.node.create({
        data: {
          title: input.title,
          slug,
          section,
          type: input.type,
          body: input.type === "PAGE" ? "" : null,
          sortOrder: siblingCount,
          parentId: input.parentId,
          userId,
        },
      });
    }),

  update: ownerProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(200).optional(),
        body: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.user.id;

      const node = await prisma.node.findFirstOrThrow({
        where: { id: input.id, userId },
      });

      const nextTitle = input.title !== undefined && input.title !== node.title ? input.title : undefined;
      const bodyChanged = input.body !== undefined && input.body !== node.body;

      // Nothing actually changed — skip the write so `updatedAt` isn't bumped
      // (e.g. opening the editor and confirming without edits).
      if (nextTitle === undefined && !bodyChanged) return node;

      const slug =
        nextTitle !== undefined
          ? await uniqueSlug({
              userId,
              section: node.section,
              parentId: node.parentId,
              title: nextTitle,
              excludeId: node.id,
            })
          : undefined;

      return await prisma.node.update({
        where: { id: input.id },
        data: {
          ...(nextTitle !== undefined ? { title: nextTitle, slug } : {}),
          ...(bodyChanged ? { body: input.body } : {}),
        },
      });
    }),

  reindex: ownerProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const userId = ctx.auth.user.id;

    await prisma.node.findFirstOrThrow({
      where: { id: input.id, userId },
      select: { id: true },
    });

    // Kick off an on-demand embed. `embedNode` short-circuits on an unchanged
    // content hash, so a redundant reindex only costs a cheap DB touch.
    await inngest.send({ name: "embeddings/embed-node", data: { nodeId: input.id } });

    return { id: input.id };
  }),

  setLocked: ownerProcedure.input(z.object({ id: z.string(), locked: z.boolean() })).mutation(async ({ ctx, input }) => {
    const userId = ctx.auth.user.id;

    await prisma.node.findFirstOrThrow({
      where: { id: input.id, userId },
      select: { id: true },
    });

    return await prisma.node.update({
      where: { id: input.id },
      data: { locked: input.locked },
    });
  }),

  delete: ownerProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const userId = ctx.auth.user.id;

    const node = await prisma.node.findFirst({
      where: { id: input.id, userId },
    });
    if (!node) throw new TRPCError({ code: "NOT_FOUND" });

    await prisma.node.delete({ where: { id: input.id } });

    return node;
  }),

  move: ownerProcedure.input(z.object({ id: z.string(), parentId: z.string().nullable() })).mutation(async ({ ctx, input }) => {
    const userId = ctx.auth.user.id;

    if (input.parentId === input.id)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "A node cannot contain itself",
      });

    const node = await prisma.node.findFirstOrThrow({
      where: { id: input.id, userId },
    });

    if (input.parentId) {
      const target = await prisma.node.findFirst({
        where: { id: input.parentId, userId },
      });
      if (!target)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Destination not found",
        });
      if (target.type !== "SPACE")
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You can only move nodes into a space",
        });
      if (target.section !== node.section)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You can only move nodes within the same section",
        });

      let parentId = target.parentId;
      while (parentId) {
        if (parentId === input.id)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You cannot move a space into its own descendant",
          });
        const parent = await prisma.node.findFirst({
          where: { id: parentId, userId },
        });
        if (!parent) break;
        parentId = parent.parentId;
      }
    }

    const slug = await uniqueSlug({
      userId,
      section: node.section,
      parentId: input.parentId,
      title: node.title,
      excludeId: node.id,
    });

    return await prisma.node.update({
      where: { id: input.id },
      data: { parentId: input.parentId, slug },
    });
  }),

  search: publicProcedure.input(z.object({ section: knowledgeSection.optional(), query: z.string() })).query(async ({ ctx, input }) => {
    if (!ctx.ownerUserId) return [];

    // Non-owners can never match a locked node, anything nested inside a locked
    // node, or a node in a locked section. lockedNodeIds covers the whole locked
    // subtree (locking a folder doesn't cascade the flag to its children).
    const lockedIds = await lockedNodeIds(ctx);
    const lockedSql = ctx.isOwner
      ? Prisma.empty
      : Prisma.sql`AND "section" NOT IN (${Prisma.join([...LOCKED_SECTIONS])})${
          lockedIds.length ? Prisma.sql` AND "id" NOT IN (${Prisma.join(lockedIds)})` : Prisma.empty
        }`;

    // Turn the raw input into a prefix tsquery: strip tsquery operators so user
    // input can't break the syntax, treat each word as a prefix (`:*`) so
    // search-as-you-type matches partial words, and AND the terms together.
    const tsquery = input.query
      .toLowerCase()
      .split(/\s+/)
      .map((term) => term.replace(/[^\p{L}\p{N}]/gu, ""))
      .filter(Boolean)
      .map((term) => `${term}:*`)
      .join(" & ");

    if (!tsquery) return [];

    // ts_headline wraps matched lexemes in these sentinels; the client splits on
    // them to render <mark> spans without injecting raw HTML.
    const titleHeadlineOpts = `StartSel=${HIGHLIGHT_START}, StopSel=${HIGHLIGHT_END}, HighlightAll=TRUE`;
    const snippetHeadlineOpts = `StartSel=${HIGHLIGHT_START}, StopSel=${HIGHLIGHT_END}, MaxFragments=2, MinWords=5, MaxWords=18`;

    // When a section is given (browsing within a hub) its hits rank above the
    // rest; global search (e.g. the dashboard) omits it so all sections compete
    // purely on relevance.
    const sectionBoost = input.section ? Prisma.sql`("section" = ${input.section}) DESC,` : Prisma.empty;

    // Rank against the GIN-indexed generated tsvector. ts_rank_cd rewards
    // proximity/density and title hits outrank body hits via the 'A'/'B' column
    // weights; on top of that we add a recency boost that decays over ~30 days
    // from the last time the note was viewed (falling back to updatedAt), so
    // things you actually use recently float up. ts_headline gives us a
    // highlighted title and a body snippet around the matches.
    const ranked = await prisma.$queryRaw<{ id: string; titleHighlight: string; snippet: string | null }[]>`
      SELECT
        "id",
        ts_headline('english', "title", to_tsquery('english', ${tsquery}), ${titleHeadlineOpts}) AS "titleHighlight",
        ts_headline('english', coalesce("body", ''), to_tsquery('english', ${tsquery}), ${snippetHeadlineOpts}) AS "snippet"
      FROM "Node"
      WHERE "userId" = ${ctx.ownerUserId}
        AND "archivedAt" IS NULL
        ${lockedSql}
        AND "searchVector" @@ to_tsquery('english', ${tsquery})
      ORDER BY
        -- Hits in the section you're currently browsing always rank above the
        -- rest, then relevance (proximity/density + a recency boost) decides the
        -- order within each group.
        ${sectionBoost}
        ts_rank_cd("searchVector", to_tsquery('english', ${tsquery}))
          + 0.3 * exp(-EXTRACT(EPOCH FROM (NOW() - COALESCE("lastViewedAt", "updatedAt"))) / (86400.0 * 30.0)) DESC,
        "updatedAt" DESC
      LIMIT ${SEARCH_LIMIT}
    `;

    if (ranked.length === 0) return [];

    const ids = ranked.map((row) => row.id);

    // Hydrate full nodes (with cover images) and, in parallel, walk each hit's
    // parent chain to the root with a single recursive CTE so we can show its
    // breadcrumb trail (depth 1 = direct parent, higher = further up).
    const [nodes, ancestry] = await Promise.all([
      prisma.node.findMany({
        where: { id: { in: ids } },
        include: coverInclude,
      }),
      prisma.$queryRaw<{ nodeId: string; ancestorId: string; title: string; depth: number }[]>`
        WITH RECURSIVE ancestry AS (
          SELECT
            child."id" AS "nodeId",
            parent."id" AS "ancestorId",
            parent."title" AS "title",
            parent."parentId" AS "parentId",
            1 AS depth
          FROM "Node" child
          JOIN "Node" parent ON parent."id" = child."parentId"
          WHERE child."id" IN (${Prisma.join(ids)}) AND child."userId" = ${ctx.ownerUserId}
          UNION ALL
          SELECT
            a."nodeId",
            grandparent."id",
            grandparent."title",
            grandparent."parentId",
            a.depth + 1
          FROM ancestry a
          JOIN "Node" grandparent ON grandparent."id" = a."parentId"
        )
        SELECT "nodeId", "ancestorId", "title", depth
        FROM ancestry
        ORDER BY "nodeId", depth DESC
      `,
    ]);

    // Group ancestors per node. The query is ordered root-first (depth DESC), so
    // each list reads top-of-tree → direct parent.
    const breadcrumbs = new Map<string, { id: string; title: string }[]>();
    for (const row of ancestry) {
      const trail = breadcrumbs.get(row.nodeId) ?? [];
      trail.push({ id: row.ancestorId, title: row.title });
      breadcrumbs.set(row.nodeId, trail);
    }

    const byId = new Map(nodes.map((node) => [node.id, node]));

    return ranked
      .map((row) => {
        const node = byId.get(row.id);
        if (!node) return undefined;
        const snippet = row.snippet?.trim() ? row.snippet : null;
        return {
          ...node,
          titleHighlight: row.titleHighlight,
          snippet,
          breadcrumb: breadcrumbs.get(row.id) ?? [],
        };
      })
      .filter((row) => row !== undefined);
  }),

  createImageUploadUrl: ownerProcedure
    .input(z.object({ nodeId: z.string(), contentType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.user.id;

      if (!(input.contentType in IMAGE_EXTENSIONS)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Unsupported image type",
        });
      }

      await prisma.node.findFirstOrThrow({
        where: { id: input.nodeId, userId },
        select: { id: true },
      });

      const key = buildImageKey({
        userId,
        nodeId: input.nodeId,
        contentType: input.contentType,
      });
      let uploadUrl = null;
      try {
        uploadUrl = (await getPresignedUploadUrl({
          key,
          contentType: input.contentType,
        })) as string;
      } catch (error) {
        console.error(error);
        uploadUrl = null;
      }

      return { uploadUrl, key, publicUrl: getPublicUrl(key) };
    }),

  attachImage: ownerProcedure
    .input(
      z.object({
        nodeId: z.string(),
        storageKey: z.string(),
        filename: z.string().optional(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.user.id;

      await prisma.node.findFirstOrThrow({
        where: { id: input.nodeId, userId },
        select: { id: true },
      });

      if (!input.storageKey.startsWith(`nodes/${userId}/${input.nodeId}/`)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid storage key",
        });
      }

      // One cover per node: remove any previous images (rows + objects) first.
      const existing = await prisma.nodeImage.findMany({
        where: { nodeId: input.nodeId },
      });
      await Promise.all(existing.map((image) => deleteObject(image.storageKey).catch(() => undefined)));
      if (existing.length > 0) await prisma.nodeImage.deleteMany({ where: { nodeId: input.nodeId } });

      const image = await prisma.nodeImage.create({
        data: {
          nodeId: input.nodeId,
          url: getPublicUrl(input.storageKey),
          storageKey: input.storageKey,
          filename: input.filename,
          width: input.width,
          height: input.height,
        },
      });

      await prisma.node.update({
        where: { id: input.nodeId },
        data: { updatedAt: new Date() },
      });

      return image;
    }),

  removeImage: ownerProcedure.input(z.object({ nodeId: z.string() })).mutation(async ({ ctx, input }) => {
    const userId = ctx.auth.user.id;

    await prisma.node.findFirstOrThrow({
      where: { id: input.nodeId, userId },
      select: { id: true },
    });

    const existing = await prisma.nodeImage.findMany({
      where: { nodeId: input.nodeId },
    });
    await Promise.all(existing.map((image) => deleteObject(image.storageKey).catch(() => undefined)));
    await prisma.nodeImage.deleteMany({ where: { nodeId: input.nodeId } });

    await prisma.node.update({
      where: { id: input.nodeId },
      data: { updatedAt: new Date() },
    });

    return { nodeId: input.nodeId };
  }),

  polishMarkdown: ownerProcedure.input(z.object({ text: z.string().min(1).max(FORMAT_MAX_CHARS) })).mutation(async ({ ctx, input }) => {
    // Flush the trace once the response is on its way (serverless-safe).
    after(() => langfuseSpanProcessor.forceFlush());

    return startActiveObservation(
      "polish-markdown",
      () =>
        propagateAttributes({ userId: ctx.auth.user.id, tags: ["format-note"] }, async () => {
          updateActiveObservation({ input: input.text });
          try {
            // generateObject forces a schema-shaped response, so we always get back
            // the formatted document in a known field — no stray commentary or
            // wrapping fences to strip.
            const { object } = await generateObject({
              model: openai(FORMAT_MODEL),
              schema: z.object({
                markdown: z.string().describe("The reformatted GitHub-Flavored Markdown document."),
              }),
              system: FORMAT_SYSTEM_PROMPT,
              prompt: input.text,
              temperature: 0.2,
              maxOutputTokens: 8192,
              experimental_telemetry: { isEnabled: true, functionId: "polish-markdown" },
            });

            updateActiveObservation({ output: object.markdown });
            return { markdown: object.markdown };
          } catch (error) {
            console.error("polishMarkdown failed", error);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Could not format the note. Please try again.",
            });
          }
        }),
      { asType: "span" },
    );
  }),
});
