// Route covers are shown full-width, so allow a larger max than card
// thumbnails, but still cap + re-encode to WebP to keep uploads reasonable.
const MAX_WIDTH = 2400;
const QUALITY = 0.85;

export type PreparedImage = {
  file: File;
  width: number;
  height: number;
};

/**
 * Downscales a picked image to a sensible banner width and re-encodes it to
 * WebP. Falls back to the original file if the browser can't process it.
 */
export const prepareCoverImage = async (file: File): Promise<PreparedImage> => {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_WIDTH / bitmap.width);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return { file, width: bitmap.width, height: bitmap.height };

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", QUALITY);
    });
    if (!blob) return { file, width, height };

    const base = file.name.replace(/\.[^./\\]+$/, "") || "cover";
    return {
      file: new File([blob], `${base}.webp`, { type: "image/webp" }),
      width,
      height,
    };
  } catch {
    return { file, width: 0, height: 0 };
  }
};
