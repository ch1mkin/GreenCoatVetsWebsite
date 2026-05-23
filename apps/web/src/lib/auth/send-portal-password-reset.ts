import crypto from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendPortalPasswordResetEmail } from "@/lib/email/send-portal-password-reset-email";
import { buildPasswordResetUrl, hashPasswordResetToken, webPortalBaseUrl } from "@/lib/auth/portal-password-reset";

export { webPortalBaseUrl };

export type SendPortalPasswordResetResult =
  | { ok: true; sent: true }
  | { ok: true; sent: false; reason: "no_user" | "smtp_not_configured" | "token_failed" }
  | { ok: false; error: string };

/** Create a reset token and email the link (service role only). */
export async function sendPortalPasswordResetLink(email: string): Promise<SendPortalPasswordResetResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return { ok: false, error: "Email is required." };
  }

  const serviceRole = createServiceRoleClient();
  if (!serviceRole) {
    return { ok: true, sent: false, reason: "smtp_not_configured" };
  }

  const { data: appUsers, error: lookupError } = await serviceRole
    .from("app_users")
    .select("id, email")
    .ilike("email", normalized)
    .limit(1);

  const appUser = appUsers?.[0];
  if (lookupError || !appUser?.id || !appUser.email) {
    return { ok: true, sent: false, reason: "no_user" };
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashPasswordResetToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await serviceRole
    .from("web_portal_password_reset_tokens")
    .delete()
    .eq("user_id", appUser.id)
    .is("used_at", null);

  const { error: insertError } = await serviceRole.from("web_portal_password_reset_tokens").insert({
    user_id: appUser.id,
    email: String(appUser.email).trim().toLowerCase(),
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (insertError) {
    console.error("[password-reset] token insert failed", insertError.message);
    return { ok: true, sent: false, reason: "token_failed" };
  }

  const resetUrl = buildPasswordResetUrl(rawToken);
  const mailResult = await sendPortalPasswordResetEmail({
    email: String(appUser.email).trim().toLowerCase(),
    resetUrl,
  });

  if (!mailResult.sent) {
    return {
      ok: true,
      sent: false,
      reason: mailResult.reason === "smtp_not_configured" ? "smtp_not_configured" : "token_failed",
    };
  }

  return { ok: true, sent: true };
}
