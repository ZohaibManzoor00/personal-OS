import { getQueryClient, trpc } from "@/trpc/server";
import type { RouteCoverKey } from "../lib/routes";

export const prefetchRouteCover = (route: RouteCoverKey) => {
  return getQueryClient().prefetchQuery(
    trpc.routeCover.get.queryOptions({ route }),
  );
};
