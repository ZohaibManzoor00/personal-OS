import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers/_app";

type RouterOutput = inferRouterOutputs<AppRouter>;

/** A node as returned by list/get/search — includes the (single) cover image. */
export type KnowledgeNode = RouterOutput["knowledge"]["listChildren"][number];

export const getCoverImage = (node: Pick<KnowledgeNode, "images">) =>
  node.images.at(0) ?? null;
