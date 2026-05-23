const DEFAULT_WEB_APP_ORIGIN = "https://web.greencoatvets.com";

/** Canonical origin for the clinic web portal (OAuth callbacks must use this, not the marketing site). */
export function getWebAppOrigin(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_WEB_APP_URL ?? "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return DEFAULT_WEB_APP_ORIGIN;
}
