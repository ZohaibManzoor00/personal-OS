import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { parseAsString } from "nuqs/server";
import { toast } from "sonner";
import type { Node as KnowledgeNode } from "@/generated/prisma/client";
import { useTRPC } from "@/trpc/client";

export const knowledgeParams = {
  search: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
};

export const useKnowledgeParams = () => {
  return useQueryStates(knowledgeParams);
};

export const useListChildren = (parentId: string | null) => {
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.knowledge.listChildren.queryOptions({ parentId }),
  );
};

export const useKnowledgeNode = (id: string) => {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.knowledge.get.queryOptions({ id }));
};

export const useAncestors = (id: string) => {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.knowledge.getAncestors.queryOptions({ id }));
};

export const useSpaces = (enabled = true) => {
  const trpc = useTRPC();
  return useQuery(
    trpc.knowledge.listSpaces.queryOptions(undefined, { enabled }),
  );
};

export const useKnowledgeSearch = (query: string) => {
  const trpc = useTRPC();
  return useQuery(
    trpc.knowledge.search.queryOptions(
      { query },
      { enabled: query.trim().length > 0 },
    ),
  );
};

export const useCreateNode = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.knowledge.create.mutationOptions({
      onSuccess: (data) => {
        toast.success(
          `${data.type === "SPACE" ? "Space" : "Page"} "${data.title}" created`,
        );
        queryClient.invalidateQueries(
          trpc.knowledge.listChildren.queryFilter({ parentId: data.parentId }),
        );
        queryClient.invalidateQueries(trpc.knowledge.listSpaces.queryFilter());
      },
      onError: (error) => {
        toast.error(`Failed to create: ${error.message}`);
      },
    }),
  );
};

export const useUpdateNode = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.knowledge.update.mutationOptions({
      onMutate: async (variables) => {
        if (variables.title === undefined) return;

        const key = trpc.knowledge.get.queryKey({ id: variables.id });
        await queryClient.cancelQueries({ queryKey: key });
        const previous = queryClient.getQueryData<KnowledgeNode>(key);

        if (previous) {
          queryClient.setQueryData<KnowledgeNode>(key, {
            ...previous,
            title: variables.title,
          });
        }

        return { previous };
      },
      onError: (error, variables, context) => {
        if (context?.previous) {
          queryClient.setQueryData(
            trpc.knowledge.get.queryKey({ id: variables.id }),
            context.previous,
          );
        }
        toast.error(`Failed to save: ${error.message}`);
      },
      onSuccess: (_data, variables) => {
        if (variables.title !== undefined) toast.success("Renamed");
      },
      onSettled: (data) => {
        if (!data) return;
        queryClient.invalidateQueries(
          trpc.knowledge.get.queryFilter({ id: data.id }),
        );
        queryClient.invalidateQueries(
          trpc.knowledge.getAncestors.queryFilter({ id: data.id }),
        );
        queryClient.invalidateQueries(
          trpc.knowledge.listChildren.queryFilter({ parentId: data.parentId }),
        );
        queryClient.invalidateQueries(trpc.knowledge.listSpaces.queryFilter());
      },
    }),
  );
};

export const useDeleteNode = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.knowledge.delete.mutationOptions({
      onMutate: async (variables) => {
        const previous = new Map<
          readonly unknown[],
          KnowledgeNode[] | undefined
        >();

        const filter = trpc.knowledge.listChildren.queryFilter();
        await queryClient.cancelQueries(filter);

        for (const [key, data] of queryClient.getQueriesData<KnowledgeNode[]>(
          filter,
        )) {
          if (data?.some((node) => node.id === variables.id)) {
            previous.set(key, data);
            queryClient.setQueryData<KnowledgeNode[]>(
              key,
              data.filter((node) => node.id !== variables.id),
            );
          }
        }

        return { previous };
      },
      onError: (error, _variables, context) => {
        context?.previous.forEach((data, key) => {
          queryClient.setQueryData(key, data);
        });
        toast.error(`Failed to delete: ${error.message}`);
      },
      onSuccess: () => {
        toast.success("Deleted");
      },
      onSettled: (data) => {
        queryClient.invalidateQueries(
          trpc.knowledge.listChildren.queryFilter(),
        );
        queryClient.invalidateQueries(trpc.knowledge.listSpaces.queryFilter());
        if (data)
          queryClient.removeQueries(
            trpc.knowledge.get.queryFilter({ id: data.id }),
          );
      },
    }),
  );
};

export const useMoveNode = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.knowledge.move.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Moved "${data.title}"`);
        queryClient.invalidateQueries(
          trpc.knowledge.listChildren.queryFilter(),
        );
        queryClient.invalidateQueries(
          trpc.knowledge.getAncestors.queryFilter({ id: data.id }),
        );
        queryClient.invalidateQueries(trpc.knowledge.listSpaces.queryFilter());
      },
      onError: (error) => {
        toast.error(`Failed to move: ${error.message}`);
      },
    }),
  );
};
