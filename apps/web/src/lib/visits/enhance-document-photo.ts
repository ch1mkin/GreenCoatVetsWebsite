"use client";

export type EnhanceDocumentPhotoOptions = {
  /** Stronger contrast, sharpening, and resolution — best for visit PDF export. */
  extraClarity?: boolean;
};

/**
 * Clinic-style document scan cleanup: high contrast, optional sharpening, white background.
 * Used before saving a photographed handwritten sheet as the visit PDF.
 */
export async function enhanceDocumentPhoto(
  file: File,
  options: EnhanceDocumentPhotoOptions = {},
): Promise<Blob> {
  const extraClarity = options.extraClarity ?? false;
  const image = await loadImageFromFile(file);
  const maxEdge = extraClarity ? 3200 : 2400;
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not prepare the photo for scanning.");
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.filter = extraClarity ? "contrast(1.08) brightness(1.03)" : "none";
  ctx.drawImage(image, 0, 0, width, height);
  ctx.filter = "none";

  const imageData = ctx.getImageData(0, 0, width, height);
  const contrastGain = extraClarity ? 1.55 : 1.35;
  const inkThreshold = extraClarity ? 198 : 210;
  binarizeDocument(imageData, contrastGain, inkThreshold);
  ctx.putImageData(imageData, 0, 0);

  if (extraClarity) {
    sharpenCanvas(ctx, width, height, 0.45);
  }

  const jpegQuality = extraClarity ? 0.96 : 0.92;

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to export the scanned document."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      jpegQuality,
    );
  });
}

function binarizeDocument(imageData: ImageData, contrastGain: number, inkThreshold: number) {
  const { data } = imageData;
  for (let index = 0; index < data.length; index += 4) {
    const r = data[index] ?? 255;
    const g = data[index + 1] ?? 255;
    const b = data[index + 2] ?? 255;
    const luminance = r * 0.299 + g * 0.587 + b * 0.114;
    const contrast = Math.max(0, Math.min(255, (luminance - 128) * contrastGain + 128));
    const ink = contrast < inkThreshold ? 0 : 255;
    data[index] = ink;
    data[index + 1] = ink;
    data[index + 2] = ink;
    data[index + 3] = 255;
  }
}

/** Light unsharp mask on luminance for crisper text in PDFs. */
function sharpenCanvas(ctx: CanvasRenderingContext2D, width: number, height: number, amount: number) {
  const source = ctx.getImageData(0, 0, width, height);
  const blurred = ctx.getImageData(0, 0, width, height);
  boxBlurPass(blurred, width, height);

  const src = source.data;
  const blur = blurred.data;
  for (let i = 0; i < src.length; i += 4) {
    for (let c = 0; c < 3; c += 1) {
      const original = src[i + c] ?? 255;
      const blurredPx = blur[i + c] ?? 255;
      const sharpened = original + (original - blurredPx) * amount;
      src[i + c] = Math.max(0, Math.min(255, Math.round(sharpened)));
    }
  }
  ctx.putImageData(source, 0, 0);
}

function boxBlurPass(imageData: ImageData, width: number, height: number) {
  const { data } = imageData;
  const copy = new Uint8ClampedArray(data);
  const radius = 1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const px = x + dx;
          const py = y + dy;
          if (px < 0 || py < 0 || px >= width || py >= height) continue;
          const idx = (py * width + px) * 4;
          r += copy[idx] ?? 0;
          g += copy[idx + 1] ?? 0;
          b += copy[idx + 2] ?? 0;
          count += 1;
        }
      }
      const idx = (y * width + x) * 4;
      data[idx] = Math.round(r / count);
      data[idx + 1] = Math.round(g / count);
      data[idx + 2] = Math.round(b / count);
    }
  }
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read the selected photo."));
    };
    image.src = url;
  });
}
