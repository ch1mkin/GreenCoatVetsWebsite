import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/supabase/env";

/**
 * Service role client (bypasses RLS). Only use in server routes / server actions.
 * Optional: if `SUPABASE_SERVICE_ROLE_KEY` is unset, returns null and callers should fall back to env.
 */
export function createServiceRoleClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) return null;
  return createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
