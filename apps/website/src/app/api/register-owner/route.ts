import { NextResponse } from "next/server";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      fullName?: string;
      phone?: string;
    };
    const fullName = (body.fullName ?? "").trim();
    const phone = (body.phone ?? "").trim();
    if (!fullName || !phone) {
      return NextResponse.json({ error: "Name and phone are required." }, { status: 400 });
    }

    const clinic = await resolveClinic();
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

    const { data: existing } = await supabase
      .from("owners")
      .select("id")
      .eq("clinic_id", clinic.id)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (existing) return NextResponse.json({ ok: true }, { status: 200 });

    const emailNorm = user.email?.trim().toLowerCase() ?? "";
    if (emailNorm) {
      const { data: guestOwner } = await supabase
        .from("owners")
        .select("id")
        .eq("clinic_id", clinic.id)
        .is("user_id", null)
        .eq("email", emailNorm)
        .limit(1)
        .maybeSingle();

      if (guestOwner?.id) {
        const { error: updErr } = await supabase
          .from("owners")
          .update({
            user_id: user.id,
            full_name: fullName,
            phone,
            email: emailNorm,
          })
          .eq("id", guestOwner.id);
        if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });
        return NextResponse.json({ ok: true, mergedGuest: true }, { status: 200 });
      }
    }

    const { error } = await supabase.from("owners").insert({
      clinic_id: clinic.id,
      user_id: user.id,
      full_name: fullName,
      phone,
      email: user.email ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Registration failed." }, { status: 500 });
  }
}
