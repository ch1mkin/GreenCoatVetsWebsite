"use client";

import { useRouter, useSearchParams } from "next/navigation";

type ClinicOption = { id: string; name: string };

/**
 * Super admin: switch active clinic context via `?clinic_id=` (preserves other query params).
 */
export function ClinicContextPicker({
  value,
  clinics,
  className = "",
}: {
  value: string;
  clinics: ClinicOption[];
  className?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (clinics.length === 0) return null;

  return (
    <label className={`flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3 ${className}`}>
      <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Clinic context</span>
      <select
        className="input-soft max-w-md min-w-[12rem] py-2 text-sm font-medium"
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(searchParams.toString());
          next.set("clinic_id", e.target.value);
          router.push(`?${next.toString()}`);
        }}
      >
        {clinics.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
