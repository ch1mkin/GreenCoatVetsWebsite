"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeLegacySpeciesToCanonical, PET_SPECIES_BOOKING_OPTIONS } from "@saasclinics/lib";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { sendWebsiteWelcomeEmail } from "@/lib/email/send-welcome-email";
import { getOwnerPortalContext } from "@/lib/owner/portal";
import { createClient } from "@/lib/supabase/server";

const WEBSITE_PROFILE_SPECIES_VALUES = new Set(PET_SPECIES_BOOKING_OPTIONS.map((option) => option.value));

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
  const species = normalizeLegacySpeciesToCanonical((formData.get("species") as string)?.trim() ?? "");
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

export async function completeOwnerProfileWithPet(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/account/complete-profile");

  const existingPortal = await getOwnerPortalContext(user.id);
  if (existingPortal) {
    redirect("/account");
  }

  const clinic = await resolveClinic();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const petName = String(formData.get("pet_name") ?? "").trim();
  const rawSpecies = String(formData.get("species") ?? "").trim();
  const breed = String(formData.get("breed") ?? "").trim() || null;
  const gender = String(formData.get("gender") ?? "").trim() || null;
  const dateOfBirth = String(formData.get("date_of_birth") ?? "").trim() || null;
  const weightRaw = String(formData.get("weight_kg") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim() || null;
  const microchipId = String(formData.get("microchip_id") ?? "").trim() || null;

  if (!fullName || !phone || !petName) {
    throw new Error("Full name, phone, and pet name are required.");
  }

  const normalizedSpecies = normalizeLegacySpeciesToCanonical(rawSpecies);
  if (!normalizedSpecies || !WEBSITE_PROFILE_SPECIES_VALUES.has(normalizedSpecies)) {
    throw new Error("A valid pet species is required.");
  }

  const emailNorm = user.email?.trim().toLowerCase() ?? "";
  let ownerId: string | null = null;

  const { data: existingOwner, error: existingOwnerError } = await supabase
    .from("owners")
    .select("id")
    .eq("clinic_id", clinic.id)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (existingOwnerError) throw new Error(existingOwnerError.message);

  if (existingOwner?.id) {
    ownerId = existingOwner.id;
    const { error: updateOwnerError } = await supabase
      .from("owners")
      .update({
        full_name: fullName,
        phone,
        email: emailNorm || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ownerId);
    if (updateOwnerError) throw new Error(updateOwnerError.message);
  } else if (emailNorm) {
    const { data: guestOwner, error: guestOwnerError } = await supabase
      .from("owners")
      .select("id")
      .eq("clinic_id", clinic.id)
      .is("user_id", null)
      .eq("email", emailNorm)
      .limit(1)
      .maybeSingle();
    if (guestOwnerError) throw new Error(guestOwnerError.message);

    if (guestOwner?.id) {
      ownerId = guestOwner.id;
      const { error: mergeOwnerError } = await supabase
        .from("owners")
        .update({
          user_id: user.id,
          full_name: fullName,
          phone,
          email: emailNorm,
          updated_at: new Date().toISOString(),
        })
        .eq("id", guestOwner.id);
      if (mergeOwnerError) throw new Error(mergeOwnerError.message);
    }
  }

  if (!ownerId) {
    const { data: insertedOwner, error: insertOwnerError } = await supabase
      .from("owners")
      .insert({
        clinic_id: clinic.id,
        user_id: user.id,
        full_name: fullName,
        phone,
        email: emailNorm || null,
      })
      .select("id")
      .single();
    if (insertOwnerError) throw new Error(insertOwnerError.message);
    ownerId = insertedOwner.id;

    try {
      if (emailNorm) {
        await sendWebsiteWelcomeEmail({ email: emailNorm, fullName });
      }
    } catch (mailError) {
      console.error("[account/complete-profile] welcome email failed", mailError);
    }
  }

  const weightKg = weightRaw ? Number(weightRaw) : null;
  const { error: insertPetError } = await supabase.from("pets").insert({
    clinic_id: clinic.id,
    owner_id: ownerId,
    name: petName,
    species: normalizedSpecies,
    breed,
    gender,
    date_of_birth: dateOfBirth || null,
    weight_kg: weightKg != null && Number.isFinite(weightKg) ? weightKg : null,
    color,
    microchip_id: microchipId,
    is_active: true,
  });
  if (insertPetError) throw new Error(insertPetError.message);

  revalidatePath("/account");
  revalidatePath("/account/pets");
  revalidatePath("/book");
  redirect("/account?completed=1");
}
