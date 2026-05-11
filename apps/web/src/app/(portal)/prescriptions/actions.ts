"use server";

import { revalidatePath } from "next/cache";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { getUserAccess } from "@/lib/auth/get-user-access";
import {
  findBestMedicineCatalogMatch,
  shouldAutoCorrectMedicine,
  type MedicineCatalogEntry,
} from "@/lib/medicines/catalog";
import { buildHandwrittenPrescriptionPdfBytes } from "@/lib/pdf/clinic-documents";
import { createClient } from "@/lib/supabase/server";

export type RxLineItem = {
  id: string;
  medicine_name: string;
  dosage: string;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
};

export type AddPrescriptionItemResult =
  | { ok: true; item: RxLineItem; correction: { from: string; to: string } | null }
  | { ok: false; error: string };

type MedicineCatalogRow = Pick<
  MedicineCatalogEntry,
  | "id"
  | "name"
  | "aliases"
  | "form"
  | "strength"
  | "manufacturer"
  | "default_dosage"
  | "default_frequency"
  | "default_duration"
  | "notes"
  | "is_active"
>;

async function loadClinicMedicineCatalog(
  supabase: ReturnType<typeof createClient>,
  clinicId: string,
): Promise<MedicineCatalogEntry[]> {
  const { data, error } = await supabase
    .from("medicine_catalog_entries")
    .select(
      "id, name, aliases, form, strength, manufacturer, default_dosage, default_frequency, default_duration, notes, is_active",
    )
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(500);

  if (error) throw new Error(error.message);

  return ((data ?? []) as MedicineCatalogRow[]).map((row) => ({
    ...row,
    aliases: Array.isArray(row.aliases) ? row.aliases : [],
    form: row.form ?? null,
    strength: row.strength ?? null,
    manufacturer: row.manufacturer ?? null,
    default_dosage: row.default_dosage ?? null,
    default_frequency: row.default_frequency ?? null,
    default_duration: row.default_duration ?? null,
    notes: row.notes ?? null,
    is_active: row.is_active ?? true,
  }));
}

function canSavePrescriptionArtifacts(role: string | null | undefined, isSuperAdmin: boolean): boolean {
  if (isSuperAdmin) return true;
  return ["receptionist", "clinic_admin", "branch_admin", "doctor", "pharmacist", "lab_technician"].includes(role ?? "");
}

/** Inserts a line and returns the row — no redirect (client updates UI). */
export async function addPrescriptionItemAction(formData: FormData): Promise<AddPrescriptionItemResult> {
  const prescriptionId = String(formData.get("prescription_id") ?? "").trim();
  const rawMedicineName = String(formData.get("medicine_name") ?? "").trim();
  const dosage = String(formData.get("dosage") ?? "").trim();
  const frequency = String(formData.get("frequency") ?? "").trim();
  const duration = String(formData.get("duration") ?? "").trim();
  const instructions = String(formData.get("instructions") ?? "").trim();

  if (!prescriptionId || !rawMedicineName) {
    return { ok: false, error: "Prescription and medicine name are required." };
  }

  try {
    const { clinic_id } = await getActiveMembership();
    const supabase = createClient();

    const { data: prescription, error: lookupError } = await supabase
      .from("prescriptions")
      .select("id, clinic_id, visit_id")
      .eq("id", prescriptionId)
      .eq("clinic_id", clinic_id)
      .maybeSingle();

    if (lookupError) return { ok: false, error: lookupError.message };
    if (!prescription) {
      return { ok: false, error: "Prescription not found. Reload the visit and try again." };
    }

    const catalog = await loadClinicMedicineCatalog(supabase, clinic_id);
    const match = findBestMedicineCatalogMatch(rawMedicineName, catalog);
    const autoMatch = shouldAutoCorrectMedicine(match) ? match : null;
    const correctedName = autoMatch ? autoMatch.entry.name : rawMedicineName;
    const finalDosage = dosage || (autoMatch ? autoMatch.entry.default_dosage ?? "" : "");
    const finalFrequency = frequency || (autoMatch ? autoMatch.entry.default_frequency ?? "" : "");
    const finalDuration = duration || (autoMatch ? autoMatch.entry.default_duration ?? "" : "");

    if (!finalDosage.trim()) {
      return { ok: false, error: "Dosage is required. Add it manually or store a default dosage in the medicine catalog." };
    }

    const { data: inserted, error: insertError } = await supabase
      .from("prescription_items")
      .insert({
        prescription_id: prescription.id,
        medicine_name: correctedName,
        dosage: finalDosage,
        frequency: finalFrequency || null,
        duration: finalDuration || null,
        instructions: instructions || null,
      })
      .select("id, medicine_name, dosage, frequency, duration, instructions")
      .single();

    if (insertError) return { ok: false, error: insertError.message };
    if (!inserted) return { ok: false, error: "Insert did not return a row." };

    const item: RxLineItem = {
      id: inserted.id as string,
      medicine_name: String(inserted.medicine_name ?? ""),
      dosage: String(inserted.dosage ?? ""),
      frequency: (inserted.frequency as string | null) ?? null,
      duration: (inserted.duration as string | null) ?? null,
      instructions: (inserted.instructions as string | null) ?? null,
    };

    const correction =
      correctedName.localeCompare(rawMedicineName, undefined, { sensitivity: "accent" }) === 0
        ? null
        : { from: rawMedicineName, to: correctedName };

    return { ok: true, item, correction };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to add medicine line.";
    return { ok: false, error: msg };
  }
}

