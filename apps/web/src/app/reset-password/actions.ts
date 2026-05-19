"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function completePortalPasswordResetAction(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!token) {
    redirect("/forgot-password?error=invalid_token");
  }
  if (password.trim().length < 8) {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=short_password`);
  }
  if (password !== confirmPassword) {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=password_mismatch`);
  }

  const serviceRole = createServiceRoleClient();
  if (!serviceRole) {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=server_config`);
  }

  const tokenHash = hashToken(token);
  const { data: row, error: rowError } = await serviceRole
    .from("web_portal_password_reset_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (rowError || !row) {
    redirect("/forgot-password?error=invalid_token");
  }
  if (row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
    redirect("/forgot-password?error=expired_token");
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
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=update_failed`);
  }

  await serviceRole
    .from("web_portal_password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id);

  redirect("/login?reset=1");
}
