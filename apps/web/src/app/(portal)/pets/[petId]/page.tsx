import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/web/app-shell";
import { RecordVisitBeacon } from "@/components/workspace/record-visit-beacon";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { formatInr } from "@/lib/format-currency";
import { buildSignedUrlMap, resolveSignedImageUrl, urlForDisplay } from "@/lib/storage/resolve-signed-image-url";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PATIENT_VIEWS = [
  { id: "details", label: "Details" },
  { id: "clinical", label: "Clinical records" },
  { id: "soc", label: "S.O.C." },
  { id: "financial", label: "Financial" },
  { id: "communication", label: "Communication" },
  { id: "boarding", label: "Boarding" },
  { id: "dental", label: "Dental" },
  { id: "images", label: "Image annotations" },
  { id: "summaries", label: "Summaries" },
  { id: "imaging", label: "Imaging" },
  { id: "medication", label: "Medication" },
  { id: "vaccinations", label: "Vaccinations" },
  { id: "appointments", label: "Appointments" },
  { id: "attachments", label: "Attachments" },
  { id: "merge", label: "Merge" },
] as const;

type ViewId = (typeof PATIENT_VIEWS)[number]["id"];

export default async function PetRecordPage({
  params,
  searchParams,
}: {
  params: { petId: string };
  searchParams: { view?: string };
}) {
  if (!UUID_RE.test(params.petId)) notFound();

  const access = await getUserAccess();
  if (!access.membership && !access.isSuperAdmin) redirect("/dashboard");
  const role = (access.membership?.role ?? (access.isSuperAdmin ? "super_admin" : "pet_owner")) as Parameters<
    typeof getRoleNavGroups
  >[0];
  if (
    !access.isSuperAdmin &&
    !["clinic_admin", "receptionist", "doctor", "branch_admin", "lab_technician"].includes(role)
  ) {
    redirect("/dashboard");
  }

  const { clinic_id } = await getActiveMembership();
  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);
  const supabase = createClient();

  const { data: pet, error } = await supabase
    .from("pets")
    .select(
      "id, name, species, breed, gender, date_of_birth, color, microchip_id, weight_kg, photo_url, is_active, owners(id, full_name, phone, email)"
    )
    .eq("id", params.petId)
    .eq("clinic_id", clinic_id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!pet) notFound();

  const view = (searchParams.view ?? "details") as ViewId;
  const safeView = PATIENT_VIEWS.some((v) => v.id === view) ? view : "details";

  const rawOwner = pet.owners as { full_name?: string; phone?: string; email?: string } | { full_name?: string }[] | null;
  const owner = Array.isArray(rawOwner) ? rawOwner[0] ?? null : rawOwner;
  const paths: string[] = [];
  if (pet.photo_url) paths.push(pet.photo_url);
  const signed = await buildSignedUrlMap(supabase, paths);
  const photo = urlForDisplay(pet.photo_url, signed);

  const { data: appts } = await supabase
    .from("appointments")
    .select("id, starts_at, appointment_type, status")
    .eq("clinic_id", clinic_id)
    .eq("pet_id", pet.id)
    .order("starts_at", { ascending: false })
    .limit(8);

  const rxRes = await supabase
    .from("prescriptions")
    .select("id, issued_at, notes, prescription_items(id, medicine_name, dosage, frequency, duration, instructions)")
    .eq("clinic_id", clinic_id)
    .eq("pet_id", pet.id)
    .order("issued_at", { ascending: false })
    .limit(20);

  const ownerId = ownerIdFromJoin(pet.owners);

  const ordersRes = ownerId
    ? await supabase
        .from("orders")
        .select("id, status, grand_total, placed_at, payment_reference")
        .eq("clinic_id", clinic_id)
        .eq("owner_id", ownerId)
        .order("placed_at", { ascending: false })
        .limit(30)
    : { data: [], error: null };

  const notificationsRes = ownerId
    ? await supabase
        .from("notifications")
        .select("id, channel, title, message, sent_at, created_at")
        .eq("clinic_id", clinic_id)
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false })
        .limit(40)
    : { data: [], error: null };

  const filesRes = await supabase
    .from("file_attachments")
    .select("id, file_name, mime_type, created_at, storage_bucket, storage_path")
    .eq("clinic_id", clinic_id)
    .eq("pet_id", pet.id)
    .order("created_at", { ascending: false })
    .limit(40);

  if (ordersRes.error) throw new Error(ordersRes.error.message);
  if (notificationsRes.error) throw new Error(notificationsRes.error.message);
  if (filesRes.error) throw new Error(filesRes.error.message);
  if (rxRes.error) throw new Error(rxRes.error.message);

  const petOrders = ordersRes.data ?? [];
  const petNotifications = notificationsRes.data ?? [];
  const petPrescriptions =
    (rxRes.data as Array<{
      id: string;
      issued_at: string;
      notes: string | null;
      prescription_items:
        | {
            id: string;
            medicine_name: string | null;
            dosage: string | null;
            frequency: string | null;
            duration: string | null;
            instructions: string | null;
          }[]
        | null;
    }>) ?? [];
  const rawPetFiles = filesRes.data ?? [];
  const petAttachmentRows = await Promise.all(
    rawPetFiles.map(async (row) => ({
      ...row,
      downloadUrl: await resolveSignedImageUrl(supabase, row.storage_path, {
        bucket: row.storage_bucket || "medical-files",
      }),
    }))
  );

  const patientTab = {
    id: pet.id,
    label: pet.name,
    href: `/pets/${pet.id}`,
    kind: "patient" as const,
  };

  return (
    <>
      <RecordVisitBeacon tab={patientTab} />
      <AppShell
        title={pet.name}
        subtitle={`Patient record · ${pet.species}${pet.breed ? ` · ${pet.breed}` : ""}`}
        activeHref="/pets"
        navGroups={navGroups}
        recordTabs={[patientTab]}
        topRight={
          <div className="flex flex-wrap gap-2">
            <Link className="btn-secondary text-sm" href={`/owners`}>
              Contacts
            </Link>
            <Link className="btn-primary text-sm" href="/pets">
              All patients
            </Link>
          </div>
        }
      >
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="card-soft w-full shrink-0 lg:max-w-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Record sidebar</p>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="mt-3 h-36 w-full rounded-lg object-cover" />
          ) : (
            <div className="mt-3 flex h-36 items-center justify-center rounded-lg bg-surface-container font-headline text-2xl font-bold text-primary">
              {pet.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="text-[10px] font-bold uppercase text-on-surface-variant">Owner</dt>
              <dd className="font-medium">{owner?.full_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase text-on-surface-variant">Status</dt>
              <dd>{pet.is_active ? "Active" : "Inactive"}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase text-on-surface-variant">Microchip</dt>
              <dd>{pet.microchip_id ?? "—"}</dd>
            </div>
          </dl>
          <div className="mt-4 border-t border-outline-variant/20 pt-3">
            <p className="text-[10px] font-bold uppercase text-on-surface-variant">Related</p>
            <Link className="mt-2 block text-sm font-semibold text-primary" href={`/medical-records?pet=${pet.id}`}>
              Open medical records
            </Link>
            <Link className="mt-1 block text-sm font-semibold text-primary" href={`/appointments`}>
              Scheduling
            </Link>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-outline-variant/25 pb-2">
            {PATIENT_VIEWS.map((v) => {
              const active = v.id === safeView;
              return (
                <Link
                  key={v.id}
                  href={`/pets/${pet.id}?view=${v.id}`}
                  className={
                    active
                      ? "shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white"
                      : "shrink-0 rounded-lg bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
                  }
                >
                  {v.label}
                </Link>
              );
            })}
          </div>

          <div className="mt-5">
            {safeView === "details" ? (
              <div className="card-soft grid gap-4 md:grid-cols-2">
                <Field label="Name" value={pet.name} />
                <Field label="Species" value={pet.species} />
                <Field label="Breed" value={pet.breed ?? "—"} />
                <Field label="Gender" value={pet.gender ?? "—"} />
                <Field label="Color" value={pet.color ?? "—"} />
                <Field label="Date of birth" value={pet.date_of_birth ?? "—"} />
                <Field label="Weight (kg)" value={pet.weight_kg != null ? String(pet.weight_kg) : "—"} />
                <Field label="Demeanor" value="—" />
              </div>
            ) : null}

            {safeView === "clinical" ? (
              <div className="card-soft space-y-3 text-sm">
                <p className="text-on-surface-variant">
                  Clinical encounters and SOAP notes live in the medical records module.
                </p>
                <Link className="btn-primary inline-flex text-sm" href={`/medical-records?pet=${pet.id}`}>
                  View clinical documentation
                </Link>
              </div>
            ) : null}

            {safeView === "appointments" ? (
              <div className="card-soft">
                <ul className="space-y-2 text-sm">
                  {(appts ?? []).map((a) => (
                    <li key={a.id} className="flex justify-between gap-2 border-b border-outline-variant/15 py-2 last:border-0">
                      <span>{a.appointment_type}</span>
                      <span className="text-on-surface-variant">{new Date(a.starts_at).toLocaleString()}</span>
                    </li>
                  ))}
                  {!appts?.length ? <li className="text-on-surface-variant">No appointments yet.</li> : null}
                </ul>
              </div>
            ) : null}

            {safeView === "vaccinations" ? (
              <div className="card-soft text-sm text-on-surface-variant">
                <Link href="/vaccinations" className="font-semibold text-primary">
                  Open vaccination register
                </Link>
                <p className="mt-2">Patient-specific vaccination history will appear here as visits are recorded.</p>
              </div>
            ) : null}

            {safeView === "medication" ? (
              <div className="card-soft text-sm">
                <p className="font-semibold text-on-background">Medication history from prescriptions</p>
                {petPrescriptions.length ? (
                  <div className="mt-3 space-y-3">
                    {petPrescriptions.map((rx) => (
                      <article key={rx.id} className="rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-3">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-bold uppercase tracking-wide text-primary">
                            {new Date(rx.issued_at).toLocaleDateString()}
                          </p>
                          <Link className="text-xs font-semibold text-primary hover:underline" href={`/prescriptions/${rx.id}`}>
                            Open prescription
                          </Link>
                        </div>
                        {rx.prescription_items?.length ? (
                          <ul className="space-y-2">
                            {rx.prescription_items.map((item) => (
                              <li key={item.id} className="rounded-md border border-outline-variant/10 px-2 py-1.5">
                                <p className="font-medium text-on-background">{item.medicine_name ?? "Medication"}</p>
                                <p className="text-xs text-on-surface-variant">
                                  {item.dosage ?? "—"} · {item.frequency ?? "—"} · {item.duration ?? "—"}
                                </p>
                                {item.instructions ? (
                                  <p className="mt-0.5 text-xs text-on-surface-variant">{item.instructions}</p>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-on-surface-variant">No medication items on this prescription.</p>
                        )}
                        {rx.notes ? <p className="mt-2 text-xs text-on-surface-variant">Notes: {rx.notes}</p> : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-on-surface-variant">No prescriptions found for this patient yet.</p>
                )}
              </div>
            ) : null}

            {safeView === "financial" ? (
              <div className="card-soft space-y-4 text-sm">
                <p className="text-on-surface-variant">
                  Orders placed under this patient&apos;s owner account (household ecommerce).
                </p>
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold text-on-background">Recent orders</span>
                  <Link className="text-xs font-bold text-primary hover:underline" href="/payments">
                    Payments
                  </Link>
                </div>
                {petOrders.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-outline-variant/20 text-[10px] font-bold uppercase text-on-surface-variant">
                          <th className="py-2 pr-2">Placed</th>
                          <th className="py-2 pr-2">Status</th>
                          <th className="py-2 pr-2">Total</th>
                          <th className="py-2">Ref</th>
                        </tr>
                      </thead>
                      <tbody>
                        {petOrders.map((o) => (
                          <tr key={o.id} className="border-b border-outline-variant/10">
                            <td className="py-2 pr-2 text-on-surface-variant">
                              {new Date(o.placed_at).toLocaleString()}
                            </td>
                            <td className="py-2 pr-2 font-medium">{o.status}</td>
                            <td className="py-2 pr-2">{formatInr(o.grand_total)}</td>
                            <td className="py-2 text-on-surface-variant">{o.payment_reference ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-on-surface-variant">No orders for this owner yet.</p>
                )}
              </div>
            ) : null}

            {safeView === "communication" ? (
              <div className="card-soft text-sm">
                <p className="text-on-surface-variant">
                  Messages and reminders sent to this patient&apos;s owner (same household account).
                </p>
                {petNotifications.length ? (
                  <ul className="mt-3 space-y-2">
                    {petNotifications.map((n) => (
                      <li
                        key={n.id}
                        className="rounded-lg border border-outline-variant/15 bg-surface-container-lowest px-3 py-2"
                      >
                        <div className="flex flex-wrap justify-between gap-2 text-xs">
                          <span className="font-bold uppercase text-primary">{n.channel}</span>
                          <span className="text-on-surface-variant">
                            {n.sent_at
                              ? new Date(n.sent_at).toLocaleString()
                              : new Date(n.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1 font-medium">{n.title}</p>
                        <p className="text-on-surface-variant">{n.message}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-on-surface-variant">No notifications logged for this owner.</p>
                )}
              </div>
            ) : null}

            {safeView === "attachments" ? (
              <div className="card-soft text-sm">
                <p className="font-semibold text-on-background">Files linked to this patient</p>
                {petAttachmentRows.length ? (
                  <ul className="mt-3 divide-y divide-outline-variant/15">
                    {petAttachmentRows.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <div>
                          <p className="font-medium">{a.file_name ?? "Untitled"}</p>
                          <p className="text-xs text-on-surface-variant">
                            {a.mime_type ?? "unknown"} · {new Date(a.created_at).toLocaleString()}
                          </p>
                        </div>
                        {a.downloadUrl ? (
                          <a
                            className="shrink-0 rounded-lg bg-primary/10 px-2 py-1 text-xs font-bold text-primary hover:bg-primary/20"
                            href={a.downloadUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Download
                          </a>
                        ) : (
                          <span className="text-xs text-on-surface-variant">Unavailable</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-on-surface-variant">No attachments stored for this patient.</p>
                )}
              </div>
            ) : null}

            {["soc", "boarding", "dental", "images", "summaries", "imaging", "merge"].includes(
              safeView
            ) ? (
              <div className="card-soft text-sm text-on-surface-variant">
                <p className="font-medium text-on-background">This section is being brought to parity with your data model.</p>
                <p className="mt-2">
                  Standard-of-care schedules, boarding, dental charts, imaging annotations, summaries, imaging reports,
                  and record merge will connect to existing visits and billing in upcoming iterations.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function ownerIdFromJoin(owners: unknown): string | null {
  if (owners == null) return null;
  if (Array.isArray(owners)) return (owners[0] as { id?: string })?.id ?? null;
  return (owners as { id?: string }).id ?? null;
}
