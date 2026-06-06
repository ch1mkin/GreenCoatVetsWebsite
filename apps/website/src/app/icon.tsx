import { fetchTabIconResponse, resolveFaviconUrl } from "@saasclinics/lib";
import { getPlatformBranding } from "@/lib/platform-branding";

export const dynamic = "force-dynamic";

export default async function Icon() {
  const branding = await getPlatformBranding();
  return fetchTabIconResponse(resolveFaviconUrl(branding));
}
