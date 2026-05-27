import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "—";
  }
}

export default async function StaffOnlineConsultsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/staff/online-consults");

  const { data: membership } = await supabase
    .from("user_clinic_memberships")
    .select("clinic_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const allowedRoles = new Set(["super_admin", "clinic_admin", "branch_admin", "doctor", "senior_doctor"]);
  if (!membership?.clinic_id || !membership.role || !allowedRoles.has(membership.role)) {
    redirect("/account");
  }

  const { data: rows } = await supabase
    .from("appointments")
    .select("id, starts_at, status, meet_link, online_consult_paid_at, razorpay_payment_id, owners(full_name, email), pets(name)")
    .eq("clinic_id", membership.clinic_id)
    .eq("appointment_type", "online_consult")
    .not("online_consult_paid_at", "is", null)
    .order("starts_at", { ascending: false })
    .limit(100);

  const list = (rows ?? []).map((row) => {
    const ownerRaw = row.owners as { full_name?: string | null; email?: string | null } | { full_name?: string | null; email?: string | null }[] | null;
    const owner = Array.isArray(ownerRaw) ? ownerRaw[0] : ownerRaw;
    const petRaw = row.pets as { name?: string | null } | { name?: string | null }[] | null;
    const pet = Array.isArray(petRaw) ? petRaw[0] : petRaw;
    const paymentId = (row.razorpay_payment_id as string | null) ?? null;
    const paidLive = Boolean(paymentId && !paymentId.startsWith("test_"));
    return {
      id: row.id as string,
      starts_at: row.starts_at as string | null,
      status: row.status as string,
      meet_link: (row.meet_link as string | null) ?? null,
      owner_name: owner?.full_name ?? "Owner",
      owner_email: owner?.email ?? "—",
      pet_name: pet?.name ?? "Pet",
      paid_live: paidLive,
      payment_id: paymentId ?? "—",
    };
  });

  return (
    <main className="bg-surface pb-20 pt-8 text-on-background sm:pt-12">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-headline text-3xl font-extrabold tracking-tight">Senior Vet online consults</h1>
            <p className="mt-2 text-sm text-on-surface-variant">Website view for senior doctors and admins.</p>
          </div>
          <Link href="/account" className="text-sm font-semibold text-primary underline">
            Account
          </Link>
        </div>

        <div className="overflow-x-auto rounded-xl border border-outline-variant/30 bg-surface-container-lowest">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface-container-low text-on-surface-variant">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Pet</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Join</th>
              </tr>
            </thead>
            <tbody>
              {list.map((item) => (
                <tr key={item.id} className="border-t border-outline-variant/20">
                  <td className="px-4 py-3">{formatWhen(item.starts_at)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{item.owner_name}</p>
                    <p className="text-xs text-on-surface-variant">{item.owner_email}</p>
                  </td>
                  <td className="px-4 py-3">{item.pet_name}</td>
                  <td className="px-4 py-3 capitalize">{item.status.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3">
                    {item.paid_live ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">Paid</span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Test</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {item.meet_link ? (
                      <a className="text-sm font-semibold text-primary underline" href={item.meet_link} target="_blank" rel="noreferrer">
                        Open call
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 ? <p className="px-4 py-8 text-center text-sm text-on-surface-variant">No paid online consults yet.</p> : null}
        </div>
      </div>
    </main>
  );
}
