import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getPlatformBranding } from "@/lib/platform-branding";
import { createHostingerTransport, getHostingerFromAddress } from "@/lib/email/hostinger-mail";
import { renderBrandedEmail } from "@/lib/email/render-branded-email";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const OTP_COOKIE_NAME = "web_portal_email_otp_verified";
const OTP_COOKIE_TTL_MS = 12 * 60 * 60 * 1000;
const OTP_CHALLENGE_TTL_MS = 10 * 60 * 1000;

function secret(): string {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.HOSTINGER_SMTP_PASS?.trim();
  if (!value) {
    throw new Error("A server secret is required for portal email OTP verification.");
  }
  return value;
}

function hashOtp(userId: string, code: string): string {
  return crypto.createHash("sha256").update(`${userId}:${code}`).digest("hex");
}

function signCookieValue(userId: string, expiresAtMs: number): string {
  const payload = `${userId}:${expiresAtMs}`;
  const signature = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}:${signature}`;
}

function clearPortalOtpCookie() {
  try {
    cookies().set(OTP_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(0),
    });
  } catch {
    // Route handlers set cookies on NextResponse; ignore if cookie store is read-only.
  }
}

export async function hasValidPortalOtpCookie(userId: string): Promise<boolean> {
  const raw = cookies().get(OTP_COOKIE_NAME)?.value?.trim();
  if (!raw) return false;
  const [cookieUserId, expiresAtRaw, signature] = raw.split(":");
  if (!cookieUserId || !expiresAtRaw || !signature) return false;
  if (cookieUserId !== userId) return false;
  const expiresAtMs = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) return false;

  const expected = crypto.createHmac("sha256", secret()).update(`${cookieUserId}:${expiresAtMs}`).digest("hex");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export async function beginPortalEmailOtpForUser(emailOrUserId: string): Promise<{ sentTo: string }> {
  const lookup = emailOrUserId.trim().toLowerCase();
  if (!lookup) {
    throw new Error("Sign in first to request a verification code.");
  }
  const serviceRole = createServiceRoleClient();
  if (!serviceRole) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for web login OTP.");
  }

  const query = serviceRole.from("app_users").select("id, email");
  const { data: appUser, error: appUserError } = lookup.includes("@")
    ? await query.eq("email", lookup).maybeSingle()
    : await query.eq("id", lookup).maybeSingle();
  if (appUserError || !appUser?.id || !appUser.email) {
    throw new Error("We could not locate that portal account.");
  }

  const code = String(Math.floor(1000 + Math.random() * 9000));
  const now = Date.now();
  const expiresAt = new Date(now + OTP_CHALLENGE_TTL_MS).toISOString();
  const codeHash = hashOtp(appUser.id, code);

  await serviceRole.from("web_login_email_otps").delete().eq("user_id", appUser.id).is("consumed_at", null);
  const { error: insertError } = await serviceRole.from("web_login_email_otps").insert({
    user_id: appUser.id,
    email: appUser.email.toLowerCase(),
    code_hash: codeHash,
    expires_at: expiresAt,
  });
  if (insertError) {
    throw new Error(insertError.message);
  }

  const transporter = createHostingerTransport();
  const from = getHostingerFromAddress();
  if (!transporter || !from) {
    throw new Error("Hostinger SMTP is not configured on the server.");
  }

  const branding = await getPlatformBranding();
  const brandName = branding.product_name || "GreenCoatVets";
  const mail = renderBrandedEmail({
    brandName,
    heading: "Your login verification code",
    intro: "Use the 4-digit code below to finish signing in to the web portal.",
    body: [`This code will expire in ${Math.round(OTP_CHALLENGE_TTL_MS / 60000)} minutes.`],
    details: [{ label: "Verification code", value: code }],
    footer: `${brandName} login verification`,
  });

  await transporter.sendMail({
    from,
    to: appUser.email.toLowerCase(),
    subject: `${brandName} login verification code`,
    text: mail.text,
    html: mail.html,
  });

  clearPortalOtpCookie();
  return { sentTo: appUser.email.toLowerCase() };
}

export async function verifyPortalEmailOtpForCurrentUser(code: string): Promise<void> {
  const normalizedCode = code.trim();
  if (!/^\d{4}$/.test(normalizedCode)) {
    throw new Error("Enter the 4-digit verification code.");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error("Login session is missing. Sign in again.");
  }

  const serviceRole = createServiceRoleClient();
  if (!serviceRole) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for web login OTP.");
  }

  const { data: challenge, error } = await serviceRole
    .from("web_login_email_otps")
    .select("id, code_hash, expires_at, consumed_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !challenge) {
    throw new Error("Request a new verification code first.");
  }
  if (challenge.consumed_at) {
    throw new Error("That verification code has already been used. Request a new one.");
  }
  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    throw new Error("That verification code has expired. Request a new one.");
  }

  const expectedHash = hashOtp(user.id, normalizedCode);
  if (expectedHash !== challenge.code_hash) {
    throw new Error("The verification code is incorrect.");
  }

  await serviceRole
    .from("web_login_email_otps")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", challenge.id);

  const cookieExpiresAt = Date.now() + OTP_COOKIE_TTL_MS;
  cookies().set(OTP_COOKIE_NAME, signCookieValue(user.id, cookieExpiresAt), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(cookieExpiresAt),
  });
}

export async function clearPortalEmailOtpVerification(): Promise<void> {
  clearPortalOtpCookie();
}
