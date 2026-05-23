const DEFAULT_WEB_APP = "https://web.greencoatvets.com";
const DEFAULT_WEBSITE_APP = "https://www.greencoatvets.com";

export function getAuthAppUrls() {
  const webFromEnv = (process.env.NEXT_PUBLIC_WEB_APP_URL ?? "").trim().replace(/\/$/, "");
  const websiteFromEnv = (process.env.NEXT_PUBLIC_WEBSITE_APP_URL ?? "").trim().replace(/\/$/, "");
  const isProd = process.env.NODE_ENV === "production";

  return {
    webApp: webFromEnv || (isProd ? DEFAULT_WEB_APP : "http://localhost:3000"),
    websiteApp: websiteFromEnv || (isProd ? DEFAULT_WEBSITE_APP : "http://localhost:3001"),
  };
}
