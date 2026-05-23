import type { MetadataRoute } from "next";
import { getMarketingSiteSettings } from "@/lib/marketing/get-marketing-site";
import { getWebsitePublicBaseUrlFromRequest } from "@/lib/seo/public-site-url";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const marketing = await getMarketingSiteSettings();
  const base = await getWebsitePublicBaseUrlFromRequest(marketing.seo_settings);

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/admin", "/account/", "/api/admin/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
