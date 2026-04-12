"use server";

import { revalidatePath } from "next/cache";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { createClient } from "@/lib/supabase/server";
import { REFERRED_TEST_OPTIONS, testFieldName } from "@/lib/clinical/referred-tests";
import { upsertMedicalRecordForVisit } from "@/lib/medical-records/upsert-by-visit";

export async function createVisitFromAppointment(formData: FormData) {
  const appointmentId = String(formData.get("appointment_id") ?? "").trim();
  if (!appointmentId) throw new Error("Appointment id is required.");

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const { data: appointment, error: apptError } = await supabase
    .from("appointments")
    .select("id, clinic_id, branch_id, pet_id, owner_id, doctor_id")
    .eq("id", appointmentId)
    .eq("clinic_id", clinic_id)
    .maybeSingle();

  if (apptError) throw new Error(apptError.message);
  if (!appointment) throw new Error("Appointment not found.");

  const { data: existingVisit } = await supabase
    .from("visits")
    .select("id")
    .eq("appointment_id", appointmentId)
    .limit(1)
    .maybeSingle();

  if (existingVisit?.id) {
    revalidatePath(`/visits/${existingVisit.id}`);
    return existingVisit.id;
  }

  const nowIso = new Date().toISOString();
  const { data: createdVisit, error: visitError } = await supabase
    .from("visits")
    .insert({
      clinic_id: appointment.clinic_id,
      branch_id: appointment.branch_id,
      appointment_id: appointment.id,
      pet_id: appointment.pet_id,
      owner_id: appointment.owner_id,
      doctor_id: appointment.doctor_id,
      check_in_at: nowIso,
      started_at: nowIso,
    })
    .select("id")
    .single();

  if (visitError) throw new Error(visitError.message);

  const { error: updateError } = await supabase
    .from("appointments")
    .update({ status: "checked_in" })
    .eq("id", appointment.id)
    .eq("clinic_id", clinic_id);

  if (updateError) throw new Error(updateError.message);

  revalidatePath("/appointments");
  revalidatePath(`/visits/${createdVisit.id}`);
  return createdVisit.id;
}

async function persistVisitConsultation(
  supabase: ReturnType<typeof createClient>,
  clinic_id: string,
  formData: FormData,
) {
  const visitId = String(formData.get("visit_id") ?? "").trim();
  const symptoms = String(formData.get("symptoms") ?? "").trim();
  const diagnosis = String(formData.get("diagnosis") ?? "").trim();
  const treatmentPlan = String(formData.get("treatment_plan") ?? "").trim();
  const followUpAt = String(formData.get("follow_up_at") ?? "").trim();
  const completeRaw = String(formData.get("complete_visit") ?? "")
    .trim()
    .toLowerCase();
  const completeVisit = completeRaw === "on" || completeRaw === "true" || completeRaw === "1";

  if (!visitId) throw new Error("Visit id is required.");

  const nowIso = new Date().toISOString();
  const updates: {
    symptoms?: string | null;
    diagnosis?: string | null;
    treatment_plan?: string | null;
    follow_up_at?: string | null;
    completed_at?: string | null;
  } = {
    symptoms: symptoms || null,
    diagnosis: diagnosis || null,
    treatment_plan: treatmentPlan || null,
    follow_up_at: followUpAt ? new Date(followUpAt).toISOString() : null,
  };

  if (completeVisit) {
    updates.completed_at = nowIso;
  }

  const { data: visit, error: visitError } = await supabase
    .from("visits")
    .update(updates)
    .eq("id", visitId)
    .eq("clinic_id", clinic_id)
    .select("appointment_id, branch_id, pet_id")
    .single();

  if (visitError) throw new Error(visitError.message);

  if (completeVisit && visit.appointment_id) {
    const { error: apptUpdateError } = await supabase
      .from("appointments")
      .update({ status: "completed" })
      .eq("id", visit.appointment_id)
      .eq("clinic_id", clinic_id);
    if (apptUpdateError) throw new Error(apptUpdateError.message);
  }

  const notesCombined = [symptoms, treatmentPlan].filter(Boolean).join("\n\n") || null;

  await upsertMedicalRecordForVisit(supabase, {
    clinic_id,
    branch_id: visit.branch_id as string,
    pet_id: visit.pet_id as string,
    visit_id: visitId,
    diagnosis: diagnosis || null,
    notes: notesCombined,
    lab_tests: null,
  });
}

async function persistVisitClinicalEvaluation(
  supabase: ReturnType<typeof createClient>,
  clinic_id: string,
  formData: FormData,
) {
  const visitId = String(formData.get("visit_id") ?? "").trim();
  if (!visitId) throw new Error("Visit id is required.");

  const { data: visit, error: vErr } = await supabase
    .from("visits")
    .select("id, clinic_id, appointment_id")
    .eq("id", visitId)
    .eq("clinic_id", clinic_id)
    .single();

  if (vErr) throw new Error(vErr.message);

  const referred: string[] = [];
  for (const code of REFERRED_TEST_OPTIONS) {
    if (String(formData.get(testFieldName(code)) ?? "") === "on") {
      referred.push(code);
    }
  }

  const row = {
    clinic_id: visit.clinic_id,
    visit_id: visit.id,
    appointment_id: visit.appointment_id,
    species_class: String(formData.get("species_class") ?? "").trim() || null,
    patient_gender: String(formData.get("patient_gender") ?? "").trim() || null,
    patient_age: String(formData.get("patient_age") ?? "").trim() || null,
    patient_name: String(formData.get("patient_name") ?? "").trim() || null,
    owner_name: String(formData.get("owner_name") ?? "").trim() || null,
    patient_complaint: String(formData.get("patient_complaint") ?? "").trim() || null,
    cc_hp: String(formData.get("cc_hp") ?? "").trim() || null,
    section_deworming: String(formData.get("section_deworming") ?? "").trim() || null,
    section_vaccination: String(formData.get("section_vaccination") ?? "").trim() || null,
    param_rt: String(formData.get("param_rt") ?? "").trim() || null,
    param_rr: String(formData.get("param_rr") ?? "").trim() || null,
    param_hr: String(formData.get("param_hr") ?? "").trim() || null,
    param_crt: String(formData.get("param_crt") ?? "").trim() || null,
    param_allergic: String(formData.get("param_allergic") ?? "").trim() || null,
    param_bw: String(formData.get("param_bw") ?? "").trim() || null,
    tests_referred: referred,
    tests_other: String(formData.get("tests_other") ?? "").trim() || null,
    physical_examination: String(formData.get("physical_examination") ?? "").trim() || null,
  };

  const { error: upErr } = await supabase.from("visit_clinical_evaluations").upsert(row, {
    onConflict: "visit_id",
  });

  if (upErr) throw new Error(upErr.message);
}

