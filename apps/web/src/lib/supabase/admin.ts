import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

/**
 * Service role client (bypasses RLS). Only use in trusted server code such as
 * route handlers and server actions.
 */
export function createServiceRoleClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) return null;
  return createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
