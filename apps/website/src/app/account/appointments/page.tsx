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
  const { clinic } = portal;

  const { data: rows, error } = await supabase.rpc("get_owner_portal_appointments", {
    p_clinic_id: clinic.id,
    p_limit: 50,
  });
  if (error) throw new Error(error.message);

  type Raw = {
    id: string;
    starts_at: string;
    status: string;
    appointment_type: string;
    doctor_id: string | null;
    online_consult_paid_at: string | null;
    razorpay_payment_id: string | null;
    meet_link: string | null;
    pet_name: string | null;
  };

  const raw: Raw[] = ((rows ?? []) as Raw[]).map((r) => ({
    id: r.id as string,
    starts_at: r.starts_at as string,
    status: r.status as string,
    appointment_type: r.appointment_type as string,
    doctor_id: (r.doctor_id as string | null) ?? null,
    online_consult_paid_at: (r.online_consult_paid_at as string | null) ?? null,
    razorpay_payment_id: (r.razorpay_payment_id as string | null) ?? null,
    meet_link: (r.meet_link as string | null) ?? null,
    pet_name: (r.pet_name as string | null) ?? null,
  }));

  const doctorIds = Array.from(new Set(raw.map((r) => r.doctor_id).filter((id): id is string => Boolean(id))));
  const { data: doctors } =
    doctorIds.length > 0
      ? await supabase.from("staff_profiles").select("id, full_name").in("id", doctorIds)
      : { data: [] as { id: string; full_name: string }[] };
  const doctorName = Object.fromEntries((doctors ?? []).map((d) => [d.id, d.full_name]));

  const list = raw.map((a) => ({
    ...a,
    pets: a.pet_name ? { name: a.pet_name } : null,
    doctor_full_name: a.doctor_id ? doctorName[a.doctor_id] ?? null : null,
    is_senior_vet_online: a.appointment_type === "online_consult" && Boolean(a.online_consult_paid_at),
  }));

  const seniorVetOnline = list.filter((a) => a.is_senior_vet_online);

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

        {seniorVetOnline.length ? (
          <section className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
            <p className="text-sm font-semibold text-emerald-900">Senior Vet online consultations</p>
            <ul className="mt-3 space-y-2">
              {seniorVetOnline.slice(0, 5).map((a) => (
                <li key={`sv-${a.id}`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
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
