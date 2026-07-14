"use client";

import { Loader2Icon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useContentImageUpload } from "../hooks/use-knowledge";
import { cropImageToFile } from "../lib/crop-image";

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

const ASPECTS = [
  { id: "wide", label: "Wide", value: 16 / 9 },
  { id: "standard", label: "Standard", value: 4 / 3 },
  { id: "square", label: "Square", value: 1 },
  { id: "tall", label: "Tall", value: 3 / 4 },
] as const;

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

  const [aspect, setAspect] = useState<number>(ASPECTS[0].value);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);

  // Reset framing whenever a new file comes in.
  useEffect(() => {
    setAspect(ASPECTS[0].value);
    setCrop({ x: 0, y: 0 });
    setZoom(MIN_ZOOM);
    setAreaPixels(null);
  }, [file]);

  const handleInsert = useCallback(async () => {
    if (!file || !src || !areaPixels) return;
    const cropped = await cropImageToFile({
      imageSrc: src,
      area: areaPixels,
      fileName: file.name,
      sourceType: file.type,
    });
    const url = await upload(cropped);
    if (url) onInsert(`![${file.name}](${url})`);
    onClose();
  }, [file, src, areaPixels, upload, onInsert, onClose]);

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
            Pick a shape, then drag and zoom to frame it before adding it to the
            page.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {ASPECTS.map((option) => (
            <Button
              key={option.id}
              type="button"
              size="sm"
              variant={aspect === option.value ? "default" : "outline"}
              onClick={() => setAspect(option.value)}
              disabled={isUploading}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_area, pixels) => setAreaPixels(pixels)}
            />
          )}
        </div>

        <Slider
          value={[zoom]}
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          onValueChange={(values) => setZoom(values[0] ?? MIN_ZOOM)}
          disabled={isUploading}
          aria-label="Zoom"
          className={cn("w-full")}
        />

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
            disabled={isUploading || !areaPixels}
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
