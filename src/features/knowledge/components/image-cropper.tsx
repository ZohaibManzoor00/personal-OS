"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactCrop, { type Crop, type PercentCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Button } from "@/components/ui/button";
import { type Area, fullImageCrop, percentCropToArea } from "../lib/crop-image";

const ASPECTS = [
  { id: "free", label: "Free", value: undefined },
  { id: "original", label: "OG", value: "original" },
  { id: "wide", label: "Wide", value: 16 / 9 },
  { id: "standard", label: "Standard", value: 4 / 3 },
  { id: "square", label: "Square", value: 1 },
  { id: "tall", label: "Tall", value: 3 / 4 },
] as const;

type AspectOption = (typeof ASPECTS)[number]["value"];

export const ImageCropper = ({
  src,
  alt,
  disabled,
  onAreaChange,
}: {
  src: string;
  alt: string;
  disabled?: boolean;
  onAreaChange: (area: Area | null) => void;
}) => {
  const [selected, setSelected] = useState<AspectOption>(undefined);
  const [crop, setCrop] = useState<Crop>();
  const naturalRef = useRef<{ width: number; height: number } | null>(null);

  useEffect(() => {
    setSelected(undefined);
    setCrop(undefined);
    naturalRef.current = null;
  }, [src]);

  const resolveAspect = (option: AspectOption): number | undefined => {
    if (option === "original") {
      const natural = naturalRef.current;
      return natural ? natural.width / natural.height : undefined;
    }
    return option;
  };

  const report = useCallback(
    (percentCrop: PercentCrop) => {
      const natural = naturalRef.current;
      onAreaChange(natural ? percentCropToArea(percentCrop, natural.width, natural.height) : null);
    },
    [onAreaChange],
  );

  const onImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight, width, height } = event.currentTarget;
    naturalRef.current = { width: naturalWidth, height: naturalHeight };
    const initial = fullImageCrop(resolveAspect(selected), width, height);
    setCrop(initial);
    report(initial);
  };

  const applyAspect = (option: AspectOption) => {
    setSelected(option);
    const natural = naturalRef.current;
    if (!natural) return;
    const next = fullImageCrop(resolveAspect(option), natural.width, natural.height);
    setCrop(next);
    report(next);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {ASPECTS.map((option) => (
          <Button
            key={option.id}
            type="button"
            size="sm"
            variant={selected === option.value ? "default" : "outline"}
            onClick={() => applyAspect(option.value)}
            disabled={disabled}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <div className="flex max-h-[60vh] justify-center overflow-hidden rounded-xl bg-muted p-2">
        <ReactCrop
          crop={crop}
          aspect={resolveAspect(selected)}
          keepSelection
          disabled={disabled}
          onChange={(_pixelCrop, percentCrop) => setCrop(percentCrop)}
          onComplete={(_pixelCrop, percentCrop) => report(percentCrop)}
          className="max-h-[calc(60vh-1rem)]"
        >
          {/* biome-ignore lint/performance/noImgElement: local object URL, cropping preview */}
          <img src={src} alt={alt} onLoad={onImageLoad} className="max-h-[calc(60vh-1rem)] w-auto object-contain" />
        </ReactCrop>
      </div>
    </div>
  );
};
