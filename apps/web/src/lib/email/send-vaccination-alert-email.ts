import { getPlatformBranding } from "@/lib/platform-branding";
import { createHostingerTransport, getHostingerFromAddress } from "./hostinger-mail";
import { renderBrandedEmail } from "./render-branded-email";

export async function sendVaccinationAlertEmail(params: {
  to: string;
  ownerName: string;
  petName: string;
  clinicName: string;
  branchName?: string | null;
  vaccineName: string;
  dose?: string | null;
  dueOn?: string | null;
  notes?: string | null;
}): Promise<{ sent: boolean; reason?: string }> {
  const to = params.to.trim().toLowerCase();
  if (!to) return { sent: false, reason: "no_recipient" };

  const transporter = createHostingerTransport();
  const from = getHostingerFromAddress();
  if (!transporter || !from) return { sent: false, reason: "smtp_not_configured" };

  const branding = await getPlatformBranding();
  const brandName = branding.product_name || params.clinicName;
  const when = params.dueOn ? new Date(params.dueOn).toLocaleDateString() : "the scheduled date";
  const mail = renderBrandedEmail({
    brandName,
    heading: "Vaccination reminder",
    intro: `Hi ${params.ownerName || "there"}, ${params.petName} has a vaccination reminder from ${params.clinicName}.`,
    body: ["Please keep this reminder for your records and contact the clinic if you need to adjust the appointment date."],
    details: [
      { label: "Clinic", value: params.clinicName },
      { label: "Branch", value: params.branchName?.trim() || "—" },
      { label: "Pet", value: params.petName },
      { label: "Vaccine", value: params.vaccineName },
      { label: "Dose", value: params.dose?.trim() || "—" },
      { label: "Due date", value: when },
      { label: "Notes", value: params.notes?.trim() || "—" },
    ],
    footer: `${brandName} vaccination reminders`,
  });

  await transporter.sendMail({
    from,
    to,
    subject: `${params.clinicName} vaccination reminder for ${params.petName}`,
    text: mail.text,
    html: mail.html,
  });

  return { sent: true };
}
