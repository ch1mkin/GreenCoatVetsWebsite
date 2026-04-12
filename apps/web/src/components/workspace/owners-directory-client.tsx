"use client";

import { useState } from "react";
import { DirectorySelectionHint, RecordDirectoryRow } from "@/components/workspace/record-directory-row";

export type OwnerDirectoryRowData = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  subtitle: string;
  avatarUrl: string | null;
  initials: string;
  addedLabel: string;
};

export function OwnersDirectoryClient({ rows }: { rows: OwnerDirectoryRowData[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (rows.length === 0) {
    return <p className="py-4 text-[11px] text-slate-600">No owners found.</p>;
  }

  return (
    <div className="space-y-1.5">
      <DirectorySelectionHint />
      {rows.map((owner) => (
        <RecordDirectoryRow
          key={owner.id}
          href={`/owners/${owner.id}`}
          recordId={owner.id}
          selectedId={selectedId}
          onSelect={setSelectedId}
          preview={
            <div className="space-y-0.5">
              <p className="font-headline text-xs font-bold text-slate-900">{owner.fullName}</p>
              <p className="text-[10px] text-slate-600">{owner.phone}</p>
              {owner.email ? (
                <p className="text-[9px] text-slate-500/80" title="Account email (secondary)">
                  {owner.email}
                </p>
              ) : null}
              <p className="border-t border-slate-200/80 pt-0.5 text-[10px] text-slate-800">{owner.subtitle}</p>
            </div>
          }
        >
          <div className="relative shrink-0">
            {owner.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={owner.avatarUrl} alt="" className="h-12 w-12 rounded-md object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-100 font-headline text-sm font-bold text-primary">
                {owner.initials}
              </div>
            )}
            <div
              className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border border-white bg-primary"
              title="Contact record"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate font-headline text-sm font-bold text-slate-900">{owner.fullName}</h3>
              <span className="shrink-0 rounded bg-primary-fixed px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-on-primary-fixed-variant">
                Owner
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-600">{owner.subtitle}</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-0.5 text-[10px] text-slate-500">
                <span className="material-symbols-outlined shrink-0 text-[14px]">call</span>
                <span className="truncate">{owner.phone}</span>
              </span>
              <span className="shrink-0 text-[10px] text-slate-500">{owner.addedLabel}</span>
            </div>
          </div>
        </RecordDirectoryRow>
      ))}
    </div>
  );
}
