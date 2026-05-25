import { getWebsitePublicBaseUrl } from "@/lib/seo/public-site-url";
import { vaccinationReminderUrls } from "@/lib/reminders/vaccination-reminder-urls";
import { createHostingerTransport, getHostingerFromAddress } from "./hostinger-mail";
import { renderBrandedEmail } from "./render-branded-email";

export async function sendVaccinationReminderEmail(params: {
  to: string;
  ownerName: string;
  petName: string;
  clinicName: string;
  vaccineName: string;
  dueOn?: string | null;
  token: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const to = params.to.trim().toLowerCase();
  if (!to) return { sent: false, reason: "no_recipient" };

  const transporter = createHostingerTransport();
  const from = getHostingerFromAddress();
  if (!transporter || !from) return { sent: false, reason: "smtp_not_configured" };

  const links = vaccinationReminderUrls(params.token);
  const when = params.dueOn ? new Date(params.dueOn).toLocaleDateString() : "soon";
  const brandName = params.clinicName;

  const mail = renderBrandedEmail({
    brandName,
    heading: "Vaccination reminder",
    intro: `Hi ${params.ownerName || "there"}, ${params.petName} is due for ${params.vaccineName} around ${when}.`,
    body: [
      "Tap a button below to tell us if the vaccination is done, or to get a reminder tomorrow.",
      `Manage reminders: ${links.respondPage}`,
    ],
    details: [
      { label: "Pet", value: params.petName },
      { label: "Vaccine", value: params.vaccineName },
      { label: "Due", value: when },
    ],
    ctaLabel: "Open reminder page",
    ctaHref: links.respondPage,
    footer: `${brandName} · ${getWebsitePublicBaseUrl()}`,
  });

  await transporter.sendMail({
    from,
    to,
    subject: `${params.clinicName} vaccination reminder — ${params.petName}`,
    text: `${mail.text}\n\nDone: ${links.completed}\nNot done: ${links.notDone}\nOpt out: ${links.optOut}`,
    html: `${mail.html}
      <p style="margin:16px 0;">
        <a href="${links.completed}" style="margin-right:8px;">Done</a>
        <a href="${links.notDone}">Not done</a>
        <a href="${links.optOut}" style="margin-left:8px;font-size:12px;">Unsubscribe</a>
      </p>`,
  });

  return { sent: true };
}
