"use server";

import { revalidatePath } from "next/cache";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";

export async function updatePlatformPaymentSettings(formData: FormData) {
  const access = await getUserAccess();
  if (!access.isSuperAdmin) {
    throw new Error("Only platform super admins can change payment integration settings.");
  }

  const keyId = String(formData.get("razorpay_key_id") ?? "").trim();
  const keySecret = String(formData.get("razorpay_key_secret") ?? "").trim();
  const paymentMode = String(formData.get("payment_mode") ?? "test").trim();
  if (paymentMode !== "test" && paymentMode !== "live") {
    throw new Error("Invalid payment mode.");
  }

  const defaultPriceInr = Number(String(formData.get("default_branch_web_license_price_inr") ?? "").trim());
  const defaultPeriodDays = Number(String(formData.get("default_branch_web_license_period_days") ?? "").trim());
  if (!Number.isFinite(defaultPriceInr) || defaultPriceInr <= 0) {
    throw new Error("Enter a valid default branch web license price (INR).");
  }
  if (
    !Number.isFinite(defaultPeriodDays) ||
    defaultPeriodDays <= 0 ||
    !Number.isInteger(defaultPeriodDays)
  ) {
    throw new Error("Enter a valid default license term in whole days.");
  }

  const supabase = createClient();

  const { data: existing } = await supabase.from("platform_payment_settings").select("razorpay_key_secret").eq("id", "default").maybeSingle();

  const payload: Record<string, unknown> = {
    id: "default",
    payment_mode: paymentMode,
    default_branch_web_license_price_paise: Math.round(defaultPriceInr * 100),
    default_branch_web_license_period_days: defaultPeriodDays,
    updated_at: new Date().toISOString(),
  };
  if (keyId) payload.razorpay_key_id = keyId;
  if (keySecret) payload.razorpay_key_secret = keySecret;
  else if (existing?.razorpay_key_secret) {
    // keep existing secret when field left blank
    payload.razorpay_key_secret = existing.razorpay_key_secret;
  }

  const { error } = await supabase.from("platform_payment_settings").upsert(payload, { onConflict: "id" });
  if (error) throw new Error(error.message);
  revalidatePath("/payments");
}

async function resolveClinicIdForPaymentAction(formData: FormData): Promise<string> {
  const access = await getUserAccess();
  const { clinic_id: fallback } = await getActiveMembership();
  if (!access.isSuperAdmin) return fallback;
  const pick = String(formData.get("context_clinic_id") ?? "").trim();
  if (!pick) return fallback;
  const supabase = createClient();
  const { data } = await supabase.from("clinics").select("id").eq("id", pick).eq("is_active", true).maybeSingle();
  return (data?.id as string | undefined) ?? fallback;
}

export async function updateOrderPaymentState(formData: FormData) {
  const orderId = String(formData.get("order_id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const paymentReference = String(formData.get("payment_reference") ?? "").trim();

  if (!orderId || !status) {
    throw new Error("Order id and status are required.");
  }

  const clinic_id = await resolveClinicIdForPaymentAction(formData);
  const supabase = createClient();

  const { error } = await supabase
    .from("orders")
    .update({
      status,
      payment_reference: paymentReference || null,
    })
    .eq("id", orderId)
    .eq("clinic_id", clinic_id);

  if (error) throw new Error(error.message);
  revalidatePath("/payments");
}
