import { readFile } from "node:fs/promises";
import path from "node:path";
import { resolveFaviconUrl } from "@saasclinics/lib";
import { getPlatformBranding } from "@/lib/platform-branding";

export const dynamic = "force-dynamic";

export default async function Icon() {
  const branding = await getPlatformBranding();
  const remote = resolveFaviconUrl(branding);
  if (remote) {
    try {
      const res = await fetch(remote, { cache: "no-store" });
      if (res.ok) {
        const bytes = await res.arrayBuffer();
        const type = res.headers.get("content-type")?.trim() || "image/png";
        return new Response(bytes, { headers: { "Content-Type": type } });
      }
    } catch {
      // Fall through to bundled SVG.
    }
  }

  const svgPath = path.join(process.cwd(), "public", "favicon.svg");
  const svg = await readFile(svgPath);
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml" } });
}
