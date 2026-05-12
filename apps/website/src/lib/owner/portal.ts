import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type OwnerRow = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
};

export type OwnerWithClinic = {
  owner: OwnerRow & { clinic_id: string };
  clinic: { id: string; name: string; slug: string; website_owner_visit_reports_enabled?: boolean | null };
  /** True when this site’s resolved clinic (host / marketing default) matches the owner’s registered clinic. */
  siteMatchesOwnerClinic: boolean;
};

/**
 * Finds the pet owner record for this user and the clinic they’re registered with.
 * If the user has multiple `owners` rows, prefers the one whose `clinic_id` matches `resolveClinic()`
 * (current marketing site), otherwise uses the first row.
 *
 * Use this for the pet owner portal so we show **their** clinic name, not only the marketing default.
 */
export async function getOwnerPortalContext(userId: string): Promise<OwnerWithClinic | null> {
  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from("owners")
    .select("id, full_name, phone, email, clinic_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  if (!rows?.length) return null;

  const resolved = await resolveClinic();
  const matchResolved = rows.find((r) => (r.clinic_id as string) === resolved.id);
  const chosen = matchResolved ?? rows[0];
  const clinicId = chosen.clinic_id as string;

  const { data: clinic, error: cErr } = await supabase
    .from("clinics")
    .select("id, name, slug, website_owner_visit_reports_enabled")
    .eq("id", clinicId)
    .maybeSingle();

  if (cErr) throw new Error(cErr.message);

  const clinicRow = clinic as { id: string; name: string; slug: string; website_owner_visit_reports_enabled?: boolean | null } | null;

  return {
    owner: chosen as OwnerRow & { clinic_id: string },
    clinic: clinicRow ?? { id: clinicId, name: "Your clinic", slug: "clinic", website_owner_visit_reports_enabled: true },
    siteMatchesOwnerClinic: resolved.id === clinicId,
  };
}

/** @deprecated Prefer getOwnerPortalContext — resolves by owner’s clinic, not marketing default only. */
export async function getOwnerForClinic(clinicId: string, userId: string): Promise<OwnerRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("owners")
    .select("id, full_name, phone, email")
    .eq("clinic_id", clinicId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as OwnerRow;
}

export type VisitSummaryRow = {
  id: string;
  pet_name: string;
  branch_name: string;
  visited_at: string | null;
  status_label: string | null;
  report_ready: boolean;
  report_generated_at: string | null;
};

export async function fetchOwnerVisitSummaries(userId: string, clinicId: string, limit = 25): Promise<VisitSummaryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_owner_portal_visit_summaries", {
    p_clinic_id: clinicId,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  const baseRows = ((data ?? []) as Omit<VisitSummaryRow, "report_ready" | "report_generated_at">[]).map((row) => ({
    ...row,
    report_ready: false,
    report_generated_at: null,
  }));
  if (!baseRows.length) return baseRows;

  const admin = createServiceRoleClient();
  if (!admin) return baseRows;

  const { data: reportRows, error: reportError } = await admin
    .from("visits")
    .select("id, visit_report_pdf_generated_at, owners!inner(user_id)")
    .in(
      "id",
      baseRows.map((row) => row.id),
    )
    .eq("owners.user_id", userId);
  if (reportError || !reportRows?.length) return baseRows;

  const reportMap = new Map(
    reportRows.map((row) => [
      String(row.id),
      String((row as { visit_report_pdf_generated_at?: string | null }).visit_report_pdf_generated_at ?? "") || null,
    ]),
  );

  return baseRows.map((row) => {
    const generatedAt = reportMap.get(row.id) ?? null;
    return {
      ...row,
      report_ready: Boolean(generatedAt),
      report_generated_at: generatedAt,
    };
  });
}
