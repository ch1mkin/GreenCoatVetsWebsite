import crypto from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const DEFAULT_WEB_APP = "https://web.greencoatvets.com";

export function webPortalBaseUrl(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_WEB_APP_URL ?? "").trim().replace(/\/$/, "");
  if (fromEnv && !fromEnv.includes("localhost")) return fromEnv;
  if (process.env.NODE_ENV === "production") return DEFAULT_WEB_APP;
  return fromEnv || "http://localhost:3000";
}

export function hashPasswordResetToken(token: string): string {
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

export function buildPasswordResetUrl(rawToken: string): string {
  const encoded = encodeURIComponent(rawToken.trim());
  return `${webPortalBaseUrl()}/reset-password/${encoded}`;
}

export type PasswordResetTokenStatus =
  | { ok: true }
  | { ok: false; reason: "missing" | "invalid" | "expired" | "used" | "server_config" };

export async function validatePortalPasswordResetToken(token: string | null | undefined): Promise<PasswordResetTokenStatus> {
  const normalized = (token ?? "").trim();
  if (!normalized) return { ok: false, reason: "missing" };

  const serviceRole = createServiceRoleClient();
  if (!serviceRole) return { ok: false, reason: "server_config" };

  const tokenHash = hashPasswordResetToken(normalized);
  const { data: row, error } = await serviceRole
    .from("web_portal_password_reset_tokens")
    .select("id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !row) return { ok: false, reason: "invalid" };
  if (row.used_at) return { ok: false, reason: "used" };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" };

  return { ok: true };
}
