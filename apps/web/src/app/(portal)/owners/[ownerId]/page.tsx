import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/web/app-shell";
import { RecordVisitBeacon } from "@/components/workspace/record-visit-beacon";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { formatInr } from "@/lib/format-currency";
import { updateOwnerContactNotes } from "../actions";
import { buildSignedUrlMap, resolveSignedImageUrl, urlForDisplay } from "@/lib/storage/resolve-signed-image-url";
import { SubmitButton } from "@/components/web/submit-button";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CONTACT_VIEWS = [
  { id: "details", label: "Details" },
  { id: "patients", label: "Patients" },
  { id: "appointments", label: "Appointments" },
  { id: "financial", label: "Financial" },
  { id: "communication", label: "Communication" },
  { id: "attachments", label: "Attachments" },
  { id: "merge", label: "Merge" },
] as const;

type ViewId = (typeof CONTACT_VIEWS)[number]["id"];

/** Per-contact record is always resolved at request time; avoids stale dev worker issues. */
export const dynamic = "force-dynamic";

export default async function ContactRecordPage({
  params,
  searchParams,
}: {
  params: { ownerId: string };
  searchParams: { view?: string };
}) {
  if (!UUID_RE.test(params.ownerId)) notFound();

  const access = await getUserAccess();
  if (!access.membership && !access.isSuperAdmin) redirect("/dashboard");
  const role = (access.membership?.role ?? (access.isSuperAdmin ? "super_admin" : "pet_owner")) as Parameters<
    typeof getRoleNavGroups
  >[0];
  if (
    !access.isSuperAdmin &&
    !["clinic_admin", "receptionist", "doctor", "branch_admin"].includes(role)
  ) {
    redirect("/dashboard");
  }

  const { clinic_id } = await getActiveMembership();
  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);
  const supabase = createClient();

  const { data: owner, error } = await supabase
    .from("owners")
    .select(
      "id, title, first_name, last_name, full_name, phone, email, address, city, state, postal_code, country, postal_address, postal_city, business_name, website, contact_notes, contact_notes_important, post_mail_to_physical, photo_url, created_at"
    )
    .eq("id", params.ownerId)
    .eq("clinic_id", clinic_id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!owner) notFound();

  const displayName =
    [owner.title, owner.first_name, owner.last_name]
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter(Boolean)
      .join(" ")
      .trim() || "—";

  const view = (searchParams.view ?? "details") as ViewId;
  const safeView = CONTACT_VIEWS.some((v) => v.id === view) ? view : "details";

  const { data: pets } = await supabase
    .from("pets")
    .select("id, name, species, breed, photo_url, is_active, created_at")
    .eq("clinic_id", clinic_id)
    .eq("owner_id", owner.id)
    .order("name", { ascending: true });

  const petIds = (pets ?? []).map((p) => p.id);
  let appointments: unknown[] | null = null;
  if (petIds.length > 0) {
    const { data: appts } = await supabase
      .from("appointments")
      .select("id, starts_at, appointment_type, status, pets(name)")
      .eq("clinic_id", clinic_id)
      .in("pet_id", petIds)
      .order("starts_at", { ascending: false })
      .limit(20);
    appointments = appts ?? null;
  }

  const [ordersRes, notificationsRes, inquiriesRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, status, grand_total, placed_at, payment_reference")
      .eq("clinic_id", clinic_id)
      .eq("owner_id", owner.id)
      .order("placed_at", { ascending: false })
      .limit(40),
    supabase
      .from("notifications")
      .select("id, channel, title, message, sent_at, created_at")
      .eq("clinic_id", clinic_id)
      .eq("owner_id", owner.id)
      .order("created_at", { ascending: false })
      .limit(50),
    owner.email
      ? supabase
          .from("contact_inquiries")
          .select("id, name, email, message, status, created_at")
          .eq("clinic_id", clinic_id)
          .eq("email", owner.email)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (ordersRes.error) throw new Error(ordersRes.error.message);
  if (notificationsRes.error) throw new Error(notificationsRes.error.message);
  if (inquiriesRes.error) throw new Error(inquiriesRes.error.message);

  const orders = ordersRes.data ?? [];
  const notifications = notificationsRes.data ?? [];
  const inquiries = (inquiriesRes.data ?? []) as {
    id: string;
    name: string;
    email: string;
    message: string;
    status: string;
    created_at: string;
  }[];

  const attachmentsQueryRes = petIds.length
    ? await supabase
        .from("file_attachments")
        .select("id, file_name, mime_type, created_at, storage_bucket, storage_path, pet_id, pets(name)")
        .eq("clinic_id", clinic_id)
        .in("pet_id", petIds)
        .order("created_at", { ascending: false })
        .limit(60)
    : { data: [], error: null };

  if (attachmentsQueryRes.error) throw new Error(attachmentsQueryRes.error.message);

  const rawAttachments = attachmentsQueryRes.data ?? [];
  const attachmentRows = await Promise.all(
    rawAttachments.map(async (row) => {
      const url = await resolveSignedImageUrl(supabase, row.storage_path, {
        bucket: row.storage_bucket || "medical-files",
      });
      const pn = row.pets as { name?: string } | { name?: string }[] | null;
      const petLabel =
        pn == null ? "—" : Array.isArray(pn) ? (pn[0] as { name?: string })?.name ?? "—" : (pn as { name?: string }).name ?? "—";
      return { ...row, downloadUrl: url, petLabel };
    })
  );

  const paths: string[] = [];
  if (owner.photo_url) paths.push(owner.photo_url);
  for (const p of pets ?? []) {
    if (p.photo_url) paths.push(p.photo_url);
  }
  const signed = await buildSignedUrlMap(supabase, paths);
  const avatar = urlForDisplay(owner.photo_url, signed);

  const tabBeacon = {
    id: owner.id,
    label: owner.full_name,
    href: `/owners/${owner.id}`,
    kind: "contact" as const,
  };

  return (
    <>
      <RecordVisitBeacon tab={tabBeacon} />
      <AppShell
        title={owner.full_name}
        subtitle="Contact record"
        activeHref="/owners"
        navGroups={navGroups}
        recordTabs={[tabBeacon]}
        topRight={
          <div className="flex flex-wrap gap-2">
            <Link className="btn-secondary text-sm" href="/pets">
              Patients
            </Link>
            <Link className="btn-primary text-sm" href="/owners">
              All contacts
            </Link>
          </div>
        }
      >
        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="card-soft w-full shrink-0 lg:max-w-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Record sidebar</p>
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="mt-3 h-36 w-full rounded-lg object-cover" />
            ) : (
              <div className="mt-3 flex h-36 items-center justify-center rounded-lg bg-surface-container font-headline text-2xl font-bold text-primary">
                {owner.full_name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <dl className="mt-4 space-y-2 text-sm">
              <div>
                <dt className="text-[10px] font-bold uppercase text-on-surface-variant">Phone</dt>
                <dd className="font-medium">{owner.phone}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-on-surface-variant">Email</dt>
                <dd className="break-all">{owner.email ?? "—"}</dd>
              </div>
            </dl>
            <div className="mt-4 border-t border-outline-variant/20 pt-3">
              <p className="text-[10px] font-bold uppercase text-on-surface-variant">Patients</p>
              <ul className="mt-2 space-y-1 text-sm">
                {(pets ?? []).slice(0, 6).map((p) => (
                  <li key={p.id}>
                    <Link className="font-semibold text-primary hover:underline" href={`/pets/${p.id}`}>
                      {p.name}
                    </Link>
                    <span className="text-on-surface-variant"> · {p.species}</span>
                  </li>
                ))}
                {!pets?.length ? <li className="text-on-surface-variant">No patients yet.</li> : null}
              </ul>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-outline-variant/25 pb-2">
              {CONTACT_VIEWS.map((v) => {
                const active = v.id === safeView;
                return (
                  <Link
                    key={v.id}
                    href={`/owners/${owner.id}?view=${v.id}`}
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
                <div className="space-y-4">
                  <div className="card-soft grid gap-4 md:grid-cols-2">
                    <Field label="Full name" value={owner.full_name} />
                    <Field label="Display" value={displayName} />
                    <Field label="Phone" value={owner.phone} />
                    <Field label="Email" value={owner.email ?? "—"} />
                    <Field label="Business" value={owner.business_name ?? "—"} />
                    <Field label="Website" value={owner.website ?? "—"} />
                    <Field label="City" value={owner.city ?? "—"} />
                    <Field label="State / Region" value={owner.state ?? "—"} />
                    <Field label="Postal code" value={owner.postal_code ?? "—"} />
                    <Field label="Country" value={owner.country ?? "—"} />
                    <Field label="Address" value={owner.address ?? "—"} />
                  </div>
                  <div
                    className={`card-soft border-l-4 ${
                      owner.contact_notes_important ? "border-error bg-error-container/30" : "border-outline-variant/30"
                    }`}
                  >
                    <h3 className="text-sm font-bold text-on-background">Contact notes</h3>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Shown to staff; mark important to highlight for billing and scheduling.
                    </p>
                    <form action={updateOwnerContactNotes} className="mt-3 space-y-2">
                      <input type="hidden" name="owner_id" value={owner.id} />
                      <textarea
                        className="input-soft min-h-[100px] w-full"
                        name="contact_notes"
                        placeholder="Notes about this client…"
                        defaultValue={owner.contact_notes ?? ""}
                      />
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="contact_notes_important"
                          defaultChecked={Boolean(owner.contact_notes_important)}
                        />
                        <span className="font-semibold text-error">Notes important</span>
                      </label>
                      <SubmitButton className="btn-primary text-sm" pendingLabel="Saving notes…">
                        Save notes
                      </SubmitButton>
                    </form>
                  </div>
                </div>
              ) : null}

              {safeView === "patients" ? (
                <div className="card-soft space-y-3">
                  {(pets ?? []).map((p) => {
                    const img = urlForDisplay(p.photo_url, signed);
                    return (
                      <Link
                        key={p.id}
                        href={`/pets/${p.id}`}
                        className="flex items-center gap-3 rounded-xl border border-outline-variant/15 p-3 transition-colors hover:bg-surface-container-low"
                      >
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt="" className="h-12 w-12 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-container text-sm font-bold text-primary">
                            {p.name.slice(0, 1)}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold">{p.name}</p>
                          <p className="text-xs text-on-surface-variant">
                            {p.species}
                            {p.breed ? ` · ${p.breed}` : ""}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                  {!pets?.length ? <p className="text-sm text-on-surface-variant">No patients linked.</p> : null}
                </div>
              ) : null}

              {safeView === "appointments" ? (
                <div className="card-soft">
                  <ul className="space-y-2 text-sm">
                    {(appointments ?? []).map((raw) => {
                      const a = raw as {
                        id: string;
                        starts_at: string;
                        appointment_type: string;
                        pets: unknown;
                      };
                      const petName =
                        a.pets == null
                          ? "—"
                          : Array.isArray(a.pets)
                            ? (a.pets[0] as { name?: string })?.name ?? "—"
                            : (a.pets as { name?: string }).name ?? "—";
                      return (
                        <li
                          key={a.id}
                          className="flex justify-between gap-2 border-b border-outline-variant/15 py-2 last:border-0"
                        >
                          <span>
                            {a.appointment_type} · {petName}
                          </span>
                          <span className="text-on-surface-variant">{new Date(a.starts_at).toLocaleString()}</span>
                        </li>
                      );
                    })}
                    {!appointments?.length ? (
                      <li className="text-on-surface-variant">No appointments for this contact&apos;s patients.</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}

              {safeView === "financial" ? (
                <div className="card-soft space-y-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-on-background">Ecommerce orders (household)</p>
                    <Link className="text-xs font-bold text-primary hover:underline" href="/payments">
                      Payments / POS
                    </Link>
                  </div>
                  {orders.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[520px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-outline-variant/20 text-[10px] font-bold uppercase text-on-surface-variant">
                            <th className="py-2 pr-2">Placed</th>
                            <th className="py-2 pr-2">Status</th>
                            <th className="py-2 pr-2">Total</th>
                            <th className="py-2">Reference</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.map((o) => (
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
                    <p className="text-on-surface-variant">No orders linked to this contact yet.</p>
                  )}
                </div>
              ) : null}

              {safeView === "communication" ? (
                <div className="space-y-4 text-sm">
                  <div className="card-soft">
                    <p className="font-semibold text-on-background">Notifications (email / SMS / WhatsApp)</p>
                    {notifications.length ? (
                      <ul className="mt-3 space-y-2">
                        {notifications.map((n) => (
                          <li
                            key={n.id}
                            className="rounded-lg border border-outline-variant/15 bg-surface-container-lowest px-3 py-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
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
                      <p className="mt-2 text-on-surface-variant">No notification log for this contact.</p>
                    )}
                  </div>
                  {owner.email ? (
                    <div className="card-soft">
                      <p className="font-semibold text-on-background">Website inquiries (matching email)</p>
                      {inquiries.length ? (
                        <ul className="mt-3 space-y-2">
                          {inquiries.map((q) => (
                            <li
                              key={q.id}
                              className="rounded-lg border border-outline-variant/15 px-3 py-2 text-on-background"
                            >
                              <div className="flex justify-between gap-2 text-xs text-on-surface-variant">
                                <span>{new Date(q.created_at).toLocaleString()}</span>
                                <span className="font-bold uppercase">{q.status}</span>
                              </div>
                              <p className="mt-1 text-sm">{q.message}</p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-on-surface-variant">No contact form threads for this email.</p>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {safeView === "attachments" ? (
                <div className="card-soft text-sm">
                  <p className="font-semibold text-on-background">Files linked to this contact&apos;s patients</p>
                  {attachmentRows.length ? (
                    <ul className="mt-3 divide-y divide-outline-variant/15">
                      {attachmentRows.map((a) => (
                        <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                          <div>
                            <p className="font-medium">{a.file_name ?? "Untitled file"}</p>
                            <p className="text-xs text-on-surface-variant">
                              Patient: {a.petLabel} · {a.mime_type ?? "unknown type"} ·{" "}
                              {new Date(a.created_at).toLocaleString()}
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
                    <p className="mt-2 text-on-surface-variant">No file attachments for patients under this contact.</p>
                  )}
                </div>
              ) : null}

              {safeView === "merge" ? (
                <div className="card-soft text-sm text-on-surface-variant">
                  <p className="font-medium text-on-background">Merge duplicate contacts</p>
                  <p className="mt-2">Record merge will be available when duplicate detection is enabled.</p>
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
