"use server";

import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";

export type PrepareCheckoutResult = {
  license_id: string;
  clinic_id: string;
  branch_id: string;
  amount_paise: number;
  period_days: number;
};

export async function prepareBranchPortalCheckout(): Promise<PrepareCheckoutResult> {
  const access = await getUserAccess();
  if (access.membership?.role !== "branch_admin") {
    throw new Error("Only branch admins can purchase branch web portal access.");
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_branch_web_portal_license_pending");
  if (error) throw new Error(error.message);
  const row = data as {
    license_id?: string;
    clinic_id?: string;
    branch_id?: string;
    amount_paise?: number;
    period_days?: number;
  } | null;
  if (!row?.license_id || !row.branch_id || row.amount_paise == null || row.period_days == null) {
    throw new Error("Could not start checkout.");
  }
  return {
    license_id: row.license_id,
    clinic_id: row.clinic_id as string,
    branch_id: row.branch_id,
    amount_paise: row.amount_paise,
    period_days: row.period_days,
  };
}
