"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createHostingerTransport, getHostingerFromAddress } from "@/lib/email/hostinger-mail";
import { renderBrandedEmail } from "@/lib/email/render-branded-email";
import { getPlatformBranding } from "@/lib/platform-branding";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const allowedTypes = [
  "consultation",
  "vaccination",
  "surgery",
  "grooming",
  "emergency",
] as const;

const allowedStatuses = [
  "scheduled",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
] as const;

const WEBSITE_BOOKING_SOURCES = ["website_guest", "owner_portal"] as const;
const WEBSITE_APPOINTMENT_PURGE_ACTION = "delete_website_booked_appointments";
const WEBSITE_OWNER_PET_PURGE_ACTION = "delete_website_owner_pet_records";
const WEBSITE_APPOINTMENT_PURGE_TTL_MS = 10 * 60 * 1000;

function appointmentsUrl(params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `/appointments?${qs}` : "/appointments";
}

function hashAdminActionCode(actionType: string, userId: string, clinicId: string, code: string) {
  return crypto.createHash("sha256").update(`${actionType}:${clinicId}:${userId}:${code}`).digest("hex");
}

async function assertWebsitePurgeAccess() {
  const access = await getUserAccess();
  const role = access.membership?.role ?? (access.isSuperAdmin ? "super_admin" : "pet_owner");
  if (!access.isSuperAdmin && role !== "clinic_admin") {
    throw new Error("Only clinic admins can run website cleanup actions.");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id || !user.email?.trim()) {
    throw new Error("Your admin account needs a valid email before you can request a verification code.");
  }

  const { clinic_id } = await getActiveMembership();
  return {
    clinicId: clinic_id,
    userId: user.id,
    userEmail: user.email.trim().toLowerCase(),
  };
}

function readOwnerPetPurgeCounts(raw: unknown) {
  const row = Array.isArray(raw) ? raw[0] : raw;
  const ownerCount = Number((row as { owner_count?: number | string | null } | null)?.owner_count ?? 0) || 0;
  const petCount = Number((row as { pet_count?: number | string | null } | null)?.pet_count ?? 0) || 0;
  return { ownerCount, petCount };
}

