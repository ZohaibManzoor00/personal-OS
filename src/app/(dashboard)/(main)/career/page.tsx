import { EntityHeader } from "@/components/entity-component";
import { GenericContainer } from "@/components/generic-container";
import { requireAuth } from "@/lib/auth-utils";

export default async function CareerPage() {
  await requireAuth();
  return (
    <GenericContainer header={<EntityHeader title="Career" description="Create and manage your career" />}>
      <div>This is where the content will go</div>
    </GenericContainer>
  );
}
