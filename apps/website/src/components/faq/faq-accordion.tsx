"use client";

import { useState, type ReactNode } from "react";

export type FaqItem = { id: string; question: string; answer: ReactNode };

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const open = openId === item.id;
        return (
          <div
            key={item.id}
            id={item.id}
            className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm"
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-headline font-bold text-on-surface transition-colors hover:bg-surface-container-low sm:px-6 sm:py-5"
              onClick={() => setOpenId(open ? null : item.id)}
              aria-expanded={open}
            >
              <span className="pr-2">{item.question}</span>
              <span className={`material-symbols-outlined shrink-0 text-primary transition-transform ${open ? "rotate-180" : ""}`}>
                expand_more
              </span>
            </button>
            {open ? (
              <div className="border-t border-outline-variant/20 px-5 pb-5 pt-0 text-on-surface-variant leading-relaxed sm:px-6 sm:pb-6">
                {item.answer}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
