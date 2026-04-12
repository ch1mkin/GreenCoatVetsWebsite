"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { prepareBranchPortalCheckout } from "./actions";

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
    s.onerror = () => reject(new Error("Could not load Razorpay."));
    document.body.appendChild(s);
  });
}

type Props = {
  userEmail: string | null;
  canPay: boolean;
};

export function BranchPortalCheckoutClient({ userEmail, canPay }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const prep = await prepareBranchPortalCheckout();
      const createRes = await fetch("/api/billing/branch-portal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseId: prep.license_id }),
      });
      const createData = (await createRes.json()) as {
        error?: string;
        razorpayOrderId?: string;
        keyId?: string;
        amountPaise?: number;
        currency?: string;
      };
      if (!createRes.ok) {
        throw new Error(createData.error ?? "Could not start payment.");
      }

      await loadRazorpayScript();

      const licenseId = prep.license_id;
      const options: Record<string, unknown> = {
        key: createData.keyId,
        amount: createData.amountPaise,
        currency: createData.currency ?? "INR",
        order_id: createData.razorpayOrderId,
        name: "Branch web portal",
        description: `Web access · ${prep.period_days} days`,
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          setBusy(true);
          setError(null);
          try {
            const verifyRes = await fetch("/api/billing/branch-portal/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                licenseId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });
            const verifyData = (await verifyRes.json()) as { error?: string };
            if (!verifyRes.ok) {
              throw new Error(verifyData.error ?? "Payment could not be confirmed.");
            }
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Verification failed.");
          } finally {
            setBusy(false);
          }
        },
        prefill: userEmail ? { email: userEmail } : undefined,
        theme: { color: "#0d9488" },
        modal: {
          ondismiss: () => setBusy(false),
        },
      };

      const rz = new window.Razorpay(options);
      setBusy(false);
      rz.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed.");
      setBusy(false);
    }
  }, [router, userEmail]);

  if (!canPay) return null;

  return (
    <div className="mt-4">
      {error ? (
        <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={pay}
        className="btn-primary disabled:opacity-60"
      >
        {busy ? "Please wait…" : "Pay with Razorpay"}
      </button>
    </div>
  );
}
