import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { path?: string };
    const path = typeof body.path === "string" ? body.path.trim() : "";
    if (!path || path.length > 2048) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    if (!path.startsWith("/") || path.startsWith("/admin")) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const supabase = createClient();
    const { error } = await supabase.from("marketing_site_page_views").insert({ path });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
