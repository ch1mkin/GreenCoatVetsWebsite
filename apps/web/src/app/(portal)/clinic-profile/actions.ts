"use server";

import { revalidatePath } from "next/cache";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";

function canManageClinicProfile(role: string | null | undefined, isSuperAdmin: boolean): boolean {
  if (isSuperAdmin) return true;
  return role === "clinic_admin" || role === "branch_admin";
}

export async function updateClinicProfileImage(formData: FormData) {
  const access = await getUserAccess();
  const role = access.membership?.role ?? "";
  const clinicId = access.membership?.clinic_id ?? "";
  if (!clinicId || !canManageClinicProfile(role, access.isSuperAdmin)) {
    throw new Error("Only clinic admins or branch admins can update clinic profile image.");
  }

  const imageFile = formData.get("clinic_image");
  const file = imageFile instanceof File ? imageFile : null;
  if (!file || file.size === 0) throw new Error("Clinic image is required.");

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${clinicId}/${Date.now()}-${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const supabase = createClient();
  const { error: uploadError } = await supabase.storage
    .from("clinic-assets")
    .upload(path, bytes, { contentType: file.type || "application/octet-stream", upsert: true });
  if (uploadError) throw new Error(uploadError.message);
  const { data: publicUrl } = supabase.storage.from("clinic-assets").getPublicUrl(path);

  const { error } = await supabase
    .from("clinics")
    .update({ image_url: publicUrl.publicUrl })
    .eq("id", clinicId);
  if (error) throw new Error(error.message);

  revalidatePath("/clinic-profile");
  revalidatePath("/join-clinic");
}

export async function updateClinicHandwrittenVisitTemplate(formData: FormData) {
  const access = await getUserAccess();
  const role = access.membership?.role ?? "";
  const clinicId = access.membership?.clinic_id ?? "";
  if (!clinicId || !canManageClinicProfile(role, access.isSuperAdmin)) {
    throw new Error("Only clinic admins or branch admins can update the handwritten visit template.");
  }

  const uploaded = formData.get("template_image");
  const file = uploaded instanceof File ? uploaded : null;
  if (!file || file.size === 0) throw new Error("Template image is required.");
  if (!(file.type || "").startsWith("image/")) {
    throw new Error("Please upload an image file (PNG, JPG, or WebP).");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${clinicId}/handwritten-visit-templates/${Date.now()}-${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const supabase = createClient();
  const { error: uploadError } = await supabase.storage
    .from("clinic-assets")
    .upload(path, bytes, { contentType: file.type || "application/octet-stream", upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrl } = supabase.storage.from("clinic-assets").getPublicUrl(path);
  const nowIso = new Date().toISOString();
  let { error } = await supabase
    .from("clinics")
    .update({
      handwritten_visit_template_url: publicUrl.publicUrl,
      handwritten_visit_template_updated_at: nowIso,
    })
    .eq("id", clinicId);
  if (error && /handwritten_visit_template_/i.test(error.message)) {
    const fallback = await supabase
      .from("clinics")
      .update({
        prescription_template_url: publicUrl.publicUrl,
        prescription_template_updated_at: nowIso,
      })
      .eq("id", clinicId);
    error = fallback.error;
  }
  if (error) throw new Error(error.message);

  revalidatePath("/clinic-profile");
  revalidatePath("/clinic-profile/prescription-template");
  revalidatePath("/medicines");
  revalidatePath("/visits");
}

export async function clearClinicHandwrittenVisitTemplate() {
  const access = await getUserAccess();
  const role = access.membership?.role ?? "";
  const clinicId = access.membership?.clinic_id ?? "";
  if (!clinicId || !canManageClinicProfile(role, access.isSuperAdmin)) {
    throw new Error("Only clinic admins or branch admins can update the handwritten visit template.");
  }

  const supabase = createClient();
  const nowIso = new Date().toISOString();
  let { error } = await supabase
    .from("clinics")
    .update({
      handwritten_visit_template_url: null,
      handwritten_visit_template_updated_at: nowIso,
    })
    .eq("id", clinicId);
  if (error && /handwritten_visit_template_/i.test(error.message)) {
    const fallback = await supabase
      .from("clinics")
      .update({
        prescription_template_url: null,
        prescription_template_updated_at: nowIso,
      })
      .eq("id", clinicId);
    error = fallback.error;
  }
  if (error) throw new Error(error.message);

  revalidatePath("/clinic-profile");
  revalidatePath("/clinic-profile/prescription-template");
  revalidatePath("/medicines");
  revalidatePath("/visits");
}

export async function updateClinicBranchWebLicenseSettings(formData: FormData) {
  const access = await getUserAccess();
  const role = access.membership?.role ?? "";
  const clinicId = access.membership?.clinic_id ?? "";
  if (!clinicId || !canManageClinicProfile(role, access.isSuperAdmin)) {
    throw new Error("Only clinic admins or branch admins can update branch web license pricing.");
  }

  const priceRaw = String(formData.get("branch_web_license_price_inr") ?? "").trim();
  const daysRaw = String(formData.get("branch_web_license_period_days") ?? "").trim();

  let branch_web_license_price_paise: number | null = null;
  if (priceRaw !== "") {
    const n = Number(priceRaw);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error("Price must be a positive number (INR), or leave blank to use platform default.");
    }
    branch_web_license_price_paise = Math.round(n * 100);
  }

  let branch_web_license_period_days: number | null = null;
  if (daysRaw !== "") {
    const n = Number(daysRaw);
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
      throw new Error("Term must be a whole number of days, or leave blank to use platform default.");
    }
    branch_web_license_period_days = n;
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("clinics")
    .update({
      branch_web_license_price_paise,
      branch_web_license_period_days,
    })
    .eq("id", clinicId);
  if (error) throw new Error(error.message);

  revalidatePath("/clinic-profile");
  revalidatePath("/billing/branch-portal");
}

export async function updateClinicWebsiteVisitReportAccess(formData: FormData) {
  const access = await getUserAccess();
  const role = access.membership?.role ?? "";
  const clinicId = access.membership?.clinic_id ?? "";
  if (!clinicId || !canManageClinicProfile(role, access.isSuperAdmin)) {
    throw new Error("Only clinic admins or branch admins can update website visit-report access.");
  }

  const websiteOwnerVisitReportsEnabled = String(formData.get("website_owner_visit_reports_enabled") ?? "") === "on";

  const supabase = createClient();
  const { error } = await supabase
    .from("clinics")
    .update({
      website_owner_visit_reports_enabled: websiteOwnerVisitReportsEnabled,
    })
    .eq("id", clinicId);
  if (error) throw new Error(error.message);

  revalidatePath("/clinic-profile");
}
