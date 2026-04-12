"use server";

import { DEFAULT_PET_SPECIES_BOOKING_VALUE, normalizeLegacySpeciesToCanonical } from "@saasclinics/lib";
import { redirect } from "next/navigation";
import { getOwnerPortalContext } from "@/lib/owner/portal";
import { createClient } from "@/lib/supabase/server";

const appointmentTypes = ["consultation", "vaccination", "surgery", "grooming", "emergency"] as const;

export async function submitOwnerBooking(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/book");

  const portalCtx = await getOwnerPortalContext(user.id);
  if (!portalCtx) throw new Error("Owner profile not found.");
  const { owner: ownerRow, clinic } = portalCtx;

  const branchId = String(formData.get("branch_id") ?? "").trim();
  const existingPetId = String(formData.get("pet_id") ?? "").trim();
  const newPetName = String(formData.get("new_pet_name") ?? "").trim();
  const newPetSpecies = String(formData.get("new_pet_species") ?? "").trim();
  const appointmentType = String(formData.get("appointment_type") ?? "consultation").trim();
  const startsAtRaw = String(formData.get("starts_at") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const chiefComplaint = String(formData.get("chief_complaint") ?? "").trim();
  const allergies = String(formData.get("allergies") ?? "").trim();
  const currentMedications = String(formData.get("current_medications") ?? "").trim();
  const contactPhone = String(formData.get("contact_phone") ?? "").trim();
  const contactEmail = String(formData.get("contact_email") ?? "").trim();

  if (!branchId || !startsAtRaw) {
    throw new Error("Branch and time are required.");
  }
  if (!existingPetId && !newPetName) {
    throw new Error("Branch, pet and time are required.");
  }
  if (!appointmentTypes.includes(appointmentType as (typeof appointmentTypes)[number])) {
    throw new Error("Invalid appointment type.");
  }

  const startsAt = new Date(startsAtRaw).toISOString();
  let petId = existingPetId;

  if (!petId) {
    const { data: createdPet, error: petError } = await supabase
      .from("pets")
      .insert({
        clinic_id: clinic.id,
        owner_id: ownerRow.id,
        primary_branch_id: branchId,
        name: newPetName,
        species: normalizeLegacySpeciesToCanonical(newPetSpecies || DEFAULT_PET_SPECIES_BOOKING_VALUE),
        is_active: true,
      })
      .select("id")
      .single();
    if (petError) throw new Error(petError.message);
    petId = createdPet.id;
  }

  const ownerIntake = {
    chief_complaint: chiefComplaint || null,
    allergies: allergies || null,
    current_medications: currentMedications || null,
    contact_phone: contactPhone || null,
    contact_email: contactEmail || null,
  };

  const { error } = await supabase.from("appointments").insert({
    clinic_id: clinic.id,
    branch_id: branchId,
    doctor_id: null,
    pet_id: petId,
    owner_id: ownerRow.id,
    appointment_type: appointmentType,
    status: "scheduled",
    starts_at: startsAt,
    reason: chiefComplaint || null,
    notes: notes || null,
    owner_intake: ownerIntake,
    booking_source: "owner_portal",
    created_by: user.id,
  });
  if (error) throw new Error(error.message);

  redirect("/account");
}
