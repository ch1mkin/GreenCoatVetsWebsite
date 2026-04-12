import { NextResponse } from "next/server";
import Razorpay from "razorpay";

export async function POST(request: Request) {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: "Missing Razorpay credentials in environment." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as { amount?: number; currency?: string };
    const amount = Number(body.amount ?? 0);
    const currency = body.currency ?? "INR";

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency,
      receipt: `saasclinics_${Date.now()}`,
    });

    return NextResponse.json(
      { razorpayOrderId: order.id, keyId, amount: order.amount, currency: order.currency },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: "Failed to create Razorpay order." }, { status: 500 });
  }
}
