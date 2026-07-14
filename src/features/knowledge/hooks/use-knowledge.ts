import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { parseAsString } from "nuqs/server";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import type { KnowledgeNode } from "../types";

const readImageDimensions = (file: File) =>
  new Promise<{ width: number; height: number } | undefined>((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      resolve(undefined);
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });

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

export const useNodeImage = (nodeId: string) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const createUploadUrl = useMutation(
    trpc.knowledge.createImageUploadUrl.mutationOptions(),
  );
  const attachImage = useMutation(trpc.knowledge.attachImage.mutationOptions());
  const removeImage = useMutation(
    trpc.knowledge.removeImage.mutationOptions({
      onError: (error) =>
        toast.error(`Failed to remove image: ${error.message}`),
    }),
  );

  const [isUploading, setIsUploading] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries(trpc.knowledge.listChildren.queryFilter());
    queryClient.invalidateQueries(
      trpc.knowledge.get.queryFilter({ id: nodeId }),
    );
    queryClient.invalidateQueries(trpc.knowledge.search.queryFilter());
  };

  const upload = async (file: File): Promise<boolean> => {
    setIsUploading(true);
    try {
      const { uploadUrl, key } = await createUploadUrl.mutateAsync({
        nodeId,
        contentType: file.type,
      });
      if (!uploadUrl) throw new Error("Could not create upload URL");

      const response = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!response.ok) throw new Error("Upload failed");

      const dimensions = await readImageDimensions(file);
      await attachImage.mutateAsync({
        nodeId,
        storageKey: key,
        filename: file.name,
        width: dimensions?.width,
        height: dimensions?.height,
      });

      invalidate();
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload image",
      );
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  const remove = async () => {
    await removeImage.mutateAsync({ nodeId });
    invalidate();
  };

  return { upload, remove, isUploading, isRemoving: removeImage.isPending };
};

export const useMoveNode = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.knowledge.move.mutationOptions({
      onSuccess: (data) => {
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
