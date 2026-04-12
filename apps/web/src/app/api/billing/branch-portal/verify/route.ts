import crypto from "crypto";
import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { getRazorpayServerConfig } from "@/lib/payments/razorpay-server-config";
import { createClientFromRouteRequest } from "@/lib/supabase/route-request-client";

export async function POST(request: Request) {
  try {
    const rz = await getRazorpayServerConfig();
    if (!rz) {
      return NextResponse.json({ error: "Razorpay is not configured." }, { status: 500 });
    }

    const body = (await request.json()) as {
      licenseId?: string;
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      razorpaySignature?: string;
    };

    const licenseId = String(body.licenseId ?? "").trim();
    const razorpayOrderId = body.razorpayOrderId?.trim();
    const razorpayPaymentId = body.razorpayPaymentId?.trim();
    const razorpaySignature = body.razorpaySignature?.trim();

    if (!licenseId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json({ error: "Missing payment confirmation." }, { status: 400 });
    }

    const expected = crypto
      .createHmac("sha256", rz.keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (expected !== razorpaySignature) {
      return NextResponse.json({ error: "Payment verification failed." }, { status: 400 });
    }

    const supabase = createClientFromRouteRequest(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }

    const { data: lic, error: licErr } = await supabase
      .from("branch_web_portal_licenses")
      .select("id, purchased_by_user_id, status, amount_paise, razorpay_order_id")
      .eq("id", licenseId)
      .maybeSingle();

    if (licErr || !lic) {
      return NextResponse.json({ error: "License not found." }, { status: 400 });
    }
    if (lic.purchased_by_user_id !== user.id) {
      return NextResponse.json({ error: "Not your checkout." }, { status: 403 });
    }
    if (lic.status !== "pending") {
      return NextResponse.json({ error: "This license was already processed." }, { status: 400 });
    }
    if (!lic.razorpay_order_id || lic.razorpay_order_id !== razorpayOrderId) {
      return NextResponse.json({ error: "Order mismatch." }, { status: 400 });
    }

    const razorpay = new Razorpay({ key_id: rz.keyId, key_secret: rz.keySecret });
    const order = await razorpay.orders.fetch(razorpayOrderId);
    const orderAmount = Number(order.amount);
    const expectedPaise = Number(lic.amount_paise);
    if (!Number.isFinite(orderAmount) || orderAmount !== expectedPaise) {
      return NextResponse.json({ error: "Paid amount does not match checkout." }, { status: 400 });
    }

    const { error: completeErr } = await supabase.rpc("complete_branch_web_portal_license", {
      p_license_id: licenseId,
      p_razorpay_order_id: razorpayOrderId,
      p_razorpay_payment_id: razorpayPaymentId,
    });

    if (completeErr) {
      return NextResponse.json({ error: completeErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Verification failed." }, { status: 500 });
  }
}
