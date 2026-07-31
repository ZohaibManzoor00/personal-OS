import { prefetch, trpc } from "@/trpc/server";

export const prefetchDashboard = () => {
  prefetch(trpc.dashboard.stats.queryOptions());
  prefetch(trpc.dashboard.recentAll.queryOptions());
  // Warm both orderings so toggling Edited/Added is instant.
  prefetch(
    trpc.dashboard.recentPagesPerSection.queryOptions({ sort: "edited" }),
  );
  prefetch(
    trpc.dashboard.recentPagesPerSection.queryOptions({ sort: "added" }),
  );
};
