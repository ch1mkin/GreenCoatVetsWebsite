"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { createClient } from "@/lib/supabase/server";

export async function createPet(formData: FormData) {
  const ownerId = String(formData.get("owner_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const species = String(formData.get("species") ?? "").trim();
  const breed = String(formData.get("breed") ?? "").trim();
  const gender = String(formData.get("gender") ?? "").trim();
  const microchipId = String(formData.get("microchip_id") ?? "").trim();
  const weightKg = String(formData.get("weight_kg") ?? "").trim();
  const dateOfBirth = String(formData.get("date_of_birth") ?? "").trim();
  const dobEstimated = String(formData.get("date_of_birth_estimated") ?? "") === "on";
  const animalNotes = String(formData.get("animal_notes") ?? "").trim();
  const animalNotesImportant = String(formData.get("animal_notes_important") ?? "") === "on";

  if (!ownerId || !name || !species) {
    throw new Error("Owner, pet name, and species are required.");
  }

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const patientCode = `P-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;

  const { error } = await supabase.from("pets").insert({
    clinic_id,
    owner_id: ownerId,
    name,
    species,
    breed: breed || null,
    gender: gender || null,
    microchip_id: microchipId || null,
    weight_kg: weightKg ? Number(weightKg) : null,
    date_of_birth: dateOfBirth || null,
    date_of_birth_estimated: dobEstimated,
    animal_notes: animalNotes || null,
    animal_notes_important: animalNotesImportant,
    patient_code: patientCode,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/pets");
  redirect("/pets");
}
