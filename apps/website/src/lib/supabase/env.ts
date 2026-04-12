function requirePublicEnv(name: string, value: string | undefined): string {
  const v = value?.trim();
  if (!v) {
    throw new Error(
      `Missing Supabase env: ${name}. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.`,
    );
  }
  return v;
}

/** Guaranteed non-empty at runtime (build/runtime will throw if unset). */
export const supabaseUrl = requirePublicEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);

/** Guaranteed non-empty at runtime (build/runtime will throw if unset). */
export const supabaseAnonKey = requirePublicEnv(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
