import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/login?oauth=google";
  return next;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const redirectUrl = new URL(next, request.url);
  const response = NextResponse.redirect(redirectUrl);

  if (!code) return response;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "oauth_exchange_failed");
    return NextResponse.redirect(loginUrl);
  }

  try {
    await supabase.rpc("reconcile_portal_auth_user_by_email");
  } catch {
    // RPC available after migration 20260519150000 is applied.
  }
  return response;
}
