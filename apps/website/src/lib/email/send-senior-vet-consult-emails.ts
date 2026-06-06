import { createHostingerTransport } from "./hostinger-mail";
import { getPlatformBranding } from "@/lib/platform-branding";
import { renderBrandedEmail } from "./render-branded-email";

type MailTransporter = NonNullable<ReturnType<typeof createHostingerTransport>>;

type ConsentAttachment = {
  filename: string;
  content: Buffer;
};

type SeniorVetConsultEmailContext = {
  clinicName: string;
  doctorName: string;
  doctorEmail: string;
  ownerName: string;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  petName: string;
  chiefComplaint?: string | null;
  whenLabel: string;
  doctorJoinUrl: string;
  consentAttachment: ConsentAttachment;
  transporter: MailTransporter;
  from: string;
};

export async function sendSeniorVetDoctorConsultEmail(ctx: SeniorVetConsultEmailContext): Promise<void> {
  const branding = await getPlatformBranding();
  const brandName = branding.product_name || ctx.clinicName;

  const mail = renderBrandedEmail({
    brandName,
    heading: "Senior Vet consultation booked",
    intro: `Hi ${ctx.doctorName}, a pet owner has booked an online video consultation with you.`,
    body: [
      "The signed consent form is attached to this email as a PDF. Please review it before starting the call.",
      "Use the secure link below to join — no website login is required.",
    ],
    details: [
      { label: "Pet", value: ctx.petName },
      { label: "Owner", value: ctx.ownerName },
      { label: "Owner email", value: ctx.ownerEmail?.trim() || "—" },
      { label: "Owner phone", value: ctx.ownerPhone?.trim() || "—" },
      { label: "When", value: ctx.whenLabel },
      { label: "Chief complaint", value: ctx.chiefComplaint?.trim() || "—" },
    ],
    ctaLabel: "Start video consultation",
    ctaHref: ctx.doctorJoinUrl,
    footer: `${brandName} · Senior Vet online consultations`,
  });

  await ctx.transporter.sendMail({
    from: ctx.from,
    to: ctx.doctorEmail,
    replyTo: ctx.ownerEmail?.trim() || undefined,
    subject: `${ctx.clinicName} — Senior Vet consult · ${ctx.petName} · consent attached`,
    text: `${mail.text}\n\nSigned consent PDF attached.`,
    html: mail.html,
    attachments: [
      {
        filename: ctx.consentAttachment.filename,
        content: ctx.consentAttachment.content,
        contentType: "application/pdf",
      },
    ],
  });
}

export async function sendSeniorVetAdminConsentEmail(params: {
  clinicName: string;
  adminEmail: string;
  ownerName: string;
  petName: string;
  whenLabel: string;
  consentAttachment: ConsentAttachment;
  transporter: MailTransporter;
  from: string;
}): Promise<void> {
  const branding = await getPlatformBranding();
  const brandName = branding.product_name || params.clinicName;

  const mail = renderBrandedEmail({
    brandName,
    heading: "Senior Vet consent signed",
    intro: "A pet owner completed the Senior Vet online consultation booking and signed the consent form.",
    body: ["The signed consent PDF is attached for your records."],
    details: [
      { label: "Owner", value: params.ownerName },
      { label: "Pet", value: params.petName },
      { label: "Consultation time", value: params.whenLabel },
    ],
    footer: `${brandName} · Clinic notifications`,
  });

  await params.transporter.sendMail({
    from: params.from,
    to: params.adminEmail,
    subject: `${params.clinicName} — Senior Vet consent signed (${params.petName})`,
    text: `${mail.text}\n\nSigned consent PDF attached.`,
    html: mail.html,
    attachments: [
      {
        filename: params.consentAttachment.filename,
        content: params.consentAttachment.content,
        contentType: "application/pdf",
      },
    ],
  });
}

export async function sendSeniorVetOwnerConfirmationEmail(params: {
  clinicName: string;
  ownerName: string;
  ownerEmail: string;
  petName: string;
  whenLabel: string;
  joinUrl: string | null;
  consentAttachment: ConsentAttachment;
  transporter: MailTransporter;
  from: string;
}): Promise<void> {
  const branding = await getPlatformBranding();
  const brandName = branding.product_name || params.clinicName;

  const mail = renderBrandedEmail({
    brandName,
    heading: "Your Senior Vet consultation is confirmed",
    intro: `Hi ${params.ownerName}, your online consultation for ${params.petName} is booked.`,
    body: [
      "Your signed consent form is attached to this email for your records.",
      "Join the video call at the scheduled time using the button below.",
      "You will receive a reminder before your session.",
    ],
    details: [
      { label: "Clinic", value: params.clinicName },
      { label: "Pet", value: params.petName },
      { label: "When", value: params.whenLabel },
    ],
    ctaLabel: params.joinUrl ? "Join video call on our website" : undefined,
    ctaHref: params.joinUrl ?? undefined,
    footer: `${brandName} · Appointment confirmation`,
  });

  await params.transporter.sendMail({
    from: params.from,
    to: params.ownerEmail,
    subject: `${params.clinicName} — Senior Vet consultation confirmed for ${params.petName}`,
    text: `${mail.text}\n\nSigned consent PDF attached.`,
    html: mail.html,
    attachments: [
      {
        filename: params.consentAttachment.filename,
        content: params.consentAttachment.content,
        contentType: "application/pdf",
      },
    ],
  });
}
