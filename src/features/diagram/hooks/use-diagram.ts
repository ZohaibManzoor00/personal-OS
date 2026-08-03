"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";

/** Load a single embedded diagram's scene by id. */
export const useDiagram = (id: string) => {
  const trpc = useTRPC();
  return useQuery(trpc.diagram.get.queryOptions({ id }));
};

/** Create a diagram (optionally tied to a page) and return its row, incl. id. */
export const useCreateDiagram = () => {
  const trpc = useTRPC();
  return useMutation(
    trpc.diagram.create.mutationOptions({
      onError: (error) =>
        toast.error(`Failed to create diagram: ${error.message}`),
    }),
  );
};

/** Persist ("Save") a diagram's current scene, refreshing its cached copy. */
export const useSaveDiagram = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.diagram.save.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries(
          trpc.diagram.get.queryFilter({ id: variables.id }),
        );
        toast.success("Diagram saved");
      },
      onError: (error) => toast.error(`Failed to save: ${error.message}`),
    }),
  );
};
