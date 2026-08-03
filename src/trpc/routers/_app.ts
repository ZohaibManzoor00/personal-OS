import { chatRouter } from "@/features/chat/server/router";
import { dashboardRouter } from "@/features/dashboard/server/router";
import { diagramRouter } from "@/features/diagram/server/router";
import { drawRouter } from "@/features/draw/server/router";
import { knowledgeRouter } from "@/features/knowledge/server/router";
import { routeCoverRouter } from "@/features/route-cover/server/router";
import { createTRPCRouter } from "@/trpc/init";

export const appRouter = createTRPCRouter({
  chat: chatRouter,
  dashboard: dashboardRouter,
  diagram: diagramRouter,
  draw: drawRouter,
  knowledge: knowledgeRouter,
  routeCover: routeCoverRouter,
});

export type AppRouter = typeof appRouter;
