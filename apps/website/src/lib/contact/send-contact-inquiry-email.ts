import nodemailer from "nodemailer";
import { createClient } from "@/lib/supabase/server";
import { getMarketingSiteSettings } from "@/lib/marketing/get-marketing-site";

export async function sendContactInquiryEmail(params: {
  clinicId: string;
  clinicName: string;
  name: string;
  email: string;
  phone: string;
  message: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const settings = await getMarketingSiteSettings();
  const fromSettings = settings.contact_form_recipient_email?.trim();
  let to = fromSettings && fromSettings.includes("@") ? fromSettings : null;

  if (!to) {
    const supabase = createClient();
    const { data } = await supabase.from("clinics").select("support_email").eq("id", params.clinicId).maybeSingle();
    const fromClinic = data?.support_email?.trim();
    to = fromClinic && fromClinic.includes("@") ? fromClinic : null;
  }

  if (!to) {
    return { sent: false, reason: "no_recipient" };
  }

  const host = process.env.HOSTINGER_SMTP_HOST;
  const port = Number(process.env.HOSTINGER_SMTP_PORT ?? "465");
  const user = process.env.HOSTINGER_SMTP_USER;
  const pass = process.env.HOSTINGER_SMTP_PASS;
  const from = process.env.HOSTINGER_SMTP_FROM || user;

  if (!host || !user || !pass || !from) {
    return { sent: false, reason: "smtp_not_configured" };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const text = [
    `New message from ${params.clinicName} marketing site`,
    "",
    `Name: ${params.name}`,
    `Email: ${params.email}`,
    `Phone: ${params.phone || "—"}`,
    "",
    params.message,
  ].join("\n");

  await transporter.sendMail({
    from,
    to,
    replyTo: params.email,
    subject: `[${params.clinicName}] Contact: ${params.name}`,
    text,
  });

  return { sent: true };
}
