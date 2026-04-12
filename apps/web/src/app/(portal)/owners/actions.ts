"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { createClient } from "@/lib/supabase/server";

function buildFullName(first: string, last: string, fallback: string) {
  const f = first.trim();
  const l = last.trim();
  if (f && l) return `${f} ${l}`;
  if (f) return f;
  if (l) return l;
  return fallback.trim() || "Unknown";
}

export async function createOwner(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const postalCode = String(formData.get("postal_code") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const businessName = String(formData.get("business_name") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();
  const contactNotes = String(formData.get("contact_notes") ?? "").trim();
  const contactNotesImportant = String(formData.get("contact_notes_important") ?? "") === "on";
  const postMailToPhysical = String(formData.get("post_mail_to_physical") ?? "on") === "on";
  const postalAddress = String(formData.get("postal_address") ?? "").trim();
  const postalCity = String(formData.get("postal_city") ?? "").trim();
  const postalState = String(formData.get("postal_state") ?? "").trim();
  const postalPostalCode = String(formData.get("postal_postal_code") ?? "").trim();
  const postalCountry = String(formData.get("postal_country") ?? "").trim();
  const contactType = String(formData.get("contact_type") ?? "customer").trim() || "customer";

  if (!phone) {
    throw new Error("Phone is required.");
  }
  if (!firstName || !lastName) {
    throw new Error("First name and last name are required.");
  }

  const fullName = buildFullName(firstName, lastName, "");

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const { error } = await supabase.from("owners").insert({
    clinic_id,
    title: title || null,
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    phone,
    email: email || null,
    city: city || null,
    address: address || null,
    state: state || null,
    postal_code: postalCode || null,
    country: country || null,
    business_name: businessName || null,
    website: website || null,
    contact_type: contactType,
    contact_notes: contactNotes || null,
    contact_notes_important: contactNotesImportant,
    post_mail_to_physical: postMailToPhysical,
    postal_address: postalAddress || null,
    postal_city: postalCity || null,
    postal_state: postalState || null,
    postal_postal_code: postalPostalCode || null,
    postal_country: postalCountry || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/owners");
  redirect("/owners");
}

export async function updateOwnerContactNotes(formData: FormData) {
  const ownerId = String(formData.get("owner_id") ?? "").trim();
  const contactNotes = String(formData.get("contact_notes") ?? "").trim();
  const contactNotesImportant = String(formData.get("contact_notes_important") ?? "") === "on";

  if (!ownerId) throw new Error("Owner id is required.");

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const { error } = await supabase
    .from("owners")
    .update({
      contact_notes: contactNotes || null,
      contact_notes_important: contactNotesImportant,
    })
    .eq("id", ownerId)
    .eq("clinic_id", clinic_id);

  if (error) throw new Error(error.message);

  revalidatePath(`/owners/${ownerId}`);
  revalidatePath("/owners");
}
