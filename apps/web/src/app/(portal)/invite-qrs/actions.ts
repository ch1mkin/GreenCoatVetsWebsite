"use server";

import { revalidatePath } from "next/cache";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";
import { roleCanGenerateQr } from "@/lib/auth/permissions";

export async function createInviteQr(formData: FormData) {
  const access = await getUserAccess();
  const memberRole = (access.membership?.role ?? "pet_owner") as
    | "super_admin"
    | "clinic_admin"
    | "branch_admin"
    | "doctor"
    | "senior_doctor"
    | "receptionist"
    | "lab_technician"
    | "pharmacist"
    | "pet_owner";
  const perms = roleCanGenerateQr(memberRole, access.isSuperAdmin);
  if (!perms.allowedRoles.length) {
    throw new Error("Your role is not allowed to create invite QRs.");
  }

  const clinicIdInput = String(formData.get("clinic_id") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const maxUsesRaw = String(formData.get("max_uses") ?? "").trim();
  const expiresInDaysRaw = String(formData.get("expires_in_days") ?? "").trim();

  const maxUses = maxUsesRaw ? Number(maxUsesRaw) : null;
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses <= 0)) {
    throw new Error("Max uses must be a positive integer.");
  }

  const expiresInDays = expiresInDaysRaw ? Number(expiresInDaysRaw) : null;
  if (expiresInDays !== null && (!Number.isInteger(expiresInDays) || expiresInDays <= 0)) {
    throw new Error("Expiry days must be a positive integer.");
  }
  if (!perms.allowedRoles.includes(role as typeof perms.allowedRoles[number])) {
    throw new Error("This role is not allowed for your QR generation permission.");
  }

  const expiresAt =
    expiresInDays === null
      ? null
      : new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  const supabase = createClient();

  const targetClinicId =
    access.isSuperAdmin
      ? clinicIdInput || access.membership?.clinic_id || ""
      : access.membership?.clinic_id || "";
  if (!targetClinicId) {
    throw new Error("Clinic is required.");
  }

  const { error } = await supabase.rpc("create_role_invite", {
    p_clinic_id: targetClinicId,
    p_role: role,
    p_label: label || null,
    p_max_uses: maxUses,
    p_expires_at: expiresAt,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/invite-qrs");
}
