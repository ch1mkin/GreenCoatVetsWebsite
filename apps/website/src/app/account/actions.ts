"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOwnerPortalContext } from "@/lib/owner/portal";
import { createClient } from "@/lib/supabase/server";

export async function signOutFromAccount() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function addPet(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/account/pets");

  const portal = await getOwnerPortalContext(user.id);
  if (!portal) {
    throw new Error("Complete pet owner registration first.");
  }
  const { owner, clinic } = portal;

  const name = (formData.get("name") as string)?.trim();
  const species = (formData.get("species") as string)?.trim();
  if (!name || !species) throw new Error("Pet name and species are required.");

  const breed = (formData.get("breed") as string)?.trim() || null;
  const gender = (formData.get("gender") as string)?.trim() || null;
  const dateOfBirth = (formData.get("date_of_birth") as string)?.trim() || null;
  const weightRaw = (formData.get("weight_kg") as string)?.trim();
  const weight_kg = weightRaw ? Number(weightRaw) : null;
  const color = (formData.get("color") as string)?.trim() || null;
  const microchip_id = (formData.get("microchip_id") as string)?.trim() || null;

  const { error } = await supabase.from("pets").insert({
    clinic_id: clinic.id,
    owner_id: owner.id,
    name,
    species,
    breed,
    gender,
    date_of_birth: dateOfBirth || null,
    weight_kg: weight_kg != null && Number.isFinite(weight_kg) ? weight_kg : null,
    color,
    microchip_id,
    is_active: true,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/account/pets");
  revalidatePath("/account");
  revalidatePath("/book");
  redirect("/account/pets");
}
