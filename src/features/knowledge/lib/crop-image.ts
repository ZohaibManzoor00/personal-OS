import type { Area } from "react-easy-crop";

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
