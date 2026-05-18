import type { User } from "@supabase/supabase-js";

export function userMustChangePassword(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.user_metadata?.must_change_password === true;
}
