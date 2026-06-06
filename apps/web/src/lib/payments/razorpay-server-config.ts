import {
  describeRazorpayConfigGap as describeGap,
  resolveRazorpayServerConfig,
  type RazorpayServerConfig,
} from "@saasclinics/lib/razorpay-server-config";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type { RazorpayServerConfig };

export async function getRazorpayServerConfig(): Promise<RazorpayServerConfig | null> {
  const serviceRole = createServiceRoleClient();
  if (serviceRole) {
    const fromServiceRole = await resolveRazorpayServerConfig(serviceRole);
    if (fromServiceRole) return fromServiceRole;
  }

  const supabase = createClient();
  return resolveRazorpayServerConfig(supabase);
}

export function describeRazorpayConfigGap(): string {
  return describeGap({
    hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    hasEnvKeys: Boolean(process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim()),
  });
}
