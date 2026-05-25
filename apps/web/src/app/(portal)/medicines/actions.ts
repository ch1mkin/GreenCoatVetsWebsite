"use server";

import { revalidatePath } from "next/cache";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { createClient } from "@/lib/supabase/server";

function canManageMedicineCatalog(role: string | null | undefined, isSuperAdmin: boolean): boolean {
  if (isSuperAdmin) return true;
  return role === "clinic_admin" || role === "branch_admin";
}

function parseAliases(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\n,]+/g)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

export async function saveMedicineCatalogEntry(formData: FormData) {
  const access = await getUserAccess();
  if (!canManageMedicineCatalog(access.membership?.role, access.isSuperAdmin)) {
    throw new Error("Only clinic admins can manage the medicine catalog.");
  }

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const aliases = parseAliases(String(formData.get("aliases") ?? ""));
  const form = String(formData.get("form") ?? "").trim();
  const strength = String(formData.get("strength") ?? "").trim();
  const manufacturer = String(formData.get("manufacturer") ?? "").trim();
  const defaultDosage = String(formData.get("default_dosage") ?? "").trim();
  const dosagePerKg = String(formData.get("dosage_per_kg") ?? "").trim();
  const defaultFrequency = String(formData.get("default_frequency") ?? "").trim();
  const defaultDuration = String(formData.get("default_duration") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const isActive = String(formData.get("is_active") ?? "on") === "on";

  if (!name) {
    throw new Error("Medicine name is required.");
  }

  const payload = {
    clinic_id,
    name,
    aliases,
    form: form || null,
    strength: strength || null,
    manufacturer: manufacturer || null,
    default_dosage: defaultDosage || null,
    dosage_per_kg: dosagePerKg || null,
    default_frequency: defaultFrequency || null,
    default_duration: defaultDuration || null,
    notes: notes || null,
    is_active: isActive,
  };

  const query = id
    ? supabase.from("medicine_catalog_entries").update(payload).eq("id", id).eq("clinic_id", clinic_id)
    : supabase.from("medicine_catalog_entries").insert(payload);

  const { error } = await query;
  if (error) {
    if (/medicine_catalog_entries/i.test(error.message)) {
      throw new Error("Run the latest Supabase migrations first, then try saving the medicine catalog again.");
    }
    throw new Error(error.message);
  }

  revalidatePath("/medicines");
  revalidatePath("/visits");
}

export async function archiveMedicineCatalogEntry(formData: FormData) {
  const access = await getUserAccess();
  if (!canManageMedicineCatalog(access.membership?.role, access.isSuperAdmin)) {
    throw new Error("Only clinic admins can manage the medicine catalog.");
  }

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();
  const id = String(formData.get("id") ?? "").trim();
  const nextActive = String(formData.get("next_active") ?? "").trim() === "true";

  if (!id) throw new Error("Medicine entry is required.");

  const { error } = await supabase
    .from("medicine_catalog_entries")
    .update({ is_active: nextActive })
    .eq("id", id)
    .eq("clinic_id", clinic_id);

  if (error) {
    if (/medicine_catalog_entries/i.test(error.message)) {
      throw new Error("Run the latest Supabase migrations first, then try updating the medicine catalog again.");
    }
    throw new Error(error.message);
  }

  revalidatePath("/medicines");
  revalidatePath("/visits");
}
