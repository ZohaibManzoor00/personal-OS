import { TRPCError } from "@trpc/server";
import z from "zod";
import { prisma } from "@/lib/db";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { slugify } from "../lib/slug";

const SEARCH_LIMIT = 20;

const nodeType = z.enum(["SPACE", "PAGE"]);

// Slugs are unique per (userId, parentId). Append a numeric suffix on collision.
const uniqueSlug = async ({
  userId,
  parentId,
  title,
  excludeId,
}: {
  userId: string;
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
    .input(z.object({ parentId: z.string().nullable() }))
    .query(async ({ ctx, input }) => {
      return await prisma.node.findMany({
        where: {
          userId: ctx.auth.user.id,
          parentId: input.parentId,
          archivedAt: null,
        },
        orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return await prisma.node.findFirstOrThrow({
        where: { id: input.id, userId: ctx.auth.user.id },
      });
    }),

  listSpaces: protectedProcedure.query(async ({ ctx }) => {
    return await prisma.node.findMany({
      where: { userId: ctx.auth.user.id, type: "SPACE", archivedAt: null },
      orderBy: { title: "asc" },
    });
  }),

  getAncestors: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
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
        parentId: z.string().nullable(),
        type: nodeType,
        title: z.string().min(1).max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.user.id;

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
      }

      const [slug, siblingCount] = await Promise.all([
        uniqueSlug({ userId, parentId: input.parentId, title: input.title }),
        prisma.node.count({ where: { userId, parentId: input.parentId } }),
      ]);

      return await prisma.node.create({
        data: {
          title: input.title,
          slug,
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

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.user.id;

      const node = await prisma.node.findFirst({
        where: { id: input.id, userId },
      });
      if (!node) throw new TRPCError({ code: "NOT_FOUND" });

      await prisma.node.delete({ where: { id: input.id } });

      return node;
    }),

  move: protectedProcedure
    .input(z.object({ id: z.string(), parentId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
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
        parentId: input.parentId,
        title: node.title,
        excludeId: node.id,
      });

      return await prisma.node.update({
        where: { id: input.id },
        data: { parentId: input.parentId, slug },
      });
    }),

  search: protectedProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ ctx, input }) => {
      const query = input.query.trim();
      if (!query) return [];

      return await prisma.node.findMany({
        where: {
          userId: ctx.auth.user.id,
          title: { contains: query, mode: "insensitive" },
          archivedAt: null,
        },
        orderBy: { updatedAt: "desc" },
        take: SEARCH_LIMIT,
      });
    }),
});
