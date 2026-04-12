import Link from "next/link";
import { redirect } from "next/navigation";
import { getOwnerPortalContext } from "@/lib/owner/portal";
import { orderStatusLabel } from "@/lib/store/order-status-label";
import { createClient } from "@/lib/supabase/server";

export default async function AccountOrdersPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const portal = await getOwnerPortalContext(user.id);
  if (!portal?.owner) {
    return (
      <main className="mx-auto w-full max-w-3xl space-y-4 px-6 py-8">
        <h1 className="text-3xl font-semibold">My Orders</h1>
        <p className="text-sm text-muted-foreground">No pet owner profile linked to this account.</p>
      </main>
    );
  }

  const clinicId = portal.clinic.id;

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, status, grand_total, placed_at, payment_provider, payment_reference, shipping_address, notes")
    .eq("clinic_id", clinicId)
    .eq("owner_id", portal.owner.id)
    .order("placed_at", { ascending: false })
    .limit(50);
  if (ordersError) throw new Error(ordersError.message);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold sm:text-3xl">My Orders</h1>
        <Link className="rounded-xl border border-outline-variant px-4 py-2 text-center text-sm font-medium" href="/account">
          Back to account
        </Link>
      </div>
      <p className="text-sm text-on-surface-variant">
        Delivery updates: <strong>Paid</strong> → <strong>Processing</strong> → <strong>Shipped</strong> → <strong>Delivered</strong>. Your clinic
        updates status as the order moves along.
      </p>
      <section className="rounded-2xl border border-outline-variant/40 p-3 sm:p-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant/40">
                <th className="py-2 pr-2">Placed</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Total</th>
                <th className="py-2 pr-2">Payment</th>
                <th className="py-2">Reference</th>
              </tr>
            </thead>
            <tbody>
              {orders?.map((order) => (
                <tr className="border-b border-outline-variant/20" key={order.id}>
                  <td className="py-3 pr-2 align-top">{new Date(order.placed_at).toLocaleString()}</td>
                  <td className="py-3 pr-2 align-top font-medium">{orderStatusLabel(order.status as string)}</td>
                  <td className="py-3 pr-2 align-top">₹{Number(order.grand_total).toFixed(0)}</td>
                  <td className="py-3 pr-2 align-top">{order.payment_provider ?? "—"}</td>
                  <td className="py-3 align-top text-xs text-muted-foreground">{order.payment_reference ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!orders?.length ? <p className="pt-3 text-sm text-muted-foreground">No orders yet.</p> : null}
        </div>
      </section>
    </main>
  );
}
