import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { createClient } from "@/lib/supabase/server";
import { roleCanUseVisitPhoneCapture } from "@/lib/visits/phone-capture-access";
import {
  generatePhoneCaptureToken,
  PHONE_CAPTURE_SESSION_TTL_MS,
} from "@/lib/visits/phone-capture-token";

function webAppOrigin(request: Request): string {
  const fromEnv = (process.env.NEXT_PUBLIC_WEB_APP_URL ?? "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  try {
    return new URL(request.url).origin;
  } catch {
    return "http://localhost:3000";
  }
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const [{ data: superAdmin }, { data: membership }] = await Promise.all([
    supabase.from("platform_super_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("user_clinic_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const isSuperAdmin = Boolean(superAdmin);
  const role = (membership?.role as string | undefined) ?? (isSuperAdmin ? "super_admin" : "");
  if (!roleCanUseVisitPhoneCapture(role, isSuperAdmin)) {
    return NextResponse.json({ error: "Your role cannot start phone capture for visits." }, { status: 403 });
  }

  let visitId = "";
  try {
    const body = (await request.json()) as { visitId?: string };
    visitId = String(body.visitId ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!visitId) {
    return NextResponse.json({ error: "visitId is required." }, { status: 400 });
  }

  const { clinic_id } = await getActiveMembership();

  const { data: visit, error: visitError } = await supabase
    .from("visits")
    .select("id, clinic_id, branch_id, pet_id, completed_at")
    .eq("id", visitId)
    .eq("clinic_id", clinic_id)
    .maybeSingle();

  if (visitError || !visit) {
    return NextResponse.json({ error: "Visit not found." }, { status: 404 });
  }

  const expiresAt = new Date(Date.now() + PHONE_CAPTURE_SESSION_TTL_MS).toISOString();
  const { token, tokenHash } = generatePhoneCaptureToken();

  await supabase
    .from("visit_phone_capture_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("visit_id", visitId)
    .is("revoked_at", null);

  const { error: insertError } = await supabase.from("visit_phone_capture_sessions").insert({
    visit_id: visitId,
    clinic_id: visit.clinic_id,
    branch_id: visit.branch_id,
    pet_id: visit.pet_id,
    token_hash: tokenHash,
    created_by: user.id,
    expires_at: expiresAt,
  });

  if (insertError) {
    const hint = /visit_phone_capture_sessions/i.test(insertError.message)
      ? " Database migration for visit phone capture may be missing — contact your administrator."
      : "";
    return NextResponse.json({ error: `${insertError.message}${hint}` }, { status: 500 });
  }

  const captureUrl = `${webAppOrigin(request)}/visit-capture/${token}`;
  const issuedAt = Date.now();

  let qrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(captureUrl, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 280,
      type: "image/png",
    });
  } catch {
    qrDataUrl = "";
  }

  return NextResponse.json({
    captureUrl,
    expiresAt,
    issuedAt,
    qrDataUrl,
    qrImageUrl: `/api/visits/phone-capture/qr?url=${encodeURIComponent(captureUrl)}&t=${issuedAt}`,
  });
}
