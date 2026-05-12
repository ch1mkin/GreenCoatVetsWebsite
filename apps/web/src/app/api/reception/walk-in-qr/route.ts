import { NextResponse } from "next/server";
import sharp from "sharp";

const BRAND_GREEN = "#006c50";
const BRAND_GREEN_SOFT = "#0d8b68";
const BRAND_GREEN_DARK = "#084f3b";
const GOLD_LIGHT = "#f7dc6f";
const GOLD_DARK = "#c99a1a";
const TEXT_DARK = "#111827";
const TEXT_MUTED = "#5f6f68";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const mimeType = response.headers.get("content-type")?.trim() || "image/png";
    const bytes = Buffer.from(await response.arrayBuffer()).toString("base64");
    return `data:${mimeType};base64,${bytes}`;
  } catch {
    return null;
  }
}

function pawPrint(x: number, y: number, scale: number, opacity = 0.12): string {
  const toe = 11 * scale;
  const padX = 18 * scale;
  const padY = 15 * scale;
  return `
    <g transform="translate(${x} ${y})" fill="white" opacity="${opacity}">
      <circle cx="${-18 * scale}" cy="${-18 * scale}" r="${toe}" />
      <circle cx="${0}" cy="${-28 * scale}" r="${toe}" />
      <circle cx="${18 * scale}" cy="${-18 * scale}" r="${toe}" />
      <circle cx="${-4 * scale}" cy="${0}" r="${toe}" />
      <ellipse cx="0" cy="${18 * scale}" rx="${padX}" ry="${padY}" />
    </g>
  `;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const target = String(searchParams.get("target") ?? "").trim();
  const label = String(searchParams.get("label") ?? "GreenCoatVets").trim() || "GreenCoatVets";
  const download = searchParams.get("download") === "1";
  const format = String(searchParams.get("format") ?? (download ? "png" : "svg"))
    .trim()
    .toLowerCase();
  const wantsPng = format === "png";

  let normalizedTarget = "";
  try {
    normalizedTarget = new URL(target).toString();
  } catch {
    return NextResponse.json({ error: "A valid absolute target URL is required." }, { status: 400 });
  }

  const qrSourceUrl = `https://api.qrserver.com/v1/create-qr-code/?size=720x720&margin=0&data=${encodeURIComponent(normalizedTarget)}`;
  const logoSourceUrl = new URL("/platform-logo.png", origin).toString();
  const [qrDataUrl, logoDataUrl] = await Promise.all([fetchAsDataUrl(qrSourceUrl), fetchAsDataUrl(logoSourceUrl)]);

  if (!qrDataUrl) {
    return NextResponse.json({ error: "Could not build the QR image." }, { status: 502 });
  }

  const safeLabel = escapeXml(label.slice(0, 42));
  const targetUrl = new URL(normalizedTarget);
  const safeDisplayUrl = escapeXml(`${targetUrl.host}${targetUrl.pathname}${targetUrl.search}`.replace(/\/$/, ""));

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1400" viewBox="0 0 1080 1400" role="img" aria-label="${safeLabel} walk-in booking QR">
      <defs>
        <linearGradient id="brandBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${BRAND_GREEN_SOFT}" />
          <stop offset="100%" stop-color="${BRAND_GREEN_DARK}" />
        </linearGradient>
        <linearGradient id="goldBorder" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${GOLD_LIGHT}" />
          <stop offset="50%" stop-color="#ffe8a3" />
          <stop offset="100%" stop-color="${GOLD_DARK}" />
        </linearGradient>
        <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="18" stdDeviation="26" flood-color="#003527" flood-opacity="0.22" />
        </filter>
        <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="10" flood-color="${GOLD_LIGHT}" flood-opacity="0.38" />
        </filter>
      </defs>

      <rect x="0" y="0" width="1080" height="1400" rx="56" fill="url(#brandBg)" />
      ${pawPrint(118, 132, 1.35)}
      ${pawPrint(930, 150, 1.1)}
      ${pawPrint(146, 1260, 1.2)}
      ${pawPrint(960, 1216, 1.3)}
      ${pawPrint(850, 310, 0.85, 0.1)}
      ${pawPrint(245, 1010, 0.9, 0.1)}
      ${pawPrint(292, 226, 0.95, 0.08)}
      ${pawPrint(760, 196, 0.92, 0.08)}
      ${pawPrint(886, 438, 1.05, 0.09)}
      ${pawPrint(174, 560, 0.88, 0.08)}
      ${pawPrint(924, 846, 0.98, 0.08)}
      ${pawPrint(352, 1188, 1.02, 0.08)}

      <rect x="62" y="62" width="956" height="1276" rx="48" fill="none" stroke="url(#goldBorder)" stroke-width="8" filter="url(#goldGlow)" />
      <rect x="74" y="74" width="932" height="1252" rx="42" fill="white" stroke="url(#goldBorder)" stroke-width="3" filter="url(#cardShadow)" />

      <rect x="118" y="118" width="844" height="188" rx="32" fill="white" stroke="url(#goldBorder)" stroke-width="4" />
      ${logoDataUrl ? `<rect x="154" y="144" width="120" height="120" rx="24" fill="white" stroke="#d9e6e0" stroke-width="2" />` : ""}
      ${logoDataUrl ? `<image href="${logoDataUrl}" x="161" y="151" width="106" height="106" preserveAspectRatio="xMidYMid meet" />` : ""}
      <text x="${logoDataUrl ? 300 : 160}" y="188" font-family="Inter, Arial, sans-serif" font-size="54" font-weight="800" fill="${TEXT_DARK}">
        ${safeLabel}
      </text>
      <text x="${logoDataUrl ? 300 : 160}" y="236" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="600" fill="${TEXT_DARK}">
        Walk-in self check-in
      </text>
      <text x="${logoDataUrl ? 300 : 160}" y="274" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="500" fill="${TEXT_MUTED}">
        Scan to open the booking form on your clinic website
      </text>

      <rect x="188" y="372" width="704" height="704" rx="34" fill="white" stroke="url(#goldBorder)" stroke-width="10" />
      <image href="${qrDataUrl}" x="242" y="426" width="596" height="596" preserveAspectRatio="xMidYMid meet" />

      <text x="540" y="1148" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="36" font-weight="800" fill="${BRAND_GREEN}">
        Scan here to book
      </text>
      <text x="540" y="1204" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="600" fill="${TEXT_MUTED}">
        ${safeDisplayUrl}
      </text>
    </svg>
  `.trim();

  if (wantsPng) {
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="greencoatvets-walk-in-qr.png"`,
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="greencoatvets-walk-in-qr.svg"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
