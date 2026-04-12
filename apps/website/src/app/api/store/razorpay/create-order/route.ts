import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { getRazorpayServerConfig } from "@/lib/payments/razorpay-server-config";
import { isWebsiteStoreEnabled } from "@/lib/store/store-availability";
import { createClientFromRouteRequest } from "@/lib/supabase/route-request-client";

type Item = { product_id: string; quantity: number };

/**
 * Creates a Razorpay order with amount computed from DB prices (do not trust client totals).
 */
export async function POST(request: Request) {
  try {
    const storeEnabled = await isWebsiteStoreEnabled();
    if (!storeEnabled) {
      return NextResponse.json({ error: "Store is currently unavailable." }, { status: 403 });
    }

    const rz = await getRazorpayServerConfig();
    if (!rz) {
      return NextResponse.json(
        { error: "Razorpay is not configured. Set keys in the Payments admin (super admin) or RAZORPAY_* env vars." },
        { status: 500 },
      );
    }
    const { keyId, keySecret, paymentMode } = rz;

    const body = (await request.json()) as { items?: Item[] };
    const items = body.items ?? [];
    if (!items.length) {
      return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
    }

    const supabase = createClientFromRouteRequest(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Please sign in to checkout." }, { status: 401 });
    }

    const clinic = await resolveClinic();
    const normalized = new Map<string, number>();
    for (const item of items) {
      const qty = Number(item.quantity);
      if (!item.product_id || !Number.isFinite(qty) || qty <= 0) continue;
      normalized.set(item.product_id, (normalized.get(item.product_id) ?? 0) + qty);
    }
    const productIds = Array.from(normalized.keys());
    if (!productIds.length) {
      return NextResponse.json({ error: "No valid items." }, { status: 400 });
    }

    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("id, price, stock_quantity, is_active, clinic_id")
      .in("id", productIds)
      .eq("clinic_id", clinic.id);

    if (prodErr) {
      return NextResponse.json({ error: prodErr.message }, { status: 400 });
    }

    let totalInr = 0;
    for (const [pid, qty] of Array.from(normalized.entries())) {
      const p = products?.find((row) => row.id === pid);
      if (!p || !p.is_active) {
        return NextResponse.json({ error: "One or more products are unavailable." }, { status: 400 });
      }
      if (p.stock_quantity < qty) {
        return NextResponse.json({ error: "Insufficient stock for an item in your cart." }, { status: 400 });
      }
      totalInr += Number(p.price) * qty;
    }

    if (totalInr <= 0) {
      return NextResponse.json({ error: "Invalid order total." }, { status: 400 });
    }

    const amountPaise = Math.round(totalInr * 100);
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: `web_${clinic.id.slice(0, 8)}_${Date.now()}`,
      notes: {
        clinic_id: clinic.id,
        user_id: user.id,
      },
    });

    return NextResponse.json(
      {
        razorpayOrderId: order.id,
        keyId,
        amountPaise: order.amount,
        currency: order.currency ?? "INR",
        amountInr: totalInr,
        paymentMode,
      },
      { status: 200 },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not start payment." }, { status: 500 });
  }
}
