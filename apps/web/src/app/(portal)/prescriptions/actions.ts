"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { createClient } from "@/lib/supabase/server";

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

  revalidatePath(`/visits/${prescription.visit_id}`);

  const returnVisitId = String(formData.get("visit_id") ?? "").trim();
  const embed = String(formData.get("embed") ?? "").trim();
  if (returnVisitId) {
    const q = new URLSearchParams();
    q.set("rx_item", "1");
    if (embed === "1") q.set("embed", "1");
    redirect(`/visits/${returnVisitId}?${q.toString()}`);
  }
}
