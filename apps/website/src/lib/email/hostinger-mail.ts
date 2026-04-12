import type { SupabaseClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { getMarketingSiteSettings } from "@/lib/marketing/get-marketing-site";

/**
 * Inbox for public-site alerts (contact form, new bookings). Set in Vercel so mail always reaches ops
 * without relying on DB-only settings.
 *
 * Falls back to marketing_site_settings.contact_form_recipient_email, then clinics.support_email.
 */
export async function resolveAdminNotificationEmail(
  supabase: SupabaseClient,
  clinicId: string,
): Promise<string | null> {
  const env = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
  if (env && env.includes("@")) return env;

  const settings = await getMarketingSiteSettings();
  const fromSettings = settings.contact_form_recipient_email?.trim();
  if (fromSettings && fromSettings.includes("@")) return fromSettings;

  const { data } = await supabase.from("clinics").select("support_email").eq("id", clinicId).maybeSingle();
  const fromClinic = data?.support_email?.trim();
  if (fromClinic && fromClinic.includes("@")) return fromClinic;

  return null;
}

export function createHostingerTransport() {
  const host = process.env.HOSTINGER_SMTP_HOST;
  const port = Number(process.env.HOSTINGER_SMTP_PORT ?? "465");
  const user = process.env.HOSTINGER_SMTP_USER;
  const pass = process.env.HOSTINGER_SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export function getHostingerFromAddress(): string | null {
  const from = process.env.HOSTINGER_SMTP_FROM?.trim();
  const user = process.env.HOSTINGER_SMTP_USER?.trim();
  return from || user || null;
}
