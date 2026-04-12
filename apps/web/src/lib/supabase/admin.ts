import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

/**
 * Service role client (bypasses RLS). Only use in route handlers.
 * Returns null when SUPABASE_SERVICE_ROLE_KEY is unset; callers fall back to env Razorpay keys.
 */
export function createServiceRoleClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) return null;
  return createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
