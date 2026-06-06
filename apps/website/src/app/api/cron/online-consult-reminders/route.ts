import { NextResponse } from "next/server";
import { createHostingerTransport, getHostingerFromAddress } from "@/lib/email/hostinger-mail";
import { renderBrandedEmail } from "@/lib/email/render-branded-email";
import { getPlatformBranding } from "@/lib/platform-branding";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return header === secret;
}

/** Sends email ~20 minutes before online_consult appointments. */
export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  const transporter = createHostingerTransport();
  const from = getHostingerFromAddress();
  if (!admin || !transporter || !from) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const branding = await getPlatformBranding();
  const brandName = branding.product_name || "GreenCoatVets";

  const now = new Date();
  const windowStart = new Date(now.getTime() + 18 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() + 22 * 60 * 1000).toISOString();

  const { data: rows, error } = await admin
    .from("appointments")
    .select("id, starts_at, meet_link, clinics(name), owners(full_name, email), pets(name)")
    .eq("appointment_type", "online_consult")
    .eq("status", "scheduled")
    .gte("starts_at", windowStart)
    .lte("starts_at", windowEnd)
    .not("meet_link", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  for (const row of rows ?? []) {
    const owners = row.owners as { full_name?: string; email?: string } | { full_name?: string; email?: string }[] | null;
    const owner = Array.isArray(owners) ? owners[0] : owners;
    const email = owner?.email?.trim();
    const joinUrl = String(row.meet_link ?? "").trim();
    if (!email || !joinUrl) continue;
    const clinics = row.clinics as { name?: string } | { name?: string }[] | null;
    const clinicName = (Array.isArray(clinics) ? clinics[0]?.name : clinics?.name) ?? "Clinic";
    const pets = row.pets as { name?: string } | { name?: string }[] | null;
    const petName = (Array.isArray(pets) ? pets[0]?.name : pets?.name) ?? "your pet";
    const when = new Date(row.starts_at as string).toLocaleString();
    const ownerName = owner?.full_name?.trim() || "there";

    const mail = renderBrandedEmail({
      brandName: brandName || clinicName,
      heading: "Your video call starts soon",
      intro: `Hi ${ownerName}, your Senior Vet online consultation for ${petName} begins in about 20 minutes.`,
      body: [
        "Tap the button below when it is time to join. The call opens in your browser — no separate app required.",
      ],
      details: [
        { label: "Clinic", value: clinicName },
        { label: "Pet", value: petName },
        { label: "When", value: when },
      ],
      ctas: [{ label: "Join video call", href: joinUrl }],
      footer: `${brandName || clinicName} · Senior Vet online consultations`,
    });

    await transporter.sendMail({
      from,
      to: email,
      subject: `${clinicName} — Senior Vet call in ~20 minutes`,
      text: mail.text,
      html: mail.html,
    });
    sent += 1;
  }

  return NextResponse.json({ ok: true, candidates: rows?.length ?? 0, sent });
}
