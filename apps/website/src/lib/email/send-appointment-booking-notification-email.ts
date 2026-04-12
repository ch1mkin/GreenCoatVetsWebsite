import { createClient } from "@/lib/supabase/server";
import { createHostingerTransport, getHostingerFromAddress, resolveAdminNotificationEmail } from "./hostinger-mail";

export async function sendAppointmentBookingNotificationEmail(params: {
  clinicId: string;
  clinicName: string;
  branchId: string;
  appointmentType: string;
  startsAtIso: string;
  petName: string;
  ownerDisplay: string;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  chiefComplaint?: string | null;
  notes?: string | null;
  bookingSource: "owner_portal" | "guest_website";
}): Promise<{ sent: boolean; reason?: string }> {
  const supabase = createClient();
  const to = await resolveAdminNotificationEmail(supabase, params.clinicId);
  if (!to) return { sent: false, reason: "no_recipient" };

  const transporter = createHostingerTransport();
  const from = getHostingerFromAddress();
  if (!transporter || !from) return { sent: false, reason: "smtp_not_configured" };

  const { data: br } = await supabase.from("branches").select("name").eq("id", params.branchId).maybeSingle();
  const branchName = (br?.name as string | undefined)?.trim() || params.branchId;

  const when = new Date(params.startsAtIso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const sourceLabel = params.bookingSource === "guest_website" ? "Guest (website)" : "Signed-in owner";

  const lines = [
    `New appointment request — ${sourceLabel}`,
    "",
    `Clinic: ${params.clinicName}`,
    `Branch: ${branchName}`,
    `When: ${when}`,
    `Type: ${params.appointmentType}`,
    `Pet: ${params.petName}`,
    "",
    `Owner: ${params.ownerDisplay}`,
    `Email: ${params.ownerEmail?.trim() || "—"}`,
    `Phone: ${params.ownerPhone?.trim() || "—"}`,
    "",
  ];
  if (params.chiefComplaint?.trim()) lines.push(`Chief complaint / reason: ${params.chiefComplaint.trim()}`);
  if (params.notes?.trim()) lines.push(`Notes: ${params.notes.trim()}`);

  const text = lines.join("\n");

  await transporter.sendMail({
    from,
    to,
    replyTo: params.ownerEmail?.trim() || undefined,
    subject: `[${params.clinicName}] New appointment: ${params.petName} · ${when}`,
    text,
  });

  return { sent: true };
}
