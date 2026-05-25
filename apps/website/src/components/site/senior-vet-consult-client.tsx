"use client";

import { useCallback, useRef, useState } from "react";
import { BookingDoctorSlotPicker } from "@/components/site/booking-doctor-slot-picker";
import { SENIOR_VET_ONLINE_CONSENT_TEXT } from "@/lib/booking/senior-vet-consent";

type Doctor = { id: string; full_name: string; branch_id: string | null };
type Branch = { id: string; name: string };

type Props = {
  clinicId: string;
  clinicName: string;
  productName: string;
  priceInr: number;
  branches: Branch[];
  doctors: Doctor[];
  fieldClassName: string;
};

export function SeniorVetConsultClient({ clinicId, clinicName, productName, priceInr, branches, doctors, fieldClassName }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<{ orderId: string; paymentId: string; signature: string } | null>(null);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const getSignaturePng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL("image/png");
  };

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#16312b";
    ctx.lineWidth = 2;
    const rect = canvas.getBoundingClientRect();
    const point = "touches" in e ? e.touches[0] : e;
    const x = point.clientX - rect.left;
    const y = point.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const draw = (ev: MouseEvent | TouchEvent) => {
      const p = "touches" in ev ? ev.touches[0] : ev;
      ctx.lineTo(p.clientX - rect.left, p.clientY - rect.top);
      ctx.stroke();
    };
    const stop = () => {
      window.removeEventListener("mousemove", draw as (ev: MouseEvent) => void);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchmove", draw as (ev: TouchEvent) => void);
      window.removeEventListener("touchend", stop);
    };
    window.addEventListener("mousemove", draw as (ev: MouseEvent) => void);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchmove", draw as (ev: TouchEvent) => void, { passive: false });
    window.addEventListener("touchend", stop);
  }, []);

  const payAndBook = async (form: HTMLFormElement) => {
    setError(null);
    setPaying(true);
    try {
      const fd = new FormData(form);
      let pay = payment;
      if (!pay) {
        const orderRes = await fetch("/api/online-consult/create-order", { method: "POST" });
        const orderJson = (await orderRes.json()) as {
          razorpayOrderId?: string;
          keyId?: string;
          amountPaise?: number;
          error?: string;
        };
        if (!orderRes.ok) throw new Error(orderJson.error ?? "Payment failed");

        await new Promise<void>((resolve, reject) => {
          const RazorpayCtor = (window as Window & { Razorpay?: new (o: Record<string, unknown>) => { open: () => void } }).Razorpay;
          if (!RazorpayCtor) {
            reject(new Error("Razorpay script not loaded"));
            return;
          }
          const rzp = new RazorpayCtor({
            key: orderJson.keyId,
            amount: orderJson.amountPaise,
            currency: "INR",
            name: clinicName,
            description: productName,
            order_id: orderJson.razorpayOrderId,
            handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
              pay = {
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              };
              setPayment(pay);
              resolve();
            },
            modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
          });
          rzp.open();
        });
      }

      const completeRes = await fetch("/api/online-consult/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: fd.get("branch_id"),
          doctor_id: fd.get("doctor_id") || null,
          starts_at: fd.get("starts_at"),
          owner_full_name: fd.get("owner_full_name"),
          owner_phone: fd.get("owner_phone"),
          owner_email: fd.get("owner_email"),
          pet_name: fd.get("pet_name"),
          pet_species: fd.get("pet_species"),
          chief_complaint: fd.get("chief_complaint"),
          razorpay_order_id: pay!.orderId,
          razorpay_payment_id: pay!.paymentId,
          razorpay_signature: pay!.signature,
          signature_png: getSignaturePng(),
          consent_accepted: true,
        }),
      });
      const done = (await completeRes.json()) as { error?: string; meetLink?: string; mergeToken?: string };
      if (!completeRes.ok) throw new Error(done.error ?? "Booking failed");
      window.location.href = `/book/senior-vet/confirmed?meet=${encodeURIComponent(done.meetLink ?? "")}&token=${encodeURIComponent(done.mergeToken ?? "")}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPaying(false);
    }
  };

  return (
    <form
      data-booking-form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        void payAndBook(e.currentTarget);
      }}
    >
      <p className="text-sm text-on-surface-variant">
        {productName} — ₹{priceInr.toLocaleString("en-IN")}. Video call up to 10 minutes after the doctor joins.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          Full name
          <input name="owner_full_name" required className={fieldClassName} />
        </label>
        <label className="text-sm">
          Phone
          <input name="owner_phone" type="tel" required className={fieldClassName} />
        </label>
        <label className="text-sm sm:col-span-2">
          Email
          <input name="owner_email" type="email" required className={fieldClassName} />
        </label>
        <label className="text-sm">
          Pet name
          <input name="pet_name" required className={fieldClassName} />
        </label>
        <label className="text-sm">
          Species
          <input name="pet_species" defaultValue="canine" className={fieldClassName} />
        </label>
        <label className="text-sm sm:col-span-2">
          Branch
          <select name="branch_id" required className={fieldClassName}>
            <option value="">Select</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <BookingDoctorSlotPicker clinicId={clinicId} doctors={doctors} fieldClassName={fieldClassName} />

      <label className="block text-sm sm:col-span-2">
        Chief concern
        <textarea name="chief_complaint" className={`${fieldClassName} min-h-[88px]`} rows={3} required />
      </label>

      <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm">
        <p className="mb-3 font-semibold">Consent</p>
        <p className="text-on-surface-variant">{SENIOR_VET_ONLINE_CONSENT_TEXT}</p>
        <label className="mt-4 flex items-start gap-2">
          <input type="checkbox" name="consent" required className="mt-1" />
          <span>I agree to the above</span>
        </label>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Signature</p>
        <canvas
          ref={canvasRef}
          width={500}
          height={120}
          className="w-full max-w-lg rounded-xl border border-outline-variant/40 bg-white touch-none"
          onMouseDown={startDrawing}
          onTouchStart={startDrawing}
        />
        <button type="button" onClick={clearSignature} className="mt-2 text-xs font-bold text-primary underline">
          Clear signature
        </button>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <button
        type="submit"
        disabled={paying}
        className="gradient-primary rounded-xl px-6 py-4 font-headline text-lg font-bold text-on-primary disabled:opacity-60"
      >
        {paying ? (payment ? "Confirming booking…" : "Opening payment…") : `Pay ₹${priceInr} & book`}
      </button>
    </form>
  );
}
