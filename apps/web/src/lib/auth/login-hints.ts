const HINT_MESSAGES: Record<string, string> = {
  use_web_portal: "Your clinic staff account uses this portal. Continue signing in here.",
  use_website_admin: "Your account is for the marketing website admin — use that sign-in page instead.",
  pet_owner: "Pet owner accounts sign in on the public website.",
};

export function loginHintMessage(hint: string | null): string | null {
  if (!hint) return null;
  return HINT_MESSAGES[hint] ?? null;
}
