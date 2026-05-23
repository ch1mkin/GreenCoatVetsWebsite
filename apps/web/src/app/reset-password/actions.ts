"use server";

import { redirect } from "next/navigation";
import { hashPasswordResetToken, validatePortalPasswordResetToken } from "@/lib/auth/portal-password-reset";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function resetPath(token: string): string {
  return `/reset-password/${encodeURIComponent(token.trim())}`;
}

export async function completePortalPasswordResetAction(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!token) {
    redirect("/forgot-password?error=invalid_token");
  }
  if (password.trim().length < 8) {
    redirect(`${resetPath(token)}?error=short_password`);
  }
  if (password !== confirmPassword) {
    redirect(`${resetPath(token)}?error=password_mismatch`);
  }

  const serviceRole = createServiceRoleClient();
  if (!serviceRole) {
    redirect(`${resetPath(token)}?error=server_config`);
  }

  const validation = await validatePortalPasswordResetToken(token);
  if (!validation.ok) {
    redirect(`/forgot-password?error=${validation.reason === "expired" ? "expired_token" : "invalid_token"}`);
  }

  const tokenHash = hashPasswordResetToken(token);
  const { data: row, error: rowError } = await serviceRole
    .from("web_portal_password_reset_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (rowError || !row) {
    redirect("/forgot-password?error=invalid_token");
  }
  if (row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
    redirect(`/forgot-password?error=${row.used_at ? "invalid_token" : "expired_token"}`);
  }

  const { data: authUser } = await serviceRole.auth.admin.getUserById(row.user_id);
  const metadata = (authUser.user?.user_metadata as Record<string, unknown> | undefined) ?? {};

  const { error: updateError } = await serviceRole.auth.admin.updateUserById(row.user_id, {
    password: password.trim(),
    user_metadata: {
      ...metadata,
      must_change_password: false,
    },
  });

  if (updateError) {
    console.error("[reset-password] auth update failed", updateError.message);
    redirect(`${resetPath(token)}?error=update_failed`);
  }

  const { error: markUsedError } = await serviceRole
    .from("web_portal_password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("used_at", null);

  if (markUsedError) {
    console.error("[reset-password] mark used failed", markUsedError.message);
  }

  redirect("/login?reset=1");
}
