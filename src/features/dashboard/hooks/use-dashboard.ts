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

export const useDashboardRecentPerSection = () => {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.dashboard.recentPerSection.queryOptions());
};
