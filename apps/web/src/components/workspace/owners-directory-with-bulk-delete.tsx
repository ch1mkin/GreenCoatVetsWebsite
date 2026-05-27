"use client";

import { useMemo, useState } from "react";
import { superAdminDeleteOwnersAction } from "@/app/(portal)/super-admin/actions";
import { SubmitButton } from "@/components/web/submit-button";
import type { OwnerDirectoryRowData } from "@/components/workspace/owners-directory-client";
import { RecordDirectoryRow } from "@/components/workspace/record-directory-row";

export function OwnersDirectoryWithBulkDelete({
  rows,
  clinicId,
}: {
  rows: OwnerDirectoryRowData[];
  clinicId: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const selectedList = useMemo(() => Array.from(selectedIds), [selectedIds]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  };

  if (rows.length === 0) {
    return <p className="py-4 text-[11px] text-slate-600">No owners found.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
        <p className="text-[11px] font-semibold text-amber-950">
          Super admin: select clients to permanently delete owner records, pets, visits, and appointments.
        </p>
        <button type="button" className="btn-secondary btn-compact text-[11px]" onClick={toggleAll}>
          {selectedIds.size === rows.length ? "Clear selection" : "Select all on page"}
        </button>
      </div>

      {selectedList.length > 0 ? (
        <form action={superAdminDeleteOwnersAction} className="rounded-md border border-red-200 bg-red-50 p-3">
          <input type="hidden" name="clinic_id" value={clinicId} />
          {selectedList.map((id) => (
            <input key={id} type="hidden" name="owner_ids" value={id} />
          ))}
          <p className="text-sm font-semibold text-red-900">
            Delete {selectedList.length} selected client{selectedList.length === 1 ? "" : "s"} permanently
          </p>
          <p className="mt-1 text-[11px] text-red-800">
            This removes linked pets, appointments, visits, prescriptions, and medical records. Type{" "}
            <strong>confirm</strong> to proceed.
          </p>
          <input
            className="input-soft mt-2 w-full max-w-xs py-2 text-[12px]"
            name="confirm_delete_text"
            placeholder='Type "confirm"'
            required
          />
          <SubmitButton className="btn-primary mt-2 bg-red-600 hover:bg-red-500" pendingLabel="Deleting…">
            Delete selected permanently
          </SubmitButton>
        </form>
      ) : null}

      <div className="space-y-1.5">
        {rows.map((owner) => (
          <div key={owner.id} className="flex items-start gap-2">
            <label className="mt-3 flex shrink-0 cursor-pointer items-center">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={selectedIds.has(owner.id)}
                onChange={() => toggle(owner.id)}
              />
            </label>
            <div className="min-w-0 flex-1">
              <RecordDirectoryRow
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
