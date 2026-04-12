"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";

export async function publishClinicAnnouncement(formData: FormData) {
  const access = await getUserAccess();
  const title = String(formData.get("title") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const clinicRaw = String(formData.get("clinic_id") ?? "").trim();

  if (!title || !message) {
    redirect("/announcements?error=" + encodeURIComponent("Title and message are required."));
  }

  const supabase = createClient();

  let clinicId: string | null = null;
  if (access.isSuperAdmin) {
    clinicId = clinicRaw || null;
    if (!clinicId) {
      redirect("/announcements?error=" + encodeURIComponent("Choose a clinic."));
    }
  } else {
    const role = access.membership?.role?.toLowerCase();
    if (role !== "clinic_admin" && role !== "branch_admin") {
      redirect("/announcements?error=" + encodeURIComponent("You do not have permission to publish announcements."));
    }
    clinicId = access.membership?.clinic_id ?? null;
  }

  if (!clinicId) {
    redirect("/announcements?error=" + encodeURIComponent("No clinic context."));
  }

  const { data, error } = await supabase.rpc("publish_clinic_announcement", {
    p_clinic_id: clinicId,
    p_title: title,
    p_message: message,
  });

  if (error) {
    redirect("/announcements?error=" + encodeURIComponent(error.message));
  }

  if (!data) {
    redirect("/announcements?error=" + encodeURIComponent("Publish failed."));
  }

  revalidatePath("/announcements");
  redirect("/announcements?saved=1");
}
