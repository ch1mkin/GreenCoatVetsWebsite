import { createHash, randomBytes } from "node:crypto";

export function generatePhoneCaptureToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashPhoneCaptureToken(token) };
}

export function hashPhoneCaptureToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

export const PHONE_CAPTURE_SESSION_TTL_MS = 4 * 60 * 60 * 1000;
