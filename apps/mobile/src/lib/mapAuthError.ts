export function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Invalid email or password.";
  if (m.includes("email not confirmed")) return "Please verify your email before signing in.";
  if (m.includes("user already registered")) return "An account with this email already exists.";
  if (m.includes("invalid or expired invite")) return "Invite code is invalid or expired.";
  if (m.includes("working hours are required for doctor onboarding")) {
    return "Doctor invite requires working hours before activation.";
  }
  return message;
}
