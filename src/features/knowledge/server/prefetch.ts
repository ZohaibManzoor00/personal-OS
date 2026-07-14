import { prefetch, trpc } from "@/trpc/server";

export const prefetchChildren = (parentId: string | null) => {
  return prefetch(trpc.knowledge.listChildren.queryOptions({ parentId }));
};

export const prefetchNode = (id: string) => {
  return prefetch(trpc.knowledge.get.queryOptions({ id }));
};

export const prefetchAncestors = (id: string) => {
  return prefetch(trpc.knowledge.getAncestors.queryOptions({ id }));
};

export const prefetchSpaces = () => {
  return prefetch(trpc.knowledge.listSpaces.queryOptions());
};

export const prefetchRecent = () => {
  return prefetch(trpc.knowledge.listRecent.queryOptions());
};
