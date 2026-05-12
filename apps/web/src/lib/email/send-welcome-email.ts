import { getPlatformBranding } from "@/lib/platform-branding";
import { createHostingerTransport, getHostingerFromAddress } from "./hostinger-mail";
import { renderBrandedEmail } from "./render-branded-email";

function getPortalBaseUrl() {
  return (process.env.NEXT_PUBLIC_WEB_APP_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");
}

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

export async function sendAdminCreatedPortalCredentialsEmail(params: {
  email: string;
  fullName: string;
  password: string;
  roleLabel?: string | null;
}): Promise<{ sent: boolean; reason?: string }> {
  const to = params.email.trim().toLowerCase();
  const password = params.password.trim();
  if (!to) return { sent: false, reason: "no_recipient" };
  if (!password) return { sent: false, reason: "missing_password" };

  const transporter = createHostingerTransport();
  const from = getHostingerFromAddress();
  if (!transporter || !from) return { sent: false, reason: "smtp_not_configured" };

  const branding = await getPlatformBranding();
  const brandName = branding.product_name || "GreenCoatVets";
  const portalBaseUrl = getPortalBaseUrl();
  const loginUrl = `${portalBaseUrl}/login`;
  const profileUrl = `${portalBaseUrl}/profile`;
  const mail = renderBrandedEmail({
    brandName,
    heading: "Your clinic portal account is ready",
    intro: `Hi ${params.fullName || "there"}, a clinic administrator created your portal account.`,
    body: [
      params.roleLabel
        ? `You can now sign in as ${params.roleLabel} in the clinic workspace.`
        : "You can now sign in to the clinic workspace.",
      "Please change this temporary password immediately after your first login so you can set a password of your own choice.",
      `After signing in, open My profile to update your password: ${profileUrl}`,
    ],
    details: [
      { label: "Login email", value: to },
      { label: "Temporary password", value: password },
      ...(params.roleLabel ? [{ label: "Assigned role", value: params.roleLabel }] : []),
    ],
    bullets: [
      "Sign in with the credentials above.",
      "Open My profile in the portal after login.",
      "Set a new password that only you know.",
    ],
    ctaLabel: "Open clinic portal",
    ctaHref: loginUrl,
    footer: `${brandName} staff account setup`,
  });

  await transporter.sendMail({
    from,
    to,
    subject: `${brandName} portal login details`,
    text: mail.text,
    html: mail.html,
  });

  return { sent: true };
}
