"use server";

import { beginPortalEmailOtpForUser, verifyPortalEmailOtpForCurrentUser } from "@/lib/auth/portal-email-otp";
import { createClient } from "@/lib/supabase/server";

type OtpActionResult = { ok: true; sentTo?: string; next?: string } | { ok: false; error: string };

export async function beginPortalLoginOtpAction(emailHint?: string | null): Promise<OtpActionResult> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      return { ok: false, error: "Sign in first to request a verification code." };
    }
    const result = await beginPortalEmailOtpForUser(user.id, user.email ?? emailHint);
    return { ok: true, sentTo: result.sentTo };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not send the verification code." };
  }
}

export async function verifyPortalLoginOtpAction(formData: FormData): Promise<OtpActionResult> {
  try {
    const code = String(formData.get("code") ?? "");
    const next = String(formData.get("next") ?? "").trim();
    await verifyPortalEmailOtpForCurrentUser(code);
    return { ok: true, next: next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not verify the code." };
  }
}
