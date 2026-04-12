import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGallery } from "@/components/store/product-gallery";
import { AddToCartButton } from "@/components/store/add-to-cart-button";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { isWebsiteStoreEnabled } from "@/lib/store/store-availability";
import { createClient } from "@/lib/supabase/server";

export default async function ProductDetailsPage({
  params,
}: {
  params: { slug: string };
}) {
  const storeEnabled = await isWebsiteStoreEnabled();
  if (!storeEnabled) notFound();

  const clinic = await resolveClinic();
  const supabase = createClient();

  const { data: product, error } = await supabase
    .from("products")
    .select(
      "id, name, slug, description, price, compare_at_price, stock_quantity, requires_prescription, image_url, image_urls",
    )
    .eq("clinic_id", clinic.id)
    .eq("slug", params.slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!product) notFound();

  const price = Number(product.price);
  const compare = product.compare_at_price != null ? Number(product.compare_at_price) : null;
  const showCompare = compare != null && compare > price;

  return (
    <main className="bg-surface pb-24 pt-8 text-on-background sm:pt-12">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <nav className="text-sm text-on-surface-variant">
            <Link href="/store" className="font-semibold text-primary hover:underline">
              Store
            </Link>
            <span className="mx-2 text-on-surface-variant/60">/</span>
            <span className="text-on-surface">{product.name}</span>
          </nav>
          <Link
            className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container-low"
            href="/store"
          >
            ← All products
          </Link>
        </div>

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
          <ProductGallery heroUrl={product.image_url} imageUrls={product.image_urls} productName={product.name} />

          <div className="flex flex-col">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">{clinic.name}</p>
            <h1 className="font-headline mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{product.name}</h1>

            <div className="mt-6 flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-extrabold text-primary">₹{price.toFixed(0)}</span>
              {showCompare ? (
                <span className="text-lg text-on-surface-variant line-through">₹{compare!.toFixed(0)}</span>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {product.requires_prescription ? (
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
                  Prescription may be required
                </span>
              ) : (
                <span className="rounded-full bg-surface-container-high px-3 py-1 text-xs font-semibold text-on-surface-variant">
                  OTC
                </span>
              )}
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  product.stock_quantity > 0 ? "bg-green-500/15 text-green-800" : "bg-error/10 text-error"
                }`}
              >
                {product.stock_quantity > 0 ? `In stock (${product.stock_quantity})` : "Out of stock"}
              </span>
            </div>

            <div className="mt-8 rounded-2xl border border-surface-container-high bg-surface-container-lowest p-4 sm:p-6">
              <AddToCartButton
                item={{
                  productId: product.id,
                  name: product.name,
                  price,
                  quantity: 1,
                }}
                disabled={product.stock_quantity <= 0}
              />
              <p className="mt-4 text-xs text-on-surface-variant">
                Prices in INR. Use the floating cart to review items, then checkout when you&apos;re ready.
              </p>
              <Link
                className="mt-4 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary"
                href="/checkout"
              >
                Go to checkout
              </Link>
            </div>
          </div>
        </div>

        <section className="mt-16 border-t border-outline-variant/20 pt-10">
          <h2 className="font-headline text-xl font-bold text-on-surface">About this item</h2>
          <div className="prose prose-sm mt-4 max-w-none text-on-surface-variant sm:prose-base">
            {product.description ? (
              <p className="whitespace-pre-wrap leading-relaxed">{product.description}</p>
            ) : (
              <p className="text-on-surface-variant/80">No detailed description yet — your clinic can add one from the dashboard.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
