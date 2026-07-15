import { KnowledgeRootView } from "@/features/knowledge/components/knowledge-root-view";
import {
  prefetchChildren,
  prefetchRecent,
} from "@/features/knowledge/server/prefetch";
import { prefetchRouteCover } from "@/features/route-cover/server/prefetch";
import { requireAuth } from "@/lib/auth-utils";
import { HydrateClient } from "@/trpc/server";

export default async function KnowledgePage() {
  await requireAuth();

  prefetchChildren(null);
  prefetchRecent();
  await prefetchRouteCover("knowledge");

  return (
    <HydrateClient>
      <KnowledgeRootView />
    </HydrateClient>
  );
}
