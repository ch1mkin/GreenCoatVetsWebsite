"use server";

import { sendPortalNewUserRegistrationNotificationEmail } from "@/lib/email/send-new-user-registration-notification-email";
import { sendPortalWelcomeEmail } from "@/lib/email/send-welcome-email";
import { getPlatformBranding } from "@/lib/platform-branding";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

type WelcomeResult = { ok: true } | { ok: false; error: string };

export async function sendPortalWelcomeEmailAction(input: {
  email: string;
  fullName: string;
  roleLabel?: string | null;
}): Promise<WelcomeResult> {
  try {
    const email = input.email.trim().toLowerCase();
    if (!email) return { ok: false, error: "Email is required." };
    const fullName = input.fullName.trim() || email;

    await sendPortalWelcomeEmail({
      email,
      fullName,
      roleLabel: input.roleLabel,
    });

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not send the welcome email." };
  }
}

export async function notifyPortalNewUserRegistrationAction(input: {
  fullName: string;
  email: string;
  phone?: string | null;
  registrationSource: "portal_staff_invite" | "portal_customer";
  role?: string | null;
}): Promise<{ ok: boolean }> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false };

    const email = (input.email || user.email || "").trim().toLowerCase();
    if (!email) return { ok: false };

    const admin = createServiceRoleClient() ?? supabase;
    const { data: membership } = await admin
      .from("user_clinic_memberships")
      .select("clinic_id, role, clinics(name)")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!membership?.clinic_id) return { ok: false };

    const clinicRow = membership.clinics as { name?: string } | null;
    const clinicName = clinicRow?.name?.trim() || "Clinic";
    const branding = await getPlatformBranding();
    const productName = branding.product_name?.trim() || clinicName;

    await sendPortalNewUserRegistrationNotificationEmail(supabase, {
      clinicId: membership.clinic_id,
      clinicName,
      productName,
      fullName: input.fullName.trim() || email,
      email,
      phone: input.phone,
      registrationSource: input.registrationSource,
      role: input.role ?? membership.role,
    });

    return { ok: true };
  } catch (error) {
    console.error("[notify-portal-registration] failed", error);
    return { ok: false };
  }
}
