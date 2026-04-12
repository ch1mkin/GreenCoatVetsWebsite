import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createProduct, createProductCategory, placeOrder, updateOrderStatus } from "./actions";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/web/app-shell";
import { ClinicContextPicker } from "@/components/web/clinic-context-picker";
import type { AppRole } from "@/lib/auth/permissions";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { resolvePortalClinicContext } from "@/lib/portal/resolve-clinic-context";
import { formatInr } from "@/lib/format-currency";
import { SubmitButton } from "@/components/web/submit-button";

type SearchParams = {
  q?: string;
  clinic_id?: string;
};

function ownerNameFromOrder(owners: unknown): string {
  if (owners == null) return "—";
  if (Array.isArray(owners)) return (owners[0] as { full_name?: string } | undefined)?.full_name ?? "—";
  return (owners as { full_name?: string }).full_name ?? "—";
}

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  price: number | string;
  stock_quantity: number;
  requires_prescription: boolean;
  image_url: string | null;
  summary: string | null;
  description: string | null;
  branches: { name?: string } | null;
  inventory_items: { name?: string } | null;
  product_categories: { name?: string } | null;
};

export default async function EcommercePage({
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

  const role = (access.membership?.role ?? (access.isSuperAdmin ? "super_admin" : "pet_owner")) as AppRole;
  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);
  const canUpdateOrderStatus =
    access.isSuperAdmin || role === "clinic_admin" || role === "branch_admin";
  const canManageProducts = access.isSuperAdmin || role === "clinic_admin";

  const query = (searchParams.q ?? "").trim();
  const { clinicId, clinicName, clinicsForPicker } = await resolvePortalClinicContext(access, searchParams);

  const [branchesRes, inventoryRes, ownersRes, categoriesRes] = await Promise.all([
    supabase
      .from("branches")
      .select("id, name")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("inventory_items")
      .select("id, name, sku, stock_quantity")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .order("name", { ascending: true })
      .limit(300),
    supabase
      .from("owners")
      .select("id, full_name")
      .eq("clinic_id", clinicId)
      .order("full_name", { ascending: true })
      .limit(300),
    supabase
      .from("product_categories")
      .select("id, name, slug, description")
      .eq("clinic_id", clinicId)
      .order("name", { ascending: true })
      .limit(200),
  ]);

  if (branchesRes.error) throw new Error(branchesRes.error.message);
  if (inventoryRes.error) throw new Error(inventoryRes.error.message);
  if (ownersRes.error) throw new Error(ownersRes.error.message);
  if (categoriesRes.error) throw new Error(categoriesRes.error.message);

  let productsQuery = supabase
    .from("products")
    .select(
      "id, name, slug, price, stock_quantity, requires_prescription, image_url, branches(name), inventory_items(name), product_categories(name)"
    )
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(100);

  if (query) {
    productsQuery = productsQuery.or(`name.ilike.%${query}%,slug.ilike.%${query}%`);
  }

  const { data: productsRaw, error: productsError } = await productsQuery;
  if (productsError) throw new Error(productsError.message);
  const products = (productsRaw ?? []) as unknown as ProductRow[];

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, status, grand_total, placed_at, owners(full_name)")
    .eq("clinic_id", clinicId)
    .order("placed_at", { ascending: false })
    .limit(20);
  if (ordersError) throw new Error(ordersError.message);

  const categories = categoriesRes.data ?? [];
  const bento = [
    {
      title: categories[0]?.name ?? "Prescription & diets",
      body: categories[0]?.description ?? "Products linked to clinical care plans and recovery.",
      className: "md:col-span-5 bg-surface-container-low",
      badge: "Essential",
      icon: "restaurant",
    },
    {
      title: categories[1]?.name ?? "Supplements",
      body: categories[1]?.description ?? "Vitamins and wellness support.",
      className: "md:col-span-3 bg-secondary-container",
      badge: null as string | null,
      icon: "pill",
      titleClass: "text-on-secondary-container",
      bodyClass: "text-on-secondary-container/80",
    },
    {
      title: categories[2]?.name ?? "Toys & care",
      body: categories[2]?.description ?? "Enrichment and everyday essentials.",
      className: "md:col-span-4 bg-tertiary-fixed",
      badge: null as string | null,
      icon: "toys",
      titleClass: "text-on-tertiary-fixed",
      bodyClass: "text-on-tertiary-fixed/70",
    },
  ];

  const featured = query ? products : products.slice(0, 8);

  async function signOut() {
    "use server";
    const sb = createClient();
    await sb.auth.signOut();
    redirect("/login");
  }

  return (
    <AppShell
      title="Clinic shop"
      subtitle={`Catalog & orders for ${clinicName ?? "this clinic"}. Products are stored per clinic and appear on the public website and pet owner app for that clinic.`}
      activeHref="/ecommerce"
      navGroups={navGroups}
      topRight={
        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn-secondary" href="/payments">
            Payments
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
      {access.isSuperAdmin && clinicsForPicker.length > 0 ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-outline-variant/20 bg-surface-container-low px-4 py-3">
          <Suspense fallback={null}>
            <ClinicContextPicker value={clinicId} clinics={clinicsForPicker} />
          </Suspense>
          <p className="text-xs text-on-surface-variant">
            Super admin: switch clinic to manage another tenant&apos;s catalog.
          </p>
        </div>
      ) : null}

      <section className="mb-10">
        <div className="relative flex min-h-[16rem] flex-col justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary-container to-primary p-8 text-white md:min-h-[20rem] md:p-10">
          <div className="relative z-10 max-w-lg">
            <h2 className="font-headline text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
              Expert care, delivered to pet owners.
            </h2>
            <p className="mb-6 mt-3 font-medium text-primary-fixed opacity-95">
              All prices are in Indian Rupees (INR). Offer subscriptions or in-clinic pickup from your catalog.
            </p>
            <a
              className="inline-flex w-max items-center gap-2 rounded-xl bg-surface-container-lowest px-8 py-3 font-bold text-primary transition-all hover:bg-opacity-90"
              href="#catalog"
            >
              Browse catalog <span className="material-symbols-outlined">arrow_forward</span>
            </a>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <form className="relative mb-4 flex flex-col gap-3 sm:flex-row sm:items-stretch" method="get">
          <input type="hidden" name="clinic_id" value={clinicId} />
          <div className="relative flex-1">
            <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 z-[1] -translate-y-1/2 text-on-surface-variant/50">
              search
            </span>
            <input
              className="input-soft w-full rounded-xl border border-outline-variant/30 py-4 pl-12 pr-4 shadow-sm"
              name="q"
              defaultValue={query}
              placeholder="Search by product name or slug…"
              aria-label="Search products"
            />
          </div>
          <div className="flex gap-2 sm:shrink-0">
            <SubmitButton className="btn-primary min-h-[52px] px-6">Search</SubmitButton>
            {query ? (
              <Link
                className="inline-flex min-h-[52px] items-center justify-center rounded-xl border border-outline-variant px-4 text-sm font-semibold"
                href={clinicId ? `/ecommerce?clinic_id=${clinicId}` : "/ecommerce"}
              >
                Clear
              </Link>
            ) : null}
          </div>
        </form>
        {query ? (
          <p className="mb-6 text-sm text-on-surface-variant">
            {products.length} result{products.length === 1 ? "" : "s"} for &quot;{query}&quot; — showing in the grid below.
          </p>
        ) : (
          <p className="mb-6 text-sm text-on-surface-variant">Search is scoped to this clinic&apos;s catalog only.</p>
        )}

        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-headline text-2xl font-bold text-on-background">Explore categories</h2>
          <span className="text-sm font-semibold text-primary">{categories.length} in database</span>
        </div>
        <div className="grid h-auto grid-cols-1 gap-6 md:grid-cols-12 md:h-72">
          {bento.map((tile, i) => (
            <div
              key={`${tile.title}-${i}`}
              className={`flex flex-col justify-between rounded-xl p-8 transition-colors ${tile.className} ${
                i === 0 ? "group cursor-pointer hover:bg-surface-container-high" : "cursor-default hover:opacity-95"
              }`}
            >
              <div>
                {tile.badge ? (
                  <span className="mb-4 inline-block rounded-full bg-on-primary-container/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary-fixed-dim">
                    {tile.badge}
                  </span>
                ) : null}
                <h3 className={`font-headline text-xl font-bold md:text-2xl ${tile.titleClass ?? "text-on-surface"}`}>
                  {tile.title}
                </h3>
                <p className={`mt-2 max-w-xs text-sm ${tile.bodyClass ?? "text-on-surface-variant"}`}>{tile.body}</p>
              </div>
              <div className="flex justify-end">
                <span
                  className={`material-symbols-outlined text-4xl opacity-20 transition-opacity ${
                    i === 0 ? "text-primary group-hover:opacity-100" : ""
                  } ${tile.titleClass?.includes("secondary") ? "text-secondary opacity-30" : ""} ${
                    tile.titleClass?.includes("tertiary") ? "text-tertiary opacity-30" : ""
                  }`}
                >
                  {tile.icon}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12" id="catalog">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-headline text-2xl font-bold text-on-background">Catalog</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((product) => {
            const cat = product.product_categories?.name ?? "Product";
            return (
              <div
                key={product.id}
                className="group flex flex-col overflow-hidden rounded-xl bg-surface-container-lowest transition-all duration-300 hover:shadow-[0_12px_32px_rgba(23,28,31,0.06)]"
              >
                <div className="relative flex h-56 items-center justify-center overflow-hidden bg-surface-container-low p-6">
                  {product.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote clinic URLs; no fixed domain allowlist
                    <img
                      src={product.image_url}
                      alt=""
                      className="h-full w-full object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-6xl text-primary/25">inventory_2</span>
                  )}
                  {product.requires_prescription ? (
                    <div className="absolute left-4 top-4">
                      <span className="rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase text-white">
                        Rx
                      </span>
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <span className="mb-1 text-xs font-medium uppercase tracking-wider text-on-surface-variant">{cat}</span>
                  <h4 className="mb-2 font-headline text-lg font-bold leading-tight text-on-background">{product.name}</h4>
                  <p className="mb-4 line-clamp-2 text-xs text-on-surface-variant">
                    {product.summary?.trim() || product.description?.trim() || `Stock: ${product.stock_quantity}`}
                  </p>
                  <div className="mt-auto flex items-center justify-between border-t border-outline-variant/10 pt-4">
                    <span className="font-headline text-xl font-extrabold text-on-background">
                      {formatInr(product.price)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {!featured.length ? (
          <p className="mt-6 text-sm text-on-surface-variant">No products yet — create one below.</p>
        ) : null}
      </section>

      <section className="mb-12 rounded-3xl border border-outline-variant/10 bg-surface-container-low p-8 md:p-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <div className="flex-1">
            <h2 className="font-headline mb-3 text-2xl font-extrabold text-on-background md:text-3xl">
              Never run out of essentials.
            </h2>
            <p className="text-on-surface-variant">
              Use inventory links on products to keep stock aligned. Owners see prices in INR at checkout.
            </p>
          </div>
          <div className="w-full md:w-auto">
            <Link className="btn-primary inline-flex rounded-xl px-8 py-4" href="/inventory">
              Manage inventory
            </Link>
          </div>
        </div>
      </section>

      {canManageProducts ? (
        <section id="product-categories" className="mb-8 rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
          <h3 className="font-headline mb-1 text-lg font-bold text-on-background">Product categories</h3>
          <p className="mb-4 text-sm text-on-surface-variant">
            Create categories for <strong>{clinicName ?? "this clinic"}</strong>, then pick one when you create or edit a product. Uses the
            same clinic context as the picker above for super admins.
          </p>
          <form action={createProductCategory} className="grid gap-3 sm:grid-cols-12 sm:items-end">
            <input type="hidden" name="context_clinic_id" value={clinicId} />
            <label className="grid gap-1 text-sm sm:col-span-4">
              <span className="font-semibold text-on-surface">Category name</span>
              <input className="input-soft" name="category_name" placeholder="e.g. Prescription diets" required />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-4">
              <span className="font-semibold text-on-surface">URL slug (optional)</span>
              <input className="input-soft" name="category_slug" placeholder="prescription-diets — auto from name if empty" />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-3">
              <span className="font-semibold text-on-surface">Description (optional)</span>
              <input className="input-soft" name="category_description" placeholder="Shown on marketing tiles" />
            </label>
            <div className="sm:col-span-1">
              <SubmitButton className="btn-primary w-full px-3 py-1.5 text-sm font-semibold sm:w-auto">Add</SubmitButton>
            </div>
          </form>
          {categories.length ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {categories.map((c) => (
                <li
                  key={c.id}
                  className="rounded-full border border-outline-variant/20 bg-surface-container-low px-3 py-1 text-xs font-medium text-on-surface"
                >
                  {c.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-on-surface-variant">No categories yet — add one above.</p>
          )}
        </section>
      ) : null}

      <section className="mb-12 grid gap-8 lg:grid-cols-2">
        <div className="rounded-3xl bg-surface-container-lowest p-6 shadow-sm">
          <h3 className="font-headline mb-4 text-lg font-bold">Create product</h3>
          <p className="mb-4 text-sm text-on-surface-variant">
            Add catalog details here; use <strong>Edit</strong> in the table below for full images, gallery URLs, and long descriptions.
          </p>
          <form action={createProduct} encType="multipart/form-data" className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="context_clinic_id" value={clinicId} />
            <input className="input-soft" name="name" placeholder="Product name" required />
            <input className="input-soft" name="slug" placeholder="product-slug" required />
            <select className="input-soft" name="branch_id">
              <option value="">Branch (optional)</option>
              {branchesRes.data?.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            <select className="input-soft" name="category_id">
              <option value="">Category (optional)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select className="input-soft" name="inventory_item_id">
              <option value="">Link inventory item</option>
              {inventoryRes.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.sku})
                </option>
              ))}
            </select>
            <input className="input-soft" name="price" type="number" step="0.01" placeholder="Price (INR)" />
            <input className="input-soft" name="compare_at_price" type="number" step="0.01" placeholder="Compare-at (optional)" />
            <input className="input-soft md:col-span-2" name="summary" placeholder="Short summary (store cards)" />
            <textarea
              className="input-soft min-h-[88px] resize-y md:col-span-2"
              name="description"
              placeholder="Full description (product page)"
            />
            <input className="input-soft md:col-span-2" name="image_url" type="url" placeholder="Primary image URL (https), optional" />
            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-medium text-on-surface">Or upload primary image</span>
              <input className="text-sm" name="primary_image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-medium text-on-surface">Gallery URLs (one per line, optional)</span>
              <textarea className="input-soft min-h-[72px] font-mono text-xs" name="gallery_urls" placeholder="https://…" />
            </label>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" name="requires_prescription" />
              Requires prescription
            </label>
            <div className="md:col-span-2">
              <SubmitButton className="btn-primary px-3 py-1.5 text-sm font-semibold">Save product</SubmitButton>
            </div>
          </form>
        </div>

        <div className="rounded-3xl bg-surface-container-lowest p-6 shadow-sm">
          <h3 className="font-headline mb-4 text-lg font-bold">Place order</h3>
          <form action={placeOrder} className="grid gap-3">
            <input type="hidden" name="context_clinic_id" value={clinicId} />
            <select className="input-soft" name="owner_id" required>
              <option value="">Select owner</option>
              {ownersRes.data?.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.full_name}
                </option>
              ))}
            </select>
            <select className="input-soft" name="product_id" required>
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} (stock: {product.stock_quantity})
                </option>
              ))}
            </select>
            <input className="input-soft" name="quantity" type="number" min={1} step={1} defaultValue={1} required />
            <SubmitButton className="btn-primary">
              Place order
            </SubmitButton>
          </form>
        </div>
      </section>

      <section className="mb-8 rounded-3xl border border-outline-variant/10 bg-white/80 p-6">
        <h3 className="font-headline mb-4 text-lg font-bold">All products</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              <tr className="border-b border-outline-variant/20">
                <th className="py-3 pr-4">Name</th>
                <th className="py-3 pr-4">Slug</th>
                <th className="py-3 pr-4">Price</th>
                <th className="py-3 pr-4">Stock</th>
                <th className="py-3 pr-4">Branch</th>
                <th className="py-3 pr-4">Category</th>
                <th className="py-3 pr-4">Inventory</th>
                <th className="py-3 pr-4">Rx</th>
                {canManageProducts ? <th className="py-3">Edit</th> : null}
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr className="border-b border-outline-variant/10" key={product.id}>
                  <td className="py-3 pr-4 font-medium">{product.name}</td>
                  <td className="py-3 pr-4">{product.slug}</td>
                  <td className="py-3 pr-4">{formatInr(product.price)}</td>
                  <td className="py-3 pr-4">{product.stock_quantity}</td>
                  <td className="py-3 pr-4">{product.branches?.name ?? "—"}</td>
                  <td className="py-3 pr-4">{product.product_categories?.name ?? "—"}</td>
                  <td className="py-3 pr-4">{product.inventory_items?.name ?? "—"}</td>
                  <td className="py-3 pr-4">{product.requires_prescription ? "Yes" : "No"}</td>
                  {canManageProducts ? (
                    <td className="py-3">
                      <Link
                        className="font-semibold text-primary hover:underline"
                        href={
                          clinicId
                            ? `/ecommerce/product/${product.id}/edit?clinic_id=${clinicId}`
                            : `/ecommerce/product/${product.id}/edit`
                        }
                      >
                        Edit
                      </Link>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          {!products.length ? <p className="pt-4 text-sm text-on-surface-variant">No products found.</p> : null}
        </div>
      </section>

      <section className="rounded-3xl bg-surface-container-low p-6">
        <h3 className="font-headline mb-4 text-lg font-bold">Recent orders</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              <tr className="border-b border-outline-variant/20">
                <th className="py-3 pr-4">Placed</th>
                <th className="py-3 pr-4">Owner</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3">Total (INR)</th>
              </tr>
            </thead>
            <tbody>
              {orders?.map((order) => (
                <tr className="border-b border-outline-variant/10" key={order.id}>
                  <td className="py-3 pr-4">{new Date(order.placed_at).toLocaleString()}</td>
                  <td className="py-3 pr-4">{ownerNameFromOrder(order.owners)}</td>
                  <td className="py-3 pr-4 capitalize">
                    {canUpdateOrderStatus ? (
                      <form action={updateOrderStatus} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="context_clinic_id" value={clinicId} />
                        <input type="hidden" name="order_id" value={order.id} />
                        <select
                          name="status"
                          defaultValue={order.status as string}
                          className="rounded-lg border border-outline-variant bg-surface px-2 py-1 text-xs font-medium"
                        >
                          <option value="pending">pending</option>
                          <option value="paid">paid</option>
                          <option value="processing">processing</option>
                          <option value="shipped">shipped</option>
                          <option value="delivered">delivered</option>
                          <option value="cancelled">cancelled</option>
                          <option value="refunded">refunded</option>
                        </select>
                        <SubmitButton className="rounded-lg bg-primary px-2 py-1 text-xs font-bold text-on-primary">
                          Set
                        </SubmitButton>
                      </form>
                    ) : (
                      order.status
                    )}
                  </td>
                  <td className="py-3 font-semibold">{formatInr(order.grand_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!orders?.length ? <p className="pt-4 text-sm text-on-surface-variant">No orders yet.</p> : null}
        </div>
      </section>
    </AppShell>
  );
}
