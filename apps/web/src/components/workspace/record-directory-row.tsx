"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode, useCallback } from "react";
import { RecordHoverPreview } from "@/components/workspace/record-hover-preview";

type Props = {
  href: string;
  recordId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  preview: ReactNode;
  children: ReactNode;
};

/** Single-click opens the record; row also highlights on click. */
export function RecordDirectoryRow({ href, recordId, selectedId, onSelect, preview, children }: Props) {
  const router = useRouter();
  const selected = selectedId === recordId;

  const go = useCallback(() => {
    onSelect(recordId);
    router.push(href);
  }, [href, onSelect, recordId, router]);

  return (
    <RecordHoverPreview content={preview}>
      <div
        role="link"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            go();
          }
        }}
        onClick={go}
        className={`relative flex cursor-pointer items-center gap-2.5 rounded-md border p-2.5 pr-[4.75rem] transition-colors active:scale-[0.995] ${
          selected
            ? "border-primary/50 bg-white ring-1 ring-primary/30"
            : "border-slate-200/80 bg-white hover:bg-slate-50"
        }`}
      >
        {children}
        <Link
          href={href}
          className="absolute right-3 top-1/2 z-[1] -translate-y-1/2 rounded-lg bg-primary/12 px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/20"
          onClick={(e) => e.stopPropagation()}
        >
          Open
        </Link>
      </div>
    </RecordHoverPreview>
  );
}

export function DirectorySelectionHint() {
  return (
    <p className="mb-2 border-b border-slate-200/80 pb-2 text-[10px] leading-snug text-slate-600">
      <span className="font-semibold text-slate-800">Tip:</span> click a row to open the record. Hover for preview.
    </p>
  );
}