/** If the visit row never got a doctor_id but the appointment has one, copy it for display, Rx, and reporting. */
async function syncVisitDoctorFromAppointment(
  supabase: ReturnType<typeof createClient>,
  clinic_id: string,
  visitId: string,
) {
  const { data: row } = await supabase
    .from("visits")
    .select("doctor_id, appointment_id")
    .eq("id", visitId)
    .eq("clinic_id", clinic_id)
    .maybeSingle();

  if (!row?.appointment_id || row.doctor_id) return;

  const { data: appt } = await supabase
    .from("appointments")
    .select("doctor_id")
    .eq("id", row.appointment_id)
    .eq("clinic_id", clinic_id)
    .maybeSingle();

  if (!appt?.doctor_id) return;

  const { error } = await supabase
    .from("visits")
    .update({ doctor_id: appt.doctor_id })
    .eq("id", visitId)
    .eq("clinic_id", clinic_id);

  if (error) throw new Error(error.message);

  await supabase
    .from("prescriptions")
    .update({ doctor_id: appt.doctor_id })
    .eq("visit_id", visitId)
    .eq("clinic_id", clinic_id)
    .is("doctor_id", null);
}

export async function saveVisitConsultation(formData: FormData) {
  const visitId = String(formData.get("visit_id") ?? "").trim();
  if (!visitId) throw new Error("Visit id is required.");

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();
  await persistVisitConsultation(supabase, clinic_id, formData);
  await syncVisitDoctorFromAppointment(supabase, clinic_id, visitId);

  revalidatePath("/appointments");
  revalidatePath(`/visits/${visitId}`);
  revalidatePath("/medical-records");
}

export async function saveVisitClinicalEvaluation(formData: FormData) {
  const visitId = String(formData.get("visit_id") ?? "").trim();
  if (!visitId) throw new Error("Visit id is required.");

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();
  await persistVisitClinicalEvaluation(supabase, clinic_id, formData);
  await syncVisitDoctorFromAppointment(supabase, clinic_id, visitId);

  revalidatePath(`/visits/${visitId}`);
}

/** Persists clinical evaluation and SOAP in one submit so users do not lose half-filled sections. */
export async function saveVisitRecord(formData: FormData) {
  const visitId = String(formData.get("visit_id") ?? "").trim();
  if (!visitId) throw new Error("Visit id is required.");

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  await persistVisitClinicalEvaluation(supabase, clinic_id, formData);
  await persistVisitConsultation(supabase, clinic_id, formData);
  await syncVisitDoctorFromAppointment(supabase, clinic_id, visitId);

  revalidatePath("/appointments");
  revalidatePath(`/visits/${visitId}`);
  revalidatePath("/medical-records");
}

export async function ensurePrescriptionForVisit(visitId: string): Promise<string> {
  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const { data: existing } = await supabase
    .from("prescriptions")
    .select("id")
    .eq("visit_id", visitId)
    .eq("clinic_id", clinic_id)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: visit, error: vErr } = await supabase
    .from("visits")
    .select("id, clinic_id, branch_id, pet_id, doctor_id")
    .eq("id", visitId)
    .eq("clinic_id", clinic_id)
    .single();

  if (vErr) throw new Error(vErr.message);

  const { data: created, error: cErr } = await supabase
    .from("prescriptions")
    .insert({
      clinic_id: visit.clinic_id,
      branch_id: visit.branch_id,
      visit_id: visit.id,
      pet_id: visit.pet_id,
      doctor_id: visit.doctor_id,
      notes: null,
    })
    .select("id")
    .single();

  if (cErr) throw new Error(cErr.message);

  revalidatePath(`/visits/${visitId}`);
  return created.id;
}

export async function uploadVisitAttachment(formData: FormData) {
  const visitId = String(formData.get("visit_id") ?? "").trim();
  const file = formData.get("file");
  const petId = String(formData.get("pet_id") ?? "").trim();
  const branchId = String(formData.get("branch_id") ?? "").trim();

  if (!visitId || !petId || !branchId) {
    throw new Error("Visit, pet, and branch are required for upload.");
  }
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Please select a file to upload.");
  }

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${clinic_id}/${visitId}/${Date.now()}-${safeName}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("medical-files")
    .upload(storagePath, arrayBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) throw new Error(uploadError.message);

  const { error: insertError } = await supabase.from("file_attachments").insert({
    clinic_id,
    branch_id: branchId,
    pet_id: petId,
    visit_id: visitId,
    storage_bucket: "medical-files",
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type || null,
    uploaded_by: user?.id ?? null,
  });
  if (insertError) throw new Error(insertError.message);

  revalidatePath(`/visits/${visitId}`);
}
