import { NextResponse } from "next/server";
import { createHostingerTransport, getHostingerFromAddress } from "@/lib/email/hostinger-mail";
import { renderBrandedEmail } from "@/lib/email/render-branded-email";
import { getPlatformBranding } from "@/lib/platform-branding";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { createClient } from "@/lib/supabase/server";

/** Staff-only bridge: redirects to the public-site video room with a valid join token. */
export async function GET(_request: Request, { params }: { params: { appointmentId: string } }) {
  const appointmentId = params.appointmentId?.trim();
  if (!appointmentId) {
    return NextResponse.json({ error: "Missing appointment id" }, { status: 400 });
  }

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const { data: appt, error } = await supabase
    .from("appointments")
    .select("id, starts_at, guest_merge_token, online_consult_doctor_join_token, appointment_type, meet_link, owners(full_name, email), pets(name), clinics(name)")
    .eq("id", appointmentId)
    .eq("clinic_id", clinic_id)
    .eq("appointment_type", "online_consult")
    .maybeSingle();

  if (error || !appt?.guest_merge_token || !(appt.online_consult_doctor_join_token as string | null)) {
    return NextResponse.json({ error: "Online consultation not found" }, { status: 404 });
  }

  const websiteBase = (process.env.NEXT_PUBLIC_WEBSITE_APP_URL ?? "https://www.greencoatvets.com").replace(/\/$/, "");
  const url = `${websiteBase}/consult/room/${appointmentId}?role=doctor&doctor_token=${appt.online_consult_doctor_join_token as string}`;

  const ownerRaw = appt.owners as { full_name?: string | null; email?: string | null } | { full_name?: string | null; email?: string | null }[] | null;
  const owner = Array.isArray(ownerRaw) ? ownerRaw[0] : ownerRaw;
  const petRaw = appt.pets as { name?: string | null } | { name?: string | null }[] | null;
  const pet = Array.isArray(petRaw) ? petRaw[0] : petRaw;
  const clinicRaw = appt.clinics as { name?: string | null } | { name?: string | null }[] | null;
  const clinic = Array.isArray(clinicRaw) ? clinicRaw[0] : clinicRaw;
  const ownerEmail = owner?.email?.trim();

  const transporter = createHostingerTransport();
  const from = getHostingerFromAddress();
  if (ownerEmail && transporter && from) {
    try {
      const when = appt.starts_at ? new Date(appt.starts_at as string).toLocaleString() : "now";
      const joinHref = String(appt.meet_link ?? url).trim();
      const branding = await getPlatformBranding();
      const brandName = branding.product_name || clinic?.name || "GreenCoatVets";
      const mail = renderBrandedEmail({
        brandName,
        heading: "Your doctor is ready",
        intro: `Hi ${owner?.full_name ?? "there"}, your doctor is ready to start the online consultation for ${pet?.name ?? "your pet"}.`,
        body: ["Tap the button below to join the video call now."],
        details: [
          { label: "Clinic", value: clinic?.name ?? "Clinic" },
          { label: "Pet", value: pet?.name ?? "Your pet" },
          { label: "Scheduled time", value: when },
        ],
        ctas: [{ label: "Join consultation now", href: joinHref }],
        footer: `${brandName} · Senior Vet online consultations`,
      });
      await transporter.sendMail({
        from,
        to: ownerEmail,
        subject: `${clinic?.name ?? "Clinic"}: Doctor is ready for your online consultation`,
        text: mail.text,
        html: mail.html,
      });
    } catch (mailError) {
      console.error("[online-consult/redirect] owner notify failed", mailError);
    }
  }

  return NextResponse.redirect(url);
}
