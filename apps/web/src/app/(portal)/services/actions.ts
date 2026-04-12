"use server";

import { revalidatePath } from "next/cache";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { createClient } from "@/lib/supabase/server";

export async function createService(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const shortDescription = String(formData.get("short_description") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const branchId = String(formData.get("branch_id") ?? "").trim();

  if (!title || !slug) throw new Error("Title and slug are required.");

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();
  const { error } = await supabase.from("services").insert({
    clinic_id,
    branch_id: branchId || null,
    title,
    slug,
    short_description: shortDescription || null,
    description: description || null,
    is_active: true,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/services");
}

export async function setServiceActive(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const active = String(formData.get("active") ?? "").trim() === "true";
  if (!id) throw new Error("Service id is required.");

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();
  const { error } = await supabase
    .from("services")
    .update({ is_active: active })
    .eq("id", id)
    .eq("clinic_id", clinic_id);
  if (error) throw new Error(error.message);
  revalidatePath("/services");
}
