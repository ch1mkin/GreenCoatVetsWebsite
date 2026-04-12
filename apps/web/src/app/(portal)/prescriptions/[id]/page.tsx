import Link from "next/link";
import { notFound } from "next/navigation";
import { regeneratePrescriptionPdfForm } from "@/app/(portal)/invoicing/actions";
import { addPrescriptionItem } from "../actions";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/web/submit-button";
import { resolveSignedImageUrl } from "@/lib/storage/resolve-signed-image-url";

function ownerDisplayName(owner: {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
} | null): string {
  if (!owner) return "—";
  const f = owner.first_name?.trim();
  const l = owner.last_name?.trim();
  if (f && l) return `${f} ${l}`;
  return owner.full_name?.trim() || "—";
}

export default async function PrescriptionDetailsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { rx_pdf?: string };
}) {
  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const [{ data: prescription, error: prescriptionError }, { data: items, error: itemsError }] =
    await Promise.all([
      supabase
        .from("prescriptions")
        .select(
          "id, issued_at, notes, pdf_url, visits(id, owners(first_name, last_name, full_name)), pets(name), staff_profiles(full_name)",
        )
        .eq("id", params.id)
        .eq("clinic_id", clinic_id)
        .maybeSingle(),
      supabase
        .from("prescription_items")
        .select("id, medicine_name, dosage, frequency, duration, instructions")
        .eq("prescription_id", params.id)
        .order("created_at", { ascending: true }),
    ]);

  if (prescriptionError) throw new Error(prescriptionError.message);
  if (itemsError) throw new Error(itemsError.message);
  if (!prescription) notFound();

  const prescriptionPdfUrl = prescription.pdf_url
    ? await resolveSignedImageUrl(supabase, prescription.pdf_url, { expiresIn: 3600 })
    : null;

  const visitRaw = prescription.visits as
    | { id?: string; owners?: { first_name?: string; last_name?: string; full_name?: string } }
    | { id?: string; owners?: { first_name?: string; last_name?: string; full_name?: string } }[]
    | null
    | undefined;
  const visitOne = Array.isArray(visitRaw) ? visitRaw[0] : visitRaw;
  const visitIdForLink = visitOne?.id;
  const ownerFromVisit = visitOne?.owners as
    | { first_name?: string; last_name?: string; full_name?: string }
    | { first_name?: string; last_name?: string; full_name?: string }[]
    | null
    | undefined;
  const ownerRow = Array.isArray(ownerFromVisit) ? ownerFromVisit[0] : ownerFromVisit;
  const ownerName = ownerDisplayName(ownerRow ?? null);
  const petRaw = prescription.pets as { name?: string } | { name?: string }[] | null | undefined;
  const petName = Array.isArray(petRaw) ? petRaw[0]?.name : petRaw?.name;
  const docRaw = prescription.staff_profiles as
    | { full_name?: string }
    | { full_name?: string }[]
    | null
    | undefined;
  const doctorName = Array.isArray(docRaw) ? docRaw[0]?.full_name : docRaw?.full_name;

  const showRxPdfBanner = searchParams?.rx_pdf === "1";

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-6 py-8">
      {showRxPdfBanner ? (
        <div
          role="status"
          className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 shadow-sm"
        >
          <p className="font-semibold text-emerald-900">Prescription PDF generated</p>
          <p className="mt-1 text-emerald-900/95">Use Download PDF or open the link in a new tab to print.</p>
        </div>
      ) : null}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Prescription</h1>
        <div className="flex flex-wrap gap-2">
          <form action={regeneratePrescriptionPdfForm}>
            <input type="hidden" name="prescription_id" value={prescription.id} />
            <input type="hidden" name="redirect_after" value="prescription" />
            <SubmitButton className="rounded-md border border-primary bg-primary/10 px-3 py-2 text-sm font-semibold text-primary" pendingLabel="PDF…">
              Generate PDF
            </SubmitButton>
          </form>
          {prescriptionPdfUrl ? (
            <a
              className="rounded-md border border-outline-variant px-3 py-2 text-sm font-semibold text-primary underline"
              href={prescriptionPdfUrl}
              target="_blank"
              rel="noreferrer"
            >
              Download PDF
            </a>
          ) : null}
          <span className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
            Or print (⌘/Ctrl+P)
          </span>
          <Link className="rounded-md border px-3 py-2" href={visitIdForLink ? `/visits/${visitIdForLink}` : "/appointments"}>
            Back to visit
          </Link>
        </div>
      </div>

      <section className="rounded-lg border p-4 text-sm">
        <p>
          <strong>Pet:</strong> {petName ?? "-"}
        </p>
        <p>
          <strong>Owner:</strong> {ownerName}
        </p>
        <p>
          <strong>Doctor:</strong> {doctorName ?? "-"}
        </p>
        <p>
          <strong>Issued at:</strong> {new Date(prescription.issued_at).toLocaleString()}
        </p>
        <p>
          <strong>Notes:</strong> {prescription.notes ?? "-"}
        </p>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-medium">Add Medicine</h2>
        <form action={addPrescriptionItem} className="grid gap-3 md:grid-cols-2">
          <input type="hidden" name="prescription_id" value={prescription.id} />
          <input className="rounded-md border px-3 py-2" name="medicine_name" placeholder="Medicine name" required />
          <input className="rounded-md border px-3 py-2" name="dosage" placeholder="Dosage" required />
          <input className="rounded-md border px-3 py-2" name="frequency" placeholder="Frequency" />
          <input className="rounded-md border px-3 py-2" name="duration" placeholder="Duration" />
          <textarea
            className="rounded-md border px-3 py-2 md:col-span-2"
            name="instructions"
            placeholder="Instructions"
          />
          <button className="rounded-md bg-black px-4 py-2 text-white md:col-span-2" type="submit">
            Add item
          </button>
        </form>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-medium">Prescription Items</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2">Medicine</th>
                <th className="py-2">Dosage</th>
                <th className="py-2">Frequency</th>
                <th className="py-2">Duration</th>
                <th className="py-2">Instructions</th>
              </tr>
            </thead>
            <tbody>
              {items?.map((item) => (
                <tr className="border-b" key={item.id}>
                  <td className="py-2">{item.medicine_name}</td>
                  <td className="py-2">{item.dosage}</td>
                  <td className="py-2">{item.frequency ?? "-"}</td>
                  <td className="py-2">{item.duration ?? "-"}</td>
                  <td className="py-2">{item.instructions ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items?.length ? <p className="pt-3 text-sm text-muted-foreground">No medicine items yet.</p> : null}
        </div>
      </section>
    </main>
  );
}
