import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const appointmentId = url.searchParams.get("appointment_id")?.trim();
  const token = url.searchParams.get("token")?.trim() || null;
  const role = url.searchParams.get("role")?.trim() || null;

  if (!appointmentId) {
    return NextResponse.json({ error: "appointment_id is required" }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("validate_online_consult_join", {
    p_appointment_id: appointmentId,
    p_token: token,
    p_role: role,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  return NextResponse.json({ room: data });
}
