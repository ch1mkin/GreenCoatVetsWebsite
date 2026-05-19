"use server";

import { redirect } from "next/navigation";
import { sendPortalPasswordResetLink } from "@/lib/auth/send-portal-password-reset";

export async function requestPortalPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  try {
    await sendPortalPasswordResetLink(email);
  } catch (error) {
    console.error("[forgot-password] reset request failed", error);
  }

  redirect("/forgot-password?sent=1");
}
