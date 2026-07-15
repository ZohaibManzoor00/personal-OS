import { GenericContainer } from "@/components/generic-container";
import { RouteCover } from "@/features/route-cover/components/route-cover";
import { prefetchRouteCover } from "@/features/route-cover/server/prefetch";
import { requireAuth } from "@/lib/auth-utils";
import { HydrateClient } from "@/trpc/server";

export default async function DashboardPage() {
  await requireAuth();
  await prefetchRouteCover("dashboard");
  return (
    <HydrateClient>
      <GenericContainer
        cover={
          <RouteCover
            route="dashboard"
            title="Dashboard"
            description="Create and manage your dashboard"
          />
        }
      >
        <div>This is where the content will go</div>
      </GenericContainer>
    </HydrateClient>
  );
}
