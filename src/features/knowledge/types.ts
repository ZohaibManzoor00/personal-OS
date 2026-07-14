import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers/_app";

type RouterOutput = inferRouterOutputs<AppRouter>;

/** A node as returned by list/get — includes the (single) cover image. */
export type KnowledgeNode = RouterOutput["knowledge"]["listChildren"][number];

/** A search hit: a node plus a highlighted title and body snippet. */
export type KnowledgeSearchResult = RouterOutput["knowledge"]["search"][number];

/** A lightweight node (id/title/type/parentId) used to build the folder tree. */
export type KnowledgeTreeNode = RouterOutput["knowledge"]["listTree"][number];

export const getCoverImage = (node: Pick<KnowledgeNode, "images">) =>
  node.images.at(0) ?? null;
