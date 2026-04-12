"use server";

import { revalidatePath } from "next/cache";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { createClient } from "@/lib/supabase/server";

export async function createMedicalRecord(formData: FormData) {
  const visitId = String(formData.get("visit_id") ?? "").trim();
  const diagnosis = String(formData.get("diagnosis") ?? "").trim();
  const labTests = String(formData.get("lab_tests") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!visitId) throw new Error("Visit is required.");

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: visit, error: visitError } = await supabase
    .from("visits")
    .select("id, branch_id, pet_id")
    .eq("id", visitId)
    .eq("clinic_id", clinic_id)
    .single();
  if (visitError) throw new Error(visitError.message);

  const { error } = await supabase.from("medical_records").insert({
    clinic_id,
    branch_id: visit.branch_id,
    pet_id: visit.pet_id,
    visit_id: visit.id,
    diagnosis: diagnosis || null,
    lab_tests: labTests || null,
    notes: notes || null,
    created_by: user?.id ?? null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/medical-records");
}
