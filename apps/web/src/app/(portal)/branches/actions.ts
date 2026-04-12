"use server";

import { revalidatePath } from "next/cache";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";

async function assertCanManageBranches() {
  const access = await getUserAccess();
  const role = access.membership?.role ?? "";
  const allowed = access.isSuperAdmin || role === "clinic_admin";
  if (!allowed) {
    throw new Error("Only clinic administrators can manage branches.");
  }
}

export async function createBranch(formData: FormData) {
  await assertCanManageBranches();
  const { clinic_id } = await getActiveMembership();

  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const addressLine1 = String(formData.get("address_line1") ?? "").trim();

  if (!name) {
    throw new Error("Branch name is required.");
  }

  const supabase = createClient();
  const { error } = await supabase.from("branches").insert({
    clinic_id,
    name,
    code: code || null,
    city: city || null,
    phone: phone || null,
    address_line1: addressLine1 || null,
    is_active: true,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/branches");
  revalidatePath("/appointments");
  revalidatePath("/appointments/calendar");
  revalidatePath("/services");
  revalidatePath("/inventory");
  revalidatePath("/ecommerce");
  revalidatePath("/vaccinations");
}

export async function setBranchActive(formData: FormData) {
  await assertCanManageBranches();
  const { clinic_id } = await getActiveMembership();

  const id = String(formData.get("id") ?? "").trim();
  const nextActive = String(formData.get("next_active") ?? "").trim() === "true";
  if (!id) throw new Error("Branch id is required.");

  const supabase = createClient();
  const { data: row, error: fetchError } = await supabase
    .from("branches")
    .select("id, clinic_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row || row.clinic_id !== clinic_id) {
    throw new Error("Branch not found for this clinic.");
  }

  if (!nextActive) {
    const { count: otherActive, error: countError } = await supabase
      .from("branches")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinic_id)
      .eq("is_active", true)
      .neq("id", id);
    if (countError) throw new Error(countError.message);
    if ((otherActive ?? 0) < 1) {
      throw new Error("Add or activate another branch before deactivating this one.");
    }
  }

  const { error } = await supabase.from("branches").update({ is_active: nextActive }).eq("id", id).eq("clinic_id", clinic_id);
  if (error) throw new Error(error.message);

  revalidatePath("/branches");
  revalidatePath("/appointments");
  revalidatePath("/appointments/calendar");
}
