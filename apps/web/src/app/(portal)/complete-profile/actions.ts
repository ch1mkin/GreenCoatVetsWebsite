"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";

function redirectWithError(message: string) {
  redirect(`/complete-profile?error=${encodeURIComponent(message)}`);
}

export async function saveStaffProfileCompletion(formData: FormData) {
  const access = await getUserAccess();
  if (!access.membership) redirect("/dashboard");
  if (access.membership.role === "super_admin") redirect("/dashboard");
  if (access.membership.role === "marketing_editor") redirect("/dashboard");

  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (fullName.length < 2) redirectWithError("Enter your full name.");
  if (phone.length < 8) redirectWithError("Enter a valid phone number (at least 8 characters).");

  const supabase = createClient();
  const { error } = await supabase.rpc("complete_own_portal_profile", {
    p_full_name: fullName,
    p_phone: phone,
    p_first_name: null,
    p_last_name: null,
  });

  if (error) redirectWithError(error.message);

  revalidatePath("/", "layout");
  revalidatePath("/complete-profile");
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
  if (first.length < 1 || last.length < 1) redirectWithError("Enter first and last name.");
  if (phone.length < 8) redirectWithError("Enter a valid phone number (at least 8 characters).");

  const supabase = createClient();
  const { error } = await supabase.rpc("complete_own_portal_profile", {
    p_full_name: null,
    p_phone: phone,
    p_first_name: first,
    p_last_name: last,
  });

  if (error) redirectWithError(error.message);

  revalidatePath("/", "layout");
  revalidatePath("/complete-profile");
  redirect("/dashboard");
}
