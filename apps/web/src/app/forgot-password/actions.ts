"use server";

import { redirect } from "next/navigation";
import { sendPortalPasswordResetLink } from "@/lib/auth/send-portal-password-reset";

export async function requestPortalPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  try {
    const result = await sendPortalPasswordResetLink(email);
    if (!result.ok) {
      redirect("/forgot-password?error=send_failed");
    }
    if (!result.sent && result.reason === "smtp_not_configured") {
      redirect("/forgot-password?error=send_failed");
    }
  } catch (error) {
    console.error("[forgot-password] reset request failed", error);
    redirect("/forgot-password?error=send_failed");
  }

  redirect("/forgot-password?sent=1");
}
