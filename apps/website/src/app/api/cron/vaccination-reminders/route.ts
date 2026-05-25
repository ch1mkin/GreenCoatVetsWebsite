import { NextResponse } from "next/server";
import { sendVaccinationReminderEmail } from "@/lib/email/send-vaccination-reminder-email";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return header === secret;
}

/** Daily job: email owners for vaccination records due today (or overdue) with respond links. */
export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data: dueRows, error } = await admin
    .from("vaccination_records")
    .select("id, clinic_id, vaccine_name, due_on, status, pets(name, owners(full_name, email))")
    .lte("due_on", today)
    .not("status", "eq", "completed")
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  for (const row of dueRows ?? []) {
    const pets = row.pets as { name?: string; owners?: { full_name?: string; email?: string } | { full_name?: string; email?: string }[] } | null;
    const pet = Array.isArray(pets) ? pets[0] : pets;
    const owners = pet?.owners;
    const owner = Array.isArray(owners) ? owners[0] : owners;
    const email = owner?.email?.trim();
    if (!email) continue;

    const { data: tokenId, error: tokenErr } = await admin.rpc("ensure_vaccination_reminder_token", {
      p_vaccination_record_id: row.id,
    });
    if (tokenErr || !tokenId) continue;

    const { data: clinic } = await admin.from("clinics").select("name").eq("id", row.clinic_id).maybeSingle();

    const result = await sendVaccinationReminderEmail({
      to: email,
      ownerName: owner?.full_name?.trim() || "there",
      petName: pet?.name?.trim() || "your pet",
      clinicName: clinic?.name?.trim() || "Your clinic",
      vaccineName: row.vaccine_name,
      dueOn: row.due_on,
      token: String(tokenId),
    });

    if (result.sent) {
      sent += 1;
      await admin
        .from("vaccination_records")
        .update({ reminder_sent_at: new Date().toISOString(), status: "reminded" })
        .eq("id", row.id);
    }
  }

  return NextResponse.json({ ok: true, processed: dueRows?.length ?? 0, sent });
}
