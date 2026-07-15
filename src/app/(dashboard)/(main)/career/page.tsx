import { GenericContainer } from "@/components/generic-container";
import { RouteCover } from "@/features/route-cover/components/route-cover";
import { prefetchRouteCover } from "@/features/route-cover/server/prefetch";
import { requireAuth } from "@/lib/auth-utils";
import { HydrateClient } from "@/trpc/server";

export default async function CareerPage() {
  await requireAuth();
  await prefetchRouteCover("career");
  return (
    <HydrateClient>
      <GenericContainer
        cover={
          <RouteCover
            route="career"
            title="Career"
            description="Create and manage your career"
          />
        }
      >
        <div>This is where the content will go</div>
      </GenericContainer>
    </HydrateClient>
  );
}
