import crypto from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendPortalPasswordResetEmail } from "@/lib/email/send-portal-password-reset-email";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function webPortalBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_WEB_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export type SendPortalPasswordResetResult =
  | { ok: true; sent: true }
  | { ok: true; sent: false; reason: "no_user" | "smtp_not_configured" | "token_failed" }
  | { ok: false; error: string };

/** Create a one-hour reset token and email the link (service role only). */
export async function sendPortalPasswordResetLink(email: string): Promise<SendPortalPasswordResetResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return { ok: false, error: "Email is required." };
  }

  const serviceRole = createServiceRoleClient();
  if (!serviceRole) {
    return { ok: true, sent: false, reason: "smtp_not_configured" };
  }

  const { data: appUser } = await serviceRole
    .from("app_users")
    .select("id, email")
    .eq("email", normalized)
    .maybeSingle();

  if (!appUser?.id || !appUser.email) {
    return { ok: true, sent: false, reason: "no_user" };
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await serviceRole
    .from("web_portal_password_reset_tokens")
    .delete()
    .eq("user_id", appUser.id)
    .is("used_at", null);

  const { error: insertError } = await serviceRole.from("web_portal_password_reset_tokens").insert({
    user_id: appUser.id,
    email: appUser.email,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (insertError) {
    return { ok: true, sent: false, reason: "token_failed" };
  }

  const resetUrl = `${webPortalBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const mailResult = await sendPortalPasswordResetEmail({
    email: appUser.email,
    resetUrl,
  });

  if (!mailResult.sent) {
    return { ok: true, sent: false, reason: mailResult.reason === "smtp_not_configured" ? "smtp_not_configured" : "token_failed" };
  }

  return { ok: true, sent: true };
}
