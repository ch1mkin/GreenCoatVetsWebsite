import type { HandwrittenVisitFieldId } from "@/lib/visits/handwritten-visit-sheet";

const NAME_FIELDS = new Set<HandwrittenVisitFieldId>(["patientName", "ownerName"]);
const PHONE_FIELDS = new Set<HandwrittenVisitFieldId>(["mobile"]);
const NUMERIC_VITAL_FIELDS = new Set<HandwrittenVisitFieldId>(["rt", "rr", "hr", "crt", "bw", "age"]);

/** Strip common Tesseract hallucinations (symbols, control chars, odd unicode). */
export function stripOcrGarbage(input: string) {
  return input
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .replace(/[©®™|¦§¶†‡•°±×÷]/g, " ")
    .replace(/[{}[\]<>\\^`~]/g, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .trim();
}

export function normalizeHandwrittenOcrText(input: string) {
  return stripOcrGarbage(input)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function letterRatio(text: string) {
  const letters = (text.match(/[A-Za-z]/g) ?? []).length;
  const digits = (text.match(/\d/g) ?? []).length;
  const symbols = (text.match(/[^A-Za-z0-9\s.,/'+\-:;()]/g) ?? []).length;
  const meaningful = letters + digits + symbols;
  if (!meaningful) return 0;
  return letters / meaningful;
}

function symbolRatio(text: string) {
  const symbols = (text.match(/[^A-Za-z0-9\s.,/'+\-:;()]/g) ?? []).length;
  return text.length ? symbols / text.length : 1;
}

/** Reject obvious OCR garbage before it can win candidate voting. */
export function isPlausibleHandwrittenOcr(fieldId: string, rawText: string): boolean {
  const text = normalizeHandwrittenOcrText(rawText);
  if (!text) return false;
  if (text.length > 600) return false;

  const symbols = symbolRatio(text);
  if (symbols > 0.22) return false;

  if (NAME_FIELDS.has(fieldId as HandwrittenVisitFieldId)) {
    const letters = (text.match(/[A-Za-z]/g) ?? []).length;
    if (letters < 2) return false;
    if (letterRatio(text) < 0.55) return false;
    if (/[©®™|¦]/.test(rawText)) return false;
    if (!/[A-Za-z]{2,}/.test(text)) return false;
    return true;
  }

  if (PHONE_FIELDS.has(fieldId as HandwrittenVisitFieldId)) {
    const digits = (text.match(/\d/g) ?? []).length;
    return digits >= 6 && digits / text.replace(/\s/g, "").length >= 0.5;
  }

  if (NUMERIC_VITAL_FIELDS.has(fieldId as HandwrittenVisitFieldId)) {
    return /\d/.test(text) && symbols < 0.35;
  }

  if (letterRatio(text) < 0.2 && !/\d{2,}/.test(text)) return false;
  return symbols < 0.4;
}

export function scoreHandwrittenOcrPlausibility(fieldId: string, rawText: string): number {
  const text = normalizeHandwrittenOcrText(rawText);
  if (!text || !isPlausibleHandwrittenOcr(fieldId, text)) return -1000;

  let score = Math.min(text.length, 60);

  if (NAME_FIELDS.has(fieldId as HandwrittenVisitFieldId)) {
    score += letterRatio(text) * 40;
    score -= symbolRatio(text) * 80;
    if (/^[A-Za-z][A-Za-z\s'.-]{1,}$/.test(text)) score += 15;
  } else {
    score += letterRatio(text) * 20;
    score -= symbolRatio(text) * 50;
  }

  return score;
}

export function filterPlausibleHandwrittenCandidates(fieldId: string, candidates: string[]): string[] {
  return candidates
    .map((candidate) => normalizeHandwrittenOcrText(candidate))
    .filter((candidate) => candidate.length > 0 && isPlausibleHandwrittenOcr(fieldId, candidate));
}

export function pickBestHandwrittenOcrText(fieldId: string, candidates: string[]): string {
  const plausible = filterPlausibleHandwrittenCandidates(fieldId, candidates);
  const pool = plausible.length ? plausible : candidates.map((c) => normalizeHandwrittenOcrText(c)).filter(Boolean);

  const scores = new Map<string, number>();
  for (const raw of pool) {
    const text = normalizeHandwrittenOcrText(raw);
    if (!text) continue;
    const key = text.toLowerCase();
    const plausibility = scoreHandwrittenOcrPlausibility(fieldId, text);
    const weight = text.length >= 2 ? 2 : 1;
    const agreementBoost = pool.filter((other) => normalizeHandwrittenOcrText(other).toLowerCase() === key).length;
    scores.set(key, (scores.get(key) ?? 0) + plausibility + weight + agreementBoost * 2);
  }

  const ranked = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return "";
  const bestKey = ranked[0]![0];
  return pool.map((c) => normalizeHandwrittenOcrText(c)).find((c) => c.toLowerCase() === bestKey) ?? ranked[0]![0];
}

export function tesseractCharWhitelistForField(fieldId: string): string | undefined {
  if (NAME_FIELDS.has(fieldId as HandwrittenVisitFieldId)) {
    return "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz '-.";
  }
  if (PHONE_FIELDS.has(fieldId as HandwrittenVisitFieldId)) {
    return "0123456789+()- ";
  }
  if (fieldId === "date") {
    return "0123456789/-. ";
  }
  if (NUMERIC_VITAL_FIELDS.has(fieldId as HandwrittenVisitFieldId)) {
    return "0123456789.,/-°CFcfkgmgmlbpmminsec ";
  }
  return undefined;
}
