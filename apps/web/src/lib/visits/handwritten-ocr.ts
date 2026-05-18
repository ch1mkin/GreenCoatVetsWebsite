"use client";

import {
  filterPlausibleHandwrittenCandidates,
  normalizeHandwrittenOcrText,
  pickBestHandwrittenOcrText,
  tesseractCharWhitelistForField,
} from "@/lib/visits/handwritten-ocr-utils";
import { applyVeterinaryOcrCleanup, pickBestVeterinaryOcrCandidate } from "@/lib/visits/veterinary-ocr-vocabulary";

let workerPromise: Promise<import("tesseract.js").Worker> | null = null;

export { pickBestHandwrittenOcrText } from "@/lib/visits/handwritten-ocr-utils";

export type HandwrittenRegionOcrPayload = {
  rawDataUrl: string;
  contrastDataUrl: string;
  boostedDataUrl: string;
  thinStrokeDataUrl: string;
  inkOnWhiteDataUrl: string;
  localCandidates: string[];
};

type PrepareVariantOptions = {
  scale: number;
  threshold: number;
  boostStrokes?: boolean;
  thickenStrokes?: boolean;
  paddingRatio?: number;
};

async function loadImage(src: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load handwritten region image for OCR."));
    image.src = src;
  });
}

export async function compressDataUrlForOcrTransport(dataUrl: string, maxEdge = 960, quality = 0.86) {
  const image = await loadImage(dataUrl);
  const longest = Math.max(image.width, image.height, 1);
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to compress OCR image.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

async function drawPreparedImage(dataUrl: string, options: PrepareVariantOptions) {
  const image = await loadImage(dataUrl);
  const padding = Math.max(12, Math.round(Math.max(image.width, image.height) * (options.paddingRatio ?? 0.22)));
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
    ctx.globalAlpha = 0.32;
    for (const [dx, dy] of [
      [-2, 0],
      [2, 0],
      [0, -2],
      [0, 2],
      [-1, -1],
      [1, 1],
    ]) {
      ctx.drawImage(canvas, dx, dy);
    }
    ctx.globalAlpha = 1;
  }

  if (options.thickenStrokes) {
    ctx.globalAlpha = 0.18;
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
    const luminance =
      (data[index] ?? 255) * 0.299 + (data[index + 1] ?? 255) * 0.587 + (data[index + 2] ?? 255) * 0.114;
    const shade = alpha < 20 ? 255 : luminance < options.threshold ? 0 : 255;
    data[index] = shade;
    data[index + 1] = shade;
    data[index + 2] = shade;
    data[index + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL("image/png");
}

/** Remove tinted form backgrounds (e.g. blue boxes) so ink reads as black-on-white. */
async function drawInkOnWhiteBackground(dataUrl: string, scale = 6) {
  const image = await loadImage(dataUrl);
  const padding = Math.max(16, Math.round(Math.max(image.width, image.height) * 0.24));
  const width = Math.max(1, Math.round((image.width + padding * 2) * scale));
  const height = Math.max(1, Math.round((image.height + padding * 2) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to prepare ink-on-white OCR image.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(
    image,
    Math.round(padding * scale),
    Math.round(padding * scale),
    Math.round(image.width * scale),
    Math.round(image.height * scale),
  );

  const sample = ctx.getImageData(0, 0, width, height);
  const corners = [
    sample.data.slice(0, 4),
    sample.data.slice((width - 1) * 4, width * 4),
    sample.data.slice((height - 1) * width * 4, (height - 1) * width * 4 + 4),
    sample.data.slice(sample.data.length - 4),
  ];
  const bgR = corners.reduce((sum, px) => sum + (px[0] ?? 255), 0) / corners.length;
  const bgG = corners.reduce((sum, px) => sum + (px[1] ?? 255), 0) / corners.length;
  const bgB = corners.reduce((sum, px) => sum + (px[2] ?? 255), 0) / corners.length;

  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  for (let index = 0; index < data.length; index += 4) {
    const r = data[index] ?? 255;
    const g = data[index + 1] ?? 255;
    const b = data[index + 2] ?? 255;
    const dr = r - bgR;
    const dg = g - bgG;
    const db = b - bgB;
    const colorDistance = Math.sqrt(dr * dr + dg * dg + db * db);
    const luminance = r * 0.299 + g * 0.587 + b * 0.114;
    const bgLuminance = bgR * 0.299 + bgG * 0.587 + bgB * 0.114;
    const isInk = colorDistance > 34 || luminance < bgLuminance - 28;
    const shade = isInk ? 0 : 255;
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
    scale: 5,
    threshold: 190,
    paddingRatio: 0.22,
  });
  const boostedDataUrl = await drawPreparedImage(dataUrl, {
    scale: 6,
    threshold: 210,
    boostStrokes: true,
    paddingRatio: 0.26,
  });
  const thinStrokeDataUrl = await drawPreparedImage(dataUrl, {
    scale: 6,
    threshold: 175,
    thickenStrokes: true,
    boostStrokes: true,
    paddingRatio: 0.28,
  });
  const inkOnWhiteDataUrl = await drawInkOnWhiteBackground(dataUrl, 6);
  return {
    rawDataUrl: dataUrl,
    contrastDataUrl,
    boostedDataUrl,
    thinStrokeDataUrl,
    inkOnWhiteDataUrl,
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
        user_defined_dpi: "350",
      });
      return worker;
    })().catch((error) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

type RecognitionPlan = {
  imageDataUrl: string;
  psm: import("tesseract.js").PSM;
  weight: number;
};

async function runRecognitionPass(
  worker: import("tesseract.js").Worker,
  imageDataUrl: string,
  psm: import("tesseract.js").PSM,
  fieldId?: string,
) {
  const whitelist = fieldId ? tesseractCharWhitelistForField(fieldId) : undefined;
  await worker.setParameters({
    tessedit_pageseg_mode: psm,
    preserve_interword_spaces: "1",
    user_defined_dpi: "400",
    ...(whitelist ? { tessedit_char_whitelist: whitelist } : {}),
  });
  const result = await worker.recognize(imageDataUrl);
  return normalizeHandwrittenOcrText(result.data.text ?? "");
}

async function collectLocalCandidates(
  variants: Omit<HandwrittenRegionOcrPayload, "localCandidates">,
  options?: { singleLine?: boolean; fieldId?: string },
) {
  const worker = await getWorker();
  const tesseract = await import("tesseract.js");
  const candidateScores = new Map<string, number>();

  const fieldId = options?.fieldId;
  const plans: RecognitionPlan[] = options?.singleLine
    ? [
        { imageDataUrl: variants.inkOnWhiteDataUrl, psm: tesseract.PSM.SINGLE_LINE, weight: 8 },
        { imageDataUrl: variants.inkOnWhiteDataUrl, psm: tesseract.PSM.SINGLE_WORD, weight: 7 },
        { imageDataUrl: variants.thinStrokeDataUrl, psm: tesseract.PSM.SINGLE_LINE, weight: 6 },
        { imageDataUrl: variants.boostedDataUrl, psm: tesseract.PSM.SINGLE_LINE, weight: 5 },
        { imageDataUrl: variants.contrastDataUrl, psm: tesseract.PSM.SINGLE_LINE, weight: 4 },
        { imageDataUrl: variants.inkOnWhiteDataUrl, psm: tesseract.PSM.SPARSE_TEXT, weight: 4 },
      ]
    : [
        { imageDataUrl: variants.inkOnWhiteDataUrl, psm: tesseract.PSM.SPARSE_TEXT, weight: 8 },
        { imageDataUrl: variants.thinStrokeDataUrl, psm: tesseract.PSM.SPARSE_TEXT, weight: 6 },
        { imageDataUrl: variants.boostedDataUrl, psm: tesseract.PSM.SINGLE_BLOCK, weight: 5 },
        { imageDataUrl: variants.contrastDataUrl, psm: tesseract.PSM.SINGLE_BLOCK, weight: 5 },
        { imageDataUrl: variants.inkOnWhiteDataUrl, psm: tesseract.PSM.SINGLE_LINE, weight: 4 },
        { imageDataUrl: variants.contrastDataUrl, psm: tesseract.PSM.SINGLE_LINE, weight: 3 },
      ];

  for (const plan of plans) {
    try {
      const candidate = await runRecognitionPass(worker, plan.imageDataUrl, plan.psm, fieldId);
      if (!candidate) continue;
      candidateScores.set(candidate, (candidateScores.get(candidate) ?? 0) + plan.weight);
    } catch {
      // Best-effort local OCR pass.
    }
  }

  const ranked = Array.from(candidateScores.entries())
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([candidate]) => candidate);

  if (fieldId) {
    const filtered = filterPlausibleHandwrittenCandidates(fieldId, ranked);
    return (filtered.length ? filtered : ranked).slice(0, 8);
  }

  return ranked.slice(0, 8);
}

export async function prepareHandwrittenRegionOcrPayload(
  dataUrl: string,
  options?: { singleLine?: boolean; fieldId?: string },
): Promise<HandwrittenRegionOcrPayload> {
  const variants = await createImageVariants(dataUrl);
  const localCandidates = await collectLocalCandidates(variants, options);
  return {
    ...variants,
    localCandidates,
  };
}

export async function compressHandwrittenOcrPayloadForTransport(payload: HandwrittenRegionOcrPayload) {
  const [rawDataUrl, contrastDataUrl, boostedDataUrl, thinStrokeDataUrl, inkOnWhiteDataUrl] = await Promise.all([
    compressDataUrlForOcrTransport(payload.rawDataUrl),
    compressDataUrlForOcrTransport(payload.contrastDataUrl),
    compressDataUrlForOcrTransport(payload.boostedDataUrl),
    compressDataUrlForOcrTransport(payload.thinStrokeDataUrl),
    compressDataUrlForOcrTransport(payload.inkOnWhiteDataUrl),
  ]);
  return {
    rawDataUrl,
    contrastDataUrl,
    boostedDataUrl,
    thinStrokeDataUrl,
    inkOnWhiteDataUrl,
    localCandidates: payload.localCandidates,
  };
}

export type HandwrittenOcrRequestResult =
  | { ok: true; text: string; confidence: "high" | "medium" | "low"; source: "openrouter" | "local" }
  | { ok: false; error: string };

export async function requestHandwrittenRegionOcr(input: {
  visitId: string;
  fieldId: string;
  fieldLabel: string;
  singleLine?: boolean;
  rawDataUrl: string;
  contrastDataUrl: string;
  boostedDataUrl: string;
  thinStrokeDataUrl?: string;
  inkOnWhiteDataUrl?: string;
  localCandidates?: string[];
}): Promise<HandwrittenOcrRequestResult> {
  const body = {
    visitId: input.visitId,
    fieldId: input.fieldId,
    fieldLabel: input.fieldLabel,
    singleLine: input.singleLine,
    rawDataUrl: input.rawDataUrl,
    contrastDataUrl: input.contrastDataUrl,
    boostedDataUrl: input.boostedDataUrl,
    thinStrokeDataUrl: input.thinStrokeDataUrl,
    inkOnWhiteDataUrl: input.inkOnWhiteDataUrl,
    localCandidates: input.localCandidates ?? [],
  };

  const { recognizeHandwrittenRegionAction } = await import("@/app/(portal)/visits/visit-report-actions");

  let result: HandwrittenOcrRequestResult | null | undefined;
  try {
    result = await recognizeHandwrittenRegionAction(body);
  } catch {
    result = undefined;
  }

  if (!result || typeof result !== "object" || !("ok" in result)) {
    try {
      const response = await fetch("/api/visits/handwritten-ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      result = (await response.json()) as HandwrittenOcrRequestResult;
    } catch {
      result = undefined;
    }
  }

  const fieldId = input.fieldId;
  const localBest = pickBestVeterinaryOcrCandidate(fieldId, input.localCandidates ?? []);
  if (!result || typeof result !== "object" || !("ok" in result)) {
    if (localBest) {
      return { ok: true, text: localBest, confidence: "low", source: "local" };
    }
    return { ok: false, error: "OCR request failed. Try again or check your connection." };
  }

  if (!result.ok) {
    if (localBest) {
      return { ok: true, text: localBest, confidence: "low", source: "local" };
    }
    return result;
  }

  const cleanedCloud = applyVeterinaryOcrCleanup(fieldId, result.text.trim());
  if (cleanedCloud && result.source === "openrouter" && result.confidence !== "low") {
    const cloudOnly = pickBestVeterinaryOcrCandidate(fieldId, [cleanedCloud]);
    if (cloudOnly) return { ...result, text: cloudOnly };
  }
  if (cleanedCloud) {
    const merged = pickBestVeterinaryOcrCandidate(fieldId, [cleanedCloud, localBest, ...(input.localCandidates ?? [])]);
    return { ...result, text: merged || cleanedCloud };
  }

  if (localBest) {
    return { ok: true, text: localBest, confidence: "low", source: "local" };
  }

  return { ok: false, error: "OCR could not read any text from this region." };
}

export async function runHandwrittenRegionOcr(
  dataUrl: string,
  options?: { singleLine?: boolean; fieldId?: string },
) {
  const payload = await prepareHandwrittenRegionOcrPayload(dataUrl, options);
  const fieldId = options?.fieldId ?? "ccHp";
  return pickBestHandwrittenOcrText(fieldId, payload.localCandidates);
}
