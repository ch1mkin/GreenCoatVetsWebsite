import { createClient } from "@/lib/supabase/server";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";

export async function isWebsiteStoreEnabled(): Promise<boolean> {
  const supabase = createClient();
  const clinic = await resolveClinic();
  const { data } = await supabase
    .from("platform_branding")
    .select("website_store_enabled")
    .eq("id", "default")
    .maybeSingle();
  const globalEnabled = (data?.website_store_enabled as boolean | null | undefined) ?? true;
  const clinicEnabled = clinic.website_store_enabled ?? true;
  return globalEnabled && clinicEnabled;
}
