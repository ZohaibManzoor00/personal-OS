import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export const useDashboardStats = () => {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.dashboard.stats.queryOptions());
};

export const useDashboardRecentAll = () => {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.dashboard.recentAll.queryOptions());
};

export type RecentSort = "edited" | "added";

export const useDashboardRecentPagesPerSection = (sort: RecentSort) => {
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.dashboard.recentPagesPerSection.queryOptions({ sort }),
  );
};

export const useDashboardGraph = () => {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.dashboard.graph.queryOptions());
};
