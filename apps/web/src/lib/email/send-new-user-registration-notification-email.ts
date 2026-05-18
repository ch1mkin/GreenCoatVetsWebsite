import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createHostingerTransport, getHostingerFromAddress } from "./hostinger-mail";
import { renderBrandedEmail } from "./render-branded-email";

export type PortalNewUserRegistrationSource = "portal_staff_invite" | "portal_customer";

const SOURCE_LABELS: Record<PortalNewUserRegistrationSource, string> = {
  portal_staff_invite: "Staff invite (clinic portal)",
  portal_customer: "Customer signup (clinic portal)",
};

async function resolveNotificationRecipients(
  supabase: SupabaseClient,
  clinicId: string,
): Promise<string[]> {
  const recipients = new Set<string>();
  const env = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
  if (env && env.includes("@")) recipients.add(env.toLowerCase());

  const lookupClient = createServiceRoleClient() ?? supabase;

  const { data: clinic } = await lookupClient
    .from("clinics")
    .select("support_email")
    .eq("id", clinicId)
    .maybeSingle();
  const support = clinic?.support_email?.trim();
  if (support && support.includes("@")) recipients.add(support.toLowerCase());

  const { data: members } = await lookupClient
    .from("user_clinic_memberships")
    .select("user_id")
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .in("role", ["clinic_admin", "branch_admin"]);

  const userIds = Array.from(new Set((members ?? []).map((row) => row.user_id).filter(Boolean)));
  if (userIds.length) {
    const { data: users } = await lookupClient.from("app_users").select("email").in("id", userIds).not("email", "is", null);
    for (const row of users ?? []) {
      const email = row.email?.trim().toLowerCase();
      if (email) recipients.add(email);
    }
  }

  return Array.from(recipients);
}

export async function sendPortalNewUserRegistrationNotificationEmail(
  supabase: SupabaseClient,
  params: {
    clinicId: string;
    clinicName: string;
    productName: string;
    fullName: string;
    email: string;
    phone?: string | null;
    registrationSource: PortalNewUserRegistrationSource;
    role?: string | null;
  },
): Promise<{ sent: boolean; reason?: string }> {
  const transporter = createHostingerTransport();
  const from = getHostingerFromAddress();
  if (!transporter || !from) return { sent: false, reason: "smtp_not_configured" };

  const recipients = await resolveNotificationRecipients(supabase, params.clinicId);
  if (!recipients.length) return { sent: false, reason: "no_recipient" };

  const brandName = params.productName.trim() || params.clinicName;
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
