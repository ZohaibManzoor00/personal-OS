"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { prepareCoverImage } from "../lib/prepare-image";
import type { RouteCoverKey } from "../lib/routes";

export const useRouteCover = (route: RouteCoverKey) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const query = useQuery(trpc.routeCover.get.queryOptions({ route }));

  const createUploadUrl = useMutation(
    trpc.routeCover.createUploadUrl.mutationOptions(),
  );
  const attach = useMutation(trpc.routeCover.attach.mutationOptions());
  const removeCover = useMutation(
    trpc.routeCover.remove.mutationOptions({
      onError: (error) =>
        toast.error(`Failed to remove cover: ${error.message}`),
    }),
  );

  const [isUploading, setIsUploading] = useState(false);

  const invalidate = () =>
    queryClient.invalidateQueries(trpc.routeCover.get.queryFilter({ route }));

  const uploadFile = async (raw: File): Promise<boolean> => {
    setIsUploading(true);
    try {
      const { file, width, height } = await prepareCoverImage(raw);

      const { uploadUrl, key } = await createUploadUrl.mutateAsync({
        route,
        contentType: file.type,
      });
      if (!uploadUrl) throw new Error("Could not create upload URL");

      const response = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!response.ok) throw new Error("Upload failed");

      await attach.mutateAsync({
        route,
        storageKey: key,
        width: width || undefined,
        height: height || undefined,
      });

      invalidate();
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload cover",
      );
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  /** Picks one of the bundled default covers by fetching it and uploading it. */
  const applyDefault = async (src: string): Promise<boolean> => {
    setIsUploading(true);
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error("Could not load default cover");
      const blob = await response.blob();
      const name = src.split("/").pop() ?? "cover.png";
      const file = new File([blob], name, {
        type: blob.type || "image/png",
      });
      // uploadFile toggles isUploading itself; it's fine to overlap.
      return await uploadFile(file);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to apply cover",
      );
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  const remove = async () => {
    await removeCover.mutateAsync({ route });
    invalidate();
  };

  return {
    cover: query.data ?? null,
    isLoading: query.isLoading,
    upload: uploadFile,
    applyDefault,
    remove,
    isUploading,
    isRemoving: removeCover.isPending,
  };
};
