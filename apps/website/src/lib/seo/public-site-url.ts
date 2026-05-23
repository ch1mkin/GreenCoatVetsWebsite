import { resolvePublicSiteUrl } from "@saasclinics/lib";
import { headers } from "next/headers";
import type { MarketingSeoSettings } from "@/lib/marketing/seo-types";

/** Production marketing site — used when env is unset or still points at localhost. */
export const DEFAULT_PUBLIC_WEBSITE_ORIGIN = "https://www.greencoatvets.com";

const LOCAL_DEV_ORIGIN = "http://localhost:3001";

function hostnameFromUrlString(value: string): string | null {
  try {
    const raw = value.trim();
    if (!raw) return null;
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isLocalHostname(hostname: string | null): boolean {
  if (!hostname) return true;
  const host = hostname.split(":")[0];
  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
}

function isLocalUrl(value: string | undefined | null): boolean {
  if (!value?.trim()) return false;
  return isLocalHostname(hostnameFromUrlString(value));
}

function originFromRequestHeaders(): string | null {
  try {
    const h = headers();
    const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0]?.trim();
    if (!host || isLocalHostname(host)) return null;
    const proto = (h.get("x-forwarded-proto") ?? "https").split(",")[0]?.trim() || "https";
    return resolvePublicSiteUrl(`${proto}://${host}`, DEFAULT_PUBLIC_WEBSITE_ORIGIN).origin;
  } catch {
    return null;
  }
}

function resolveConfiguredOrigin(candidate: string | undefined | null, fallback: string): string {
  if (!candidate?.trim() || isLocalUrl(candidate)) {
    return resolvePublicSiteUrl(fallback, DEFAULT_PUBLIC_WEBSITE_ORIGIN).origin;
  }
  return resolvePublicSiteUrl(candidate, fallback).origin;
}

/**
 * Canonical public origin for sitemaps, robots, and metadata.
 * Never returns localhost in production builds or on a live request host.
 */
export function getWebsitePublicBaseUrl(seo?: MarketingSeoSettings | null): string {
  const override = seo?.public_site_url?.trim();
  if (override && !isLocalUrl(override)) {
    return resolvePublicSiteUrl(override, DEFAULT_PUBLIC_WEBSITE_ORIGIN).origin;
  }

  const fromEnv = process.env.NEXT_PUBLIC_WEBSITE_APP_URL;
  if (fromEnv?.trim() && !isLocalUrl(fromEnv)) {
    return resolveConfiguredOrigin(fromEnv, DEFAULT_PUBLIC_WEBSITE_ORIGIN);
  }

  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProduction && !isLocalUrl(vercelProduction)) {
    return resolveConfiguredOrigin(vercelProduction, DEFAULT_PUBLIC_WEBSITE_ORIGIN);
  }

  if (process.env.NODE_ENV === "production") {
    return resolvePublicSiteUrl(DEFAULT_PUBLIC_WEBSITE_ORIGIN, DEFAULT_PUBLIC_WEBSITE_ORIGIN).origin;
  }

  return resolveConfiguredOrigin(fromEnv, LOCAL_DEV_ORIGIN);
}

/** Prefer the live request host (e.g. www.greencoatvets.com) when generating sitemap/robots. */
export async function getWebsitePublicBaseUrlFromRequest(
  seo?: MarketingSeoSettings | null,
): Promise<string> {
  const fromRequest = originFromRequestHeaders();
  if (fromRequest) return fromRequest;
  return getWebsitePublicBaseUrl(seo);
}
