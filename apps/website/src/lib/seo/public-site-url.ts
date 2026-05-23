import { resolvePublicSiteUrl } from "@saasclinics/lib";
import type { MarketingSeoSettings } from "@/lib/marketing/seo-types";

export function getWebsitePublicBaseUrl(seo?: MarketingSeoSettings | null): string {
  const override = seo?.public_site_url?.trim();
  if (override) {
    return resolvePublicSiteUrl(override, "http://localhost:3001").origin;
  }
  return resolvePublicSiteUrl(process.env.NEXT_PUBLIC_WEBSITE_APP_URL, "http://localhost:3001").origin;
}