export async function createAppointment(formData: FormData) {
  const branchId = String(formData.get("branch_id") ?? "").trim();
  const petId = String(formData.get("pet_id") ?? "").trim();
  const ownerId = String(formData.get("owner_id") ?? "").trim();
  const doctorId = String(formData.get("doctor_id") ?? "").trim();
  const appointmentType = String(formData.get("appointment_type") ?? "").trim();
  const startsAt = String(formData.get("starts_at") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!branchId || !petId || !ownerId || !appointmentType || !startsAt) {
    throw new Error("Branch, owner, pet, type, and start time are required.");
  }
  if (!allowedTypes.includes(appointmentType as (typeof allowedTypes)[number])) {
    throw new Error("Invalid appointment type.");
  }

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("appointments").insert({
    clinic_id,
    branch_id: branchId,
    pet_id: petId,
    owner_id: ownerId,
    doctor_id: doctorId || null,
    appointment_type: appointmentType,
    booking_source: "clinic_portal",
    starts_at: new Date(startsAt).toISOString(),
    notes: notes || null,
    created_by: user?.id ?? null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/appointments");
}

export async function sendWebsiteAppointmentsDeleteCodeAction() {
  const { clinicId, userId, userEmail } = await assertWebsitePurgeAccess();
  const serviceRole = createServiceRoleClient();
  if (!serviceRole) {
    redirect(appointmentsUrl({ purge_error: "SUPABASE_SERVICE_ROLE_KEY is required for destructive admin verification." }));
  }

  let targetCount = 0;
  try {
    const cutoffIso = new Date().toISOString();
    const { count, error: countError } = await serviceRole
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .in("booking_source", [...WEBSITE_BOOKING_SOURCES])
      .lte("created_at", cutoffIso);
    if (countError) throw new Error(countError.message);
    if (!count) {
      throw new Error("There are no existing website-booked appointments to delete for this clinic.");
    }
    targetCount = count;

    const transporter = createHostingerTransport();
    const from = getHostingerFromAddress();
    if (!transporter || !from) {
      throw new Error("Hostinger SMTP is not configured on the server.");
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + WEBSITE_APPOINTMENT_PURGE_TTL_MS).toISOString();
    const codeHash = hashAdminActionCode(WEBSITE_APPOINTMENT_PURGE_ACTION, userId, clinicId, code);

    await serviceRole
      .from("admin_email_action_codes")
      .delete()
      .eq("user_id", userId)
      .eq("clinic_id", clinicId)
      .eq("action_type", WEBSITE_APPOINTMENT_PURGE_ACTION)
      .is("consumed_at", null);

    const { error: insertError } = await serviceRole.from("admin_email_action_codes").insert({
      clinic_id: clinicId,
      user_id: userId,
      email: userEmail,
      action_type: WEBSITE_APPOINTMENT_PURGE_ACTION,
      code_hash: codeHash,
      payload: {
        cutoff_iso: cutoffIso,
        target_count: count,
      },
      expires_at: expiresAt,
    });
    if (insertError) throw new Error(insertError.message);

    const branding = await getPlatformBranding();
    const brandName = branding.product_name || "GreenCoatVets";
    const mail = renderBrandedEmail({
      brandName,
      heading: "Confirm website appointment deletion",
      intro: "Use the verification code below to permanently delete existing website-booked appointments for this clinic.",
      body: [
        `This code expires in ${Math.round(WEBSITE_APPOINTMENT_PURGE_TTL_MS / 60000)} minutes.`,
        "Only appointments created before you requested this code will be deleted.",
      ],
      details: [
        { label: "Verification code", value: code },
        { label: "Website-booked appointments queued", value: String(count) },
      ],
      footer: `${brandName} destructive action verification`,
    });

    await transporter.sendMail({
      from,
      to: userEmail,
      subject: `${brandName} verification code for website appointment deletion`,
      text: mail.text,
      html: mail.html,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Could not send the verification code.";
    redirect(appointmentsUrl({ purge_error: errorMessage }));
  }

  redirect(appointmentsUrl({ purge_code_sent: 1, purge_target_count: targetCount }));
}

export async function confirmDeleteWebsiteAppointmentsAction(formData: FormData) {
  const { clinicId, userId } = await assertWebsitePurgeAccess();
  const code = String(formData.get("verification_code") ?? "").trim();
  const confirmPhrase = String(formData.get("confirm_delete_text") ?? "")
    .trim()
    .toLowerCase();
  if (!/^\d{6}$/.test(code)) {
    redirect(appointmentsUrl({ purge_error: "Enter the 6-digit code sent to your email." }));
  }
  if (confirmPhrase !== "delete") {
    redirect(appointmentsUrl({ purge_error: 'Type "delete" to confirm removing website-booked appointments.' }));
  }

  const serviceRole = createServiceRoleClient();
  if (!serviceRole) {
    redirect(appointmentsUrl({ purge_error: "SUPABASE_SERVICE_ROLE_KEY is required for destructive admin verification." }));
  }

  try {
    const { data: challenge, error: challengeError } = await serviceRole
      .from("admin_email_action_codes")
      .select("id, code_hash, expires_at, consumed_at, payload")
      .eq("user_id", userId)
      .eq("clinic_id", clinicId)
      .eq("action_type", WEBSITE_APPOINTMENT_PURGE_ACTION)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (challengeError || !challenge) {
      throw new Error("Request a new verification code first.");
    }
    if (challenge.consumed_at) {
      throw new Error("That verification code has already been used. Request a new one.");
    }
    if (new Date(challenge.expires_at).getTime() < Date.now()) {
      throw new Error("That verification code has expired. Request a new one.");
    }

    const expectedHash = hashAdminActionCode(WEBSITE_APPOINTMENT_PURGE_ACTION, userId, clinicId, code);
    if (expectedHash !== challenge.code_hash) {
      throw new Error("The verification code is incorrect.");
    }

    const payload =
      challenge.payload && typeof challenge.payload === "object" ? (challenge.payload as { cutoff_iso?: string | null }) : {};
    const cutoffIso = payload.cutoff_iso?.trim();
    if (!cutoffIso) {
      throw new Error("The delete request is missing its cutoff timestamp. Request a new code.");
    }

    const { count: deletedCount, error: deleteError } = await serviceRole
      .from("appointments")
      .delete({ count: "exact" })
      .eq("clinic_id", clinicId)
      .in("booking_source", [...WEBSITE_BOOKING_SOURCES])
      .lte("created_at", cutoffIso);
    if (deleteError) throw new Error(deleteError.message);

    await serviceRole
      .from("admin_email_action_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", challenge.id);

    revalidatePath("/appointments");
    revalidatePath("/appointments/calendar");
    revalidatePath("/dashboard");
    redirect(appointmentsUrl({ purged: 1, purged_count: deletedCount ?? 0 }));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Could not delete website-booked appointments.";
    redirect(appointmentsUrl({ purge_error: errorMessage }));
  }
}

export async function sendWebsiteOwnerPetDeleteCodeAction() {
  const { clinicId, userId, userEmail } = await assertWebsitePurgeAccess();
  const serviceRole = createServiceRoleClient();
  if (!serviceRole) {
    redirect(appointmentsUrl({ owner_pet_purge_error: "SUPABASE_SERVICE_ROLE_KEY is required for destructive admin verification." }));
  }

  let ownerCount = 0;
  let petCount = 0;
  try {
    const cutoffIso = new Date().toISOString();
    const { data: stats, error: statsError } = await serviceRole.rpc("get_website_owner_pet_purge_stats", {
      p_clinic_id: clinicId,
      p_cutoff: cutoffIso,
      p_excluded_email: userEmail,
    });
    if (statsError) throw new Error(statsError.message);

    const counts = readOwnerPetPurgeCounts(stats);
    ownerCount = counts.ownerCount;
    petCount = counts.petCount;
    if (!ownerCount && !petCount) {
      throw new Error("There are no existing website-created owners or patients eligible for cleanup in this clinic.");
    }

    const transporter = createHostingerTransport();
    const from = getHostingerFromAddress();
    if (!transporter || !from) {
      throw new Error("Hostinger SMTP is not configured on the server.");
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + WEBSITE_APPOINTMENT_PURGE_TTL_MS).toISOString();
    const codeHash = hashAdminActionCode(WEBSITE_OWNER_PET_PURGE_ACTION, userId, clinicId, code);

    await serviceRole
      .from("admin_email_action_codes")
      .delete()
      .eq("user_id", userId)
      .eq("clinic_id", clinicId)
      .eq("action_type", WEBSITE_OWNER_PET_PURGE_ACTION)
      .is("consumed_at", null);

    const { error: insertError } = await serviceRole.from("admin_email_action_codes").insert({
      clinic_id: clinicId,
      user_id: userId,
      email: userEmail,
      action_type: WEBSITE_OWNER_PET_PURGE_ACTION,
      code_hash: codeHash,
      payload: {
        cutoff_iso: cutoffIso,
        owner_count: ownerCount,
        pet_count: petCount,
        excluded_email: userEmail,
      },
      expires_at: expiresAt,
    });
    if (insertError) throw new Error(insertError.message);

    const branding = await getPlatformBranding();
    const brandName = branding.product_name || "GreenCoatVets";
    const mail = renderBrandedEmail({
      brandName,
      heading: "Confirm website owner and patient cleanup",
      intro: "Use the verification code below to permanently delete existing website-created test owners and patients for this clinic.",
      body: [
        `This code expires in ${Math.round(WEBSITE_APPOINTMENT_PURGE_TTL_MS / 60000)} minutes.`,
        "Only records created before you requested this code are included, and the admin email on your account is excluded from the cleanup.",
      ],
      details: [
        { label: "Verification code", value: code },
        { label: "Owners queued", value: String(ownerCount) },
        { label: "Patients queued", value: String(petCount) },
      ],
      footer: `${brandName} destructive action verification`,
    });

    await transporter.sendMail({
      from,
      to: userEmail,
      subject: `${brandName} verification code for website owner and patient cleanup`,
      text: mail.text,
      html: mail.html,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Could not send the verification code.";
    redirect(appointmentsUrl({ owner_pet_purge_error: errorMessage }));
  }

  redirect(
    appointmentsUrl({
      owner_pet_purge_code_sent: 1,
      owner_pet_purge_owner_count: ownerCount,
      owner_pet_purge_pet_count: petCount,
    })
  );
}

export async function confirmDeleteWebsiteOwnerPetAction(formData: FormData) {
  const { clinicId, userId, userEmail } = await assertWebsitePurgeAccess();
  const code = String(formData.get("verification_code") ?? "").trim();
  const confirmPhrase = String(formData.get("confirm_delete_text") ?? "")
    .trim()
    .toLowerCase();
  if (!/^\d{6}$/.test(code)) {
    redirect(appointmentsUrl({ owner_pet_purge_error: "Enter the 6-digit code sent to your email." }));
  }
  if (confirmPhrase !== "delete") {
    redirect(appointmentsUrl({ owner_pet_purge_error: 'Type "delete" to confirm removing website-created owners and patients.' }));
  }

  const serviceRole = createServiceRoleClient();
  if (!serviceRole) {
    redirect(appointmentsUrl({ owner_pet_purge_error: "SUPABASE_SERVICE_ROLE_KEY is required for destructive admin verification." }));
  }

  try {
    const { data: challenge, error: challengeError } = await serviceRole
      .from("admin_email_action_codes")
      .select("id, code_hash, expires_at, consumed_at, payload")
      .eq("user_id", userId)
      .eq("clinic_id", clinicId)
      .eq("action_type", WEBSITE_OWNER_PET_PURGE_ACTION)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (challengeError || !challenge) {
      throw new Error("Request a new verification code first.");
    }
    if (challenge.consumed_at) {
      throw new Error("That verification code has already been used. Request a new one.");
    }
    if (new Date(challenge.expires_at).getTime() < Date.now()) {
      throw new Error("That verification code has expired. Request a new one.");
    }

    const expectedHash = hashAdminActionCode(WEBSITE_OWNER_PET_PURGE_ACTION, userId, clinicId, code);
    if (expectedHash !== challenge.code_hash) {
      throw new Error("The verification code is incorrect.");
    }

    const payload =
      challenge.payload && typeof challenge.payload === "object"
        ? (challenge.payload as { cutoff_iso?: string | null; excluded_email?: string | null })
        : {};
    const cutoffIso = payload.cutoff_iso?.trim();
    const excludedEmail = payload.excluded_email?.trim().toLowerCase() || userEmail;
    if (!cutoffIso) {
      throw new Error("The delete request is missing its cutoff timestamp. Request a new code.");
    }

    const { data: purgeResult, error: purgeError } = await serviceRole.rpc("purge_website_owner_pet_records", {
      p_clinic_id: clinicId,
      p_cutoff: cutoffIso,
      p_excluded_email: excludedEmail,
    });
    if (purgeError) throw new Error(purgeError.message);
    const counts = readOwnerPetPurgeCounts(purgeResult);

    await serviceRole
      .from("admin_email_action_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", challenge.id);

    revalidatePath("/appointments");
    revalidatePath("/appointments/calendar");
    revalidatePath("/owners");
    revalidatePath("/pets");
    revalidatePath("/medical-records");
    revalidatePath("/vaccinations");
    revalidatePath("/dashboard");
    redirect(
      appointmentsUrl({
        owner_pet_purged: 1,
        owner_pet_purged_owner_count: counts.ownerCount,
        owner_pet_purged_pet_count: counts.petCount,
      })
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Could not delete website-created owners and patients.";
    redirect(appointmentsUrl({ owner_pet_purge_error: errorMessage }));
  }
}

export async function updateAppointmentStatus(formData: FormData) {
  const appointmentId = String(formData.get("appointment_id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!appointmentId || !allowedStatuses.includes(status as (typeof allowedStatuses)[number])) {
    throw new Error("Invalid appointment status update.");
  }

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const { error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", appointmentId)
    .eq("clinic_id", clinic_id);

  if (error) throw new Error(error.message);
  revalidatePath("/appointments");
}
