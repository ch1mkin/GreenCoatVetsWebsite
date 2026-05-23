export function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Invalid email or password.";
  if (m.includes("email not confirmed")) return "Please verify your email before signing in.";
  if (m.includes("user already registered")) return "An account with this email already exists.";
  if (m.includes("working hours are required for doctor onboarding")) {
    return "Doctor onboarding requires working hours. Please fill them and try again.";
  }
  if (m.includes("invalid or expired invite")) return "Invite is invalid or expired.";
  if (m === "oauth_exchange_failed") {
    return "Google sign-in expired or was already used. Please try again.";
  }
  if (m === "oauth_no_user") {
    return "Google sign-in did not return an account. Please try again.";
  }
  if (m === "oauth_callback_failed") {
    return "Google sign-in could not be completed. Please try again.";
  }
  if (m === "otp_send_failed") {
    return "Signed in with Google, but we could not email your verification code. Check server email settings or try password sign-in.";
  }
  return message;
}
