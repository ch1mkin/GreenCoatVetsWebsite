import { redirect } from "next/navigation";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { createClient } from "@/lib/supabase/server";

/** Prescriptions are edited only on the visit screen; keep old links working. */
export default async function PrescriptionRedirectPage({ params }: { params: { id: string } }) {
  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();
  const { data } = await supabase
    .from("prescriptions")
    .select("visit_id")
    .eq("id", params.id)
    .eq("clinic_id", clinic_id)
    .maybeSingle();

  if (data?.visit_id) {
    redirect(`/visits/${data.visit_id}`);
  }
  redirect("/appointments");
}
