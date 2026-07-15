import { prefetch, trpc } from "@/trpc/server";

export const prefetchDashboard = () => {
  prefetch(trpc.dashboard.stats.queryOptions());
  prefetch(trpc.dashboard.recentAll.queryOptions());
  prefetch(trpc.dashboard.recentPerSection.queryOptions());
};