export type UpdateRxInstructionsResult = { ok: true } | { ok: false; error: string };

export async function updatePrescriptionItemInstructionsAction(formData: FormData): Promise<UpdateRxInstructionsResult> {
  const itemId = String(formData.get("item_id") ?? "").trim();
  const instructions = String(formData.get("instructions") ?? "").trim();
  const visitId = String(formData.get("visit_id") ?? "").trim();

  if (!itemId || !visitId) {
    return { ok: false, error: "Medicine line and visit are required." };
  }

  try {
    const { clinic_id } = await getActiveMembership();
    const supabase = createClient();

    const { data: item, error: itemErr } = await supabase
      .from("prescription_items")
      .select("id, prescription_id")
      .eq("id", itemId)
      .maybeSingle();

    if (itemErr) return { ok: false, error: itemErr.message };
    if (!item) return { ok: false, error: "Prescription line not found." };

    const { data: presc, error: prescErr } = await supabase
      .from("prescriptions")
      .select("id, clinic_id, visit_id")
      .eq("id", item.prescription_id)
      .maybeSingle();

    if (prescErr) return { ok: false, error: prescErr.message };
    if (!presc || presc.clinic_id !== clinic_id || presc.visit_id !== visitId) {
      return { ok: false, error: "You cannot update this prescription line." };
    }

    const { error: upErr } = await supabase
      .from("prescription_items")
      .update({ instructions: instructions || null })
      .eq("id", itemId);

    if (upErr) return { ok: false, error: upErr.message };

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update instructions.";
    return { ok: false, error: msg };
  }
}

export type SaveHandwrittenPrescriptionResult = { ok: true; pdfPath: string } | { ok: false; error: string };

function decodeImageDataUrl(dataUrl: string): Uint8Array {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i);
  if (!match) {
    throw new Error("Handwritten prescription image is invalid.");
  }

  const base64 = match[2] ?? "";
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

export async function saveHandwrittenPrescriptionPdfAction(formData: FormData): Promise<SaveHandwrittenPrescriptionResult> {
  try {
    const access = await getUserAccess();
    if (!canSavePrescriptionArtifacts(access.membership?.role, access.isSuperAdmin)) {
      return { ok: false, error: "You do not have permission to save handwritten prescriptions." };
    }

    const prescriptionId = String(formData.get("prescription_id") ?? "").trim();
    const visitId = String(formData.get("visit_id") ?? "").trim();
    const imageDataUrl = String(formData.get("image_data_url") ?? "").trim();
    if (!prescriptionId || !visitId || !imageDataUrl) {
      return { ok: false, error: "Prescription, visit, and image are required." };
    }

    const { clinic_id } = await getActiveMembership();
    const supabase = createClient();

    const { data: prescription, error: prescriptionError } = await supabase
      .from("prescriptions")
      .select("id, clinic_id, visit_id, pet_id, branch_id")
      .eq("id", prescriptionId)
      .eq("clinic_id", clinic_id)
      .maybeSingle();

    if (prescriptionError) return { ok: false, error: prescriptionError.message };
    if (!prescription || prescription.visit_id !== visitId) {
      return { ok: false, error: "Prescription not found for this visit." };
    }

    const imageBytes = decodeImageDataUrl(imageDataUrl);
    const pdfBytes = await buildHandwrittenPrescriptionPdfBytes({
      imageBytes,
      footerText: `Handwritten prescription saved ${new Date().toLocaleString()}.`,
    });

    const pdfPath = `${clinic_id}/prescriptions/${prescriptionId}-handwritten.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("medical-files")
      .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (uploadError) return { ok: false, error: uploadError.message };

    const { error: updateError } = await supabase
      .from("prescriptions")
      .update({ pdf_url: pdfPath })
      .eq("id", prescriptionId)
      .eq("clinic_id", clinic_id);
    if (updateError) return { ok: false, error: updateError.message };

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const attachmentPayload = {
      clinic_id,
      branch_id: prescription.branch_id,
      pet_id: prescription.pet_id,
      visit_id: prescription.visit_id,
      storage_bucket: "medical-files",
      storage_path: pdfPath,
      file_name: "handwritten-prescription.pdf",
      mime_type: "application/pdf",
      uploaded_by: user?.id ?? null,
    };

    const { data: existingAttachment, error: attachmentLookupError } = await supabase
      .from("file_attachments")
      .select("id")
      .eq("clinic_id", clinic_id)
      .eq("storage_path", pdfPath)
      .maybeSingle();
    if (attachmentLookupError) return { ok: false, error: attachmentLookupError.message };

    if (existingAttachment?.id) {
      const { error: attachmentUpdateError } = await supabase
        .from("file_attachments")
        .update(attachmentPayload)
        .eq("id", existingAttachment.id)
        .eq("clinic_id", clinic_id);
      if (attachmentUpdateError) return { ok: false, error: attachmentUpdateError.message };
    } else {
      const { error: attachmentInsertError } = await supabase.from("file_attachments").insert(attachmentPayload);
      if (attachmentInsertError) return { ok: false, error: attachmentInsertError.message };
    }

    revalidatePath(`/visits/${visitId}`);
    revalidatePath("/medicines");
    return { ok: true, pdfPath };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save handwritten prescription." };
  }
}
