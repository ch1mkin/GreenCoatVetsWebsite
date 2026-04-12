"use client";

import { useSearchParams } from "next/navigation";
import { Rnd } from "react-rnd";
import { useClinicalWindows, MAX_CLINICAL_WINDOWS } from "./clinical-windows-context";

export function ClinicalWindowsLayer() {
  const sp = useSearchParams();
  const { windows, closeWindow, bringToFront, updateWindow } = useClinicalWindows();
  if (sp.get("embed") === "1") return null;

  if (!windows.length) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100]">
      {windows.map((w, idx) => {
        const embedSrc = `/visits/${w.visitId}?embed=1`;
        if (w.minimized) {
          const stack = windows.slice(0, idx).filter((x) => x.minimized).length;
          return (
            <button
              key={w.visitId}
              type="button"
              className="pointer-events-auto fixed z-[101] flex max-w-[220px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-xs font-semibold shadow-lg"
              style={{ zIndex: w.z, bottom: 16 + stack * 48, right: 16 }}
              onClick={() => updateWindow(w.visitId, { minimized: false })}
            >
              <span className="material-symbols-outlined text-base text-primary">pets</span>
              <span className="truncate">{w.label}</span>
            </button>
          );
        }

        const fullW = typeof window !== "undefined" ? window.innerWidth - 16 : 1200;
        const fullH = typeof window !== "undefined" ? window.innerHeight - 16 : 800;
        const width = w.expanded ? fullW : w.width;
        const height = w.expanded ? fullH : w.height;
        const x = w.expanded ? 8 : w.x;
        const y = w.expanded ? 8 : w.y;

        return (
          <Rnd
            key={w.visitId}
            className="pointer-events-auto z-[100] border border-slate-300/90 shadow-2xl"
            style={{ zIndex: w.z }}
            size={{ width, height }}
            position={{ x, y }}
            minWidth={320}
            minHeight={260}
            bounds="parent"
            enableResizing={!w.expanded}
            dragHandleClassName="clinical-window-drag"
            onDragStop={(_e, d) => {
              updateWindow(w.visitId, { x: d.x, y: d.y });
            }}
            onResizeStop={(_e, _dir, ref, _delta, pos) => {
              updateWindow(w.visitId, {
                width: parseInt(ref.style.width, 10),
                height: parseInt(ref.style.height, 10),
                x: pos.x,
                y: pos.y,
              });
            }}
            onMouseDown={() => bringToFront(w.visitId)}
            disableDragging={w.expanded}
          >
            <div className="flex h-full flex-col overflow-hidden rounded-lg bg-white">
              <div
                className="clinical-window-drag flex cursor-grab items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-2 py-1.5 active:cursor-grabbing"
                onMouseDown={() => bringToFront(w.visitId)}
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="material-symbols-outlined shrink-0 text-lg text-primary">pets</span>
                  <span className="truncate text-[13px] font-bold text-slate-800">{w.label}</span>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    className="rounded p-1 text-slate-600 hover:bg-slate-200"
                    title={w.expanded ? "Restore" : "Expand"}
                    onClick={() => updateWindow(w.visitId, { expanded: !w.expanded })}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {w.expanded ? "close_fullscreen" : "open_in_full"}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-slate-600 hover:bg-slate-200"
                    title="Minimize"
                    onClick={() => updateWindow(w.visitId, { minimized: true })}
                  >
                    <span className="material-symbols-outlined text-[18px]">minimize</span>
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-slate-600 hover:bg-red-100 hover:text-red-700"
                    title="Close"
                    onClick={() => closeWindow(w.visitId)}
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              </div>
              <iframe
                title={w.label}
                src={embedSrc}
                className="h-full min-h-0 w-full flex-1 border-0 bg-slate-50"
              />
            </div>
          </Rnd>
        );
      })}
      {windows.length >= MAX_CLINICAL_WINDOWS ? (
        <p className="pointer-events-auto fixed bottom-3 left-3 rounded bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-900 shadow">
          Max {MAX_CLINICAL_WINDOWS} patient windows — close one to open another.
        </p>
      ) : null}
    </div>
  );
}
