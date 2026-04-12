"use client";

import { useState } from "react";

const DEMO_MESSAGES = [
  { id: "1", level: "info" as const, text: "System ready — workspace layout active." },
  { id: "2", level: "success" as const, text: "Background sync idle." },
];

export function WorkspaceTaskPanelToggle() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold ${
          open
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-outline-variant/25 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low"
        }`}
        title="Task panel"
      >
        <span className="material-symbols-outlined text-[18px]">notifications</span>
        <span className="hidden sm:inline">Tasks</span>
      </button>
      {open ? (
        <div className="fixed bottom-0 right-0 z-[60] flex max-h-[40vh] w-full max-w-md flex-col border-l border-t border-outline-variant/25 bg-surface-container-lowest shadow-2xl md:rounded-tl-xl">
          <div className="flex items-center justify-between border-b border-outline-variant/20 px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Task panel</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-low"
              aria-label="Close task panel"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
          <ul className="sidebar-scroll flex-1 space-y-1 overflow-y-auto p-2 text-sm">
            {DEMO_MESSAGES.map((m) => (
              <li
                key={m.id}
                className={`rounded-lg px-3 py-2 ${
                  m.level === "success" ? "bg-primary/5 text-on-background" : "bg-surface-container-low text-on-background"
                }`}
              >
                {m.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
