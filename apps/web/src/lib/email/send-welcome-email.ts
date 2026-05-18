import { getPlatformBranding } from "@/lib/platform-branding";
import { createHostingerTransport, getHostingerFromAddress } from "./hostinger-mail";
import { renderBrandedEmail } from "./render-branded-email";

type AdminCreatedAccessKind = "website" | "web";

function getAccessUrls(kind: AdminCreatedAccessKind) {
  if (kind === "website") {
    return {
      loginUrl: "https://greencoatvets.com/admin/login",
      passwordUrl: "https://greencoatvets.com/admin/change-password",
      ctaLabel: "Open website admin",
      accessLabel: "website marketing admin (blog, settings, reviews)",
    };
  }

  return {
    loginUrl: "https://web.greencoatvets.com/login",
    passwordUrl: "https://web.greencoatvets.com/profile",
    ctaLabel: "Open clinic portal",
    accessLabel: "clinic web access",
  };
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
  accessKind: AdminCreatedAccessKind;
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
  const accessUrls = getAccessUrls(params.accessKind);
  const mail = renderBrandedEmail({
    brandName,
    heading: "Your clinic portal account is ready",
    intro: `Hi ${params.fullName || "there"}, a clinic administrator created your portal account.`,
    body: [
      params.roleLabel
        ? `You can now sign in as ${params.roleLabel} in the clinic workspace.`
        : "You can now sign in to the clinic workspace.",
      "You will be asked to set a new password immediately after your first sign-in.",
      `Website admin sign-in: ${accessUrls.loginUrl}`,
    ],
    details: [
      { label: "Login email", value: to },
      { label: "Temporary password", value: password },
      { label: "Access", value: accessUrls.accessLabel },
      ...(params.roleLabel ? [{ label: "Assigned role", value: params.roleLabel }] : []),
    ],
    bullets: [
      "Sign in at the website admin login with the credentials above.",
      "Complete the required password change screen on first login.",
      "Then manage blog posts, homepage content, and reviews from the admin panel.",
    ],
    ctaLabel: accessUrls.ctaLabel,
    ctaHref: accessUrls.loginUrl,
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
