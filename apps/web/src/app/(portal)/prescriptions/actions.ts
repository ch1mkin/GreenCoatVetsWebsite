"use server";

import { revalidatePath } from "next/cache";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
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
  | { ok: true; item: RxLineItem }
  | { ok: false; error: string };

/** Inserts a line and returns the row — no redirect (client updates UI). */
export async function addPrescriptionItemAction(formData: FormData): Promise<AddPrescriptionItemResult> {
  const prescriptionId = String(formData.get("prescription_id") ?? "").trim();
  const medicineName = String(formData.get("medicine_name") ?? "").trim();
  const dosage = String(formData.get("dosage") ?? "").trim();
  const frequency = String(formData.get("frequency") ?? "").trim();
  const duration = String(formData.get("duration") ?? "").trim();
  const instructions = String(formData.get("instructions") ?? "").trim();

  if (!prescriptionId || !medicineName || !dosage) {
    return { ok: false, error: "Prescription, medicine name, and dosage are required." };
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

    const { data: inserted, error: insertError } = await supabase
      .from("prescription_items")
      .insert({
        prescription_id: prescription.id,
        medicine_name: medicineName,
        dosage,
        frequency: frequency || null,
        duration: duration || null,
        instructions: instructions || null,
      })
      .select("id, medicine_name, dosage, frequency, duration, instructions")
      .single();

    if (insertError) return { ok: false, error: insertError.message };
    if (!inserted) return { ok: false, error: "Insert did not return a row." };

    revalidatePath(`/visits/${prescription.visit_id}`, "layout");
    revalidatePath(`/visits/${prescription.visit_id}`);

    const item: RxLineItem = {
      id: inserted.id as string,
      medicine_name: String(inserted.medicine_name ?? ""),
      dosage: String(inserted.dosage ?? ""),
      frequency: (inserted.frequency as string | null) ?? null,
      duration: (inserted.duration as string | null) ?? null,
      instructions: (inserted.instructions as string | null) ?? null,
    };

    return { ok: true, item };
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

    revalidatePath(`/visits/${visitId}`, "layout");
    revalidatePath(`/visits/${visitId}`);

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update instructions.";
    return { ok: false, error: msg };
  }
}
