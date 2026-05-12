"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendWebsitePasswordResetEmail } from "@/lib/email/send-password-reset-email";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function websiteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_WEBSITE_APP_URL ?? "http://localhost:3001").replace(/\/$/, "");
}

export async function requestWebsitePasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  const serviceRole = createServiceRoleClient();
  if (!serviceRole) {
    redirect("/forgot-password?sent=1");
  }

  if (email) {
    const { data: appUser } = await serviceRole
      .from("app_users")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    if (appUser?.id && appUser.email) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      await serviceRole
        .from("website_password_reset_tokens")
        .delete()
        .eq("user_id", appUser.id)
        .is("used_at", null);

      const { error: insertError } = await serviceRole.from("website_password_reset_tokens").insert({
        user_id: appUser.id,
        email: appUser.email,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });
      if (!insertError) {
        const resetUrl = `${websiteBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
        try {
          await sendWebsitePasswordResetEmail({
            email: appUser.email,
            resetUrl,
          });
        } catch (error) {
          console.error("[website] password reset email failed", error);
        }
      }
    }
  }

  redirect("/forgot-password?sent=1");
}
