import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { updateProduct } from "../../../actions";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/web/app-shell";
import { ClinicContextPicker } from "@/components/web/clinic-context-picker";
import type { AppRole } from "@/lib/auth/permissions";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { resolvePortalClinicContext } from "@/lib/portal/resolve-clinic-context";
import { SubmitButton } from "@/components/web/submit-button";
import { formatInr } from "@/lib/format-currency";
import { Suspense } from "react";

function parseImageUrls(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.filter((x): x is string => typeof x === "string" && /^https?:\/\//i.test(x));
  }
  return [];
}

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: { productId: string };
  searchParams: { clinic_id?: string };
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

  const canEdit = access.isSuperAdmin || role === "clinic_admin";
  if (!canEdit) redirect("/ecommerce");

  const { clinicId, clinicName, clinicsForPicker } = await resolvePortalClinicContext(access, searchParams);

  const { data: product, error: productError } = await supabase
    .from("products")
    .select(
      "id, name, slug, description, summary, price, compare_at_price, stock_quantity, requires_prescription, branch_id, category_id, inventory_item_id, image_url, image_urls, seo_title, seo_description",
    )
    .eq("id", params.productId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (productError) throw new Error(productError.message);
  if (!product) notFound();

  const galleryLines = parseImageUrls((product as { image_urls?: unknown }).image_urls).join("\n");

  const [branchesRes, inventoryRes, categoriesRes] = await Promise.all([
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
      .from("product_categories")
      .select("id, name")
      .eq("clinic_id", clinicId)
      .order("name", { ascending: true })
      .limit(200),
  ]);

  if (branchesRes.error) throw new Error(branchesRes.error.message);
  if (inventoryRes.error) throw new Error(inventoryRes.error.message);
  if (categoriesRes.error) throw new Error(categoriesRes.error.message);

  const backHref = clinicId ? `/ecommerce?clinic_id=${clinicId}` : "/ecommerce";

  async function signOut() {
    "use server";
    const sb = createClient();
    await sb.auth.signOut();
    redirect("/login");
  }

  return (
    <AppShell
      title="Edit product"
      subtitle={`Catalog content for ${clinicName ?? "this clinic"} — images, description, and pricing shown on the public store and owner app.`}
      activeHref="/ecommerce"
      navGroups={navGroups}
      topRight={
        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn-secondary" href={backHref}>
            Back to shop
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
          <p className="text-xs text-on-surface-variant">Switch clinic to edit another tenant&apos;s catalog.</p>
        </div>
      ) : null}

      <div className="mx-auto max-w-3xl space-y-8">
        <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm md:p-8">
          <h2 className="font-headline mb-1 text-xl font-bold text-on-background">{product.name}</h2>
          <p className="mb-6 text-sm text-on-surface-variant">
            Current price {formatInr(product.price as number)} · Stock {(product as { stock_quantity: number }).stock_quantity}
          </p>

          <form action={updateProduct} encType="multipart/form-data" className="grid gap-4">
            <input type="hidden" name="context_clinic_id" value={clinicId} />
            <input type="hidden" name="product_id" value={product.id} />

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-on-surface">Name</span>
                <input className="input-soft" name="name" required defaultValue={product.name} />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-on-surface">URL slug</span>
                <input className="input-soft" name="slug" required defaultValue={product.slug} />
              </label>
            </div>

            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-semibold text-on-surface">Short summary</span>
              <span className="text-xs text-on-surface-variant">One or two lines for store cards &amp; search snippets.</span>
              <input
                className="input-soft"
                name="summary"
                defaultValue={(product as { summary?: string | null }).summary ?? ""}
                placeholder="e.g. Grain-free adult formula for small breeds"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-on-surface">Full description</span>
              <span className="text-xs text-on-surface-variant">Shown on product page (Amazon-style detail section).</span>
              <textarea
                className="input-soft min-h-[140px] resize-y"
                name="description"
                defaultValue={(product as { description?: string | null }).description ?? ""}
                placeholder="Ingredients, sizing, usage, warranty…"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-on-surface">Price (INR)</span>
                <input
                  className="input-soft"
                  name="price"
                  type="number"
                  step="0.01"
                  required
                  defaultValue={String(product.price)}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-on-surface">Compare-at price (optional)</span>
                <input
                  className="input-soft"
                  name="compare_at_price"
                  type="number"
                  step="0.01"
                  placeholder="MSRP / was price"
                  defaultValue={
                    (product as { compare_at_price?: number | null }).compare_at_price != null
                      ? String((product as { compare_at_price?: number | null }).compare_at_price)
                      : ""
                  }
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-on-surface">Branch</span>
                <select className="input-soft" name="branch_id" defaultValue={(product as { branch_id?: string | null }).branch_id ?? ""}>
                  <option value="">Any / online</option>
                  {branchesRes.data?.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-on-surface">Category</span>
                <select className="input-soft" name="category_id" defaultValue={(product as { category_id?: string | null }).category_id ?? ""}>
                  <option value="">Uncategorized</option>
                  {categoriesRes.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-xs text-on-surface-variant">
              Need a new category?{" "}
              <Link className="font-semibold text-primary hover:underline" href={`${backHref}#product-categories`}>
                Create one on the shop page
              </Link>{" "}
              (same clinic context), then refresh this page.
            </p>

            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-on-surface">Inventory link</span>
              <select
                className="input-soft"
                name="inventory_item_id"
                defaultValue={(product as { inventory_item_id?: string | null }).inventory_item_id ?? ""}
              >
                <option value="">Not linked</option>
                {inventoryRes.data?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.sku})
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="requires_prescription" defaultChecked={product.requires_prescription} />
              Requires prescription
            </label>

            <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
              <h3 className="font-headline mb-3 text-sm font-bold text-on-background">Images</h3>
              <p className="mb-4 text-xs text-on-surface-variant">
                Primary image is the hero on the store and app. Upload replaces the current hero. Additional URLs appear in the gallery on the
                website product page.
              </p>
              {(product as { image_url?: string | null }).image_url ? (
                <div className="mb-4 flex flex-wrap items-start gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={(product as { image_url: string }).image_url}
                    alt=""
                    className="h-40 w-40 rounded-xl border border-outline-variant/30 bg-white object-contain p-2"
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="clear_primary_image" />
                    Remove primary image (or replace below)
                  </label>
                </div>
              ) : (
                <p className="mb-4 text-sm text-on-surface-variant">No primary image yet.</p>
              )}

              <label className="mb-3 grid gap-1 text-sm">
                <span className="font-semibold text-on-surface">Upload primary image</span>
                <input className="text-sm" name="primary_image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-on-surface">Or paste image URL (https)</span>
                <input
                  className="input-soft"
                  name="image_url"
                  type="url"
                  placeholder="https://…"
                  defaultValue={(product as { image_url?: string | null }).image_url ?? ""}
                />
              </label>

              <label className="mt-4 grid gap-1 text-sm">
                <span className="font-semibold text-on-surface">Gallery image URLs (one per line)</span>
                <textarea
                  className="input-soft min-h-[100px] font-mono text-xs"
                  name="gallery_urls"
                  defaultValue={galleryLines}
                  placeholder="https://…&#10;https://…"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-dashed border-outline-variant/30 p-4">
              <h3 className="font-headline mb-3 text-sm font-bold text-on-background">SEO (optional)</h3>
              <label className="mb-3 grid gap-1 text-sm">
                <span className="font-semibold text-on-surface">SEO title</span>
                <input className="input-soft" name="seo_title" defaultValue={(product as { seo_title?: string | null }).seo_title ?? ""} />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-on-surface">SEO description</span>
                <textarea
                  className="input-soft min-h-[72px]"
                  name="seo_description"
                  defaultValue={(product as { seo_description?: string | null }).seo_description ?? ""}
                />
              </label>
            </div>

            <SubmitButton className="btn-primary px-3 py-1.5 text-sm font-semibold">Save product</SubmitButton>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
