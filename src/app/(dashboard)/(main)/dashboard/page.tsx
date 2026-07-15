import { GenericContainer } from "@/components/generic-container";
import { GlobalSearch, GlobalSearchContent } from "@/features/knowledge/components/global-search";
import { RouteCover } from "@/features/route-cover/components/route-cover";
import { prefetchRouteCover } from "@/features/route-cover/server/prefetch";
import { requireAuth } from "@/lib/auth-utils";
import { HydrateClient } from "@/trpc/server";

export default async function DashboardPage() {
  await requireAuth();
  await prefetchRouteCover("dashboard");
  return (
    <HydrateClient>
      <GlobalSearch />
      <GenericContainer
        cover={
          <RouteCover
            route="dashboard"
            title="Welcome back, Zo 👋"
            description="Your personal OS"
          />
        }
      >
        <GlobalSearchContent>
          <div></div>
        </GlobalSearchContent>
      </GenericContainer>
    </HydrateClient>
  );
}
