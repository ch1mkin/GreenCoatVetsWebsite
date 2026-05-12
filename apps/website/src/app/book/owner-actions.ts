"use server";

import { DEFAULT_PET_SPECIES_BOOKING_VALUE, normalizeLegacySpeciesToCanonical } from "@saasclinics/lib";
import { redirect } from "next/navigation";
import { APPOINTMENT_BOOKING_CONSENT_TEXT, APPOINTMENT_BOOKING_CONSENT_VERSION } from "@/lib/booking/appointment-consent";
import { sendAppointmentBookingNotificationEmail } from "@/lib/email/send-appointment-booking-notification-email";
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
  const contactFullName = String(formData.get("contact_full_name") ?? "").trim();
  const contactPhone = String(formData.get("contact_phone") ?? "").trim();
  const contactEmail = String(formData.get("contact_email") ?? "").trim();
  const consentAccepted = String(formData.get("booking_consent") ?? "") === "on";

  if (!branchId || !startsAtRaw) {
    throw new Error("Branch and time are required.");
  }
  if (!existingPetId && !newPetName) {
    throw new Error("Branch, pet and time are required.");
  }
  if (!appointmentTypes.includes(appointmentType as (typeof appointmentTypes)[number])) {
    throw new Error("Invalid appointment type.");
  }
  if (!consentAccepted) {
    throw new Error("You must accept the booking consent before submitting.");
  }
  if (!contactFullName) {
    throw new Error("Full name is required.");
  }
  if (!contactPhone) {
    throw new Error("Contact phone is required.");
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
    contact_name: contactFullName || null,
    contact_phone: contactPhone || null,
    contact_email: contactEmail || null,
    consent_accepted: true,
    consent_text: APPOINTMENT_BOOKING_CONSENT_TEXT,
    consent_version: APPOINTMENT_BOOKING_CONSENT_VERSION,
    consent_at: new Date().toISOString(),
  };

  const nextOwnerName = contactFullName || ownerRow.full_name;
  const nextOwnerPhone = contactPhone || ownerRow.phone;
  const nextOwnerEmail = contactEmail || ownerRow.email;

  const { error: ownerUpdateError } = await supabase
    .from("owners")
    .update({
      full_name: nextOwnerName,
      phone: nextOwnerPhone,
      email: nextOwnerEmail || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ownerRow.id)
    .eq("clinic_id", clinic.id);
  if (ownerUpdateError) throw new Error(ownerUpdateError.message);

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

  let petDisplayName = newPetName;
  if (existingPetId) {
    const { data: petRow } = await supabase.from("pets").select("name").eq("id", petId).maybeSingle();
    petDisplayName = (petRow?.name as string | undefined) ?? "—";
  }

  try {
    await sendAppointmentBookingNotificationEmail({
      clinicId: clinic.id,
      clinicName: clinic.name,
      branchId,
      appointmentType,
      startsAtIso: startsAt,
      petName: petDisplayName,
      ownerDisplay: nextOwnerName,
      ownerEmail: nextOwnerEmail,
      ownerPhone: nextOwnerPhone,
      chiefComplaint: chiefComplaint || null,
      notes: notes || null,
      bookingSource: "owner_portal",
    });
  } catch (mailErr) {
    console.error("[book] admin notification email failed", mailErr);
  }

  redirect("/account");
}
