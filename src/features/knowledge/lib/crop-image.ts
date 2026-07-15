import {
  centerCrop,
  makeAspectCrop,
  type PercentCrop,
} from "react-image-crop";

/** A crop rectangle in source-image pixel coordinates. */
export type Area = { x: number; y: number; width: number; height: number };

/**
 * A crop covering the whole image. With an aspect ratio it returns the largest
 * centred crop of that ratio; without one it selects the entire image.
 */
export const fullImageCrop = (
  aspect: number | undefined,
  mediaWidth: number,
  mediaHeight: number,
): PercentCrop => {
  if (!aspect) {
    return { unit: "%", x: 0, y: 0, width: 100, height: 100 };
  }
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 100 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight,
  );
};

/** Converts a react-image-crop percentage crop into source-pixel coordinates. */
export const percentCropToArea = (
  crop: PercentCrop,
  naturalWidth: number,
  naturalHeight: number,
): Area => ({
  x: (crop.x / 100) * naturalWidth,
  y: (crop.y / 100) * naturalHeight,
  width: (crop.width / 100) * naturalWidth,
  height: (crop.height / 100) * naturalHeight,
});

// Cap the exported image so we don't upload a needlessly huge file for a small card thumbnail.
const MAX_OUTPUT_SIZE = 1024;

const OUTPUT_BY_TYPE: Record<
  string,
  { mime: string; ext: string; quality?: number }
> = {
  "image/jpeg": { mime: "image/jpeg", ext: "jpg", quality: 0.9 },
  "image/webp": { mime: "image/webp", ext: "webp", quality: 0.9 },
};
const DEFAULT_OUTPUT = { mime: "image/png", ext: "png", quality: undefined };

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image"));
    image.src = src;
  });

/** Renders the selected crop area to a canvas and returns it as an uploadable File. */
export const cropImageToFile = async ({
  imageSrc,
  area,
  fileName,
  sourceType,
}: {
  imageSrc: string;
  area: Area;
  fileName: string;
  sourceType: string;
}): Promise<File> => {
  const image = await loadImage(imageSrc);
  const output = OUTPUT_BY_TYPE[sourceType] ?? DEFAULT_OUTPUT;

  const scale = Math.min(
    1,
    MAX_OUTPUT_SIZE / Math.max(area.width, area.height),
  );
  const width = Math.max(1, Math.round(area.width * scale));
  const height = Math.max(1, Math.round(area.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported");

  ctx.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    width,
    height,
  );

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, output.mime, output.quality);
  });
  if (!blob) throw new Error("Could not process image");

  const base = fileName.replace(/\.[^./\\]+$/, "") || "cover";
  return new File([blob], `${base}.${output.ext}`, { type: output.mime });
};
