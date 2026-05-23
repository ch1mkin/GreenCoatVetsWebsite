import { NextResponse } from "next/server";
import QRCode from "qrcode";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = String(searchParams.get("url") ?? "").trim();
  if (!url) {
    return NextResponse.json({ error: "url query parameter is required." }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid url." }, { status: 400 });
  }

  const png = await QRCode.toBuffer(url, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
    type: "png",
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=300",
    },
  });
}
