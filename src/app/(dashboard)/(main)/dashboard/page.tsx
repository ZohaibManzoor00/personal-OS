import { EntityHeader } from "@/components/entity-component";
import { GenericContainer } from "@/components/generic-container";
import { requireAuth } from "@/lib/auth-utils";

export default async function DashboardPage() {
  await requireAuth();
  return (
    <GenericContainer header={<EntityHeader title="Dashboard" description="Create and manage your dashboard" />}>
      <div>This is where the content will go</div>
    </GenericContainer>
  );
}
