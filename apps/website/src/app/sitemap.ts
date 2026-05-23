import type { MetadataRoute } from "next";
import { getMarketingSiteSettings } from "@/lib/marketing/get-marketing-site";
import { buildMarketingSitemapEntries } from "@/lib/seo/build-sitemap-entries";
import { getWebsitePublicBaseUrlFromRequest } from "@/lib/seo/public-site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const marketing = await getMarketingSiteSettings();
  const base = await getWebsitePublicBaseUrlFromRequest(marketing.seo_settings);
  const entries = await buildMarketingSitemapEntries();

  return entries.map((entry) => ({
    ...entry,
    url: entry.url.startsWith("http") ? entry.url : new URL(entry.url, base).href,
  }));
}
