import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AddToCartButton } from "@/components/store/add-to-cart-button";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { isWebsiteStoreEnabled } from "@/lib/store/store-availability";
import { createClient } from "@/lib/supabase/server";

export default async function StorePage() {
  const storeEnabled = await isWebsiteStoreEnabled();
  if (!storeEnabled) redirect("/");

  const clinic = await resolveClinic();
  const supabase = createClient();

  // Base columns only — add `summary` to select after migration `20260325220000_product_summary_image_urls.sql`
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, slug, price, compare_at_price, stock_quantity, requires_prescription, image_url, description")
    .eq("clinic_id", clinic.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);

  return (
    <main className="bg-surface pb-40 pt-8 text-on-background sm:pb-36 sm:pt-12">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="mb-10 text-center sm:text-left">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Shop</p>
          <h1 className="font-headline mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{clinic.name} store</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-on-surface-variant sm:mx-0 sm:text-base">
            Products are managed by your clinic from the staff dashboard. Use the cart (above Book) to review items — checkout when you&apos;re
            ready. We deliver to <strong>Chandigarh, Mohali, and Panchkula</strong> only.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {products?.map((product) => {
            const inStock = product.stock_quantity > 0;
            const showCompare =
              product.compare_at_price != null && Number(product.compare_at_price) > Number(product.price);
            return (
              <article
                key={product.id}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-outline-variant/25 bg-surface-container-lowest shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-[0_12px_40px_rgba(23,28,31,0.08)]"
              >
                {/* Square media — symmetric grid */}
                <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-gradient-to-b from-surface-container-high to-surface-container">
                  {product.image_url ? (
                    <Image
                      src={product.image_url}
                      alt=""
                      fill
                      unoptimized
                      className={`object-cover transition-transform duration-500 group-hover:scale-[1.03] ${!inStock ? "opacity-50 grayscale" : ""}`}
                      sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="material-symbols-outlined text-6xl text-primary/25">shopping_bag</span>
                    </div>
                  )}
                  {product.requires_prescription ? (
                    <span className="absolute left-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                      Rx
                    </span>
                  ) : (
                    <span className="absolute left-3 top-3 rounded-full bg-surface-container-lowest/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant shadow-sm backdrop-blur-sm">
                      OTC
                    </span>
                  )}
                  {!inStock ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-on-background/45 backdrop-blur-[2px]">
                      <span className="rounded-full bg-on-background px-4 py-2 text-xs font-bold uppercase tracking-wider text-white">
                        Out of stock
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="flex min-h-0 flex-1 flex-col p-5">
                  <h2 className="font-headline line-clamp-2 min-h-[3.25rem] text-lg font-bold leading-snug text-on-surface">{product.name}</h2>

                  <div className="mt-2 min-h-[2.75rem]">
                    {product.description ? (
                      <p className="line-clamp-2 text-sm leading-relaxed text-on-surface-variant">{product.description}</p>
                    ) : (
                      <p className="text-sm text-on-surface-variant/50">&nbsp;</p>
                    )}
                  </div>

                  <p className="mt-3 text-xs font-medium text-on-surface-variant/90">
                    Stock <span className="font-bold text-on-surface">{product.stock_quantity}</span>
                  </p>

                  <div className="mt-4 flex items-end justify-between gap-3 border-t border-outline-variant/15 pt-4">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-2xl font-extrabold tabular-nums text-primary">₹{Number(product.price).toFixed(0)}</span>
                      {showCompare ? (
                        <span className="text-sm tabular-nums text-on-surface-variant line-through">
                          ₹{Number(product.compare_at_price).toFixed(0)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {product.slug ? (
                      <Link
                        href={`/product/${product.slug}`}
                        className="inline-flex h-11 items-center justify-center rounded-xl border border-outline-variant/40 bg-surface-container-lowest text-center text-sm font-semibold text-on-surface transition-colors hover:border-primary/40 hover:bg-surface-container-high"
                      >
                        Details
                      </Link>
                    ) : (
                      <span className="inline-flex h-11 items-center justify-center rounded-xl border border-outline-variant/20 bg-surface-container-low text-center text-sm font-semibold text-on-surface-variant">
                        No details
                      </span>
                    )}
                    <AddToCartButton
                      className="mt-0 flex h-11 w-full items-center justify-center px-3 py-0 text-sm"
                      item={{
                        productId: product.id,
                        name: product.name,
                        price: Number(product.price),
                        quantity: 1,
                      }}
                      disabled={!inStock}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {!products?.length ? (
          <p className="mt-8 text-center text-sm text-on-surface-variant sm:text-left">
            No products listed yet. Ask your clinic to add catalog items from the <strong>staff app → Ecommerce</strong>.
          </p>
        ) : null}
      </div>
    </main>
  );
}
