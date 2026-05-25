import { NextResponse } from "next/server";
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
    .select("id, guest_merge_token, appointment_type")
    .eq("id", appointmentId)
    .eq("clinic_id", clinic_id)
    .eq("appointment_type", "online_consult")
    .maybeSingle();

  if (error || !appt?.guest_merge_token) {
    return NextResponse.json({ error: "Online consultation not found" }, { status: 404 });
  }

  const websiteBase = (process.env.NEXT_PUBLIC_WEBSITE_APP_URL ?? "https://www.greencoatvets.com").replace(/\/$/, "");
  const url = `${websiteBase}/consult/room/${appointmentId}?token=${appt.guest_merge_token}&role=doctor`;
  return NextResponse.redirect(url);
}
