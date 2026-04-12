import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * For Route Handlers: use `Authorization: Bearer <access_token>` (mobile / native clients)
 * or session cookies (browser). Same Supabase project as the web app.
 */
export function createClientFromRouteRequest(request: Request) {
  const auth = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: auth } },
    });
  }

  const cookieStore = cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          /* ignore */
        }
      },
    },
  });
}
