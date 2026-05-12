import { getPlatformBranding } from "@/lib/platform-branding";
import { createHostingerTransport, getHostingerFromAddress } from "./hostinger-mail";
import { renderBrandedEmail } from "./render-branded-email";

export async function sendWebsitePasswordResetEmail(params: {
  email: string;
  resetUrl: string;
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
    heading: "Reset your password",
    intro: "A request was received to reset your website password.",
    body: [
      "Use the button below to choose a new password. For security, this reset link will expire shortly.",
      "If you did not request this, you can safely ignore this email.",
    ],
    ctaLabel: "Reset password",
    ctaHref: params.resetUrl,
    footer: `${brandName} password reset`,
  });

  await transporter.sendMail({
    from,
    to,
    subject: `${brandName} password reset`,
    text: mail.text,
    html: mail.html,
  });

  return { sent: true };
}
