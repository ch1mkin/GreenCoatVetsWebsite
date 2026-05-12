import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "medical-files";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Server download support is not configured." }, { status: 503 });
  }

  const { data: visit, error: visitError } = await admin
    .from("visits")
    .select("id, clinic_id, visit_report_pdf_path, owners!inner(user_id)")
    .eq("id", params.id)
    .eq("owners.user_id", user.id)
    .maybeSingle();

  if (visitError || !visit) {
    return NextResponse.json({ error: "Visit not found." }, { status: 404 });
  }

  const { data: clinic, error: clinicError } = await admin
    .from("clinics")
    .select("website_owner_visit_reports_enabled")
    .eq("id", String((visit as { clinic_id?: string | null }).clinic_id ?? ""))
    .maybeSingle();
  if (clinicError) {
    return NextResponse.json({ error: clinicError.message }, { status: 400 });
  }
  if (((clinic as { website_owner_visit_reports_enabled?: boolean | null } | null)?.website_owner_visit_reports_enabled ?? true) === false) {
    return NextResponse.json({ error: "Visit-report downloads are disabled for this clinic." }, { status: 403 });
  }

  const path = String((visit as { visit_report_pdf_path?: string | null }).visit_report_pdf_path ?? "").trim();
  if (!path) {
    return NextResponse.json({ error: "Visit report is not available yet." }, { status: 404 });
  }

  const { data: blob, error: downloadError } = await admin.storage.from(BUCKET).download(path);
  if (downloadError || !blob) {
    return NextResponse.json({ error: "Visit report file is missing from storage." }, { status: 404 });
  }

  const bytes = await blob.arrayBuffer();
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="visit-report-${params.id.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
