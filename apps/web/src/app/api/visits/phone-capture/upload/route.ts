import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { hashPhoneCaptureToken } from "@/lib/visits/phone-capture-token";

export async function POST(request: Request) {
  const formData = await request.formData();
  const token = String(formData.get("token") ?? "").trim();
  const file = formData.get("file");

  if (!token) {
    return NextResponse.json({ error: "Missing capture token." }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Please choose a photo to upload." }, { status: 400 });
  }

  const serviceRole = createServiceRoleClient();
  if (!serviceRole) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  const tokenHash = hashPhoneCaptureToken(token);
  const now = new Date().toISOString();

  const { data: session, error: sessionError } = await serviceRole
    .from("visit_phone_capture_sessions")
    .select("id, visit_id, clinic_id, branch_id, pet_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Invalid or expired link. Scan the QR again from your laptop." }, { status: 403 });
  }

  if (session.revoked_at || session.expires_at < now) {
    return NextResponse.json({ error: "This capture link has expired. Scan a new QR from the visit on your laptop." }, { status: 403 });
  }

  const safeName = (file.name || "phone-capture.jpg").replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${session.clinic_id}/${session.visit_id}/${Date.now()}-${safeName}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await serviceRole.storage
    .from("medical-files")
    .upload(storagePath, arrayBuffer, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { error: insertError } = await serviceRole.from("file_attachments").insert({
    clinic_id: session.clinic_id,
    branch_id: session.branch_id,
    pet_id: session.pet_id,
    visit_id: session.visit_id,
    storage_bucket: "medical-files",
    storage_path: storagePath,
    file_name: file.name || "phone-capture.jpg",
    mime_type: file.type || "image/jpeg",
    uploaded_by: null,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, fileName: file.name || "phone-capture.jpg" });
}
