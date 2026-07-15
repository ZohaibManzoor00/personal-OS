import { notFound } from "next/navigation";
import { GenericContainer } from "@/components/generic-container";
import { prefetchRouteCover } from "@/features/route-cover/server/prefetch";
import { getIsOwner } from "@/lib/auth-utils";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { KnowledgePageView } from "../components/knowledge-page-view";
import { KnowledgeRootView } from "../components/knowledge-root-view";
import { KnowledgeSectionProvider } from "../components/knowledge-section-context";
import { KnowledgeSpaceView } from "../components/knowledge-space-view";
import { getKnowledgeSectionConfig, isSectionLocked, type KnowledgeSection } from "../lib/sections";
import { prefetchAncestors, prefetchChildren, prefetchRecent } from "./prefetch";

/**
 * Root (collection) page for a knowledge section. Every route that reuses the
 * Learnings UI renders this with its own `section` — the only thing that
 * differs between routes.
 */
export const KnowledgeSectionRootPage = async ({ section }: { section: KnowledgeSection }) => {
  // Locked (personal) sections are unavailable to everyone but the owner.
  if (isSectionLocked(section) && !(await getIsOwner())) notFound();

  const config = getKnowledgeSectionConfig(section);

  prefetchChildren(section, null);
  prefetchRecent(section);
  await prefetchRouteCover(config.coverRoute);

  return (
    <HydrateClient>
      <KnowledgeSectionProvider config={config}>
        <KnowledgeRootView />
      </KnowledgeSectionProvider>
    </HydrateClient>
  );
};

/**
 * Node (space or page) page for a knowledge section, i.e. `/[section]/[nodeId]`.
 * Guards against cross-section access so a node only resolves under its own
 * route.
 */
export const KnowledgeSectionNodePage = async ({ section, nodeId }: { section: KnowledgeSection; nodeId: string }) => {
  if (isSectionLocked(section) && !(await getIsOwner())) notFound();

  const config = getKnowledgeSectionConfig(section);

  const queryClient = getQueryClient();
  const node = await queryClient.fetchQuery(trpc.knowledge.get.queryOptions({ id: nodeId })).catch(() => null);

  if (!node || node.section !== section) notFound();

  prefetchAncestors(nodeId);
  if (node.type === "SPACE") prefetchChildren(section, nodeId);

  return (
    <GenericContainer>
      <HydrateClient>
        <KnowledgeSectionProvider config={config}>
          {node.type === "SPACE" ? <KnowledgeSpaceView nodeId={nodeId} /> : <KnowledgePageView nodeId={nodeId} />}
        </KnowledgeSectionProvider>
      </HydrateClient>
    </GenericContainer>
  );
};
