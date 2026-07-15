import { openai } from "@ai-sdk/openai";
import { TRPCError } from "@trpc/server";
import { generateObject } from "ai";
import z from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { deleteObject, getPresignedUploadUrl, getPublicUrl } from "@/lib/r2";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { HIGHLIGHT_END, HIGHLIGHT_START } from "../lib/search-highlight";
import { KNOWLEDGE_SECTIONS } from "../lib/sections";
import { slugify } from "../lib/slug";

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

export const knowledgeRouter = createTRPCRouter({
  listChildren: protectedProcedure
    .input(z.object({ section: knowledgeSection, parentId: z.string().nullable() }))
    .query(async ({ ctx, input }) => {
      return await prisma.node.findMany({
        where: {
          userId: ctx.auth.user.id,
          section: input.section,
          parentId: input.parentId,
          archivedAt: null,
        },
        orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
        include: coverInclude,
      });
    }),

  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return await prisma.node.findFirstOrThrow({
      where: { id: input.id, userId: ctx.auth.user.id },
      include: coverInclude,
    });
  }),

  listSpaces: protectedProcedure.input(z.object({ section: knowledgeSection })).query(async ({ ctx, input }) => {
    return await prisma.node.findMany({
      where: { userId: ctx.auth.user.id, section: input.section, type: "SPACE", archivedAt: null },
      orderBy: { title: "asc" },
    });
  }),

  listTree: protectedProcedure.input(z.object({ section: knowledgeSection })).query(async ({ ctx, input }) => {
    return await prisma.node.findMany({
      where: { userId: ctx.auth.user.id, section: input.section, archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      select: { id: true, title: true, type: true, parentId: true },
    });
  }),

  listRecent: protectedProcedure.input(z.object({ section: knowledgeSection })).query(async ({ ctx, input }) => {
    return await prisma.node.findMany({
      where: {
        userId: ctx.auth.user.id,
        section: input.section,
        archivedAt: null,
        lastViewedAt: { not: null },
      },
      orderBy: { lastViewedAt: "desc" },
      take: RECENT_LIMIT,
      include: coverInclude,
    });
  }),

  recordView: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    // Raw update so we only touch lastViewedAt — a Prisma update would also bump the @updatedAt column.
    await prisma.$executeRaw`
      UPDATE "Node"
      SET "lastViewedAt" = NOW()
      WHERE "id" = ${input.id} AND "userId" = ${ctx.auth.user.id}
    `;

    return { id: input.id };
  }),

  getAncestors: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const userId = ctx.auth.user.id;

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

    return ancestors;
  }),

  create: protectedProcedure
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

  update: protectedProcedure
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

      const slug =
        input.title !== undefined
          ? await uniqueSlug({
              userId,
              section: node.section,
              parentId: node.parentId,
              title: input.title,
              excludeId: node.id,
            })
          : undefined;

      return await prisma.node.update({
        where: { id: input.id },
        data: {
          ...(input.title !== undefined ? { title: input.title, slug } : {}),
          ...(input.body !== undefined ? { body: input.body } : {}),
        },
      });
    }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const userId = ctx.auth.user.id;

    const node = await prisma.node.findFirst({
      where: { id: input.id, userId },
    });
    if (!node) throw new TRPCError({ code: "NOT_FOUND" });

    await prisma.node.delete({ where: { id: input.id } });

    return node;
  }),

  move: protectedProcedure.input(z.object({ id: z.string(), parentId: z.string().nullable() })).mutation(async ({ ctx, input }) => {
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

  search: protectedProcedure.input(z.object({ section: knowledgeSection, query: z.string() })).query(async ({ ctx, input }) => {
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
      WHERE "userId" = ${ctx.auth.user.id}
        AND "archivedAt" IS NULL
        AND "searchVector" @@ to_tsquery('english', ${tsquery})
      ORDER BY
        -- Hits in the section you're currently browsing always rank above the
        -- rest, then relevance (proximity/density + a recency boost) decides the
        -- order within each group.
        ("section" = ${input.section}) DESC,
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
          WHERE child."id" IN (${Prisma.join(ids)}) AND child."userId" = ${ctx.auth.user.id}
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

  createImageUploadUrl: protectedProcedure
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

  attachImage: protectedProcedure
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

  removeImage: protectedProcedure.input(z.object({ nodeId: z.string() })).mutation(async ({ ctx, input }) => {
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

  polishMarkdown: protectedProcedure.input(z.object({ text: z.string().min(1).max(FORMAT_MAX_CHARS) })).mutation(async ({ input }) => {
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
      });

      return { markdown: object.markdown };
    } catch (error) {
      console.error("polishMarkdown failed", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not format the note. Please try again.",
      });
    }
  }),
});
