"use server";

import { revalidatePath } from "next/cache";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { buildHandwrittenCanvasPdfBytes } from "@/lib/pdf/clinic-documents";
import { createClient } from "@/lib/supabase/server";
import { buildVisitReportPdfForVisit } from "@/lib/pdf/visit-report-pdf";
import { assertVisitReportAccess } from "@/lib/visits/visit-report-access";

const BUCKET = "medical-files";

/**
 * Generates the PDF, uploads to medical-files, and stores the path on the visit row (attachment for pet profile).
 */
export async function regenerateVisitReportPdfAttachment(visitId: string, options?: { force?: boolean }) {
  const access = await getUserAccess();
  if (access.membership?.role === "pet_owner") {
    throw new Error("Only clinic staff can save visit PDFs to the record.");
  }
  const supabase = createClient();
  await assertVisitReportAccess(supabase, access, visitId);

  const { data: visit, error: vErr } = await supabase
    .from("visits")
    .select("*")
    .eq("id", visitId)
    .single();

  if (vErr || !visit) throw new Error(vErr?.message ?? "Visit not found.");
  if ((visit as { visit_report_pdf_source?: string | null }).visit_report_pdf_source === "handwritten" && !options?.force) {
    return;
  }

  const bytes = await buildVisitReportPdfForVisit(supabase, visitId);
  const path = `${visit.clinic_id}/pets/${visit.pet_id}/visits/${visitId}/visit-report.pdf`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (upErr) throw new Error(upErr.message);

  const nowIso = new Date().toISOString();
  let { error: upRow } = await supabase
    .from("visits")
    .update({
      visit_report_pdf_path: path,
      visit_report_pdf_generated_at: nowIso,
      visit_report_pdf_source: "generated",
    })
    .eq("id", visitId)
    .eq("clinic_id", visit.clinic_id as string);

  if (upRow && /visit_report_pdf_source/i.test(upRow.message)) {
    const fallback = await supabase
      .from("visits")
      .update({
        visit_report_pdf_path: path,
        visit_report_pdf_generated_at: nowIso,
      })
      .eq("id", visitId)
      .eq("clinic_id", visit.clinic_id as string);
    upRow = fallback.error;
  }

  if (upRow) throw new Error(upRow.message);

  revalidatePath(`/visits/${visitId}`);
  revalidatePath(`/pets/${visit.pet_id}`);
}

export async function regenerateVisitReportPdfFormAction(formData: FormData) {
  const visitId = String(formData.get("visit_id") ?? "").trim();
  if (!visitId) throw new Error("Visit id is required.");
  await regenerateVisitReportPdfAttachment(visitId, { force: true });
}

type SaveHandwrittenVisitPdfResult = { ok: true; pdfPath: string } | { ok: false; error: string };

function decodeImageDataUrl(dataUrl: string): Uint8Array {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i);
  if (!match) {
    throw new Error("Handwritten visit image is invalid.");
  }
  return Uint8Array.from(Buffer.from(match[2] ?? "", "base64"));
}

async function readHandwrittenImageUpload(formData: FormData): Promise<Uint8Array> {
  const uploaded = formData.get("image_file");
  const file = uploaded instanceof File ? uploaded : null;
  if (file && file.size > 0) {
    if (!(file.type || "").startsWith("image/")) {
      throw new Error("Handwritten visit upload must be an image.");
    }
    return new Uint8Array(await file.arrayBuffer());
  }

  const imageDataUrl = String(formData.get("image_data_url") ?? "").trim();
  if (!imageDataUrl) {
    throw new Error("Visit and handwritten image are required.");
  }
  return decodeImageDataUrl(imageDataUrl);
}

export async function saveHandwrittenVisitPdfAction(formData: FormData): Promise<SaveHandwrittenVisitPdfResult> {
  try {
    const access = await getUserAccess();
    if (access.membership?.role === "pet_owner") {
      return { ok: false, error: "Only clinic staff can save handwritten visit sheets." };
    }

    const visitId = String(formData.get("visit_id") ?? "").trim();
    if (!visitId) {
      return { ok: false, error: "Visit and handwritten image are required." };
    }

    const supabase = createClient();
    await assertVisitReportAccess(supabase, access, visitId);

    const { data: visit, error: visitError } = await supabase
      .from("visits")
      .select("id, clinic_id, pet_id, branch_id")
      .eq("id", visitId)
      .single();

    if (visitError || !visit) {
      return { ok: false, error: visitError?.message ?? "Visit not found." };
    }

    const uploadedImageBytes = await readHandwrittenImageUpload(formData);
    const pdfBytes = await buildHandwrittenCanvasPdfBytes({
      imageBytes: uploadedImageBytes,
      footerText: `Handwritten visit sheet saved ${new Date().toLocaleString()}.`,
    });
    const path = `${visit.clinic_id}/pets/${visit.pet_id}/visits/${visitId}/visit-report-handwritten.pdf`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (uploadError) return { ok: false, error: uploadError.message };

    const nowIso = new Date().toISOString();
    let { error: visitUpdateError } = await supabase
      .from("visits")
      .update({
        visit_report_pdf_path: path,
        visit_report_pdf_generated_at: nowIso,
        visit_report_pdf_source: "handwritten",
      })
      .eq("id", visitId)
      .eq("clinic_id", visit.clinic_id as string);
    if (visitUpdateError && /visit_report_pdf_source/i.test(visitUpdateError.message)) {
      const fallback = await supabase
        .from("visits")
        .update({
          visit_report_pdf_path: path,
          visit_report_pdf_generated_at: nowIso,
        })
        .eq("id", visitId)
        .eq("clinic_id", visit.clinic_id as string);
      visitUpdateError = fallback.error;
    }
    if (visitUpdateError) return { ok: false, error: visitUpdateError.message };

    revalidatePath(`/visits/${visitId}`);
    revalidatePath(`/pets/${visit.pet_id}`);
    return { ok: true, pdfPath: path };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save handwritten visit PDF." };
  }
}
