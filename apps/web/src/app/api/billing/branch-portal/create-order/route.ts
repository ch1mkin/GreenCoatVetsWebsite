import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { getRazorpayServerConfig } from "@/lib/payments/razorpay-server-config";
import { createClientFromRouteRequest } from "@/lib/supabase/route-request-client";

export async function POST(request: Request) {
  try {
    const rz = await getRazorpayServerConfig();
    if (!rz) {
      return NextResponse.json(
        {
          error:
            "Razorpay is not configured. Super admins can set keys under Payments, or set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
        },
        { status: 500 },
      );
    }

    const body = (await request.json()) as { licenseId?: string };
    const licenseId = String(body.licenseId ?? "").trim();
    if (!licenseId) {
      return NextResponse.json({ error: "licenseId is required." }, { status: 400 });
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
      .select("id, status, amount_paise, currency, clinic_id, branch_id, purchased_by_user_id")
      .eq("id", licenseId)
      .maybeSingle();

    if (licErr) {
      return NextResponse.json({ error: licErr.message }, { status: 400 });
    }
    if (!lic || lic.purchased_by_user_id !== user.id || lic.status !== "pending") {
      return NextResponse.json({ error: "Invalid or expired checkout session." }, { status: 400 });
    }

    const amountPaise = Number(lic.amount_paise);
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      return NextResponse.json({ error: "Invalid license amount." }, { status: 400 });
    }

    const razorpay = new Razorpay({ key_id: rz.keyId, key_secret: rz.keySecret });
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: (lic.currency as string) || "INR",
      receipt: `bwp_${String(lic.id).slice(0, 8)}_${Date.now()}`,
      notes: {
        license_id: lic.id,
        clinic_id: lic.clinic_id,
        branch_id: lic.branch_id,
      },
    });

    const { error: attachErr } = await supabase.rpc("attach_branch_web_portal_license_order", {
      p_license_id: lic.id,
      p_razorpay_order_id: order.id,
    });

    if (attachErr) {
      return NextResponse.json({ error: attachErr.message }, { status: 400 });
    }

    return NextResponse.json({
      razorpayOrderId: order.id,
      keyId: rz.keyId,
      amountPaise: order.amount,
      currency: order.currency ?? "INR",
      paymentMode: rz.paymentMode,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not start payment." }, { status: 500 });
  }
}
