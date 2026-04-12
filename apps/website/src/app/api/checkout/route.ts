import crypto from "crypto";
import { NextResponse } from "next/server";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { getRazorpayServerConfig } from "@/lib/payments/razorpay-server-config";
import { isWebsiteStoreEnabled } from "@/lib/store/store-availability";
import { isAllowedDeliveryCity, deliveryCityNotAllowedMessage } from "@/lib/store/delivery-cities";
import { createClientFromRouteRequest } from "@/lib/supabase/route-request-client";

type CheckoutItem = {
  product_id: string;
  quantity: number;
};

export async function POST(request: Request) {
  try {
    const storeEnabled = await isWebsiteStoreEnabled();
    if (!storeEnabled) {
      return NextResponse.json({ error: "Store is currently unavailable." }, { status: 403 });
    }

    const body = (await request.json()) as {
      items?: CheckoutItem[];
      paymentReference?: string;
      paymentProvider?: string;
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      razorpaySignature?: string;
      shippingAddress?: {
        line1?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
        phone?: string;
      };
    };
    const items = body.items ?? [];
    if (!items.length) {
      return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
    }

    const cityRaw = body.shippingAddress?.city?.trim() ?? "";
    if (!cityRaw) {
      return NextResponse.json({ error: "City is required for delivery." }, { status: 400 });
    }
    if (!isAllowedDeliveryCity(cityRaw)) {
      return NextResponse.json({ error: deliveryCityNotAllowedMessage() }, { status: 400 });
    }

    const razorpayOrderId = body.razorpayOrderId?.trim();
    const razorpayPaymentId = body.razorpayPaymentId?.trim();
    const razorpaySignature = body.razorpaySignature?.trim();
    const rzConfig = await getRazorpayServerConfig();
    const keySecret = rzConfig?.keySecret;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !keySecret) {
      return NextResponse.json(
        { error: "Missing payment confirmation. Complete the Razorpay step first." },
        { status: 400 },
      );
    }

    const expected = crypto.createHmac("sha256", keySecret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest("hex");
    if (expected !== razorpaySignature) {
      return NextResponse.json({ error: "Payment verification failed. Please try again." }, { status: 400 });
    }

    const clinic = await resolveClinic();
    const supabase = createClientFromRouteRequest(request);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Please login first." }, { status: 401 });
    }

    const { data: owner, error: ownerError } = await supabase
      .from("owners")
      .select("id")
      .eq("clinic_id", clinic.id)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (ownerError) {
      return NextResponse.json({ error: ownerError.message }, { status: 400 });
    }
    if (!owner) {
      return NextResponse.json(
        { error: "No owner profile linked to this account for the current clinic." },
        { status: 403 },
      );
    }

    const normalized = new Map<string, number>();
    for (const item of items) {
      const qty = Number(item.quantity);
      if (!item.product_id || !Number.isFinite(qty) || qty <= 0) continue;
      normalized.set(item.product_id, (normalized.get(item.product_id) ?? 0) + qty);
    }
    const rpcItems = Array.from(normalized.entries()).map(([product_id, quantity]) => ({
      product_id,
      quantity,
    }));
    if (!rpcItems.length) {
      return NextResponse.json({ error: "No valid items in cart." }, { status: 400 });
    }

    const { data: orderId, error } = await supabase.rpc("place_order_cart_atomic", {
      p_clinic_id: clinic.id,
      p_owner_id: owner.id,
      p_items: rpcItems,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const paymentProvider = body.paymentProvider?.trim() || "razorpay";

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "paid",
        payment_provider: paymentProvider,
        payment_reference: razorpayPaymentId,
        shipping_address: {
          ...body.shippingAddress,
          city: cityRaw,
          razorpay_order_id: razorpayOrderId,
        },
        notes: `razorpay_order_id:${razorpayOrderId}`,
      })
      .eq("id", orderId)
      .eq("clinic_id", clinic.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ orderId }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Unexpected checkout error." }, { status: 500 });
  }
}
