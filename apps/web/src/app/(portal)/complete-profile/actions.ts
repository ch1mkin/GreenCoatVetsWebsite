"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";

export async function saveStaffProfileCompletion(formData: FormData) {
  const access = await getUserAccess();
  if (!access.membership) redirect("/dashboard");
  if (access.membership.role === "super_admin") redirect("/dashboard");

  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (fullName.length < 2) throw new Error("Enter your full name.");
  if (phone.length < 8) throw new Error("Enter a valid phone number.");

  const supabase = createClient();
  const { data: updated, error } = await supabase
    .from("staff_profiles")
    .update({ full_name: fullName, phone, updated_at: new Date().toISOString() })
    .eq("user_id", access.userId)
    .eq("clinic_id", access.membership.clinic_id)
    .eq("role", access.membership.role)
    .eq("is_active", true)
    .select("id");
  if (error) throw new Error(error.message);
  if (!updated?.length) throw new Error("Staff profile not found. Ask your clinic admin to finish onboarding.");

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function saveOwnerProfileCompletion(formData: FormData) {
  const access = await getUserAccess();
  if (!access.membership || access.membership.role !== "pet_owner") {
    redirect("/dashboard");
  }

  const first = String(formData.get("first_name") ?? "").trim();
  const last = String(formData.get("last_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (first.length < 1 || last.length < 1) throw new Error("Enter first and last name.");
  if (phone.length < 8) throw new Error("Enter a valid phone number.");

  const supabase = createClient();
  const clinicId = access.membership.clinic_id;

  const { data: existing } = await supabase
    .from("owners")
    .select("id")
    .eq("user_id", access.userId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  const full_name = `${first} ${last}`.trim();

  if (existing?.id) {
    const { error } = await supabase
      .from("owners")
      .update({
        first_name: first,
        last_name: last,
        full_name,
        phone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("owners").insert({
      clinic_id: clinicId,
      user_id: access.userId,
      first_name: first,
      last_name: last,
      full_name,
      phone,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
