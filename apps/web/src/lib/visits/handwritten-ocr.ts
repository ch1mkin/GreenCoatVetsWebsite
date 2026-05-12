"use client";

let workerPromise: Promise<import("tesseract.js").Worker> | null = null;

export type HandwrittenRegionOcrPayload = {
  rawDataUrl: string;
  contrastDataUrl: string;
  boostedDataUrl: string;
  localCandidates: string[];
};

type PrepareVariantOptions = {
  scale: number;
  threshold: number;
  boostStrokes?: boolean;
  paddingRatio?: number;
};

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

async function drawPreparedImage(dataUrl: string, options: PrepareVariantOptions) {
  const image = await loadImage(dataUrl);
  const padding = Math.max(8, Math.round(Math.max(image.width, image.height) * (options.paddingRatio ?? 0.18)));
  const width = Math.max(1, Math.round((image.width + padding * 2) * options.scale));
  const height = Math.max(1, Math.round((image.height + padding * 2) * options.scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to prepare handwritten region for OCR.");
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(
    image,
    Math.round(padding * options.scale),
    Math.round(padding * options.scale),
    Math.round(image.width * options.scale),
    Math.round(image.height * options.scale),
  );

  if (options.boostStrokes) {
    ctx.globalAlpha = 0.24;
    ctx.drawImage(canvas, -1, 0);
    ctx.drawImage(canvas, 1, 0);
    ctx.drawImage(canvas, 0, -1);
    ctx.drawImage(canvas, 0, 1);
    ctx.globalAlpha = 1;
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] ?? 255;
    const luminance = (data[index] ?? 255) * 0.299 + (data[index + 1] ?? 255) * 0.587 + (data[index + 2] ?? 255) * 0.114;
    const shade = alpha < 20 ? 255 : luminance < options.threshold ? 0 : 255;
    data[index] = shade;
    data[index + 1] = shade;
    data[index + 2] = shade;
    data[index + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL("image/png");
}

async function createImageVariants(dataUrl: string) {
  const contrastDataUrl = await drawPreparedImage(dataUrl, {
    scale: 4,
    threshold: 198,
    paddingRatio: 0.2,
  });
  const boostedDataUrl = await drawPreparedImage(dataUrl, {
    scale: 5,
    threshold: 222,
    boostStrokes: true,
    paddingRatio: 0.24,
  });
  return {
    rawDataUrl: dataUrl,
    contrastDataUrl,
    boostedDataUrl,
  };
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

async function runRecognitionPass(
  worker: import("tesseract.js").Worker,
  imageDataUrl: string,
  options?: { singleLine?: boolean; singleChar?: boolean },
) {
  const tesseract = await import("tesseract.js");
  await worker.setParameters({
    tessedit_pageseg_mode: options?.singleChar
      ? tesseract.PSM.SINGLE_CHAR
      : options?.singleLine
        ? tesseract.PSM.SINGLE_LINE
        : tesseract.PSM.SINGLE_BLOCK,
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
  });
  const result = await worker.recognize(imageDataUrl);
  return normalizeRecognizedText(result.data.text ?? "");
}

async function collectLocalCandidates(
  variants: Omit<HandwrittenRegionOcrPayload, "localCandidates">,
  options?: { singleLine?: boolean },
) {
  const worker = await getWorker();
  const candidateScores = new Map<string, number>();
  const recognitionPlans: Array<{ imageDataUrl: string; singleLine?: boolean; singleChar?: boolean; weight: number }> =
    options?.singleLine
      ? [
          { imageDataUrl: variants.contrastDataUrl, singleLine: true, weight: 4 },
          { imageDataUrl: variants.boostedDataUrl, singleLine: true, weight: 4 },
          { imageDataUrl: variants.rawDataUrl, singleLine: true, weight: 3 },
          { imageDataUrl: variants.boostedDataUrl, singleChar: true, weight: 1 },
        ]
      : [
          { imageDataUrl: variants.contrastDataUrl, singleLine: false, weight: 4 },
          { imageDataUrl: variants.boostedDataUrl, singleLine: false, weight: 4 },
          { imageDataUrl: variants.rawDataUrl, singleLine: false, weight: 3 },
          { imageDataUrl: variants.contrastDataUrl, singleLine: true, weight: 2 },
        ];

  for (const plan of recognitionPlans) {
    try {
      const candidate = await runRecognitionPass(worker, plan.imageDataUrl, {
        singleLine: plan.singleLine,
        singleChar: plan.singleChar,
      });
      if (!candidate) continue;
      candidateScores.set(candidate, (candidateScores.get(candidate) ?? 0) + plan.weight);
    } catch {
      // OCR candidates are a best-effort hint for the server-side model.
    }
  }

  return Array.from(candidateScores.entries())
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([candidate]) => candidate)
    .slice(0, 5);
}

export async function prepareHandwrittenRegionOcrPayload(
  dataUrl: string,
  options?: { singleLine?: boolean },
): Promise<HandwrittenRegionOcrPayload> {
  const variants = await createImageVariants(dataUrl);
  const localCandidates = await collectLocalCandidates(variants, options);
  return {
    ...variants,
    localCandidates,
  };
}

export async function runHandwrittenRegionOcr(dataUrl: string, options?: { singleLine?: boolean }) {
  const payload = await prepareHandwrittenRegionOcrPayload(dataUrl, options);
  return payload.localCandidates[0] ?? "";
}
