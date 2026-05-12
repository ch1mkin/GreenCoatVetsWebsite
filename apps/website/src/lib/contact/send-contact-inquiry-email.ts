import { createClient } from "@/lib/supabase/server";
import { getPlatformBranding } from "@/lib/platform-branding";
import { createHostingerTransport, getHostingerFromAddress, resolveAdminNotificationEmail } from "@/lib/email/hostinger-mail";
import { renderBrandedEmail } from "@/lib/email/render-branded-email";

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

  const branding = await getPlatformBranding();
  const brandName = branding.product_name || params.clinicName;
  const mail = renderBrandedEmail({
    brandName,
    heading: "New website inquiry",
    intro: `${params.name} sent a message through the public website.`,
    details: [
      { label: "Clinic", value: params.clinicName },
      { label: "Name", value: params.name },
      { label: "Email", value: params.email },
      { label: "Phone", value: params.phone || "—" },
      { label: "Message", value: params.message },
    ],
    footer: `${brandName} website contact inquiries`,
  });

  await transporter.sendMail({
    from,
    to,
    replyTo: params.email,
    subject: `[${params.clinicName}] Contact: ${params.name}`,
    text: mail.text,
    html: mail.html,
  });

  return { sent: true };
}
