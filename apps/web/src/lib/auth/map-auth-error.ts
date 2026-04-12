export function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Invalid email or password.";
  if (m.includes("email not confirmed")) return "Please verify your email before signing in.";
  if (m.includes("user already registered")) return "An account with this email already exists.";
  if (m.includes("working hours are required for doctor onboarding")) {
    return "Doctor onboarding requires working hours. Please fill them and try again.";
  }
  if (m.includes("invalid or expired invite")) return "Invite is invalid or expired.";
  return message;
}
