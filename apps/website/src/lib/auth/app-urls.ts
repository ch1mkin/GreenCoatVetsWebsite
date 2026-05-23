export function getAuthAppUrls() {
  return {
    webApp: (process.env.NEXT_PUBLIC_WEB_APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
    websiteApp: (process.env.NEXT_PUBLIC_WEBSITE_APP_URL ?? "http://localhost:3001").replace(/\/$/, ""),
  };
}
