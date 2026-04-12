import { NextResponse } from "next/server";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { createClient } from "@/lib/supabase/server";

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, "\"\"")}"`;
  return s;
}

export async function GET() {
  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, starts_at, status, appointment_type, reason, notes, pets(name), owners(full_name, phone), branches(name)")
    .eq("clinic_id", clinic_id)
    .order("starts_at", { ascending: false })
    .limit(10000);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const header = ["id", "starts_at", "status", "appointment_type", "pet", "owner", "owner_phone", "branch", "reason", "notes"];
  const rows = [header.join(",")];
  for (const a of data ?? []) {
    const pet = Array.isArray(a.pets) ? a.pets[0] : a.pets;
    const owner = Array.isArray(a.owners) ? a.owners[0] : a.owners;
    const branch = Array.isArray(a.branches) ? a.branches[0] : a.branches;
    rows.push(
      [
        a.id,
        a.starts_at,
        a.status,
        a.appointment_type,
        pet?.name ?? "",
        owner?.full_name ?? "",
        owner?.phone ?? "",
        branch?.name ?? "",
        a.reason ?? "",
        a.notes ?? "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  const csv = rows.join("\n");
  const filename = `appointments-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
