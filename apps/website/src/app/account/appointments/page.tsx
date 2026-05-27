import Link from "next/link";
import { redirect } from "next/navigation";
import { getOwnerPortalContext } from "@/lib/owner/portal";
import { createClient } from "@/lib/supabase/server";

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

export default async function AccountAppointmentsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/account/appointments");

  const portal = await getOwnerPortalContext(user.id);
  if (!portal) redirect("/account");
  const { owner, clinic } = portal;

  const ownerEmail = user.email?.trim().toLowerCase() ?? null;
  let ownerIds = [owner.id];
  if (ownerEmail) {
    const { data: linkedOwners } = await supabase
      .from("owners")
      .select("id, email")
      .eq("clinic_id", clinic.id)
      .ilike("email", ownerEmail);
    const linkedIds = (linkedOwners ?? []).map((r) => r.id as string);
    ownerIds = Array.from(new Set([...ownerIds, ...linkedIds]));
  }

  const { data: rows } = await supabase
    .from("appointments")
    .select("id, starts_at, status, appointment_type, doctor_id, online_consult_paid_at, razorpay_payment_id, meet_link, pets(name)")
    .eq("clinic_id", clinic.id)
    .in("owner_id", ownerIds)
    .order("starts_at", { ascending: false })
    .limit(50);

  type Raw = {
    id: string;
    starts_at: string;
    status: string;
    appointment_type: string;
    doctor_id: string | null;
    online_consult_paid_at: string | null;
    razorpay_payment_id: string | null;
    meet_link: string | null;
    pets: { name: string } | null;
  };

  function normalizePets(pets: unknown): { name: string } | null {
    if (pets == null) return null;
    if (Array.isArray(pets)) {
      const first = pets[0];
      if (first && typeof first === "object" && first !== null && "name" in first) {
        return { name: String((first as { name: unknown }).name) };
      }
      return null;
    }
    if (typeof pets === "object" && pets !== null && "name" in pets) {
      return { name: String((pets as { name: unknown }).name) };
    }
    return null;
  }

  const raw: Raw[] = (rows ?? []).map((r) => ({
    id: r.id as string,
    starts_at: r.starts_at as string,
    status: r.status as string,
    appointment_type: r.appointment_type as string,
    doctor_id: (r.doctor_id as string | null) ?? null,
    online_consult_paid_at: (r.online_consult_paid_at as string | null) ?? null,
    razorpay_payment_id: (r.razorpay_payment_id as string | null) ?? null,
    meet_link: (r.meet_link as string | null) ?? null,
    pets: normalizePets(r.pets),
  }));

  const doctorIds = Array.from(
    new Set(raw.map((r) => r.doctor_id).filter((id): id is string => Boolean(id))),
  );
  const { data: doctors } =
    doctorIds.length > 0
      ? await supabase.from("staff_profiles").select("id, full_name").in("id", doctorIds)
      : { data: [] as { id: string; full_name: string }[] };
  const doctorName = Object.fromEntries((doctors ?? []).map((d) => [d.id, d.full_name]));

  const list = raw.map((a) => ({
    ...a,
    doctor_full_name: a.doctor_id ? doctorName[a.doctor_id] ?? null : null,
    is_paid_senior_vet:
      a.appointment_type === "online_consult" &&
      Boolean(a.online_consult_paid_at) &&
      Boolean(a.razorpay_payment_id) &&
      !String(a.razorpay_payment_id).startsWith("test_"),
  }));

  const paidSeniorVet = list.filter((a) => a.is_paid_senior_vet);

  return (
    <main className="bg-surface pb-20 pt-8 text-on-background sm:pt-12">
      <div className="mx-auto max-w-3xl px-6">
        <Link href="/account" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Pet owner portal
        </Link>
        <h1 className="mt-4 font-headline text-3xl font-extrabold tracking-tight">Appointments</h1>
        <p className="mt-2 text-on-surface-variant">
          Bookings at <strong className="text-on-surface">{clinic.name}</strong>. Need a new visit?{" "}
          <Link href="/book" className="font-semibold text-primary hover:underline">
            Schedule online
          </Link>
          .
        </p>

        {paidSeniorVet.length ? (
          <section className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
            <p className="text-sm font-semibold text-emerald-900">Paid Senior Vet appointments</p>
            <ul className="mt-3 space-y-2">
              {paidSeniorVet.slice(0, 5).map((a) => (
                <li key={`paid-${a.id}`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    {formatWhen(a.starts_at)} · {a.pets?.name ?? "Pet"} · {a.doctor_full_name ?? "Senior veterinarian"}
                  </span>
                  {a.meet_link ? (
                    <a href={a.meet_link} className="font-semibold text-primary underline">
                      Join call
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <ul className="mt-8 space-y-3">
          {list.length ? (
            list.map((a) => (
              <li
                key={a.id}
                className="clinical-shadow rounded-xl border border-surface-container-high bg-surface-container-lowest px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-headline font-bold text-on-surface">{a.pets?.name ?? "Pet"}</p>
                    <p className="text-sm capitalize text-on-surface-variant">
                      {a.appointment_type.replace(/_/g, " ")} · {a.doctor_full_name ?? "Veterinarian"}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium text-on-surface">{formatWhen(a.starts_at)}</p>
                    <p className="text-xs capitalize text-primary">{a.status.replace(/_/g, " ")}</p>
                  </div>
                </div>
                {a.appointment_type === "online_consult" && a.meet_link ? (
                  <div className="mt-3">
                    <a href={a.meet_link} className="text-sm font-semibold text-primary underline">
                      Join consultation
                    </a>
                  </div>
                ) : null}
              </li>
            ))
          ) : (
            <li className="rounded-xl border border-dashed border-outline-variant px-4 py-10 text-center text-sm text-on-surface-variant">
              No appointments yet.{" "}
              <Link href="/book" className="font-semibold text-primary hover:underline">
                Book your first visit
              </Link>
              .
            </li>
          )}
        </ul>
      </div>
    </main>
  );
}
