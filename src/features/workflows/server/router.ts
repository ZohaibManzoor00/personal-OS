import { prisma } from "@/lib/db";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { generateSlug } from "random-word-slugs";
import z from "zod";
import { PAGINATION } from "../hooks/use-workflows";

export const workflowsRouter = createTRPCRouter({
  execute: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input, ctx }) => {
    const workflow = await prisma.workflow.findUniqueOrThrow({ where: { id: input.id, userId: ctx.auth.user.id } });
    // await sendWorkflowExecution({ workflowId: input.id });
    return workflow;
  }),

  create: protectedProcedure.mutation(async ({ ctx }) => {
    return await prisma.workflow.create({ data: { name: generateSlug(3), userId: ctx.auth.user.id } });
  }),

  remove: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    return await prisma.workflow.delete({ where: { id: input.id, userId: ctx.auth.user.id } });
  }),

  //   update: protectedProcedure
  //     .input(
  //       z.object({
  //         id: z.string(),
  //         nodes: z.array(
  //           z.object({
  //             id: z.string(),
  //             type: z.string().nullish(),
  //             position: z.object({ x: z.number(), y: z.number() }),
  //             data: z.record(z.string(), z.any()).optional(),
  //           }),
  //         ),
  //         edges: z.array(
  //           z.object({
  //             source: z.string(),
  //             target: z.string(),
  //             sourceHandle: z.string().nullish(),
  //             targetHandle: z.string().nullish(),
  //           }),
  //         ),
  //       }),
  //     )
  //     .mutation(async ({ ctx, input }) => {
  //       const { id, nodes, edges } = input;

  //       const workflow = await prisma.workflow.findUniqueOrThrow({ where: { id, userId: ctx.auth.user.id } });

  //       return await prisma.$transaction(async (tx) => {
  //         await tx.node.deleteMany({
  //           where: { workflowId: id },
  //         });

  //         // Create nodes
  //         await tx.node.createMany({
  //           data: nodes.map((node) => ({
  //             id: node.id,
  //             workflowId: id,
  //             name: node.type || "unknown",
  //             type: node.type as NodeType,
  //             position: node.position,
  //             data: node.data || {},
  //           })),
  //         });

  //         // Create connections
  //         await tx.connection.createMany({
  //           data: edges.map((edge) => ({
  //             workflowId: id,
  //             fromNodeId: edge.source,
  //             toNodeId: edge.target,
  //             fromOutput: edge.sourceHandle || "main",
  //             toInput: edge.targetHandle || "main",
  //           })),
  //         });

  //         // Update workflow's updateAt timestamp
  //         await tx.workflow.update({
  //           where: { id },
  //           data: { updatedAt: new Date() },
  //         });

  //         return workflow;
  //       });
  //     }),

  updateName: protectedProcedure.input(z.object({ id: z.string(), name: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    return await prisma.workflow.update({ where: { id: input.id, userId: ctx.auth.user.id }, data: { name: input.name } });
  }),

  getOne: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return await prisma.workflow.findUnique({ where: { id: input.id, userId: ctx.auth.user.id } });
  }),

  getMany: protectedProcedure
    .input(
      z.object({
        page: z.number().default(PAGINATION.DEFAULT_PAGE),
        pageSize: z.number().min(PAGINATION.MIN_PAGE_SIZE).max(PAGINATION.MAX_PAGE_SIZE).default(PAGINATION.DEFAULT_PAGE_SIZE),
        search: z.string().default(""),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search } = input;

      const [items, totalCount] = await Promise.all([
        prisma.workflow.findMany({
          skip: (page - 1) * pageSize,
          take: pageSize,
          where: {
            userId: ctx.auth.user.id,
            name: { contains: search, mode: "insensitive" },
          },
          orderBy: { updatedAt: "desc" },
        }),
        prisma.workflow.count({
          where: {
            userId: ctx.auth.user.id,
            name: { contains: search, mode: "insensitive" },
          },
        }),
      ]);

      const totalPages = Math.ceil(totalCount / pageSize);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return {
        items,
        page,
        pageSize,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      };
    }),
});
