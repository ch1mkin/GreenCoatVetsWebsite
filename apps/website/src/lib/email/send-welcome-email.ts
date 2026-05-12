import { getPlatformBranding } from "@/lib/platform-branding";
import { createHostingerTransport, getHostingerFromAddress } from "./hostinger-mail";
import { renderBrandedEmail } from "./render-branded-email";

export async function sendWebsiteWelcomeEmail(params: {
  email: string;
  fullName: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const to = params.email.trim().toLowerCase();
  if (!to) return { sent: false, reason: "no_recipient" };

  const transporter = createHostingerTransport();
  const from = getHostingerFromAddress();
  if (!transporter || !from) return { sent: false, reason: "smtp_not_configured" };

  const branding = await getPlatformBranding();
  const brandName = branding.product_name || "GreenCoatVets";
  const mail = renderBrandedEmail({
    brandName,
    heading: "Welcome to your pet owner account",
    intro: `Hi ${params.fullName || "there"}, your account is ready.`,
    body: [
      "You can now book appointments online, manage your pets, and access your visit history from the owner portal.",
    ],
    footer: `${brandName} welcome email`,
  });

  await transporter.sendMail({
    from,
    to,
    subject: `Welcome to ${brandName}`,
    text: mail.text,
    html: mail.html,
  });

  return { sent: true };
}
