const DEFAULT_WEB_APP_ORIGIN = "https://web.greencoatvets.com";

export function getWebAppOrigin(): string {
  return (process.env.NEXT_PUBLIC_WEB_APP_URL ?? DEFAULT_WEB_APP_ORIGIN).trim().replace(/\/$/, "");
}
