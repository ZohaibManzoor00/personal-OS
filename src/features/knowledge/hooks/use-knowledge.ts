import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { parseAsString } from "nuqs/server";
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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

export const useKnowledgeTree = (enabled = true) => {
  const trpc = useTRPC();
  return useQuery(trpc.knowledge.listTree.queryOptions(undefined, { enabled }));
};

export type KnowledgeView = "cards" | "tree";

const VIEW_STORAGE_KEY = "knowledge:view";

// Module-level store so every toggle/consumer (search bar, tree, cards) stays in
// sync live, while still persisting the choice to localStorage.
let currentView: KnowledgeView = "cards";
const viewListeners = new Set<() => void>();

const setKnowledgeView = (next: KnowledgeView) => {
  if (next === currentView) return;
  currentView = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(VIEW_STORAGE_KEY, next);
  }
  for (const listener of viewListeners) listener();
};

const subscribeView = (listener: () => void) => {
  viewListeners.add(listener);
  return () => {
    viewListeners.delete(listener);
  };
};

export const useKnowledgeView = () => {
  const view = useSyncExternalStore(
    subscribeView,
    () => currentView,
    () => "cards" as KnowledgeView,
  );

  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "cards" || stored === "tree") setKnowledgeView(stored);
  }, []);

  return [view, setKnowledgeView] as const;
};

/**
 * Tracks whether the referenced element has scrolled up and out of the top of
 * the viewport. Uses a callback ref so it attaches correctly even when the
 * target only mounts after a Suspense boundary resolves.
 */
export const useScrolledPast = () => {
  const [scrolledPast, setScrolledPast] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback((node: HTMLElement | null) => {
    observerRef.current?.disconnect();
    if (!node) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        setScrolledPast(
          !entry.isIntersecting && entry.boundingClientRect.top < 0,
        );
      },
      { threshold: 0 },
    );
    observerRef.current.observe(node);
  }, []);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return { ref, scrolledPast };
};

/**
 * Tracks how far the document has been scrolled as a 0–1 fraction, so callers
 * can show reading progress. Recomputes on scroll and resize (content height
 * shifts as images load), throttled to one update per animation frame.
 */
export const useScrollProgress = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? Math.min(1, window.scrollY / scrollable) : 0);
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return progress;
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

export const useRecentNodes = () => {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.knowledge.listRecent.queryOptions());
};

export const useRecordView = (id: string) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const recordView = useMutation(
    trpc.knowledge.recordView.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.knowledge.listRecent.queryFilter());
      },
    }),
  );

  const mutate = recordView.mutate;

  useEffect(() => {
    mutate({ id });
  }, [id, mutate]);
};

/**
 * Focuses the given search input on ⌘K / Ctrl+K (advertised) and also on the
 * intentionally-undocumented ⌘L / Ctrl+L. When several inputs register this
 * (e.g. the inline and sticky-header page search), only the one currently
 * on-screen responds, so the shortcut always lands on the visible field.
 */
export const useSearchFocusHotkey = (
  ref: React.RefObject<HTMLInputElement | null>,
) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key !== "k" && key !== "l") return;

      const input = ref.current;
      if (!input) return;

      // Ignore instances that are scrolled out of view or otherwise hidden, so
      // duplicate mounts don't steal focus to an off-screen field.
      const rect = input.getBoundingClientRect();
      const onScreen =
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 8 &&
        rect.top < window.innerHeight;
      if (!onScreen) return;

      event.preventDefault();
      input.focus();
      input.select();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [ref]);
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
        queryClient.invalidateQueries(trpc.knowledge.listTree.queryFilter());
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
        queryClient.invalidateQueries(trpc.knowledge.listTree.queryFilter());
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
        queryClient.invalidateQueries(trpc.knowledge.listTree.queryFilter());
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

/**
 * Uploads an image to R2 for embedding inside page content (Markdown body).
 * Unlike `useNodeImage`, this does NOT touch the cover image / DB — it just
 * stores the file and returns its stable public URL to drop into the body.
 */
export const useContentImageUpload = (nodeId: string) => {
  const trpc = useTRPC();

  const createUploadUrl = useMutation(
    trpc.knowledge.createImageUploadUrl.mutationOptions(),
  );

  const [isUploading, setIsUploading] = useState(false);

  const upload = async (file: File): Promise<string | null> => {
    setIsUploading(true);
    try {
      const { uploadUrl, publicUrl } = await createUploadUrl.mutateAsync({
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

      return publicUrl;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload image",
      );
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return { upload, isUploading };
};

export const usePolishMarkdown = () => {
  const trpc = useTRPC();

  return useMutation(
    trpc.knowledge.polishMarkdown.mutationOptions({
      onError: (error) => {
        toast.error(`Failed to format: ${error.message}`);
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
        queryClient.invalidateQueries(
          trpc.knowledge.listChildren.queryFilter(),
        );
        queryClient.invalidateQueries(
          trpc.knowledge.getAncestors.queryFilter({ id: data.id }),
        );
        queryClient.invalidateQueries(trpc.knowledge.listSpaces.queryFilter());
        queryClient.invalidateQueries(trpc.knowledge.listTree.queryFilter());
      },
      onError: (error) => {
        toast.error(`Failed to move: ${error.message}`);
      },
    }),
  );
};
