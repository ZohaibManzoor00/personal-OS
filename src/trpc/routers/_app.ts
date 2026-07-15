import { dashboardRouter } from "@/features/dashboard/server/router";
import { knowledgeRouter } from "@/features/knowledge/server/router";
import { routeCoverRouter } from "@/features/route-cover/server/router";
import { createTRPCRouter } from "@/trpc/init";

export const appRouter = createTRPCRouter({
  dashboard: dashboardRouter,
  knowledge: knowledgeRouter,
  routeCover: routeCoverRouter,
});

export type AppRouter = typeof appRouter;
