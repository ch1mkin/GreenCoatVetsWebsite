import type { MetadataRoute } from "next";
import { getMarketingSiteSettings } from "@/lib/marketing/get-marketing-site";
import { buildMarketingSitemapEntries } from "@/lib/seo/build-sitemap-entries";
import { getWebsitePublicBaseUrl } from "@/lib/seo/public-site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const marketing = await getMarketingSiteSettings();
  const base = getWebsitePublicBaseUrl(marketing.seo_settings);
  const entries = await buildMarketingSitemapEntries();

  return entries.map((entry) => ({
    ...entry,
    url: entry.url.startsWith("http") ? entry.url : new URL(entry.url, base).href,
  }));
}
