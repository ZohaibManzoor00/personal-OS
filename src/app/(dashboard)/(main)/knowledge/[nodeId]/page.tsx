import { notFound } from "next/navigation";
import { GenericContainer } from "@/components/generic-container";
import { KnowledgePageView } from "@/features/knowledge/components/knowledge-page-view";
import { KnowledgeSpaceView } from "@/features/knowledge/components/knowledge-space-view";
import {
  prefetchAncestors,
  prefetchChildren,
} from "@/features/knowledge/server/prefetch";
import { requireAuth } from "@/lib/auth-utils";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

interface Props {
  params: Promise<{ nodeId: string }>;
}

export default async function KnowledgeNodePage({ params }: Props) {
  await requireAuth();
  const { nodeId } = await params;

  const queryClient = getQueryClient();
  const node = await queryClient
    .fetchQuery(trpc.knowledge.get.queryOptions({ id: nodeId }))
    .catch(() => null);

  if (!node) notFound();

  prefetchAncestors(nodeId);
  if (node.type === "SPACE") prefetchChildren(nodeId);

  return (
    <GenericContainer>
      <HydrateClient>
        {node.type === "SPACE" ? (
          <KnowledgeSpaceView nodeId={nodeId} />
        ) : (
          <KnowledgePageView nodeId={nodeId} />
        )}
      </HydrateClient>
    </GenericContainer>
  );
}
