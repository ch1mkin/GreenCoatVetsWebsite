import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ensurePrescriptionForVisit, saveVisitRecord, uploadVisitAttachment } from "../actions";
import { addPrescriptionItem } from "@/app/(portal)/prescriptions/actions";
import { regeneratePrescriptionPdfForm } from "@/app/(portal)/invoicing/actions";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { canManageInvoices } from "@/lib/auth/invoice-access";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/web/app-shell";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { REFERRED_TEST_OPTIONS, testFieldName } from "@/lib/clinical/referred-tests";
import { inferSpeciesClass, SPECIES_CLASS_OPTIONS } from "@/lib/clinical/species-class";
import { SubmitButton } from "@/components/web/submit-button";
import { resolveSignedImageUrl } from "@/lib/storage/resolve-signed-image-url";
import { VisitSection } from "@/components/clinical/visit-section";
import { VisitAnchorNav } from "@/components/clinical/visit-anchor-nav";
import { OpenClinicalWindowButton } from "@/components/clinical/open-clinical-window-button";
import { VisitRxVoicePanel } from "@/components/clinical/visit-rx-voice-panel";
import { VisitVoiceDictation } from "@/components/clinical/visit-voice-dictation";
import { VisitReportToolbar } from "@/components/clinical/visit-report-toolbar";
import { formatSpeciesDisplay } from "@/lib/pets/species-labels";

export const dynamic = "force-dynamic";

function ownerDisplayName(owner: {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
} | null): string {
  if (!owner) return "—";
  const f = owner.first_name?.trim();
  const l = owner.last_name?.trim();
  if (f && l) return `${f} ${l}`;
  return owner.full_name ?? "—";
}

function patientAgeLabel(pet: {
  date_of_birth?: string | null;
  age_months?: number | null;
}): string {
  if (pet.date_of_birth) {
    const d = new Date(pet.date_of_birth);
    if (!Number.isNaN(d.getTime())) {
      const years = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      return `${years} y`;
    }
  }
  if (pet.age_months != null) return `${pet.age_months} mo`;
  return "";
}

