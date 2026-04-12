"use server";

import { revalidatePath } from "next/cache";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { createClient } from "@/lib/supabase/server";

const allowedTypes = [
  "consultation",
  "vaccination",
  "surgery",
  "grooming",
  "emergency",
] as const;

const allowedStatuses = [
  "scheduled",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
] as const;

export async function createAppointment(formData: FormData) {
  const branchId = String(formData.get("branch_id") ?? "").trim();
  const petId = String(formData.get("pet_id") ?? "").trim();
  const ownerId = String(formData.get("owner_id") ?? "").trim();
  const doctorId = String(formData.get("doctor_id") ?? "").trim();
  const appointmentType = String(formData.get("appointment_type") ?? "").trim();
  const startsAt = String(formData.get("starts_at") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!branchId || !petId || !ownerId || !appointmentType || !startsAt) {
    throw new Error("Branch, owner, pet, type, and start time are required.");
  }
  if (!allowedTypes.includes(appointmentType as (typeof allowedTypes)[number])) {
    throw new Error("Invalid appointment type.");
  }

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("appointments").insert({
    clinic_id,
    branch_id: branchId,
    pet_id: petId,
    owner_id: ownerId,
    doctor_id: doctorId || null,
    appointment_type: appointmentType,
    starts_at: new Date(startsAt).toISOString(),
    notes: notes || null,
    created_by: user?.id ?? null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/appointments");
}

export async function updateAppointmentStatus(formData: FormData) {
  const appointmentId = String(formData.get("appointment_id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!appointmentId || !allowedStatuses.includes(status as (typeof allowedStatuses)[number])) {
    throw new Error("Invalid appointment status update.");
  }

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const { error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", appointmentId)
    .eq("clinic_id", clinic_id);

  if (error) throw new Error(error.message);
  revalidatePath("/appointments");
}
