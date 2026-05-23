import type { PlatformBranding } from "./platform-branding";
import { resolveFaviconUrl } from "./platform-branding";

export type PlatformIconMetadata = {
  icon?: Array<{ url: string; type?: string; sizes?: string }>;
  shortcut?: Array<{ url: string }>;
  apple?: Array<{ url: string; type?: string; sizes?: string }>;
};

/** One tab icon: custom platform PNG when set, otherwise static SVG. */
export function buildPlatformIcons(branding: PlatformBranding): PlatformIconMetadata {
  const custom = resolveFaviconUrl(branding);
  if (custom) {
    return {
      icon: [{ url: custom, type: "image/png", sizes: "32x32" }],
      shortcut: [{ url: custom }],
      apple: [{ url: custom, sizes: "180x180" }],
    };
  }
  return {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml", sizes: "any" }],
    apple: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  };
}

export function resolvePublicSiteUrl(envValue: string | undefined, fallback: string): URL {
  const raw = (envValue ?? fallback).trim().replace(/\/$/, "");
  try {
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return new URL(fallback);
  }
}
