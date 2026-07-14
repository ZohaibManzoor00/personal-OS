"use client";

import { ImageIcon, Loader2Icon, UploadIcon } from "lucide-react";
import { useRef } from "react";
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
import { getCoverImage, type KnowledgeNode } from "../types";

const ACCEPTED_TYPES = "image/png,image/jpeg,image/webp,image/gif,image/avif";

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

  const handleSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await upload(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cover image</DialogTitle>
          <DialogDescription>
            Add an image to make this {node.type === "SPACE" ? "space" : "page"}{" "}
            stand out on its card.
          </DialogDescription>
        </DialogHeader>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isBusy}
          className="group relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-xl border border-dashed bg-muted/40 transition-colors hover:border-foreground/30 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          {cover ? (
            // biome-ignore lint/performance/noImgElement: R2 public asset, no next/image domain config
            <img
              src={cover.url}
              alt={cover.altText ?? node.title}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <ImageIcon className="size-6" />
              <span className="text-sm">No image yet</span>
            </div>
          )}

          <div className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 backdrop-blur-[1px] transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            {isUploading ? (
              <span className="flex items-center gap-2 text-sm font-medium">
                <Loader2Icon className="size-4 animate-spin" />
                Uploading...
              </span>
            ) : (
              <span className="flex items-center gap-2 text-sm font-medium">
                <UploadIcon className="size-4" />
                {cover ? "Replace image" : "Upload image"}
              </span>
            )}
          </div>
        </button>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={handleSelect}
        />

        <DialogFooter>
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
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isBusy}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
