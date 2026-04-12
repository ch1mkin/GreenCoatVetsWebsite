"use server";

import { revalidatePath } from "next/cache";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { createClient } from "@/lib/supabase/server";

export async function createVaccinationRecord(formData: FormData) {
  const petId = String(formData.get("pet_id") ?? "").trim();
  const branchId = String(formData.get("branch_id") ?? "").trim();
  const vaccineName = String(formData.get("vaccine_name") ?? "").trim();
  const dose = String(formData.get("dose") ?? "").trim();
  const administeredOn = String(formData.get("administered_on") ?? "").trim();
  const dueOn = String(formData.get("due_on") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!petId || !vaccineName) {
    throw new Error("Pet and vaccine name are required.");
  }

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const { error } = await supabase.from("vaccination_records").insert({
    clinic_id,
    branch_id: branchId || null,
    pet_id: petId,
    vaccine_name: vaccineName,
    dose: dose || null,
    administered_on: administeredOn || null,
    due_on: dueOn || null,
    status: status || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/vaccinations");
}

export async function updateVaccinationRecord(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const dueOn = String(formData.get("due_on") ?? "").trim();

  if (!id) throw new Error("Vaccination record id is required.");

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const { error } = await supabase
    .from("vaccination_records")
    .update({
      status: status || null,
      due_on: dueOn || null,
      reminder_sent_at: status.toLowerCase() === "reminded" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("clinic_id", clinic_id);

  if (error) throw new Error(error.message);
  revalidatePath("/vaccinations");
}

export async function sendVaccinationReminderNow(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Vaccination record id is required.");

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const { data: row, error: rowErr } = await supabase
    .from("vaccination_records")
    .select("id, due_on, pets(owner_id, name)")
    .eq("id", id)
    .eq("clinic_id", clinic_id)
    .maybeSingle();
  if (rowErr) throw new Error(rowErr.message);
  if (!row) throw new Error("Vaccination record not found.");

  const pets = row.pets as { owner_id?: string | null; name?: string | null } | { owner_id?: string | null; name?: string | null }[] | null;
  const pet = Array.isArray(pets) ? pets[0] : pets;
  const ownerId = pet?.owner_id ?? null;
  if (!ownerId) throw new Error("No owner linked to this pet.");

  const { data: owner, error: ownerErr } = await supabase.from("owners").select("user_id, email").eq("id", ownerId).maybeSingle();
  if (ownerErr) throw new Error(ownerErr.message);

  const message = `${pet?.name ?? "Your pet"} has a vaccination due on ${row.due_on ?? "the scheduled date"}.`;

  type VaccinationReminderInsert = {
    clinic_id: string;
    owner_id: string;
    user_id: string | null;
    channel: "push" | "email";
    title: string;
    message: string;
    payload: { event: string; entity_id: string; email?: string };
  };

  const inserts: VaccinationReminderInsert[] = [
    {
      clinic_id,
      owner_id: ownerId,
      user_id: owner?.user_id ?? null,
      channel: "push",
      title: "Vaccination due reminder",
      message,
      payload: { event: "vaccination_due_manual", entity_id: row.id },
    },
  ];
  if (owner?.email) {
    inserts.push({
      clinic_id,
      owner_id: ownerId,
      user_id: owner?.user_id ?? null,
      channel: "email",
      title: "Vaccination due reminder",
      message,
      payload: { event: "vaccination_due_manual", entity_id: row.id, email: owner.email },
    });
  }

  const { error: insertErr } = await supabase.from("notifications").insert(inserts);
  if (insertErr) throw new Error(insertErr.message);

  const { error: updateErr } = await supabase
    .from("vaccination_records")
    .update({ reminder_sent_at: new Date().toISOString(), status: "reminded" })
    .eq("id", row.id)
    .eq("clinic_id", clinic_id);
  if (updateErr) throw new Error(updateErr.message);

  revalidatePath("/vaccinations");
  revalidatePath("/notifications-center");
}
