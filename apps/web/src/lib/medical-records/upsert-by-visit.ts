import { createClient } from "@/lib/supabase/server";

type Supabase = ReturnType<typeof createClient>;

/**
 * One chart row per visit. Updates preserve lab_tests unless explicitly provided.
 */
export async function upsertMedicalRecordForVisit(
  supabase: Supabase,
  row: {
    clinic_id: string;
    branch_id: string;
    pet_id: string;
    visit_id: string;
    diagnosis: string | null;
    notes: string | null;
    lab_tests?: string | null;
    created_by?: string | null;
  },
): Promise<void> {
  const { data: rows, error: selErr } = await supabase
    .from("medical_records")
    .select("id")
    .eq("visit_id", row.visit_id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (selErr) throw new Error(selErr.message);

  const existingId = rows?.[0]?.id as string | undefined;
  const labTestsProvided = Object.prototype.hasOwnProperty.call(row, "lab_tests");

  if (existingId) {
    const patch: Record<string, unknown> = {
      clinic_id: row.clinic_id,
      branch_id: row.branch_id,
      pet_id: row.pet_id,
      diagnosis: row.diagnosis,
      notes: row.notes,
    };
    if (labTestsProvided) patch.lab_tests = row.lab_tests ?? null;
    const { error } = await supabase.from("medical_records").update(patch).eq("id", existingId);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from("medical_records").insert({
    clinic_id: row.clinic_id,
    branch_id: row.branch_id,
    pet_id: row.pet_id,
    visit_id: row.visit_id,
    diagnosis: row.diagnosis,
    notes: row.notes,
    lab_tests: row.lab_tests ?? null,
    created_by: row.created_by ?? null,
  });
  if (error) throw new Error(error.message);
}
