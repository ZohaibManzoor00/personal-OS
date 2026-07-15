"use client";

import { Loader2Icon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useContentImageUpload } from "../hooks/use-knowledge";
import {
  cropImageToFile,
  fullImageCrop,
  percentCropToArea,
} from "../lib/crop-image";

// `undefined` = free-form crop (drag any edge or corner independently).
// `null` sentinel isn't used; a number locks the crop to that ratio.
const ASPECTS = [
  { id: "free", label: "Free", value: undefined },
  { id: "original", label: "Original", value: "original" },
  { id: "wide", label: "Wide", value: 16 / 9 },
  { id: "standard", label: "Standard", value: 4 / 3 },
  { id: "square", label: "Square", value: 1 },
  { id: "tall", label: "Tall", value: 3 / 4 },
] as const;

type AspectOption = (typeof ASPECTS)[number]["value"];

type Props = {
  nodeId: string;
  file: File | null;
  onInsert: (markdown: string) => void;
  onClose: () => void;
};

export const KnowledgeImageInsertDialog = ({
  nodeId,
  file,
  onInsert,
  onClose,
}: Props) => {
  const { upload, isUploading } = useContentImageUpload(nodeId);

  const src = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (src) URL.revokeObjectURL(src);
    };
  }, [src]);

  const [selected, setSelected] = useState<AspectOption>(undefined);
  const [crop, setCrop] = useState<Crop>();
  const [completed, setCompleted] = useState<PercentCrop | null>(null);
  const naturalRef = useRef<{ width: number; height: number } | null>(null);

  // Reset framing whenever a new file comes in.
  useEffect(() => {
    setSelected(undefined);
    setCrop(undefined);
    setCompleted(null);
    naturalRef.current = null;
  }, [file]);

  // Resolve an aspect option to a concrete ratio for the current image.
  const resolveAspect = useCallback(
    (option: AspectOption): number | undefined => {
      if (option === "original") {
        const natural = naturalRef.current;
        return natural ? natural.width / natural.height : undefined;
      }
      return option;
    },
    [],
  );

  const onImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight, width, height } = event.currentTarget;
    naturalRef.current = { width: naturalWidth, height: naturalHeight };
    // Start with the entire image selected so nothing is cropped by default.
    const initial = fullImageCrop(resolveAspect(selected), width, height);
    setCrop(initial);
    setCompleted(initial);
  };

  const applyAspect = (option: AspectOption) => {
    setSelected(option);
    const natural = naturalRef.current;
    if (!natural) return;
    const next = fullImageCrop(
      resolveAspect(option),
      natural.width,
      natural.height,
    );
    setCrop(next);
    setCompleted(next);
  };

  const handleInsert = useCallback(async () => {
    const natural = naturalRef.current;
    if (!file || !src || !completed || !natural) return;

    const area = percentCropToArea(completed, natural.width, natural.height);
    const cropped = await cropImageToFile({
      imageSrc: src,
      area,
      fileName: file.name,
      sourceType: file.type,
    });
    const url = await upload(cropped);
    if (url) onInsert(`![${file.name}](${url})`);
    onClose();
  }, [file, src, completed, upload, onInsert, onClose]);

  const aspect = resolveAspect(selected);
  const hasSelection = Boolean(
    completed && completed.width > 0 && completed.height > 0,
  );

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
            The whole image is selected by default. Drag any edge or corner to
            crop, or pick a ratio to lock it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {ASPECTS.map((option) => (
            <Button
              key={option.id}
              type="button"
              size="sm"
              variant={selected === option.value ? "default" : "outline"}
              onClick={() => applyAspect(option.value)}
              disabled={isUploading}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <div className="flex max-h-[60vh] justify-center overflow-hidden rounded-xl bg-muted p-2">
          {src && (
            <ReactCrop
              crop={crop}
              aspect={aspect}
              keepSelection
              disabled={isUploading}
              onChange={(_pixelCrop, percentCrop) => setCrop(percentCrop)}
              onComplete={(_pixelCrop, percentCrop) =>
                setCompleted(percentCrop)
              }
              className="max-h-[calc(60vh-1rem)]"
            >
              {/* biome-ignore lint/performance/noImgElement: local object URL, cropping preview */}
              <img
                src={src}
                alt={file?.name ?? "Image to crop"}
                onLoad={onImageLoad}
                className="max-h-[calc(60vh-1rem)] w-auto object-contain"
              />
            </ReactCrop>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isUploading}
            className="mr-auto"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleInsert}
            disabled={isUploading || !hasSelection}
          >
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
