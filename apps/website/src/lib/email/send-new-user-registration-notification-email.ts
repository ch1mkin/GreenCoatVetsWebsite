import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlatformBranding } from "@/lib/platform-branding";
import {
  createHostingerTransport,
  getHostingerFromAddress,
  resolveClinicNotificationRecipients,
} from "./hostinger-mail";
import { renderBrandedEmail } from "./render-branded-email";

export type NewUserRegistrationSource =
  | "website_owner"
  | "website_staff_invite"
  | "portal_staff_invite"
  | "portal_customer";

const SOURCE_LABELS: Record<NewUserRegistrationSource, string> = {
  website_owner: "Pet owner (public website)",
  website_staff_invite: "Staff invite (public website)",
  portal_staff_invite: "Staff invite (clinic portal)",
  portal_customer: "Customer signup (clinic portal)",
};

export async function sendNewUserRegistrationNotificationEmail(
  supabase: SupabaseClient,
  params: {
    clinicId: string;
    clinicName: string;
    fullName: string;
    email: string;
    phone?: string | null;
    registrationSource: NewUserRegistrationSource;
    role?: string | null;
  },
): Promise<{ sent: boolean; reason?: string }> {
  const transporter = createHostingerTransport();
  const from = getHostingerFromAddress();
  if (!transporter || !from) return { sent: false, reason: "smtp_not_configured" };

  const recipients = await resolveClinicNotificationRecipients(supabase, params.clinicId, [
    "clinic_admin",
    "branch_admin",
  ]);
  if (!recipients.length) return { sent: false, reason: "no_recipient" };

  const branding = await getPlatformBranding();
  const brandName = branding.product_name || params.clinicName;
  const sourceLabel = SOURCE_LABELS[params.registrationSource];
  const roleLabel = params.role?.trim() ? params.role.replace(/_/g, " ") : "—";

  const mail = renderBrandedEmail({
    brandName,
    heading: "New user registration",
    intro: `A new account was created on ${brandName}.`,
    body: [`Registration channel: ${sourceLabel}. Review the account in your admin tools if follow-up is needed.`],
    details: [
      { label: "Clinic", value: params.clinicName },
      { label: "Name", value: params.fullName.trim() || "—" },
      { label: "Email", value: params.email.trim() || "—" },
      { label: "Phone", value: params.phone?.trim() || "—" },
      { label: "Role", value: roleLabel },
      { label: "Source", value: sourceLabel },
    ],
    footer: `${brandName} registration alerts`,
  });

  const subject = `[${params.clinicName}] New registration: ${params.fullName.trim() || params.email}`;

  for (const recipient of recipients) {
    await transporter.sendMail({
      from,
      to: recipient,
      replyTo: params.email.trim() || undefined,
      subject,
      text: mail.text,
      html: mail.html,
    });
  }

  return { sent: true };
}
