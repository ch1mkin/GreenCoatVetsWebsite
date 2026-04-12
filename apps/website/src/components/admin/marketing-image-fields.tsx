"use client";

import { useEffect, useMemo, useState } from "react";
import type { HomepageImageKey } from "@/lib/marketing/defaults";

export type ImageFieldSpec = {
  key: HomepageImageKey;
  label: string;
  defaultValue: string;
  fallbackUrl: string;
};

function ImageUrlRow({ name, label, defaultValue, fallbackUrl }: { name: string; label: string; defaultValue: string; fallbackUrl: string }) {
  const [value, setValue] = useState(defaultValue);
  const previewSrc = useMemo(() => {
    const v = value.trim();
    if (v.startsWith("http://") || v.startsWith("https://")) return v;
    return fallbackUrl;
  }, [value, fallbackUrl]);

  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [previewSrc]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 transition-shadow hover:shadow-md">
      <label className="block text-xs font-bold uppercase tracking-wide text-slate-600" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="url"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={fallbackUrl}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-inner outline-none ring-primary/30 focus:ring-2"
      />
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200/80 bg-slate-900/5">
        <div className="relative aspect-[16/9] w-full bg-gradient-to-br from-slate-100 to-slate-200">
          {!imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt={`Preview: ${label}`}
              className="h-full w-full object-cover transition-opacity duration-300"
              onError={() => setImgError(true)}
              loading="lazy"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-slate-500">
              <span className="material-symbols-outlined text-4xl text-slate-400">broken_image</span>
              <p className="text-xs">Could not load preview. Check the URL or leave empty to use the default.</p>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-3 py-2">
            <p className="truncate text-[10px] font-mono text-white/90">{previewSrc.slice(0, 72)}{previewSrc.length > 72 ? "…" : ""}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MarketingImageFields({ fields }: { fields: ImageFieldSpec[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {fields.map((f) => (
        <ImageUrlRow
          key={f.key}
          name={`img_${f.key}`}
          label={f.label}
          defaultValue={f.defaultValue}
          fallbackUrl={f.fallbackUrl}
        />
      ))}
    </div>
  );
}
