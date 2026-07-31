import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers/_app";

type RouterOutput = inferRouterOutputs<AppRouter>;

export type DashboardStats = RouterOutput["dashboard"]["stats"];

/** A recently-touched node (with its cover image) shown in the dashboard rows. */
export type DashboardRecentNode =
  RouterOutput["dashboard"]["recentAll"][number];

/** Recent pages grouped under a single section, for the carousels. */
export type DashboardRecentPagesGroup =
  RouterOutput["dashboard"]["recentPagesPerSection"][number];

/** Force-directed graph payload: section hubs + nodes, plus parent→child links. */
export type DashboardGraph = RouterOutput["dashboard"]["graph"];
export type DashboardGraphNode = DashboardGraph["nodes"][number];
export type DashboardGraphLink = DashboardGraph["links"][number];
