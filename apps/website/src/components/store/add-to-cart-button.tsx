"use client";

import { useState } from "react";
import { useCart } from "@/components/store/cart-context";
import type { CartItem } from "@/lib/cart/types";

export function AddToCartButton({
  item,
  disabled,
  className = "",
}: {
  item: CartItem;
  disabled?: boolean;
  /** Merged with base styles (e.g. `mt-0 w-full` on product cards). */
  className?: string;
}) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  function onAdd() {
    addItem({ ...item, quantity: item.quantity || 1 });
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  }

  return (
    <button
      className={`mt-3 rounded-xl border border-primary bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 disabled:opacity-50 ${className}`}
      type="button"
      onClick={onAdd}
      disabled={disabled}
    >
      {added ? "Added ✓" : "Add to cart"}
    </button>
  );
}
