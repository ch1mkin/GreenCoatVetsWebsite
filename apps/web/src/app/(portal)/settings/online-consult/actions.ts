"use server";

import { revalidatePath } from "next/cache";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { createClient } from "@/lib/supabase/server";

export async function saveOnlineConsultSettings(formData: FormData) {
  const enabled = String(formData.get("enabled") ?? "") === "on";
  const testMode = String(formData.get("test_mode") ?? "") === "on";
  const productName = String(formData.get("product_name") ?? "Senior Vet consultation").trim();
  const pricePaise = Math.round(Number(formData.get("price_inr") ?? 0) * 100);
  const durationMinutes = Number(formData.get("duration_minutes") ?? 10);
  const reminderMinutes = Number(formData.get("reminder_minutes_before") ?? 20);

  if (!productName || pricePaise < 0) throw new Error("Product name and price are required.");

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const { error } = await supabase.from("clinic_online_consult_settings").upsert({
    clinic_id,
    enabled,
    test_mode: testMode,
    product_name: productName,
    price_paise: pricePaise,
    duration_minutes: durationMinutes,
    reminder_minutes_before: reminderMinutes,
    updated_at: new Date().toISOString(),
  });

  if (error) throw new Error(error.message);
  revalidatePath("/settings/online-consult");
}
