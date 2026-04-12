import { NextResponse } from "next/server";
import { getWebsiteAdminAccessCode, WEBSITE_ADMIN_UNLOCK_COOKIE } from "@/lib/admin/access-code";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { code?: string };
    const entered = (body.code ?? "").trim();
    const expected = await getWebsiteAdminAccessCode();
    if (!entered || entered !== expected) {
      return NextResponse.json({ error: "Invalid access code." }, { status: 403 });
    }
    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.cookies.set(WEBSITE_ADMIN_UNLOCK_COOKIE, "1", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/admin",
      maxAge: 60 * 60 * 12,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Could not validate access code." }, { status: 500 });
  }
}
