import { createClient } from "@/lib/supabase/server";
import { DEFAULT_MARKETING_LOCATIONS } from "./default-locations";
import {
  DEFAULT_HOMEPAGE_COPY,
  DEFAULT_HOMEPAGE_IMAGES,
  type HomepageCopy,
  type HomepageImageKey,
  type SocialLinks,
} from "./defaults";
import type { MarketingLocationPublic } from "./types";

export type MarketingSiteSettingsRow = {
  /** When no host match, used after `website_branded_for_clinic_id` is tried. */
  default_clinic_id: string | null;
  /** When no host match, preferred for branding / resolveClinic() before `default_clinic_id`. */
  website_branded_for_clinic_id: string | null;
  /** Super admin: receives public contact form emails (SMTP). */
  contact_form_recipient_email: string | null;
  homepage_images: Record<string, string>;
  social_links: SocialLinks;
  homepage_copy: HomepageCopy;
};

const EMPTY: MarketingSiteSettingsRow = {
  default_clinic_id: null,
  website_branded_for_clinic_id: null,
  contact_form_recipient_email: null,
  homepage_images: {},
  social_links: {},
  homepage_copy: {},
};

export async function getMarketingSiteSettings(): Promise<MarketingSiteSettingsRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("marketing_site_settings")
    .select(
      "default_clinic_id, website_branded_for_clinic_id, contact_form_recipient_email, homepage_images, social_links, homepage_copy",
    )
    .eq("id", "default")
    .maybeSingle();

  if (error || !data) {
    return { ...EMPTY };
  }

  return {
    default_clinic_id: data.default_clinic_id as string | null,
    website_branded_for_clinic_id: (data as { website_branded_for_clinic_id?: string | null })
      .website_branded_for_clinic_id ?? null,
    contact_form_recipient_email:
      ((data as { contact_form_recipient_email?: string | null }).contact_form_recipient_email as string | null)?.trim() ||
      null,
    homepage_images: (data.homepage_images as Record<string, string>) ?? {},
    social_links: (data.social_links as SocialLinks) ?? {},
    homepage_copy: ((data as { homepage_copy?: HomepageCopy | null }).homepage_copy as HomepageCopy) ?? {},
  };
}

export function mergeHomepageImages(db: Record<string, string>): Record<HomepageImageKey, string> {
  const out = { ...DEFAULT_HOMEPAGE_IMAGES };
  for (const key of Object.keys(DEFAULT_HOMEPAGE_IMAGES) as HomepageImageKey[]) {
    const v = db[key]?.trim();
    if (v) (out as Record<string, string>)[key] = v;
  }
  return out;
}

/** Resolved headline / tagline / call CTA for the public homepage. */
export function mergeHomepageCopy(db: HomepageCopy) {
  const line1 = db.hero_line1?.trim() || DEFAULT_HOMEPAGE_COPY.hero_line1;
  const gradient = db.hero_gradient?.trim() || DEFAULT_HOMEPAGE_COPY.hero_gradient;
  const tagline = db.hero_tagline?.trim() || DEFAULT_HOMEPAGE_COPY.hero_tagline;
  const callDisplay = db.navbar_call_display?.trim() || "";
  const callTelHref = db.navbar_call_tel_href?.trim() || "";
  return { line1, gradient, tagline, callDisplay, callTelHref };
}

/** Unique hero image URLs for the homepage slider (primary hero + optional extra slides). */
export function buildHeroSlideUrls(merged: Record<HomepageImageKey, string>, db: Record<string, string>): string[] {
  const primary = merged.hero;
  const extra = [db.hero_slide_2?.trim(), db.hero_slide_3?.trim()].filter(Boolean) as string[];
  const urls = [primary, ...extra];
  const seen = new Set<string>();
  return urls.filter((u) => {
    if (!u || seen.has(u)) return false;
    seen.add(u);
    return true;
  });
}

export async function getMarketingLocations(): Promise<MarketingLocationPublic[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("marketing_locations")
    .select("id, name, address_lines, phone_display, tel_href, hours_label, directions_url, latitude, longitude")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error || !data?.length) {
    return [];
  }

  return data.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    addressLines: Array.isArray(row.address_lines) ? (row.address_lines as string[]) : [],
    phoneDisplay: (row.phone_display as string) ?? "",
    telHref: (row.tel_href as string) ?? "",
    hoursLabel: (row.hours_label as string) ?? "",
    directionsUrl: (row.directions_url as string | null) ?? null,
    latitude: (() => {
      const n = typeof row.latitude === "number" ? row.latitude : Number(row.latitude);
      return Number.isFinite(n) ? n : null;
    })(),
    longitude: (() => {
      const n = typeof row.longitude === "number" ? row.longitude : Number(row.longitude);
      return Number.isFinite(n) ? n : null;
    })(),
  }));
}

export async function getMarketingLocationsOrDefaults(): Promise<MarketingLocationPublic[]> {
  const rows = await getMarketingLocations();
  if (rows.length > 0) return rows;
  return DEFAULT_MARKETING_LOCATIONS;
}

export type { MarketingLocationPublic } from "./types";
