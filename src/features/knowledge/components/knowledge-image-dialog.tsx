"use client";

import { ImageIcon, Loader2Icon, UploadIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactCrop, { type Crop, type PercentCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNodeImage } from "../hooks/use-knowledge";
import {
  cropImageToFile,
  fullImageCrop,
  percentCropToArea,
} from "../lib/crop-image";
import { getCoverImage, type KnowledgeNode } from "../types";

const ACCEPTED_TYPES = "image/png,image/jpeg,image/webp,image/gif,image/avif";
// Matches the card cover banner so cropped images fit without distortion.
const CROP_ASPECT = 16 / 9;

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
  const [crop, setCrop] = useState<Crop>();
  const [completed, setCompleted] = useState<PercentCrop | null>(null);
  const naturalRef = useRef<{ width: number; height: number } | null>(null);

  const clearPending = useCallback(() => {
    setPending((prev) => {
      if (prev) URL.revokeObjectURL(prev.src);
      return null;
    });
    setCrop(undefined);
    setCompleted(null);
    naturalRef.current = null;
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

  const onImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight, width, height } = event.currentTarget;
    naturalRef.current = { width: naturalWidth, height: naturalHeight };
    const initial = fullImageCrop(CROP_ASPECT, width, height);
    setCrop(initial);
    setCompleted(initial);
  };

  const handleSave = async () => {
    const natural = naturalRef.current;
    if (!pending || !completed || !natural) return;
    const area = percentCropToArea(completed, natural.width, natural.height);
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
              ? "Drag the edges or corners to frame the 16:9 cover, then save."
              : `Add an image to make this ${
                  node.type === "SPACE" ? "space" : "page"
                } stand out on its card.`}
          </DialogDescription>
        </DialogHeader>

        {pending ? (
          <div className="flex max-h-[60vh] justify-center overflow-hidden rounded-xl bg-muted p-2">
            <ReactCrop
              crop={crop}
              aspect={CROP_ASPECT}
              keepSelection
              disabled={isUploading}
              onChange={(_pixelCrop, percentCrop) => setCrop(percentCrop)}
              onComplete={(_pixelCrop, percentCrop) => setCompleted(percentCrop)}
              className="max-h-[calc(60vh-1rem)]"
            >
              {/* biome-ignore lint/performance/noImgElement: local object URL, cropping preview */}
              <img
                src={pending.src}
                alt={pending.name}
                onLoad={onImageLoad}
                className="max-h-[calc(60vh-1rem)] w-auto object-contain"
              />
            </ReactCrop>
          </div>
        ) : cover ? (
          <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border bg-muted/40">
            {/* biome-ignore lint/performance/noImgElement: R2 public asset, no next/image domain config */}
            <img
              src={cover.url}
              alt={cover.altText ?? node.title}
              className="size-full object-cover"
            />
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

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={handleSelect}
        />

        <DialogFooter>
          {pending ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={clearPending}
                disabled={isUploading}
                className="mr-auto"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={isUploading || !completed}
              >
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => remove()}
                  disabled={isBusy}
                  className="mr-auto"
                >
                  {isRemoving ? "Removing..." : "Remove"}
                </Button>
              )}
              {cover && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => inputRef.current?.click()}
                  disabled={isBusy}
                >
                  <UploadIcon className="size-4" />
                  Replace
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isBusy}
              >
                Done
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
