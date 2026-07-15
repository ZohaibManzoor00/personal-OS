"use client";

import { Loader2Icon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useContentImageUpload } from "../hooks/use-knowledge";
import { type Area, cropImageToFile } from "../lib/crop-image";
import { ImageCropper } from "./image-cropper";

type Props = {
  nodeId: string;
  file: File | null;
  onInsert: (markdown: string) => void;
  onClose: () => void;
};

export const KnowledgeImageInsertDialog = ({ nodeId, file, onInsert, onClose }: Props) => {
  const { upload, isUploading } = useContentImageUpload(nodeId);

  const src = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (src) URL.revokeObjectURL(src);
    };
  }, [src]);

  const [area, setArea] = useState<Area | null>(null);

  useEffect(() => {
    setArea(null);
  }, [file]);

  const handleInsert = useCallback(async () => {
    if (!file || !src || !area) return;
    const cropped = await cropImageToFile({
      imageSrc: src,
      area,
      fileName: file.name,
      sourceType: file.type,
    });
    const url = await upload(cropped);
    if (url) onInsert(`![${file.name}](${url})`);
    onClose();
  }, [file, src, area, upload, onInsert, onClose]);

  return (
    <Dialog
      open={Boolean(file)}
      onOpenChange={(next) => {
        if (!next && !isUploading) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Insert image</DialogTitle>
          <DialogDescription>
            The whole image is selected by default. Drag any edge or corner to crop, or pick a ratio to lock it.
          </DialogDescription>
        </DialogHeader>

        {src && (
          <ImageCropper
            src={src}
            alt={file?.name ?? "Image to crop"}
            disabled={isUploading}
            onAreaChange={setArea}
          />
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isUploading} className="mr-auto">
            Cancel
          </Button>
          <Button type="button" onClick={handleInsert} disabled={isUploading || !area}>
            {isUploading ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Inserting…
              </>
            ) : (
              "Insert"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
