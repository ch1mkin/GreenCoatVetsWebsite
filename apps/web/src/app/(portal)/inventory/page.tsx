import Link from "next/link";
import { redirect } from "next/navigation";
import { adjustInventoryStock, createInventoryItem, createSupplier } from "./actions";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/web/app-shell";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { formatInr } from "@/lib/format-currency";
import { SubmitButton } from "@/components/web/submit-button";

type SearchParams = {
  q?: string;
  alert?: string;
};

type InventoryRow = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  stock_quantity: number;
  reorder_level: number | null;
  price: number | string | null;
  requires_prescription: boolean;
  branches: { name?: string } | null;
  suppliers: { name?: string } | null;
};

function reorderOf(item: InventoryRow) {
  return item.reorder_level ?? 5;
}

function movementItemName(inv: unknown): string {
  if (inv == null) return "—";
  if (Array.isArray(inv)) return (inv[0] as { name?: string } | undefined)?.name ?? "—";
  return (inv as { name?: string }).name ?? "—";
}

function categoryIcon(cat: string) {
  const c = cat.toLowerCase();
  if (c.includes("vacc")) return "vaccines";
  if (c.includes("med") || c.includes("drug") || c.includes("tab")) return "medication";
  if (c.includes("supply") || c.includes("gauze") || c.includes("needle")) return "sanitizer";
  return "inventory_2";
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const access = await getUserAccess();
  if (!access.membership && !access.isSuperAdmin) redirect("/dashboard");

  const role = (access.membership?.role ?? (access.isSuperAdmin ? "super_admin" : "pet_owner")) as Parameters<
    typeof getRoleNavGroups
  >[0];
  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);

  const query = (searchParams.q ?? "").trim();
  const alert = (searchParams.alert ?? "all").trim();
  const { clinic_id } = await getActiveMembership();

  const [branchesRes, suppliersRes, alertScanRes] = await Promise.all([
    supabase
      .from("branches")
      .select("id, name")
      .eq("clinic_id", clinic_id)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("suppliers")
      .select("id, name")
      .eq("clinic_id", clinic_id)
      .order("name", { ascending: true }),
    supabase
      .from("inventory_items")
      .select("id, name, stock_quantity, reorder_level, expiry_date, category, sku, batch_number")
      .eq("clinic_id", clinic_id)
      .eq("is_active", true)
      .limit(400),
  ]);

  if (branchesRes.error) throw new Error(branchesRes.error.message);
  if (suppliersRes.error) throw new Error(suppliersRes.error.message);
  if (alertScanRes.error) throw new Error(alertScanRes.error.message);

  const today = new Date().toISOString().slice(0, 10);
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  let itemsQuery = supabase
    .from("inventory_items")
    .select(
      "id, sku, name, category, batch_number, expiry_date, stock_quantity, reorder_level, price, requires_prescription, branches(name), suppliers(name)"
    )
    .eq("clinic_id", clinic_id)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (query) {
    itemsQuery = itemsQuery.or(`name.ilike.%${query}%,sku.ilike.%${query}%,category.ilike.%${query}%`);
  }

  if (alert === "low_stock") {
    itemsQuery = itemsQuery.lte("stock_quantity", 5);
  } else if (alert === "expiry_soon") {
    itemsQuery = itemsQuery.gte("expiry_date", today).lte("expiry_date", in30Days);
  } else if (alert === "expired") {
    itemsQuery = itemsQuery.lt("expiry_date", today);
  }

  const { data: itemsRaw, error: itemsError } = await itemsQuery;
  if (itemsError) throw new Error(itemsError.message);
  const items = (itemsRaw ?? []) as InventoryRow[];

  const { data: movements, error: movementsError } = await supabase
    .from("inventory_movements")
    .select("id, movement_type, quantity, notes, created_at, inventory_items(name)")
    .eq("clinic_id", clinic_id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (movementsError) throw new Error(movementsError.message);

  const scan = (alertScanRes.data ?? []) as InventoryRow[];
  const lowStockAlerts = scan
    .filter((row) => row.stock_quantity <= reorderOf(row))
    .slice(0, 12);
  const expiringAlerts = scan
    .filter((row) => row.expiry_date && row.expiry_date >= today && row.expiry_date <= in30Days)
    .slice(0, 12);

  const byCategory = new Map<string, InventoryRow[]>();
  for (const item of items) {
    const key = item.category?.trim() || "Uncategorized";
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(item);
  }
  const categoryKeys = Array.from(byCategory.keys()).sort((a, b) => {
    if (a === "Uncategorized") return 1;
    if (b === "Uncategorized") return -1;
    return a.localeCompare(b);
  });

  async function signOut() {
    "use server";
    const sb = createClient();
    await sb.auth.signOut();
    redirect("/login");
  }

  return (
    <AppShell
      title="Inventory"
      subtitle="Stock, batches, and INR unit pricing — pharmacy & supplies."
      activeHref="/inventory"
      navGroups={navGroups}
      topRight={
        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn-secondary" href="/ecommerce">
            Shop
          </Link>
          <Link className="btn-primary" href="/dashboard">
            Dashboard
          </Link>
          <form action={signOut}>
            <button
              className="rounded-xl border border-outline-variant/30 px-3 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      }
    >
      <section className="mb-8 max-w-3xl">
        <div className="relative mb-6">
          <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50">
            search
          </span>
          <form method="get">
            <input type="hidden" name="alert" value={alert} />
            <input
              className="input-soft w-full rounded-xl border-none py-3 pl-12 pr-4"
              name="q"
              defaultValue={query}
              placeholder="Search inventory…"
            />
          </form>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-headline text-2xl font-extrabold tracking-tight text-on-background">Inventory</h2>
          <Link
            href="#add-item"
            className="flex items-center gap-2 rounded-full bg-gradient-to-br from-primary-container to-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Add item
          </Link>
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>
            warning
          </span>
          <h3 className="font-headline text-sm font-bold uppercase tracking-widest text-on-surface-variant">
            Critical alerts
          </h3>
        </div>
        <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
          {lowStockAlerts.slice(0, 6).map((row) => {
            const cap = Math.max(1, reorderOf(row) * 4);
            const pct = Math.min(100, Math.round((row.stock_quantity / cap) * 100));
            return (
              <div
                key={`low-${row.id}`}
                className="min-w-[200px] rounded-xxl border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-[0_12px_32px_rgba(23,28,31,0.06)]"
              >
                <div className="mb-2 flex items-start justify-between">
                  <span className="rounded bg-tertiary-fixed px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter text-on-tertiary-fixed">
                    Low stock
                  </span>
                  <span className="material-symbols-outlined text-lg text-tertiary">inventory_2</span>
                </div>
                <p className="font-headline mb-1 text-sm font-bold text-on-background">{row.name}</p>
                <p className="text-xs text-on-surface-variant">
                  {row.stock_quantity} left (reorder ≤ {reorderOf(row)})
                </p>
                <div className="mt-3 h-1.5 w-full rounded-full bg-surface-container">
                  <div className="h-1.5 rounded-full bg-tertiary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          {expiringAlerts.slice(0, 6).map((row) => {
            const pct = row.expiry_date ? 70 : 20;
            return (
              <div
                key={`exp-${row.id}`}
                className="min-w-[200px] rounded-xxl border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-[0_12px_32px_rgba(23,28,31,0.06)]"
              >
                <div className="mb-2 flex items-start justify-between">
                  <span className="rounded bg-tertiary-fixed px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter text-on-tertiary-fixed">
                    Expiring soon
                  </span>
                  <span className="material-symbols-outlined text-lg text-tertiary">event</span>
                </div>
                <p className="font-headline mb-1 text-sm font-bold text-on-background">{row.name}</p>
                <p className="text-xs text-on-surface-variant">
                  {row.stock_quantity} units · {row.expiry_date ?? "—"}
                </p>
                <div className="mt-3 h-1.5 w-full rounded-full bg-surface-container">
                  <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          {!lowStockAlerts.length && !expiringAlerts.length ? (
            <p className="text-sm text-on-surface-variant">No critical alerts in the scanned catalog.</p>
          ) : null}
        </div>
      </section>

      <section className="mb-10 rounded-3xl bg-surface-container-low p-6">
        <h3 className="font-headline mb-4 text-sm font-bold text-on-background">Filters</h3>
        <form className="grid gap-3 md:grid-cols-3" method="get">
          <input
            className="input-soft"
            name="q"
            defaultValue={query}
            placeholder="Search SKU, name, category"
          />
          <select className="input-soft" name="alert" defaultValue={alert}>
            <option value="all">All items</option>
            <option value="low_stock">Low stock</option>
            <option value="expiry_soon">Expiry within 30 days</option>
            <option value="expired">Expired</option>
          </select>
          <SubmitButton className="btn-primary rounded-full">
            Apply
          </SubmitButton>
        </form>
      </section>

      <section className="mb-12 grid gap-8 lg:grid-cols-2">
        <div className="rounded-3xl bg-surface-container-lowest p-6 shadow-sm">
          <h3 className="font-headline mb-4 text-lg font-bold">Create supplier</h3>
          <form action={createSupplier} className="grid gap-3">
            <input className="input-soft" name="name" placeholder="Supplier name" required />
            <input className="input-soft" name="contact_name" placeholder="Contact name" />
            <input className="input-soft" name="phone" placeholder="Phone" />
            <input className="input-soft" name="email" placeholder="Email" />
            <SubmitButton className="btn-primary">
              Save supplier
            </SubmitButton>
          </form>
        </div>

        <div className="rounded-3xl bg-surface-container-lowest p-6 shadow-sm" id="add-item">
          <h3 className="font-headline mb-4 text-lg font-bold">Create inventory item</h3>
          <form action={createInventoryItem} className="grid gap-3 md:grid-cols-2">
            <select className="input-soft" name="branch_id" required>
              <option value="">Select branch</option>
              {branchesRes.data?.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            <select className="input-soft" name="supplier_id">
              <option value="">Select supplier</option>
              {suppliersRes.data?.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            <input className="input-soft" name="sku" placeholder="SKU" required />
            <input className="input-soft" name="name" placeholder="Item name" required />
            <input className="input-soft" name="category" placeholder="Category" />
            <input className="input-soft" name="batch_number" placeholder="Batch number" />
            <input className="input-soft" type="date" name="expiry_date" />
            <input className="input-soft" name="price" type="number" step="0.01" placeholder="Price (INR)" />
            <input className="input-soft" name="stock_quantity" type="number" step="1" placeholder="Initial stock" />
            <input className="input-soft" name="reorder_level" type="number" step="1" placeholder="Reorder level (default 5)" />
            <label className="md:col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" name="requires_prescription" />
              Requires prescription verification
            </label>
            <SubmitButton className="btn-primary md:col-span-2">
              Save item
            </SubmitButton>
          </form>
        </div>
      </section>

      <section className="space-y-10">
        {categoryKeys.map((cat) => {
          const rows = byCategory.get(cat) ?? [];
          return (
            <div key={cat}>
              <div className="mb-4 flex items-end justify-between px-1">
                <h3 className="font-headline text-xl font-extrabold text-primary">{cat}</h3>
                <span className="text-xs font-medium text-on-surface-variant">{rows.length} items</span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {rows.map((item) => {
                  const low = item.stock_quantity <= reorderOf(item);
                  const icon = categoryIcon(cat);
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between rounded-xxl p-5 transition-all hover:bg-surface-container-low ${
                        low ? "bg-surface-container-low opacity-90" : "bg-surface-container-lowest"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                            low ? "bg-surface-container-lowest text-tertiary" : "bg-surface-container-low text-primary"
                          }`}
                        >
                          <span className="material-symbols-outlined">{low ? "error" : icon}</span>
                        </div>
                        <div>
                          <h4 className="font-bold text-on-background">{item.name}</h4>
                          <p className="text-xs text-on-surface-variant">
                            {item.batch_number ? `Batch ${item.batch_number}` : item.sku}
                            {item.price != null && item.price !== "" ? ` · ${formatInr(item.price)}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-headline text-lg font-extrabold text-on-background">{item.stock_quantity}</p>
                        <span
                          className={`text-[10px] font-bold uppercase ${
                            low
                              ? "rounded bg-tertiary-fixed px-1.5 py-0.5 text-on-tertiary-container"
                              : "rounded bg-on-primary-fixed-variant/15 px-1.5 py-0.5 text-primary-fixed-dim"
                          }`}
                        >
                          {low ? "Reorder" : "Stable"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {!items.length ? <p className="text-sm text-on-surface-variant">No inventory items match.</p> : null}
      </section>

      <section className="mt-12 rounded-3xl border border-outline-variant/10 bg-white/80 p-6">
        <h3 className="font-headline mb-4 text-lg font-bold">Adjust stock &amp; details</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              <tr className="border-b border-outline-variant/20">
                <th className="py-3 pr-4">SKU</th>
                <th className="py-3 pr-4">Item</th>
                <th className="py-3 pr-4">Branch</th>
                <th className="py-3 pr-4">Supplier</th>
                <th className="py-3 pr-4">Stock</th>
                <th className="py-3 pr-4">Reorder</th>
                <th className="py-3 pr-4">Expiry</th>
                <th className="py-3">Adjust</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr className="border-b border-outline-variant/10 align-top" key={item.id}>
                  <td className="py-3 pr-4">{item.sku}</td>
                  <td className="py-3 pr-4">
                    {item.name}
                    <div className="text-xs text-on-surface-variant">{item.category ?? "—"}</div>
                  </td>
                  <td className="py-3 pr-4">{item.branches?.name ?? "—"}</td>
                  <td className="py-3 pr-4">{item.suppliers?.name ?? "—"}</td>
                  <td className="py-3 pr-4">{item.stock_quantity}</td>
                  <td className="py-3 pr-4">{item.reorder_level ?? "—"}</td>
                  <td className="py-3 pr-4">{item.expiry_date ?? "—"}</td>
                  <td className="py-3">
                    <form action={adjustInventoryStock} className="flex flex-wrap gap-2">
                      <input type="hidden" name="inventory_item_id" value={item.id} />
                      <input
                        className="input-soft w-20 py-1.5 text-sm"
                        name="delta"
                        type="number"
                        step="1"
                        placeholder="+/-"
                        required
                      />
                      <input className="input-soft min-w-[120px] flex-1 py-1.5 text-sm" name="notes" placeholder="Reason" />
                      <button
                        className="rounded-xl border border-outline-variant/40 px-3 py-1.5 text-sm font-semibold hover:bg-surface-container-low"
                        type="submit"
                      >
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 rounded-3xl bg-surface-container-low p-6">
        <h3 className="font-headline mb-4 text-lg font-bold">Recent stock movements</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              <tr className="border-b border-outline-variant/20">
                <th className="py-3 pr-4">When</th>
                <th className="py-3 pr-4">Item</th>
                <th className="py-3 pr-4">Type</th>
                <th className="py-3 pr-4">Qty</th>
                <th className="py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {movements?.map((movement) => (
                <tr className="border-b border-outline-variant/10" key={movement.id}>
                  <td className="py-3 pr-4">{new Date(movement.created_at).toLocaleString()}</td>
                  <td className="py-3 pr-4">{movementItemName(movement.inventory_items)}</td>
                  <td className="py-3 pr-4">{movement.movement_type}</td>
                  <td className="py-3 pr-4">{movement.quantity}</td>
                  <td className="py-3">{movement.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!movements?.length ? <p className="pt-4 text-sm text-on-surface-variant">No stock movement history yet.</p> : null}
        </div>
      </section>
    </AppShell>
  );
}
