import type { SupabaseClient } from "@supabase/supabase-js";

export type RazorpayServerConfig = {
  keyId: string;
  keySecret: string;
  paymentMode: "test" | "live";
};

type PlatformPaymentRow = {
  razorpay_key_id: string | null;
  razorpay_key_secret: string | null;
  payment_mode: string | null;
};

function inferPaymentMode(keyId: string, storedMode: string | null | undefined): "test" | "live" {
  if (storedMode === "live" || storedMode === "test") return storedMode;
  return keyId.startsWith("rzp_live_") ? "live" : "test";
}

function fromEnv(): RazorpayServerConfig | null {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) return null;
  return {
    keyId,
    keySecret,
    paymentMode: inferPaymentMode(keyId, process.env.RAZORPAY_PAYMENT_MODE),
  };
}

async function fromPlatformSettings(supabase: SupabaseClient): Promise<RazorpayServerConfig | null> {
  const { data, error } = await supabase
    .from("platform_payment_settings")
    .select("razorpay_key_id, razorpay_key_secret, payment_mode")
    .eq("id", "default")
    .maybeSingle();

  if (error || !data) return null;

  const row = data as PlatformPaymentRow;
  const keyId = row.razorpay_key_id?.trim();
  const keySecret = row.razorpay_key_secret?.trim();
  if (!keyId || !keySecret) return null;

  return {
    keyId,
    keySecret,
    paymentMode: inferPaymentMode(keyId, row.payment_mode),
  };
}

/** Resolve Razorpay keys from platform settings (service role / super admin) then env fallback. */
export async function resolveRazorpayServerConfig(
  supabase?: SupabaseClient | null,
): Promise<RazorpayServerConfig | null> {
  if (supabase) {
    const fromDb = await fromPlatformSettings(supabase);
    if (fromDb) return fromDb;
  }
  return fromEnv();
}

export function describeRazorpayConfigGap(options?: {
  hasServiceRole?: boolean;
  hasEnvKeys?: boolean;
}): string {
  const hasServiceRole = options?.hasServiceRole ?? Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  const hasEnvKeys =
    options?.hasEnvKeys ??
    Boolean(process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim());

  if (!hasServiceRole && !hasEnvKeys) {
    return "Add Razorpay keys in web app → Payments (super admin) and set SUPABASE_SERVICE_ROLE_KEY on this site, or set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET here.";
  }
  if (!hasServiceRole && hasEnvKeys) {
    return "Razorpay env keys are set but invalid or incomplete. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.";
  }
  if (hasServiceRole && !hasEnvKeys) {
    return "Save Razorpay key id and secret in web app → Payments (super admin), or set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on this deployment.";
  }
  return "Razorpay is not configured. Save keys in web app → Payments or set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.";
}
