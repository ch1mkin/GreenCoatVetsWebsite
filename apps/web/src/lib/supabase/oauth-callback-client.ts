import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "./env";

export type OAuthCallbackCookie = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

/** Supabase auth client for OAuth callback — collects Set-Cookie headers for the redirect response. */
export function createOAuthCallbackClient(request: NextRequest) {
  const pending = new Map<string, OAuthCallbackCookie>();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach((cookie) => {
          pending.set(cookie.name, cookie);
        });
      },
    },
  });

  function redirectWithSession(url: URL | string) {
    const response = NextResponse.redirect(url);
    pending.forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    });
    return response;
  }

  return { supabase, redirectWithSession };
}
