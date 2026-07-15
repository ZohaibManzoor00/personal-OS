import { GenericContainer } from "@/components/generic-container";
import {
  DashboardCoverContent,
  DashboardSectionsPanel,
} from "@/features/dashboard/components/dashboard-overview";
import { prefetchDashboard } from "@/features/dashboard/server/prefetch";
import {
  GlobalSearch,
  GlobalSearchContent,
} from "@/features/knowledge/components/global-search";
import { RouteCover } from "@/features/route-cover/components/route-cover";
import { prefetchRouteCover } from "@/features/route-cover/server/prefetch";
import { HydrateClient } from "@/trpc/server";

export default async function DashboardPage() {
  await prefetchRouteCover("dashboard");
  prefetchDashboard();
  return (
    <HydrateClient>
      <GlobalSearch />
      <GenericContainer
        cover={
          <RouteCover
            route="dashboard"
            title="Welcome back, Zo 👋"
            description=""
          >
            <DashboardCoverContent />
          </RouteCover>
        }
      >
        <GlobalSearchContent>
          <DashboardSectionsPanel />
        </GlobalSearchContent>
      </GenericContainer>
    </HydrateClient>
  );
}
