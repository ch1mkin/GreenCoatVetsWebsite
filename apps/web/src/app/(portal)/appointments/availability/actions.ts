"use server";

import { revalidatePath } from "next/cache";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { createClient } from "@/lib/supabase/server";

export async function saveDoctorAvailabilityRule(formData: FormData) {
  const doctorId = String(formData.get("doctor_id") ?? "").trim();
  const branchId = String(formData.get("branch_id") ?? "").trim() || null;
  const dayOfWeek = Number(formData.get("day_of_week"));
  const startTime = String(formData.get("start_time") ?? "09:00").trim();
  const endTime = String(formData.get("end_time") ?? "17:00").trim();
  const slotMinutes = Number(formData.get("slot_minutes") ?? 30);

  if (!doctorId || Number.isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw new Error("Doctor and day of week are required.");
  }

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const { error } = await supabase.from("doctor_availability_rules").upsert(
    {
      clinic_id,
      doctor_id: doctorId,
      branch_id: branchId,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      slot_minutes: slotMinutes,
      is_active: true,
    },
    { onConflict: "doctor_id,day_of_week,start_time,end_time" },
  );

  if (error) throw new Error(error.message);
  revalidatePath("/appointments/availability");
}

export async function deleteDoctorAvailabilityRule(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Rule id required.");

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();
  const { error } = await supabase.from("doctor_availability_rules").delete().eq("id", id).eq("clinic_id", clinic_id);
  if (error) throw new Error(error.message);
  revalidatePath("/appointments/availability");
}
