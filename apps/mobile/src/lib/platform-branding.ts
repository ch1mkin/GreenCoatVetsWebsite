import { supabase } from "./supabase";

export type PlatformBranding = {
  product_name: string;
  logo_url: string | null;
  favicon_url: string | null;
};

const DEFAULT: PlatformBranding = {
  product_name: "GreenCoatVets",
  logo_url: null,
  favicon_url: null,
};

/** Public read — same row as web (`platform_branding.id = default`). */
export async function loadPlatformBranding(): Promise<PlatformBranding> {
  const { data, error } = await supabase
    .from("platform_branding")
    .select("product_name, logo_url, favicon_url")
    .eq("id", "default")
    .maybeSingle();

  if (error || !data) {
    return { ...DEFAULT };
  }

  return {
    product_name: (data.product_name as string)?.trim() || DEFAULT.product_name,
    logo_url: (data.logo_url as string | null) ?? null,
    favicon_url: (data.favicon_url as string | null) ?? null,
  };
}
