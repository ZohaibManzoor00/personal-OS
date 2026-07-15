"use client";

import { ImageIcon, Loader2Icon, UploadIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNodeImage } from "../hooks/use-knowledge";
import { type Area, cropImageToFile } from "../lib/crop-image";
import { getCoverImage, type KnowledgeNode } from "../types";
import { ImageCropper } from "./image-cropper";

const ACCEPTED_TYPES = "image/png,image/jpeg,image/webp,image/gif,image/avif";

type Pending = { src: string; name: string; type: string };

type Props = {
  node: KnowledgeNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const KnowledgeImageDialog = ({ node, open, onOpenChange }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, remove, isUploading, isRemoving } = useNodeImage(node.id);

  const cover = getCoverImage(node);
  const isBusy = isUploading || isRemoving;

  const [pending, setPending] = useState<Pending | null>(null);
  const [area, setArea] = useState<Area | null>(null);

  const clearPending = useCallback(() => {
    setPending((prev) => {
      if (prev) URL.revokeObjectURL(prev.src);
      return null;
    });
    setArea(null);
  }, []);

  // Reset any in-progress crop when the dialog closes.
  useEffect(() => {
    if (!open) clearPending();
  }, [open, clearPending]);

  const handleSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    clearPending();
    setPending({
      src: URL.createObjectURL(file),
      name: file.name,
      type: file.type,
    });
  };

  const handleSave = async () => {
    if (!pending || !area) return;
    const file = await cropImageToFile({
      imageSrc: pending.src,
      area,
      fileName: pending.name,
      sourceType: pending.type,
    });
    const ok = await upload(file);
    if (ok) clearPending();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cover image</DialogTitle>
          <DialogDescription>
            {pending
              ? "The whole image is selected by default. Drag any edge or corner to crop, or pick a ratio to lock it."
              : `Add an image to make this ${node.type === "SPACE" ? "space" : "page"} stand out on its card.`}
          </DialogDescription>
        </DialogHeader>

        {pending ? (
          <ImageCropper src={pending.src} alt={pending.name} disabled={isUploading} onAreaChange={setArea} />
        ) : cover ? (
          <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border bg-muted/40">
            {/* biome-ignore lint/performance/noImgElement: R2 public asset, no next/image domain config */}
            <img src={cover.url} alt={cover.altText ?? node.title} className="size-full object-cover" />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isBusy}
            className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/40 text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ImageIcon className="size-6" />
            <span className="text-sm">Click to upload an image</span>
          </button>
        )}

        <input ref={inputRef} type="file" accept={ACCEPTED_TYPES} className="hidden" onChange={handleSelect} />

        <DialogFooter>
          {pending ? (
            <>
              <Button type="button" variant="outline" onClick={clearPending} disabled={isUploading} className="mr-auto">
                Cancel
              </Button>
              <Button type="button" onClick={handleSave} disabled={isUploading || !area}>
                {isUploading ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </>
          ) : (
            <>
              {cover && (
                <Button type="button" variant="outline" onClick={() => remove()} disabled={isBusy} className="mr-auto">
                  {isRemoving ? "Removing..." : "Remove"}
                </Button>
              )}
              {cover && (
                <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={isBusy}>
                  <UploadIcon className="size-4" />
                  Replace
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isBusy}>
                Done
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
