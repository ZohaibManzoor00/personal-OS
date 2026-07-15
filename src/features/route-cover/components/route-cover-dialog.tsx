"use client";

import { ImageIcon, Loader2Icon, Trash2Icon, UploadIcon } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { DEFAULT_COVERS } from "../lib/default-covers";

const ACCEPTED_TYPES = "image/png,image/jpeg,image/webp,image/gif,image/avif";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasCover: boolean;
  isBusy: boolean;
  onUpload: (file: File) => Promise<boolean>;
  onApplyDefault: (src: string) => Promise<boolean>;
  onRemove: () => void;
};

export const RouteCoverDialog = ({
  open,
  onOpenChange,
  hasCover,
  isBusy,
  onUpload,
  onApplyDefault,
  onRemove,
}: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const ok = await onUpload(file);
    if (ok) onOpenChange(false);
  };

  const handleDefault = async (src: string) => {
    const ok = await onApplyDefault(src);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cover image</DialogTitle>
          <DialogDescription>
            Pick one of the presets below or upload your own image to set the
            banner for this page.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3">
          {DEFAULT_COVERS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={isBusy}
              onClick={() => handleDefault(preset.src)}
              className={cn(
                "group relative aspect-video w-full overflow-hidden rounded-lg border transition-all",
                "hover:border-foreground/40 hover:ring-2 hover:ring-ring/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {/* biome-ignore lint/performance/noImgElement: bundled static asset preview */}
              <img
                src={preset.src}
                alt={preset.label}
                className="size-full object-cover transition-transform group-hover:scale-105"
              />
              <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/60 to-transparent px-2 py-1 text-left text-[11px] font-medium text-white">
                {preset.label}
              </span>
            </button>
          ))}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={handleFile}
        />

        <DialogFooter className="sm:justify-between">
          <div className="flex gap-2">
            {hasCover && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onRemove();
                  onOpenChange(false);
                }}
                disabled={isBusy}
              >
                <Trash2Icon className="size-4" />
                Remove
              </Button>
            )}
          </div>
          <Button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isBusy}
          >
            {isBusy ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Working...
              </>
            ) : (
              <>
                {hasCover ? (
                  <UploadIcon className="size-4" />
                ) : (
                  <ImageIcon className="size-4" />
                )}
                Upload image
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
