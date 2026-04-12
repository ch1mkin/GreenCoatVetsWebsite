"use server";

import { DATA_SHARING_CONSENT_KEY, DATA_SHARING_CONSENT_VERSION } from "@saasclinics/lib";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function hasDataSharingConsent(): Promise<boolean> {
  const access = await getUserAccess();
  const supabase = createClient();
  const { data } = await supabase
    .from("user_consents")
    .select("id")
    .eq("user_id", access.userId)
    .eq("consent_key", DATA_SHARING_CONSENT_KEY)
    .maybeSingle();
  return Boolean(data);
}

export async function acceptDataSharingConsent() {
  const access = await getUserAccess();
  const supabase = createClient();
  const { error } = await supabase.from("user_consents").upsert(
    {
      user_id: access.userId,
      consent_key: DATA_SHARING_CONSENT_KEY,
      consent_version: DATA_SHARING_CONSENT_VERSION,
      accepted_at: new Date().toISOString(),
    },
    { onConflict: "user_id,consent_key", ignoreDuplicates: false }
  );
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
