"use client";

let workerPromise: Promise<import("tesseract.js").Worker> | null = null;

function normalizeRecognizedText(input: string) {
  return input
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function loadImage(src: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load handwritten region image for OCR."));
    image.src = src;
  });
}

async function prepareImageForOcr(dataUrl: string) {
  const image = await loadImage(dataUrl);
  const width = Math.max(1, image.width * 2);
  const height = Math.max(1, image.height * 2);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to prepare handwritten region for OCR.");
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] ?? 255;
    const luminance = (data[index] ?? 255) * 0.299 + (data[index + 1] ?? 255) * 0.587 + (data[index + 2] ?? 255) * 0.114;
    const shade = alpha < 20 ? 255 : luminance < 200 ? 0 : 255;
    data[index] = shade;
    data[index + 1] = shade;
    data[index + 2] = shade;
    data[index + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL("image/png");
}

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const tesseract = await import("tesseract.js");
      const worker = await tesseract.createWorker("eng", 1, {
        logger: () => undefined,
        errorHandler: () => undefined,
      });
      await worker.setParameters({
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
      });
      return worker;
    })().catch((error) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

export async function runHandwrittenRegionOcr(dataUrl: string, options?: { singleLine?: boolean }) {
  const tesseract = await import("tesseract.js");
  const worker = await getWorker();
  await worker.setParameters({
    tessedit_pageseg_mode: options?.singleLine ? tesseract.PSM.SINGLE_LINE : tesseract.PSM.SINGLE_BLOCK,
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
  });
  const preparedImage = await prepareImageForOcr(dataUrl);
  const result = await worker.recognize(preparedImage);
  return normalizeRecognizedText(result.data.text ?? "");
}