function searchParamOne(
  sp: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string | undefined {
  if (!sp) return undefined;
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}

export default async function VisitDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const access = await getUserAccess();
  if (!access.membership && !access.isSuperAdmin) redirect("/login");
  const role = (access.membership?.role ?? (access.isSuperAdmin ? "super_admin" : "pet_owner")) as Parameters<
    typeof getRoleNavGroups
  >[0];
  if (
    !access.isSuperAdmin &&
    !["clinic_admin", "receptionist", "doctor", "branch_admin", "lab_technician", "pharmacist"].includes(role)
  ) {
    redirect("/dashboard");
  }

  const resolvedParams = await Promise.resolve(params);
  const sp = await Promise.resolve(searchParams ?? {});
  const embed = searchParamOne(sp, "embed") === "1";
  const showVisitSavedBanner = searchParamOne(sp, "saved") === "1";
  const showRxPdfBanner = searchParamOne(sp, "rx_pdf") === "1";
  const showRxItemBanner = searchParamOne(sp, "rx_item") === "1";
  const showRxEditBanner = searchParamOne(sp, "rx_edit") === "1";

  const { clinic_id } = await getActiveMembership();
  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);
  const supabase = createClient();

  const { data: visit, error } = await supabase
    .from("visits")
    .select(
      "id, doctor_id, check_in_at, started_at, completed_at, symptoms, diagnosis, treatment_plan, follow_up_at, appointment_id, visit_report_pdf_path, visit_report_pdf_generated_at, updated_at, pets(id, name, species, breed, gender, date_of_birth, age_months, microchip_id, weight_kg), owners(first_name, last_name, full_name, phone, email), branches(id, name), staff_profiles(full_name), appointments(id, status, reason, notes, starts_at, owner_intake, doctor_id)"
    )
    .eq("id", resolvedParams.id)
    .eq("clinic_id", clinic_id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!visit) notFound();

  const pet = visit.pets as unknown as Record<string, unknown> | null;
  const owner = visit.owners as unknown as Record<string, unknown> | null;
  const apptRaw = visit.appointments as Record<string, unknown> | Record<string, unknown>[] | null;
  const appt = Array.isArray(apptRaw) ? apptRaw[0] ?? null : apptRaw;
  const branch = visit.branches as { id?: string; name?: string } | null;

  const intakeObj =
    appt?.owner_intake && typeof appt.owner_intake === "object" && !Array.isArray(appt.owner_intake)
      ? (appt.owner_intake as Record<string, unknown>)
      : null;
  const ic = (k: string) => String(intakeObj?.[k] ?? "").trim();
  const hasOwnerIntake =
    !!intakeObj &&
    ["chief_complaint", "allergies", "current_medications", "contact_phone", "contact_email"].some((k) => ic(k));

  const species = pet?.species ? formatSpeciesDisplay(String(pet.species)) : "Pet";
  const defaultSpeciesClass = inferSpeciesClass(species);

  const { data: evaluation } = await supabase
    .from("visit_clinical_evaluations")
    .select("*")
    .eq("visit_id", visit.id)
    .maybeSingle();

  const referredSet = new Set(
    Array.isArray(evaluation?.tests_referred) ? (evaluation?.tests_referred as string[]) : []
  );

  const visitDoctorId = visit.doctor_id as string | null | undefined;
  const apptDoctorId = (appt?.doctor_id as string | undefined) ?? undefined;
  const resolvedDoctorStaffId = visitDoctorId ?? apptDoctorId;

  let doctorDisplayName = (visit.staff_profiles as { full_name?: string } | null)?.full_name ?? null;
  if (!doctorDisplayName && resolvedDoctorStaffId) {
    const { data: docRow } = await supabase
      .from("staff_profiles")
      .select("full_name")
      .eq("id", resolvedDoctorStaffId)
      .maybeSingle();
    doctorDisplayName = docRow?.full_name ?? null;
  }

  const visitUpdated = String((visit as { updated_at?: string }).updated_at ?? "");
  const evalUpdated = String(evaluation?.updated_at ?? "");
  const visitFormKey = `${visit.id}-${visitUpdated}-${evalUpdated}`;

  const prescriptionId = await ensurePrescriptionForVisit(visit.id);

  const { data: rxMeta } = await supabase.from("prescriptions").select("pdf_url").eq("id", prescriptionId).maybeSingle();
  const prescriptionPdfUrl = rxMeta?.pdf_url
    ? await resolveSignedImageUrl(supabase, rxMeta.pdf_url, { expiresIn: 3600 })
    : null;

  const canInvoice = canManageInvoices(access);
  const canRxPdf =
    access.isSuperAdmin ||
    ["receptionist", "clinic_admin", "branch_admin", "doctor", "pharmacist", "lab_technician"].includes(role);

  const { data: rxItems, error: rxItemsError } = await supabase
    .from("prescription_items")
    .select("id, medicine_name, dosage, frequency, duration, instructions")
    .eq("prescription_id", prescriptionId)
    .order("created_at", { ascending: true });

  if (rxItemsError) throw new Error(rxItemsError.message);

  const { data: attachments, error: attachmentsError } = await supabase
    .from("file_attachments")
    .select("id, file_name, mime_type, storage_bucket, storage_path, created_at")
    .eq("visit_id", visit.id)
    .eq("clinic_id", clinic_id)
    .order("created_at", { ascending: false });

  if (attachmentsError) throw new Error(attachmentsError.message);

  const petId = String(pet?.id ?? "");
  const branchId = String(branch?.id ?? "");

  const { data: previousVisitsRaw } = await supabase
    .from("visits")
    .select("id, started_at, completed_at, created_at")
    .eq("clinic_id", clinic_id)
    .eq("pet_id", petId)
    .neq("id", visit.id)
    .order("created_at", { ascending: false })
    .limit(12);

  const previousVisits = (previousVisitsRaw ?? []).map((v) => ({
    id: v.id as string,
    when: new Date((v.completed_at ?? v.started_at ?? v.created_at) as string).toLocaleString(),
  }));

  const visitMainClass = embed
    ? "space-y-2 text-[13px] leading-snug"
    : "workspace-form mx-auto max-w-5xl space-y-4 text-sm";

  const showVoiceDictation = access.isSuperAdmin || role === "doctor";

  const bannerClass = embed
    ? "rounded-lg border px-3 py-2 text-[12px]"
    : "mx-auto max-w-5xl rounded-xl border px-4 py-3 text-[13px] shadow-sm";

  const body = (
    <>
      {showVisitSavedBanner ? (
        <div role="status" className={`${bannerClass} border-emerald-200 bg-emerald-50 text-emerald-950`}>
          <p className="font-headline font-bold text-emerald-900">Visit information saved</p>
          <p className={embed ? "mt-0.5 text-[11px] text-emerald-900/90" : "mt-1 text-emerald-800/95"}>
            Clinical evaluation and consultation updates are stored for this visit.
          </p>
        </div>
      ) : null}
      {showRxPdfBanner ? (
        <div role="status" className={`${bannerClass} border-emerald-200 bg-emerald-50 text-emerald-950`}>
          <p className="font-headline font-bold text-emerald-900">Prescription PDF ready</p>
          <p className={embed ? "mt-0.5 text-[11px] text-emerald-900/90" : "mt-1 text-emerald-800/95"}>
            The file was saved to storage. Use <strong>Open printable prescription (PDF)</strong> below or{" "}
            <strong>Download PDF</strong> to view it.
          </p>
        </div>
      ) : null}
      {showRxItemBanner ? (
        <div role="status" className={`${bannerClass} border-sky-200 bg-sky-50 text-sky-950`}>
          <p className="font-headline font-bold text-sky-900">Medicine line added</p>
          <p className={embed ? "mt-0.5 text-[11px]" : "mt-1 text-sky-900/90"}>
            Generate or refresh the prescription PDF when you are ready to print it for the owner.
          </p>
        </div>
      ) : null}
      {showRxEditBanner ? (
        <div role="status" className={`${bannerClass} border-sky-200 bg-sky-50 text-sky-950`}>
          <p className="font-headline font-bold text-sky-900">Instructions updated</p>
          <p className={embed ? "mt-0.5 text-[11px]" : "mt-1 text-sky-900/90"}>
            Regenerate the visit report PDF if you need the printed summary to match.
          </p>
        </div>
      ) : null}
      {!embed ? <VisitAnchorNav showIntake={hasOwnerIntake} /> : null}
      {!embed ? (
        <>
          {petId ? (
            <VisitReportToolbar
              visitId={visit.id}
              petId={petId}
              storedAt={(visit.visit_report_pdf_generated_at as string | null) ?? null}
            />
          ) : null}
          {previousVisits.length > 0 ? (
            <div className="mx-auto max-w-5xl rounded-xl border border-amber-200/90 bg-amber-50 px-4 py-3 text-[12px] text-amber-950">
              <p className="font-headline font-bold">Earlier visits for this patient ({previousVisits.length})</p>
              <p className="mt-1 text-[11px] opacity-90">
                Open a prior visit in the side panel or its PDF in a new tab to compare clinical context.
              </p>
              <ul className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
                {previousVisits.map((pv) => (
                  <li key={pv.id} className="flex flex-wrap items-center gap-2">
                    <span className="text-on-surface-variant">{pv.when}</span>
                    <a
                      href={`/visits/${pv.id}?embed=1`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-primary underline"
                    >
                      Side panel
                    </a>
                    <a
                      href={`/visits/${pv.id}/report`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-primary underline"
                    >
                      PDF report
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        <div className="mb-2 flex flex-wrap gap-2">
          <a
            className="btn-secondary btn-compact text-[11px]"
            href={`/visits/${visit.id}/report`}
            target="_blank"
            rel="noreferrer"
          >
            PDF report
          </a>
        </div>
      )}
      {showVoiceDictation ? <VisitVoiceDictation embed={embed} /> : null}
      <div className={visitMainClass}>
        {hasOwnerIntake ? (
          <VisitSection
            embed={embed}
            id="section-intake"
            title="Owner intake (booking)"
            defaultOpen={embed}
            description={
              !embed ? (
                <span>Submitted when the appointment was booked on the website — use with the clinical evaluation.</span>
              ) : undefined
            }
          >
            <div className="grid gap-2 md:grid-cols-2">
              {ic("chief_complaint") ? (
                <p className="md:col-span-2">
                  <span className="text-on-surface-variant">Chief complaint / concern:</span>{" "}
                  <span className="font-medium">{ic("chief_complaint")}</span>
                </p>
              ) : null}
              {ic("allergies") ? (
                <p className="md:col-span-2">
                  <span className="text-on-surface-variant">Allergies:</span>{" "}
                  <span className="font-medium">{ic("allergies")}</span>
                </p>
              ) : null}
              {ic("current_medications") ? (
                <p className="md:col-span-2">
                  <span className="text-on-surface-variant">Current medications / supplements:</span>{" "}
                  <span className="font-medium">{ic("current_medications")}</span>
                </p>
              ) : null}
              {ic("contact_phone") ? (
                <p>
                  <span className="text-on-surface-variant">Contact phone (confirmed):</span>{" "}
                  <span className="font-medium">{ic("contact_phone")}</span>
                </p>
              ) : null}
              {ic("contact_email") ? (
                <p>
                  <span className="text-on-surface-variant">Contact email (confirmed):</span>{" "}
                  <span className="font-medium">{ic("contact_email")}</span>
                </p>
              ) : null}
      </div>
          </VisitSection>
        ) : null}

        <VisitSection embed={embed} id="section-summary" title="Patient & visit" defaultOpen>
          <div className="grid gap-2 md:grid-cols-2">
            <p>
              <span className="text-on-surface-variant">Owner:</span>{" "}
              <strong>{ownerDisplayName(owner as { first_name?: string; last_name?: string; full_name?: string })}</strong>
            </p>
            <p>
              <span className="text-on-surface-variant">Patient:</span> <strong>{String(pet?.name ?? "—")}</strong> ({species})
        </p>
        <p>
              <span className="text-on-surface-variant">Branch:</span> {branch?.name ?? "—"}
        </p>
        <p>
              <span className="text-on-surface-variant">Doctor:</span> {doctorDisplayName ?? "—"}
        </p>
        <p>
              <span className="text-on-surface-variant">Appointment:</span> {String(appt?.status ?? "—")}
        </p>
        <p>
              <span className="text-on-surface-variant">Reason:</span>{" "}
              {String(appt?.reason ?? "").trim() || ic("chief_complaint") || "—"}
            </p>
          </div>
        </VisitSection>

        <div
          className={
            embed
              ? "contents"
              : "rounded-2xl border border-outline-variant/25 bg-surface-container-low/15 shadow-sm overflow-hidden"
          }
        >
        <form
          id="form-visit-record"
          key={visitFormKey}
          action={saveVisitRecord}
          className={embed ? "space-y-2" : "space-y-4"}
        >
          <input type="hidden" name="visit_id" value={visit.id} />
          <input type="hidden" name="embed" value={embed ? "1" : ""} />
          <p className={embed ? "text-[11px] text-slate-600" : "text-[12px] text-on-surface-variant"}>
            Clinical evaluation and consultation save together — use one button below for SOAP + exam fields.
          </p>
          <VisitSection
            embed={embed}
            id="section-clinical"
            title="Clinical evaluation"
            defaultOpen
            description={
              !embed ? (
                <span>Pre-filled from the appointment / patient where possible. Saved for medical record and invoicing.</span>
              ) : (
                <span className="text-slate-600">Pre-filled where possible. Saves for record & billing.</span>
              )
            }
          >
            <div className={embed ? "space-y-2" : "space-y-3"}>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-on-surface-variant">Species class</span>
                <select
                  className="input-soft input-compact"
                  name="species_class"
                  defaultValue={evaluation?.species_class ?? defaultSpeciesClass}
                >
                  {SPECIES_CLASS_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-on-surface-variant">Gender</span>
                <input
                  className="input-soft input-compact"
                  name="patient_gender"
                  defaultValue={evaluation?.patient_gender ?? String(pet?.gender ?? "")}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-on-surface-variant">Age</span>
                <input
                  className="input-soft input-compact"
                  name="patient_age"
                  defaultValue={
                    evaluation?.patient_age ?? patientAgeLabel(pet as { date_of_birth?: string; age_months?: number })
                  }
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-on-surface-variant">Patient name</span>
                <input
                  className="input-soft input-compact"
                  name="patient_name"
                  defaultValue={evaluation?.patient_name ?? String(pet?.name ?? "")}
                />
              </label>
              <label className="flex flex-col gap-0.5 md:col-span-2">
                <span className="text-[11px] font-semibold text-on-surface-variant">Owner name</span>
                <input
                  className="input-soft input-compact"
                  name="owner_name"
                  defaultValue={
                    evaluation?.owner_name ??
                    ownerDisplayName(owner as { first_name?: string; last_name?: string; full_name?: string })
                  }
                />
              </label>
            </div>

            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low/40 p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                Presenting complaint
              </p>
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-on-surface-variant">Patient complaint</span>
                <span className="text-[10px] leading-snug text-on-surface-variant">
                  What the owner or patient gives as the reason for today&apos;s visit (you can dictate into this field).
                </span>
                <textarea
                  className="input-soft mt-1 min-h-[56px] py-2 text-[13px]"
                  name="patient_complaint"
                  placeholder="e.g. not eating, cough, limping on the left hind"
                  defaultValue={evaluation?.patient_complaint ?? ic("chief_complaint")}
                />
              </label>
            </div>

            <label className="flex flex-col gap-0.5">
              <span className="text-[11px] font-semibold text-on-surface-variant">CC / HP (HPI)</span>
              <textarea
                className="input-soft min-h-[56px] py-2 text-[13px]"
                name="cc_hp"
                placeholder="Chief complaint / history of present illness"
                defaultValue={evaluation?.cc_hp ?? String(appt?.notes ?? "")}
              />
            </label>

            <div className="grid gap-2 md:grid-cols-2">
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-on-surface-variant">Deworming</span>
                <textarea
                  className="input-soft min-h-[48px] py-2 text-[13px]"
                  name="section_deworming"
                  defaultValue={evaluation?.section_deworming ?? ""}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-on-surface-variant">Vaccination</span>
                <textarea
                  className="input-soft min-h-[48px] py-2 text-[13px]"
                  name="section_vaccination"
                  defaultValue={evaluation?.section_vaccination ?? ""}
                />
              </label>
            </div>

            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Parameters</p>
              <div className="grid gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
                {(
                  [
                    ["param_rt", "RT"],
                    ["param_rr", "RR"],
                    ["param_hr", "HR"],
                    ["param_crt", "CRT"],
                    ["param_allergic", "Allergic"],
                    ["param_bw", "B/W"],
                  ] as const
                ).map(([name, label]) => (
                  <label key={name} className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold text-on-surface-variant">{label}</span>
                    <input
                      className="input-soft input-compact py-1.5 text-[13px]"
                      name={name}
                      defaultValue={String((evaluation as Record<string, string>)?.[name] ?? "")}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Tests referred</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {REFERRED_TEST_OPTIONS.map((code) => (
                  <label key={code} className="flex items-center gap-1.5 text-[11px]">
                    <input
                      type="checkbox"
                      name={testFieldName(code)}
                      defaultChecked={referredSet.has(code)}
                      className="rounded border-outline-variant"
                    />
                    {code}
                  </label>
                ))}
              </div>
              <label className="mt-2 flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-on-surface-variant">Other tests</span>
                <input className="input-soft input-compact" name="tests_other" defaultValue={evaluation?.tests_other ?? ""} />
              </label>
            </div>

            <label className="flex flex-col gap-0.5">
              <span className="text-[11px] font-semibold text-on-surface-variant">Physical examination</span>
              <textarea
                className="input-soft min-h-[72px] py-2 text-[13px]"
                name="physical_examination"
                defaultValue={evaluation?.physical_examination ?? ""}
              />
            </label>
            </div>
          </VisitSection>

        <VisitSection embed={embed} id="section-soap" title="Consultation (SOAP)" defaultOpen={!embed}>
          <div className="space-y-2">
          <textarea
              className="input-soft min-h-[64px] w-full py-2 text-[13px]"
            name="symptoms"
              placeholder="Symptoms / subjective"
            defaultValue={visit.symptoms ?? ""}
          />
          <textarea
              className="input-soft min-h-[64px] w-full py-2 text-[13px]"
            name="diagnosis"
              placeholder="Diagnosis / assessment"
            defaultValue={visit.diagnosis ?? ""}
          />
          <textarea
              className="input-soft min-h-[64px] w-full py-2 text-[13px]"
            name="treatment_plan"
            placeholder="Treatment plan"
            defaultValue={visit.treatment_plan ?? ""}
          />
          <div>
              <label className="mb-0.5 block text-[11px] font-semibold text-on-surface-variant">Follow-up</label>
            <input
                className="input-soft input-compact"
              type="datetime-local"
              name="follow_up_at"
                defaultValue={visit.follow_up_at ? new Date(visit.follow_up_at).toISOString().slice(0, 16) : ""}
            />
          </div>
            <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" name="complete_visit" defaultChecked={Boolean(visit.completed_at)} />
            Mark visit complete
          </label>
            <p className="text-[11px] text-on-surface-variant">
              Use <strong>Save entire visit</strong> and <strong>Complete visit</strong> at the bottom of this page (after attachments).
            </p>
          </div>
        </VisitSection>
        </form>

        <VisitSection
          embed={embed}
          id="section-rx"
          title="Prescription (this visit)"
          defaultOpen={!embed}
          className={
            embed
              ? ""
              : "!rounded-none !border-0 !shadow-none border-t border-outline-variant/25 bg-surface-container-lowest/90 px-4 py-4"
          }
        >
          <p className="text-[11px] text-on-surface-variant">
            Medicines and instructions are stored on this visit (no separate prescription screen). Generate a PDF for the owner. Billing uses{" "}
            <strong>Billing / invoice</strong> on this visit.
          </p>
          <div
            className={`rounded-lg border px-3 py-2 text-[11px] ${
              prescriptionPdfUrl ? "border-emerald-200/80 bg-emerald-50/60 text-emerald-950" : "border-amber-200/90 bg-amber-50/80 text-amber-950"
            }`}
            role="status"
          >
            <p className="font-semibold">
              PDF status: {prescriptionPdfUrl ? "Ready — opens in a new tab below." : "Not generated — add medicines, then click Save prescription PDF."}
            </p>
          </div>
          {canRxPdf ? (
            <div className="flex flex-wrap items-center gap-2">
              <form action={regeneratePrescriptionPdfForm}>
                <input type="hidden" name="prescription_id" value={prescriptionId} />
                <input type="hidden" name="visit_id" value={visit.id} />
                <input type="hidden" name="embed" value={embed ? "1" : ""} />
                <SubmitButton className="btn-secondary btn-compact text-xs" pendingLabel="Generating PDF…">
                  Save prescription PDF
                </SubmitButton>
        </form>
              {prescriptionPdfUrl ? (
                <a
                  className="text-xs font-semibold text-primary underline"
                  href={prescriptionPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download PDF
                </a>
              ) : null}
            </div>
          ) : (
            <p className="text-[11px] text-on-surface-variant">Your role cannot generate prescription PDFs. Ask a clinician or reception.</p>
          )}
          {showVoiceDictation ? (
            <VisitRxVoicePanel
              embed={embed}
              visitId={visit.id}
              lines={(rxItems ?? []).map((r) => ({
                id: r.id,
                medicine_name: String(r.medicine_name ?? ""),
                instructions: r.instructions ?? null,
              }))}
            />
          ) : null}
          <form id="form-rx-add" action={addPrescriptionItem} className="grid gap-2 md:grid-cols-2">
            <input type="hidden" name="prescription_id" value={prescriptionId} />
            <input type="hidden" name="visit_id" value={visit.id} />
            <input type="hidden" name="embed" value={embed ? "1" : ""} />
            <input className="input-soft input-compact md:col-span-2" name="medicine_name" placeholder="Medicine name *" required />
            <input className="input-soft input-compact" name="dosage" placeholder="Dosage *" required />
            <input className="input-soft input-compact" name="frequency" placeholder="Frequency" />
            <input className="input-soft input-compact" name="duration" placeholder="Duration" />
            <textarea
              id="rx-new-instructions"
              className="input-soft input-compact md:col-span-2 min-h-[48px]"
              name="instructions"
              placeholder="Instructions (use the prescription mic above, or type here)"
            />
            <button type="submit" className="btn-primary btn-compact md:col-span-2">
              Add medicine line
            </button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[11px]">
              <thead>
                <tr className="border-b border-outline-variant/20 text-[10px] font-bold uppercase text-on-surface-variant">
                  <th className="py-1.5 pr-2">Medicine</th>
                  <th className="py-1.5 pr-2">Dosage</th>
                  <th className="py-1.5 pr-2">Frequency</th>
                  <th className="py-1.5 pr-2">Duration</th>
                  <th className="py-1.5">Instructions</th>
                </tr>
              </thead>
              <tbody>
                {rxItems?.map((item) => (
                  <tr key={item.id} className="border-b border-outline-variant/10">
                    <td className="py-1.5 pr-2">{item.medicine_name}</td>
                    <td className="py-1.5 pr-2">{item.dosage}</td>
                    <td className="py-1.5 pr-2">{item.frequency ?? "—"}</td>
                    <td className="py-1.5 pr-2">{item.duration ?? "—"}</td>
                    <td className="py-1.5">{item.instructions ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rxItems?.length ? <p className="py-2 text-on-surface-variant">No line items yet.</p> : null}
          </div>

          <div className="flex flex-col gap-2 border-t border-outline-variant/15 pt-3 sm:flex-row sm:flex-wrap sm:items-center">
            {prescriptionPdfUrl ? (
              <a
                className="btn-primary btn-compact text-xs"
                href={prescriptionPdfUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open printable prescription (PDF)
              </a>
            ) : (
              <span className="text-[11px] text-on-surface-variant">
                Printable PDF appears here after you save the prescription PDF above.
              </span>
            )}
          </div>
        </VisitSection>
        </div>

        <VisitSection embed={embed} id="section-files" title="Attachments" defaultOpen={!embed}>
          <form action={uploadVisitAttachment} className="space-y-2" encType="multipart/form-data">
          <input type="hidden" name="visit_id" value={visit.id} />
            <input type="hidden" name="pet_id" value={petId} />
            <input type="hidden" name="branch_id" value={branchId} />
            <input className="input-file-soft input-file-compact max-w-md" name="file" type="file" required />
            <SubmitButton className="btn-secondary btn-compact text-xs" pendingLabel="Uploading…">
              Upload file
            </SubmitButton>
        </form>
          <ul className="space-y-1.5 text-[11px]">
            {attachments?.map((attachment) => (
              <li key={attachment.id} className="rounded-lg border border-outline-variant/15 px-2 py-1.5">
                <p className="font-medium">{attachment.file_name ?? "File"}</p>
                <p className="text-on-surface-variant">
                  {attachment.mime_type ?? "-"} · {new Date(attachment.created_at).toLocaleString()}
                </p>
              </li>
            ))}
            {!attachments?.length ? <li className="text-on-surface-variant">No attachments yet.</li> : null}
          </ul>
        </VisitSection>

        <div
          className={
            embed
              ? "mt-3 rounded-lg border border-primary/25 bg-primary-fixed/10 px-2 py-2 text-[11px]"
              : "mx-auto mt-4 flex max-w-5xl flex-col gap-2 rounded-xl border border-outline-variant/25 bg-surface-container-low/80 px-4 py-4"
          }
        >
          <p className={embed ? "text-slate-700" : "text-[12px] font-semibold text-on-surface"}>Save clinical visit</p>
          <p className={embed ? "text-[11px] text-slate-600" : "text-[11px] text-on-surface-variant"}>
            Saves clinical evaluation, SOAP fields, and completion status. Prescription lines save separately when you add or update them above.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" form="form-visit-record" className="btn-primary btn-compact">
              Save entire visit
            </button>
            <button
              type="submit"
              form="form-visit-record"
              name="complete_visit"
              value="true"
              className="btn-secondary btn-compact"
            >
              Complete visit
            </button>
          </div>
        </div>
      </div>
    </>
  );

  if (embed) {
    return (
      <div className="visit-embed min-h-screen bg-[#eef2f6] p-2 text-slate-900">
        <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold">{String(pet?.name ?? "Patient")}</p>
            <p className="truncate text-[10px] text-slate-600">Side panel · {species}</p>
              </div>
          <Link className="shrink-0 text-[11px] font-bold text-primary underline" href={`/visits/${visit.id}`}>
            Full page
              </Link>
            </div>
        {body}
      </div>
    );
  }

  return (
    <AppShell
      title="Visit consultation"
      subtitle={appt?.reason ? String(appt.reason) : "Clinical evaluation & treatment"}
      activeHref={`/visits/${visit.id}`}
      navGroups={navGroups}
      topRight={
        <div className="flex flex-wrap gap-2">
          {access.isSuperAdmin || ["doctor", "clinic_admin", "branch_admin"].includes(role) ? (
            <OpenClinicalWindowButton visitId={visit.id} petName={String(pet?.name ?? "Patient")} />
          ) : null}
          {canInvoice ? (
            <Link className="btn-primary btn-compact text-xs" href={`/visits/${visit.id}/invoice`}>
              Billing / invoice
            </Link>
          ) : null}
          <Link className="btn-secondary btn-compact text-xs" href="/appointments">
            Appointments
          </Link>
          <Link className="btn-secondary btn-compact text-xs" href="/medical-records">
            Medical records
          </Link>
        </div>
      }
    >
      {body}
    </AppShell>
  );
}
