import {
  getKnowledgeSectionConfig,
  KNOWLEDGE_SECTIONS,
  type KnowledgeSection,
  LOCKED_SECTIONS,
} from "@/features/knowledge/lib/sections";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createTRPCRouter, publicProcedure } from "@/trpc/init";

const RECENT_ALL_LIMIT = 3;
const RECENT_PER_SECTION_LIMIT = 3;

const coverInclude = {
  images: { orderBy: { createdAt: "desc" }, take: 1 },
} as const;

const EMPTY_STATS = { pages: 0, spaces: 0, addedThisWeek: 0, editedThisWeek: 0, words: 0 };

type ReaderCtx = { ownerUserId: string | null; isOwner: boolean };

/** Raw-SQL fragment hiding locked nodes/sections from non-owners. */
const lockedSql = (ctx: ReaderCtx) =>
  ctx.isOwner ? Prisma.empty : Prisma.sql`AND "locked" = false AND "section" NOT IN (${Prisma.join([...LOCKED_SECTIONS])})`;

/** Prisma `where` fragment hiding locked nodes/sections from non-owners. */
const lockedWhere = (ctx: ReaderCtx) => (ctx.isOwner ? {} : { locked: false, section: { notIn: [...LOCKED_SECTIONS] } });

export const dashboardRouter = createTRPCRouter({
  /**
   * Headline counts for the dashboard stat cards, computed in a single pass with
   * conditional aggregates. Everything is cast to `int` so it comes back as a JS
   * number (raw `count`/`sum` would otherwise be a BigInt).
   */
  stats: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.ownerUserId) return EMPTY_STATS;

    const [row] = await prisma.$queryRaw<
      {
        pages: number;
        spaces: number;
        addedThisWeek: number;
        editedThisWeek: number;
        words: number;
      }[]
    >`
      SELECT
        count(*) FILTER (WHERE "type" = 'PAGE')::int AS "pages",
        count(*) FILTER (WHERE "type" = 'SPACE')::int AS "spaces",
        count(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '7 days')::int AS "addedThisWeek",
        count(*) FILTER (WHERE "updatedAt" >= NOW() - INTERVAL '7 days')::int AS "editedThisWeek",
        COALESCE(
          SUM(array_length(regexp_split_to_array(trim("body"), E'\\s+'), 1))
            FILTER (WHERE COALESCE(trim("body"), '') <> ''),
          0
        )::int AS "words"
      FROM "Node"
      WHERE "userId" = ${ctx.ownerUserId} AND "archivedAt" IS NULL
        ${lockedSql(ctx)}
    `;

    return row ?? EMPTY_STATS;
  }),

  /** Most recently viewed nodes across every section — the "jump back in" row. */
  recentAll: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.ownerUserId) return [];
    return await prisma.node.findMany({
      where: {
        userId: ctx.ownerUserId,
        archivedAt: null,
        lastViewedAt: { not: null },
        ...lockedWhere(ctx),
      },
      orderBy: { lastViewedAt: "desc" },
      take: RECENT_ALL_LIMIT,
      include: coverInclude,
    });
  }),

  /**
   * Top few recent nodes per section. Ranks by last-viewed, falling back to
   * last-updated so a section that hasn't been opened yet still shows its newest
   * work instead of being empty. Sections with no nodes at all are omitted.
   */
  recentPerSection: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.ownerUserId) return [];

    const ranked = await prisma.$queryRaw<
      { id: string; section: string; rn: number }[]
    >`
      SELECT "id", "section", "rn" FROM (
        SELECT
          "id",
          "section",
          row_number() OVER (
            PARTITION BY "section"
            ORDER BY COALESCE("lastViewedAt", "updatedAt") DESC
          )::int AS "rn"
        FROM "Node"
        WHERE "userId" = ${ctx.ownerUserId} AND "archivedAt" IS NULL
          ${lockedSql(ctx)}
      ) ranked
      WHERE "rn" <= ${RECENT_PER_SECTION_LIMIT}
    `;

    if (ranked.length === 0) return [];

    const [nodes, covers] = await Promise.all([
      prisma.node.findMany({
        where: { id: { in: ranked.map((r) => r.id) } },
        include: coverInclude,
      }),
      // The banner behind each section card reuses that section's route cover.
      prisma.routeCover.findMany({
        where: { userId: ctx.ownerUserId },
        select: { route: true, url: true },
      }),
    ]);

    const byId = new Map(nodes.map((node) => [node.id, node]));
    const rankById = new Map(ranked.map((r) => [r.id, r.rn]));
    const coverByRoute = new Map(
      covers.map((cover) => [cover.route, cover.url]),
    );

    // Preserve the section order defined in KNOWLEDGE_SECTIONS and the rank order
    // within each section.
    return KNOWLEDGE_SECTIONS.map((section) => {
      const sectionNodes = ranked
        .filter((r) => r.section === section)
        .map((r) => byId.get(r.id))
        .filter((node) => node !== undefined)
        .sort((a, b) => (rankById.get(a.id) ?? 0) - (rankById.get(b.id) ?? 0));

      return {
        section: section as KnowledgeSection,
        coverUrl:
          coverByRoute.get(getKnowledgeSectionConfig(section).coverRoute) ??
          null,
        nodes: sectionNodes,
      };
    }).filter((group) => group.nodes.length > 0);
  }),
});
