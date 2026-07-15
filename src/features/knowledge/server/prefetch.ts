import { prefetch, trpc } from "@/trpc/server";
import type { KnowledgeSection } from "../lib/sections";

export const prefetchChildren = (section: KnowledgeSection, parentId: string | null) => {
  return prefetch(trpc.knowledge.listChildren.queryOptions({ section, parentId }));
};

export const prefetchNode = (id: string) => {
  return prefetch(trpc.knowledge.get.queryOptions({ id }));
};

export const prefetchAncestors = (id: string) => {
  return prefetch(trpc.knowledge.getAncestors.queryOptions({ id }));
};

export const prefetchSpaces = (section: KnowledgeSection) => {
  return prefetch(trpc.knowledge.listSpaces.queryOptions({ section }));
};

export const prefetchRecent = (section: KnowledgeSection) => {
  return prefetch(trpc.knowledge.listRecent.queryOptions({ section }));
};
