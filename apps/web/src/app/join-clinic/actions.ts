"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function joinClinicWithInvite(formData: FormData) {
  const token = String(formData.get("invite") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const workingHours = String(formData.get("working_hours") ?? "").trim();
  if (!token) {
    throw new Error("Invite code is required.");
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("consume_clinic_role_invite", {
    p_token: token,
    p_full_name: fullName || null,
    p_phone: null,
    p_working_hours: workingHours || null,
  });
  if (error) {
    throw new Error(error.message);
  }

  redirect("/dashboard");
}
