import { getPlatformBranding } from "@/lib/platform-branding";
import { createHostingerTransport, getHostingerFromAddress } from "./hostinger-mail";
import { renderBrandedEmail } from "./render-branded-email";

export async function sendPortalWelcomeEmail(params: {
  email: string;
  fullName: string;
  roleLabel?: string | null;
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
    heading: "Welcome to your clinic workspace",
    intro: `Hi ${params.fullName || "there"}, your account is ready.`,
    body: [
      params.roleLabel
        ? `You can now sign in and work as ${params.roleLabel} inside the clinic portal.`
        : "You can now sign in and continue using the clinic portal.",
    ],
    footer: `${brandName} portal welcome email`,
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
