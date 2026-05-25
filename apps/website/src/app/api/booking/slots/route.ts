import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clinicId = url.searchParams.get("clinic_id")?.trim();
  const branchId = url.searchParams.get("branch_id")?.trim() || null;
  const doctorId = url.searchParams.get("doctor_id")?.trim();
  const date = url.searchParams.get("date")?.trim();

  if (!clinicId || !doctorId || !date) {
    return NextResponse.json({ error: "clinic_id, doctor_id, and date are required." }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_public_booking_slots", {
    p_clinic_id: clinicId,
    p_branch_id: branchId,
    p_doctor_id: doctorId,
    p_date: date,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ slots: data ?? [] });
}
