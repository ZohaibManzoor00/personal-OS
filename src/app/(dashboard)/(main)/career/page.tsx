import { GenericContainer } from "@/components/generic-container";
import { RouteCover } from "@/features/route-cover/components/route-cover";
import { requireAuth } from "@/lib/auth-utils";

export default async function CareerPage() {
  await requireAuth();
  return (
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
  );
}
