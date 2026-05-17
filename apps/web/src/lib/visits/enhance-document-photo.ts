"use client";

/**
 * Clinic-style document scan cleanup: high contrast, light sharpening, white background.
 * Used before saving a photographed handwritten sheet as the visit PDF.
 */
export async function enhanceDocumentPhoto(file: File): Promise<Blob> {
  const image = await loadImageFromFile(file);
  const maxEdge = 2400;
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
  ctx.drawImage(image, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  for (let index = 0; index < data.length; index += 4) {
    const r = data[index] ?? 255;
    const g = data[index + 1] ?? 255;
    const b = data[index + 2] ?? 255;
    const luminance = r * 0.299 + g * 0.587 + b * 0.114;
    const contrast = Math.max(0, Math.min(255, (luminance - 128) * 1.35 + 128));
    const ink = contrast < 210 ? 0 : 255;
    data[index] = ink;
    data[index + 1] = ink;
    data[index + 2] = ink;
    data[index + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

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
      0.92,
    );
  });
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
