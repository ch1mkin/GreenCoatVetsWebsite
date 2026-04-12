/** User-friendly copy for Supabase Auth errors. */
export function mapLoginError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid_credentials")) {
    return "Incorrect email or password. Please try again.";
  }
  if (m.includes("email not confirmed")) {
    return "Please confirm your email before signing in.";
  }
  if (m.includes("user already registered")) {
    return "An account with this email already exists.";
  }
  if (m.includes("invalid or expired invite")) {
    return "Invite is invalid or expired.";
  }
  if (m.includes("working hours are required for doctor onboarding")) {
    return "Doctor onboarding requires working hours.";
  }
  return message;
}
