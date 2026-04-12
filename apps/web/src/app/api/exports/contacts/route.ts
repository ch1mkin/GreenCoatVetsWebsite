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
    .from("owners")
    .select("id, full_name, first_name, last_name, phone, email, city, address, business_name, website, created_at")
    .eq("clinic_id", clinic_id)
    .order("created_at", { ascending: false })
    .limit(10000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const headers = [
    "id",
    "full_name",
    "first_name",
    "last_name",
    "phone",
    "email",
    "city",
    "address",
    "business_name",
    "website",
    "created_at",
  ];
  const lines = [headers.join(",")];
  for (const row of data ?? []) {
    lines.push(
      [
        row.id,
        row.full_name,
        row.first_name,
        row.last_name,
        row.phone,
        row.email,
        row.city,
        row.address,
        row.business_name,
        row.website,
        row.created_at,
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  const csv = lines.join("\n");
  const filename = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
