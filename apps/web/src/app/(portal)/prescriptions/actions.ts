"use server";

import { revalidatePath } from "next/cache";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { createClient } from "@/lib/supabase/server";

export async function createPrescription(formData: FormData) {
  const visitId = String(formData.get("visit_id") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!visitId) throw new Error("Visit id is required.");

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const { data: visit, error: visitError } = await supabase
    .from("visits")
    .select("id, clinic_id, branch_id, pet_id, doctor_id")
    .eq("id", visitId)
    .eq("clinic_id", clinic_id)
    .single();

  if (visitError) throw new Error(visitError.message);

  const { data: prescription, error } = await supabase
    .from("prescriptions")
    .insert({
      clinic_id: visit.clinic_id,
      branch_id: visit.branch_id,
      visit_id: visit.id,
      pet_id: visit.pet_id,
      doctor_id: visit.doctor_id,
      notes: notes || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(`/visits/${visitId}`);
  revalidatePath(`/prescriptions/${prescription.id}`);
}

export async function addPrescriptionItem(formData: FormData) {
  const prescriptionId = String(formData.get("prescription_id") ?? "").trim();
  const medicineName = String(formData.get("medicine_name") ?? "").trim();
  const dosage = String(formData.get("dosage") ?? "").trim();
  const frequency = String(formData.get("frequency") ?? "").trim();
  const duration = String(formData.get("duration") ?? "").trim();
  const instructions = String(formData.get("instructions") ?? "").trim();

  if (!prescriptionId || !medicineName || !dosage) {
    throw new Error("Prescription, medicine name, and dosage are required.");
  }

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const { data: prescription, error: lookupError } = await supabase
    .from("prescriptions")
    .select("id, clinic_id, visit_id")
    .eq("id", prescriptionId)
    .eq("clinic_id", clinic_id)
    .single();

  if (lookupError) throw new Error(lookupError.message);

  const { error } = await supabase.from("prescription_items").insert({
    prescription_id: prescription.id,
    medicine_name: medicineName,
    dosage,
    frequency: frequency || null,
    duration: duration || null,
    instructions: instructions || null,
  });

  if (error) throw new Error(error.message);

  await supabase.from("prescriptions").update({ pdf_url: null }).eq("id", prescriptionId);

  revalidatePath(`/visits/${prescription.visit_id}`);
  revalidatePath(`/prescriptions/${prescriptionId}`);
}
