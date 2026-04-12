"use client";

import Link from "next/link";
import { useCart } from "@/components/store/cart-context";

function formatInr(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

/** Floating cart button + slide-over panel (mobile + desktop). */
export function StoreCartChrome() {
  const { items, isOpen, closeCart, openCart, setQuantity, removeItem, subtotalInr, itemCount } = useCart();

  return (
    <>
      <button
        type="button"
        onClick={openCart}
        className="fixed bottom-[5.75rem] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg ring-2 ring-white/20 md:bottom-[6.75rem] md:right-8"
        aria-label="Open cart"
      >
        <span className="material-symbols-outlined text-2xl">shopping_cart</span>
        {itemCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
            {itemCount > 99 ? "99+" : itemCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          aria-label="Close cart overlay"
          onClick={closeCart}
        />
      ) : null}

      <aside
        className={`fixed right-0 top-0 z-[60] flex h-full w-full max-w-md flex-col border-l border-outline-variant/30 bg-surface shadow-2xl transition-transform duration-300 ease-out md:max-w-sm ${
          isOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
        }`}
        aria-hidden={!isOpen}
      >
        <div className="flex items-center justify-between border-b border-outline-variant/30 px-4 py-4">
          <h2 className="font-headline text-lg font-bold text-on-surface">Your cart</h2>
          <button
            type="button"
            onClick={closeCart}
            className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-high"
            aria-label="Close cart"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {items.length === 0 ? (
            <p className="text-sm text-on-surface-variant">Your cart is empty. Browse the store to add products.</p>
          ) : (
            <ul className="space-y-4">
              {items.map((line) => (
                <li key={line.productId} className="flex gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-on-surface">{line.name}</p>
                    <p className="text-sm text-on-surface-variant">{formatInr(line.price)} each</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <label className="sr-only" htmlFor={`qty-${line.productId}`}>
                        Quantity
                      </label>
                      <input
                        id={`qty-${line.productId}`}
                        type="number"
                        min={1}
                        className="w-16 rounded-lg border border-outline-variant px-2 py-1 text-sm"
                        value={line.quantity}
                        onChange={(e) => setQuantity(line.productId, Number(e.target.value) || 1)}
                      />
                      <button
                        type="button"
                        className="text-xs font-semibold text-red-600 hover:underline"
                        onClick={() => removeItem(line.productId)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-outline-variant/30 p-4">
          <div className="mb-3 flex justify-between text-sm">
            <span className="text-on-surface-variant">Subtotal</span>
            <span className="font-semibold text-on-surface">{formatInr(subtotalInr)}</span>
          </div>
          <Link
            href="/checkout"
            onClick={closeCart}
            className={`gradient-primary flex w-full justify-center rounded-xl py-3 text-center font-headline text-sm font-bold text-on-primary ${
              items.length === 0 ? "pointer-events-none opacity-50" : ""
            }`}
          >
            Checkout
          </Link>
          <Link href="/store" onClick={closeCart} className="mt-2 block text-center text-sm text-primary hover:underline">
            Continue shopping
          </Link>
        </div>
      </aside>
    </>
  );
}
