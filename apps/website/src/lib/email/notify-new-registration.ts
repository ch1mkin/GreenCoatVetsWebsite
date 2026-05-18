"use server";

import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { createClient } from "@/lib/supabase/server";
import {
  sendNewUserRegistrationNotificationEmail,
  type NewUserRegistrationSource,
} from "./send-new-user-registration-notification-email";

export async function notifyNewUserRegistrationAction(input: {
  fullName: string;
  email: string;
  phone?: string | null;
  registrationSource: NewUserRegistrationSource;
  role?: string | null;
}): Promise<{ ok: boolean }> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false };

    const clinic = await resolveClinic();
    const email = (input.email || user.email || "").trim().toLowerCase();
    if (!email) return { ok: false };

    await sendNewUserRegistrationNotificationEmail(supabase, {
      clinicId: clinic.id,
      clinicName: clinic.name,
      fullName: input.fullName.trim() || email,
      email,
      phone: input.phone,
      registrationSource: input.registrationSource,
      role: input.role,
    });

    return { ok: true };
  } catch (error) {
    console.error("[notify-new-registration] failed", error);
    return { ok: false };
  }
}
