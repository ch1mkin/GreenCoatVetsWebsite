"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "saasclinics_workspace_sidebar_w";
const COLLAPSED_KEY = "saasclinics_workspace_sidebar_collapsed";
const MIN = 200;
const MAX = 420;
const DEFAULT_W = 288;

export function WorkspaceSidebarFrame({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  const [width, setWidth] = useState(DEFAULT_W);
  const [collapsed, setCollapsed] = useState(false);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  useEffect(() => {
    try {
      const w = localStorage.getItem(STORAGE_KEY);
      const c = localStorage.getItem(COLLAPSED_KEY);
      if (w) {
        const n = Number.parseInt(w, 10);
        if (!Number.isNaN(n)) setWidth(Math.min(MAX, Math.max(MIN, n)));
      }
      if (c === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((next: number) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* ignore */
    }
  }, []);

  const onMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - startX.current;
      const next = Math.min(MAX, Math.max(MIN, startW.current + dx));
      setWidth(next);
    },
    []
  );

  const onUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    persist(width);
  }, [persist, width]);

  useEffect(() => {
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onMove, onUp]);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  if (collapsed) {
    return (
      <div className="flex h-full shrink-0 flex-col border-r border-slate-300/80 bg-[#e4eaf2] shadow-[inset_-1px_0_0_rgba(255,255,255,0.5)]">
        <button
          type="button"
          onClick={toggleCollapse}
          className="flex h-10 w-10 items-center justify-center border-b border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-low"
          title="Show sidebar"
        >
          <span className="material-symbols-outlined text-xl">dock_to_right</span>
        </button>
      </div>
    );
  }

  return (
    <aside
      style={{ width }}
      className="relative flex h-full min-h-0 shrink-0 flex-col border-r border-slate-300/80 bg-[#e4eaf2] shadow-[inset_-1px_0_0_rgba(255,255,255,0.5)]"
    >
      {title ? (
        <div className="shrink-0 border-b border-slate-300/60 bg-[#dce3ed] px-2 py-1.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600">{title}</p>
        </div>
      ) : null}
      <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
      <button
        type="button"
        onClick={toggleCollapse}
        className="absolute -right-0.5 top-1/2 z-10 flex h-9 w-5 -translate-y-1/2 items-center justify-center rounded-r-md border border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant shadow-sm hover:bg-surface-container-low"
        title="Hide sidebar"
      >
        <span className="material-symbols-outlined text-lg">chevron_left</span>
      </button>
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={startDrag}
        className="absolute right-0 top-0 z-[5] h-full w-1.5 cursor-col-resize hover:bg-primary/25"
      />
    </aside>
  );
}
