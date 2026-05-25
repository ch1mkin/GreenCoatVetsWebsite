import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { getRazorpayServerConfig } from "@/lib/payments/razorpay-server-config";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const clinic = await resolveClinic();
    const supabase = createClient();
    const { data: settings, error } = await supabase
      .from("clinic_online_consult_settings")
      .select("enabled, price_paise, product_name")
      .eq("clinic_id", clinic.id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!settings?.enabled) {
      return NextResponse.json({ error: "Senior Vet online consultation is not available." }, { status: 403 });
    }

    const rz = await getRazorpayServerConfig();
    if (!rz) {
      return NextResponse.json({ error: "Payment gateway is not configured." }, { status: 500 });
    }

    const amountPaise = settings.price_paise;
    const razorpay = new Razorpay({ key_id: rz.keyId, key_secret: rz.keySecret });
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: `svc_${clinic.id.slice(0, 8)}_${Date.now()}`,
      notes: { clinic_id: clinic.id, product: "senior_vet_online" },
    });

    return NextResponse.json({
      razorpayOrderId: order.id,
      keyId: rz.keyId,
      amountPaise,
      productName: settings.product_name,
      paymentMode: rz.paymentMode,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not start payment." }, { status: 500 });
  }
}
