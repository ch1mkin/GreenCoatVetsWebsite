import crypto from "crypto";
import { NextResponse } from "next/server";
import { SENIOR_VET_ONLINE_CONSENT_TEXT, SENIOR_VET_ONLINE_CONSENT_VERSION } from "@/lib/booking/senior-vet-consent";
import { createHostingerTransport, getHostingerFromAddress, resolveAdminNotificationEmail } from "@/lib/email/hostinger-mail";
import { sendAppointmentBookingNotificationEmail } from "@/lib/email/send-appointment-booking-notification-email";
import {
  sendSeniorVetAdminConsentEmail,
  sendSeniorVetDoctorConsultEmail,
  sendSeniorVetOwnerConfirmationEmail,
} from "@/lib/email/send-senior-vet-consult-emails";
import { buildOnlineConsultConsentPdf } from "@/lib/pdf/online-consent-pdf";
import { buildOnlineConsultJoinUrl } from "@/lib/online-consult/build-join-url";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { getWebsitePublicBaseUrl } from "@/lib/seo/public-site-url";
import { getRazorpayServerConfig } from "@/lib/payments/razorpay-server-config";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "medical-files";

type Body = {
  branch_id?: string;
  doctor_id?: string;
  starts_at?: string;
  owner_full_name?: string;
  owner_phone?: string;
  owner_email?: string;
  pet_name?: string;
  pet_species?: string;
  chief_complaint?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  signature_png?: string;
  consent_accepted?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body.consent_accepted) {
      return NextResponse.json({ error: "Consent is required." }, { status: 400 });
    }

    const clinic = await resolveClinic();
    const supabase = createClient();
    const { data: consultSettings } = await supabase
      .from("clinic_online_consult_settings")
      .select("test_mode")
      .eq("clinic_id", clinic.id)
      .maybeSingle();
    const isTestMode = Boolean(consultSettings?.test_mode);

    const orderId = body.razorpay_order_id?.trim();
    const paymentId = body.razorpay_payment_id?.trim();
    const signature = body.razorpay_signature?.trim();
    if (!isTestMode && (!orderId || !paymentId || !signature)) {
      return NextResponse.json({ error: "Missing payment confirmation." }, { status: 400 });
    }

    if (!isTestMode) {
      const rz = await getRazorpayServerConfig();
      if (!rz?.keySecret) {
        return NextResponse.json({ error: "Payment not configured." }, { status: 500 });
      }
      const expected = crypto.createHmac("sha256", rz.keySecret).update(`${orderId}|${paymentId}`).digest("hex");
      if (expected !== signature) {
        return NextResponse.json({ error: "Invalid payment signature." }, { status: 400 });
      }
    }

    const admin = createServiceRoleClient();
    if (!admin) return NextResponse.json({ error: "Server storage not configured." }, { status: 503 });

    const signedAt = new Date().toISOString();
    const pdfBytes = await buildOnlineConsultConsentPdf({
      clinicName: clinic.name,
      ownerName: body.owner_full_name?.trim() || "Owner",
      petName: body.pet_name?.trim() || "Pet",
      petSpecies: body.pet_species?.trim() || null,
      chiefComplaint: body.chief_complaint?.trim() || null,
      appointmentAtIso: body.starts_at ?? null,
      signedAtIso: signedAt,
      consentText: SENIOR_VET_ONLINE_CONSENT_TEXT,
      signaturePngBase64: body.signature_png,
    });

    const path = `online-consent/${clinic.id}/${orderId ?? `test_${Date.now()}`}.pdf`;
    const { error: uploadErr } = await admin.storage.from(BUCKET).upload(path, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    const { data, error } = await supabase.rpc("create_senior_vet_online_consult", {
      p_clinic_id: clinic.id,
      p_branch_id: body.branch_id,
      p_doctor_id: body.doctor_id,
      p_starts_at: body.starts_at,
      p_owner_full_name: body.owner_full_name,
      p_owner_phone: body.owner_phone,
      p_owner_email: body.owner_email,
      p_pet_name: body.pet_name,
      p_pet_species: body.pet_species || "unknown",
      p_chief_complaint: body.chief_complaint,
      p_razorpay_order_id: orderId ?? `test_order_${Date.now()}`,
      p_razorpay_payment_id: paymentId ?? `test_payment_${Date.now()}`,
      p_consent_pdf_path: path,
      p_website_base_url: getWebsitePublicBaseUrl(),
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const result = data as {
      appointment_id?: string;
      owner_id?: string;
      meet_link?: string;
      join_url?: string;
      doctor_join_url?: string;
      merge_token?: string;
    };

    const {
      data: { user: bookingUser },
    } = await supabase.auth.getUser();
    const ownerEmailNorm = body.owner_email?.trim().toLowerCase() ?? "";
    if (bookingUser?.email && ownerEmailNorm && bookingUser.email.toLowerCase() === ownerEmailNorm && result.owner_id) {
      await admin.from("owners").update({ user_id: bookingUser.id }).eq("id", result.owner_id);
    }
    const joinUrl =
      result.join_url ??
      result.meet_link ??
      (result.appointment_id && result.merge_token
        ? buildOnlineConsultJoinUrl(result.appointment_id, result.merge_token)
        : null);
    const doctorJoinUrl = result.doctor_join_url ?? null;
    const branchName = body.branch_id ?? "";

    const consentAttachment = {
      filename: `senior-vet-consent-${result.appointment_id ?? "booking"}.pdf`,
      content: Buffer.from(pdfBytes),
    };
    const transporter = createHostingerTransport();
    const from = getHostingerFromAddress();
    const whenLabel = body.starts_at ? new Date(body.starts_at).toLocaleString() : "Scheduled time";

    try {
      await sendAppointmentBookingNotificationEmail({
        clinicId: clinic.id,
        clinicName: clinic.name,
        branchName,
        appointmentType: "online_consult",
        startsAtIso: body.starts_at ?? "",
        petName: body.pet_name?.trim() || "Pet",
        ownerDisplay: body.owner_full_name?.trim() || "Owner",
        ownerEmail: body.owner_email?.trim() || "",
        ownerPhone: body.owner_phone?.trim() || "",
        chiefComplaint: body.chief_complaint || null,
        notes: `Senior Vet online consultation · Consent v${SENIOR_VET_ONLINE_CONSENT_VERSION}`,
        bookingSource: "guest_website",
        bookingCode: result.merge_token,
        consentPdfAttachment: consentAttachment,
        staffCtas: [
          ...(joinUrl ? [{ label: "Owner video room", href: joinUrl }] : []),
          ...(doctorJoinUrl ? [{ label: "Doctor video room", href: doctorJoinUrl }] : []),
        ],
      });
    } catch (mailErr) {
      console.error("[senior-vet] notification email failed", mailErr);
    }

    const adminEmail = await resolveAdminNotificationEmail(supabase, clinic.id);
    if (adminEmail && transporter && from) {
      try {
        await sendSeniorVetAdminConsentEmail({
          clinicName: clinic.name,
          adminEmail,
          ownerName: body.owner_full_name?.trim() || "Owner",
          petName: body.pet_name?.trim() || "Pet",
          whenLabel,
          consentAttachment,
          transporter,
          from,
        });
      } catch (adminMailErr) {
        console.error("[senior-vet] admin consent email failed", adminMailErr);
      }
    }

    const ownerEmail = body.owner_email?.trim();
    if (ownerEmail && transporter && from) {
      try {
        await sendSeniorVetOwnerConfirmationEmail({
          clinicName: clinic.name,
          ownerName: body.owner_full_name?.trim() || "Owner",
          ownerEmail,
          petName: body.pet_name?.trim() || "Pet",
          whenLabel,
          joinUrl,
          transporter,
          from,
        });
      } catch (ownerMailErr) {
        console.error("[senior-vet] owner email failed", ownerMailErr);
      }
    }

    if (doctorJoinUrl && transporter && from && body.doctor_id?.trim()) {
      try {
        const { data: doctorProfile } = await admin
          .from("staff_profiles")
          .select("full_name, user_id")
          .eq("id", body.doctor_id.trim())
          .maybeSingle();
        const doctorUserId = doctorProfile?.user_id?.trim();
        if (doctorUserId) {
          const { data: doctorUser } = await admin
            .from("app_users")
            .select("email")
            .eq("id", doctorUserId)
            .maybeSingle();
          const doctorEmail = doctorUser?.email?.trim();
          if (doctorEmail) {
            await sendSeniorVetDoctorConsultEmail({
              clinicName: clinic.name,
              doctorName: doctorProfile?.full_name?.trim() || "Doctor",
              doctorEmail,
              ownerName: body.owner_full_name?.trim() || "Owner",
              ownerEmail: body.owner_email?.trim() || null,
              ownerPhone: body.owner_phone?.trim() || null,
              petName: body.pet_name?.trim() || "Pet",
              chiefComplaint: body.chief_complaint || null,
              whenLabel,
              doctorJoinUrl,
              consentAttachment,
              transporter,
              from,
            });
          }
        }
      } catch (doctorMailErr) {
        console.error("[senior-vet] doctor email failed", doctorMailErr);
      }
    }

    return NextResponse.json({
      ok: true,
      appointmentId: result.appointment_id,
      meetLink: joinUrl,
      mergeToken: result.merge_token,
      consentPdfPath: path,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not complete booking." }, { status: 500 });
  }
}
