import { createTRPCRouter } from "@/trpc/init";
import { workflowsRouter } from "@/features/workflows/server/router";

export const appRouter = createTRPCRouter({
  workflows: workflowsRouter,
});

export type AppRouter = typeof appRouter;
