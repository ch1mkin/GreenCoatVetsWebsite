"use client";

import { formatSpeciesLabel } from "@saasclinics/lib";
import { useState } from "react";
import { DirectorySelectionHint, RecordDirectoryRow } from "@/components/workspace/record-directory-row";

export type PetDirectoryRowData = {
  id: string;
  name: string;
  species: string;
  breed: string;
  ownerLine: string;
  status: string;
  statusClass: string;
  avatarUrl: string | null;
  initials: string;
  addedLabel: string;
};

export function PetsDirectoryClient({ rows }: { rows: PetDirectoryRowData[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (rows.length === 0) {
    return <p className="py-4 text-[11px] text-slate-600">No pets match this filter.</p>;
  }

  return (
    <div className="space-y-1.5">
      <DirectorySelectionHint />
      {rows.map((pet) => (
        <RecordDirectoryRow
          key={pet.id}
          href={`/pets/${pet.id}`}
          recordId={pet.id}
          selectedId={selectedId}
          onSelect={setSelectedId}
          preview={
            <div className="space-y-0.5">
              <p className="font-headline text-xs font-bold text-slate-900">{pet.name}</p>
              <p className="text-[10px] text-slate-600">
                {formatSpeciesLabel(pet.species)}
                {pet.breed ? ` · ${pet.breed}` : ""}
              </p>
              <p className="text-[10px] text-slate-600">Owner: {pet.ownerLine}</p>
              <p className="text-[9px] font-bold uppercase text-primary">{pet.status}</p>
            </div>
          }
        >
          <div className="relative shrink-0">
            {pet.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pet.avatarUrl} alt="" className="h-12 w-12 rounded-md object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-100 font-headline text-sm font-bold text-primary">
                {pet.initials}
              </div>
            )}
            <div
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border border-white ${
                pet.status === "Healthy" ? "bg-primary" : "bg-tertiary"
              }`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate font-headline text-sm font-bold text-slate-900">{pet.name}</h3>
              <span
                className={`shrink-0 rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${pet.statusClass}`}
              >
                {pet.status}
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-600">
              {formatSpeciesLabel(pet.species)}
              {pet.breed ? ` • ${pet.breed}` : ""}
            </p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-0.5 text-[10px] text-slate-500">
                <span className="material-symbols-outlined shrink-0 text-[14px]">person</span>
                <span className="truncate">{pet.ownerLine}</span>
              </span>
              <span className="shrink-0 text-[10px] text-slate-500">{pet.addedLabel}</span>
            </div>
          </div>
        </RecordDirectoryRow>
      ))}
    </div>
  );
}
