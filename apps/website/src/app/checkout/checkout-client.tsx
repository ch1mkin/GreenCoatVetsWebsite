"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useCart } from "@/components/store/cart-context";
import { createClient } from "@/lib/supabase/client";
import { DELIVERY_CITY_OPTIONS, isAllowedDeliveryCity, deliveryCityNotAllowedMessage } from "@/lib/store/delivery-cities";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if (window.Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load payment script."));
    document.body.appendChild(s);
  });
}

export function CheckoutClient() {
  const router = useRouter();
  const { items, subtotalInr, clear } = useCart();
  const [email, setEmail] = useState<string | null>(null);
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState<(typeof DELIVERY_CITY_OPTIONS)[number]["value"]>("chandigarh");
  const [postalCode, setPostalCode] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null);
      if (!user) router.replace("/login?redirect=/checkout");
    });
  }, [router]);

  const startPay = useCallback(async () => {
    setError(null);
    if (!items.length) {
      setError("Your cart is empty.");
      return;
    }
    if (!line1.trim()) {
      setError("Please enter your street address.");
      return;
    }
    if (!isAllowedDeliveryCity(city)) {
      setError(deliveryCityNotAllowedMessage());
      return;
    }
    if (!phone.trim()) {
      setError("Please enter a phone number for delivery contact.");
      return;
    }

    setBusy(true);
    const lineItems = items.map((i) => ({ product_id: i.productId, quantity: i.quantity }));
    try {
      const createRes = await fetch("/api/store/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: lineItems }),
      });
      const createData = (await createRes.json()) as { error?: string; razorpayOrderId?: string; keyId?: string; amountPaise?: number; currency?: string };
      if (!createRes.ok) {
        throw new Error(createData.error ?? "Could not start payment.");
      }

      await loadRazorpayScript();

      const shippingAddress = {
        line1: line1.trim(),
        city,
        state: "Punjab / Haryana",
        postalCode: postalCode.trim(),
        country: "India",
        phone: phone.trim(),
      };

      const options: Record<string, unknown> = {
        key: createData.keyId,
        amount: createData.amountPaise,
        currency: createData.currency ?? "INR",
        order_id: createData.razorpayOrderId,
        name: "Clinic store",
        description: "Pet care products",
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          setBusy(true);
          setError(null);
          try {
            const confirmRes = await fetch("/api/checkout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                items: lineItems,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                shippingAddress,
              }),
            });
            const confirmData = (await confirmRes.json()) as { error?: string; orderId?: string };
            if (!confirmRes.ok) {
              throw new Error(confirmData.error ?? "Payment could not be confirmed.");
            }
            clear();
            router.push(`/account/orders?paid=1`);
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Checkout failed.");
          } finally {
            setBusy(false);
          }
        },
        prefill: email ? { email } : undefined,
        theme: { color: "#0d9488" },
        modal: {
          ondismiss: () => setBusy(false),
        },
      };

      const rz = new window.Razorpay(options);
      setBusy(false);
      rz.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed to start.");
    } finally {
      setBusy(false);
    }
  }, [items, line1, city, postalCode, phone, email, clear, router]);

  if (!items.length) {
    return (
      <main className="mx-auto max-w-lg px-6 py-12 text-center">
        <h1 className="font-headline text-2xl font-bold text-on-surface">Checkout</h1>
        <p className="mt-2 text-on-surface-variant">Your cart is empty.</p>
        <Link href="/store" className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 font-semibold text-on-primary">
          Browse store
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8 sm:px-6">
      <h1 className="font-headline text-2xl font-bold text-on-surface">Checkout</h1>
      <p className="mt-1 text-sm text-on-surface-variant">Delivery in Chandigarh, Mohali &amp; Panchkula only.</p>

      <section className="mt-6 space-y-3 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4">
        <h2 className="text-sm font-bold text-on-surface">Order summary</h2>
        <ul className="space-y-2 text-sm">
          {items.map((i) => (
            <li key={i.productId} className="flex justify-between gap-2">
              <span className="text-on-surface">
                {i.name} × {i.quantity}
              </span>
              <span className="text-on-surface-variant">₹{(i.price * i.quantity).toFixed(0)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-outline-variant/30 pt-3 font-semibold">
          <span>Total</span>
          <span>₹{subtotalInr.toFixed(0)}</span>
        </div>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-on-surface-variant">Delivery address</h2>
        <div>
          <label className="text-xs font-semibold text-on-surface-variant" htmlFor="line1">
            Street / building
          </label>
          <input
            id="line1"
            className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2.5 text-on-surface"
            value={line1}
            onChange={(e) => setLine1(e.target.value)}
            autoComplete="street-address"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-on-surface-variant" htmlFor="city">
            City
          </label>
          <select
            id="city"
            className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2.5 text-on-surface"
            value={city}
            onChange={(e) => setCity(e.target.value as typeof city)}
          >
            {DELIVERY_CITY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-on-surface-variant" htmlFor="postal">
              PIN code
            </label>
            <input
              id="postal"
              className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2.5 text-on-surface"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-on-surface-variant" htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2.5 text-on-surface"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
            />
          </div>
        </div>
      </section>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={busy}
        onClick={startPay}
        className="gradient-primary mt-8 w-full rounded-xl py-3.5 font-headline text-sm font-bold text-on-primary disabled:opacity-60"
      >
        {busy ? "Please wait…" : "Pay securely with Razorpay"}
      </button>

      <p className="mt-4 text-center text-xs text-on-surface-variant">
        You’ll complete payment in a secure Razorpay window. Orders are confirmed after successful payment.
      </p>
    </main>
  );
}
