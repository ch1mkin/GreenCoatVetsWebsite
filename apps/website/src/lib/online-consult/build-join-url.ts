import { getWebsitePublicBaseUrl } from "@/lib/seo/public-site-url";

export function buildOnlineConsultJoinUrl(appointmentId: string, guestToken: string): string {
  const base = getWebsitePublicBaseUrl().replace(/\/$/, "");
  return `${base}/consult/room/${appointmentId}?token=${encodeURIComponent(guestToken)}`;
}
