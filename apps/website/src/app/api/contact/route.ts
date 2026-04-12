import { NextResponse } from "next/server";
import { sendContactInquiryEmail } from "@/lib/contact/send-contact-inquiry-email";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      phone?: string;
      message?: string;
    };

    const name = (body.name ?? "").trim();
    const email = (body.email ?? "").trim();
    const phone = (body.phone ?? "").trim();
    const message = (body.message ?? "").trim();
    if (!name || !email || !message) {
      return NextResponse.json({ error: "Name, email and message are required." }, { status: 400 });
    }

    const clinic = await resolveClinic();
    const supabase = createClient();
    const { error } = await supabase.from("contact_inquiries").insert({
      clinic_id: clinic.id,
      name,
      email,
      phone: phone || null,
      message,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    try {
      await sendContactInquiryEmail({
        clinicId: clinic.id,
        clinicName: clinic.name,
        name,
        email,
        phone,
        message,
      });
    } catch (mailErr) {
      console.error("[contact] notification email failed", mailErr);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to submit contact form." }, { status: 500 });
  }
}
