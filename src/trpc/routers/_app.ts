import { knowledgeRouter } from "@/features/knowledge/server/router";
import { createTRPCRouter } from "@/trpc/init";

export const appRouter = createTRPCRouter({
  knowledge: knowledgeRouter,
});

export type AppRouter = typeof appRouter;
