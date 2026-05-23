const HINT_MESSAGES: Record<string, string> = {
  use_web_portal: "Your clinic staff account uses the web portal. Sign in there to continue.",
  use_website_admin: "Website editors and super admins should use the marketing admin sign-in.",
  pet_owner: "Pet owner accounts sign in on the public website, not the clinic portal.",
  no_portal_access: "No clinic staff account was found. Sign in on the public website or contact your clinic.",
};

export function loginHintMessage(hint: string | null): string | null {
  if (!hint) return null;
  return HINT_MESSAGES[hint] ?? null;
}
