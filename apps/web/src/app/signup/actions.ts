"use server";

import { sendPortalWelcomeEmail } from "@/lib/email/send-welcome-email";

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
