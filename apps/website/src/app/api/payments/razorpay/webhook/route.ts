import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RazorpayWebhookPayload = {
  event: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        status?: string;
      };
    };
  };
};

export async function POST(request: Request) {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "Missing webhook secret." }, { status: 500 });
    }

    const signature = request.headers.get("x-razorpay-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing Razorpay signature." }, { status: 400 });
    }

    const rawBody = await request.text();
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
    if (payload.event !== "payment.captured") {
      return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
    }

    const payment = payload.payload?.payment?.entity;
    const razorpayOrderId = payment?.order_id;
    const razorpayPaymentId = payment?.id;
    if (!razorpayOrderId || !razorpayPaymentId) {
      return NextResponse.json({ error: "Missing payment/order reference." }, { status: 400 });
    }

    const supabase = createClient();
    const { error } = await supabase
      .from("orders")
      .update({
        status: "paid",
        payment_provider: "razorpay",
        payment_reference: razorpayOrderId,
        notes: `razorpay_payment_id:${razorpayPaymentId}`,
      })
      .eq("payment_provider", "razorpay")
      .eq("payment_reference", razorpayOrderId)
      .in("status", ["pending", "processing"]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Webhook handling failed." }, { status: 500 });
  }
}
