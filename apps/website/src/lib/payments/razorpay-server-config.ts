import { createServiceRoleClient } from "@/lib/supabase/admin";

export type RazorpayServerConfig = {
  keyId: string;
  keySecret: string;
  /** Mirrors saved mode; Razorpay still distinguishes test vs live primarily by key prefix. */
  paymentMode: "test" | "live";
  source: "database" | "env";
};

/**
 * Keys for server-side Razorpay API (order create + signature verify).
 * Order: DB (via service role) → env fallback.
 */
export async function getRazorpayServerConfig(): Promise<RazorpayServerConfig | null> {
  const admin = createServiceRoleClient();
  if (admin) {
    const { data } = await admin.from("platform_payment_settings").select("*").eq("id", "default").maybeSingle();
    if (data?.razorpay_key_id && data?.razorpay_key_secret) {
      const mode = data.payment_mode === "live" ? "live" : "test";
      return {
        keyId: data.razorpay_key_id as string,
        keySecret: data.razorpay_key_secret as string,
        paymentMode: mode,
        source: "database",
      };
    }
  }

  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (keyId && keySecret) {
    const mode: "test" | "live" = keyId.startsWith("rzp_live_") ? "live" : "test";
    return { keyId, keySecret, paymentMode: mode, source: "env" };
  }

  return null;
}
