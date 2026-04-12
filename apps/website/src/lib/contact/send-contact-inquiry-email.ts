import { createClient } from "@/lib/supabase/server";
import { createHostingerTransport, getHostingerFromAddress, resolveAdminNotificationEmail } from "@/lib/email/hostinger-mail";

export async function sendContactInquiryEmail(params: {
  clinicId: string;
  clinicName: string;
  name: string;
  email: string;
  phone: string;
  message: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const supabase = createClient();
  const to = await resolveAdminNotificationEmail(supabase, params.clinicId);
  if (!to) {
    return { sent: false, reason: "no_recipient" };
  }

  const transporter = createHostingerTransport();
  const from = getHostingerFromAddress();
  if (!transporter || !from) {
    return { sent: false, reason: "smtp_not_configured" };
  }

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
