import { GenericContainer } from "@/components/generic-container";
import { KnowledgeRootView } from "@/features/knowledge/components/knowledge-root-view";
import {
  prefetchChildren,
  prefetchRecent,
} from "@/features/knowledge/server/prefetch";
import { requireAuth } from "@/lib/auth-utils";
import { HydrateClient } from "@/trpc/server";

export default async function KnowledgePage() {
  await requireAuth();

  prefetchChildren(null);
  prefetchRecent();

  return (
    <GenericContainer>
      <HydrateClient>
        <KnowledgeRootView />
      </HydrateClient>
    </GenericContainer>
  );
}
