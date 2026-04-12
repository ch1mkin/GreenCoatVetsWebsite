import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const WEBSITE_ADMIN_UNLOCK_COOKIE = "website_admin_unlock";
const DEFAULT_ACCESS_CODE = "15072005";

export async function getWebsiteAdminAccessCode(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase
    .from("platform_branding")
    .select("website_admin_access_code")
    .eq("id", "default")
    .maybeSingle();
  const code = (data as { website_admin_access_code?: string | null } | null)?.website_admin_access_code?.trim();
  return code && code.length > 0 ? code : DEFAULT_ACCESS_CODE;
}

export function isWebsiteAdminUnlocked(): boolean {
  return cookies().get(WEBSITE_ADMIN_UNLOCK_COOKIE)?.value === "1";
}
