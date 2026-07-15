import { knowledgeRouter } from "@/features/knowledge/server/router";
import { routeCoverRouter } from "@/features/route-cover/server/router";
import { createTRPCRouter } from "@/trpc/init";

export const appRouter = createTRPCRouter({
  knowledge: knowledgeRouter,
  routeCover: routeCoverRouter,
});

export type AppRouter = typeof appRouter;
