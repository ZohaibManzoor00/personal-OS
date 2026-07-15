import { GenericContainer } from "@/components/generic-container";
import { RouteCover } from "@/features/route-cover/components/route-cover";
import { requireAuth } from "@/lib/auth-utils";

export default async function DashboardPage() {
  await requireAuth();
  return (
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
  );
}
