"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

function normalizeUrls(hero: string | null | undefined, gallery: unknown): string[] {
  const extra = Array.isArray(gallery) ? gallery.filter((x): x is string => typeof x === "string" && /^https?:\/\//i.test(x)) : [];
  const list = [hero, ...extra].filter((x): x is string => typeof x === "string" && x.length > 0);
  return Array.from(new Set(list));
}

export function ProductGallery({
  heroUrl,
  imageUrls,
  productName,
}: {
  heroUrl: string | null | undefined;
  imageUrls: unknown;
  productName: string;
}) {
  const urls = useMemo(() => normalizeUrls(heroUrl ?? null, imageUrls), [heroUrl, imageUrls]);
  const [active, setActive] = useState(0);
  const current = urls[active] ?? null;

  if (!urls.length) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-2xl border border-surface-container-high bg-surface-container-high">
        <span className="material-symbols-outlined text-7xl text-primary/35">shopping_bag</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-surface-container-high bg-white">
        <Image
          src={current}
          alt={productName}
          fill
          unoptimized
          className="object-contain p-4"
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
        />
      </div>
      {urls.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {urls.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              className={`relative h-16 w-16 overflow-hidden rounded-lg border-2 bg-white p-1 transition ${
                i === active ? "border-primary" : "border-transparent opacity-80 hover:opacity-100"
              }`}
            >
              <Image src={url} alt="" fill unoptimized className="object-contain p-0.5" sizes="64px" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
