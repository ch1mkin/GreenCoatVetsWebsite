"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const MAX_CLINICAL_WINDOWS = 10;

const STORAGE_KEY = "saasclinics_clinical_windows_v1";

export type ClinicalWindowState = {
  visitId: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  minimized: boolean;
  expanded: boolean;
};

type Ctx = {
  windows: ClinicalWindowState[];
  openWindow: (visitId: string, label: string) => void;
  closeWindow: (visitId: string) => void;
  bringToFront: (visitId: string) => void;
  updateWindow: (visitId: string, patch: Partial<ClinicalWindowState>) => void;
  clearAll: () => void;
};

const ClinicalWindowsContext = createContext<Ctx | null>(null);

function loadInitial(): ClinicalWindowState[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ClinicalWindowState[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_CLINICAL_WINDOWS) : [];
  } catch {
    return [];
  }
}

export function ClinicalWindowsProvider({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = useState<ClinicalWindowState[]>([]);

  useEffect(() => {
    setWindows(loadInitial());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(windows));
    } catch {
      /* ignore */
    }
  }, [windows]);

  const openWindow = useCallback((visitId: string, label: string) => {
    setWindows((prev) => {
      const existing = prev.find((w) => w.visitId === visitId);
      if (existing) {
        return prev.map((w) =>
          w.visitId === visitId ? { ...w, minimized: false, z: Math.max(...prev.map((p) => p.z), 0) + 1 } : w
        );
      }
      if (prev.length >= MAX_CLINICAL_WINDOWS) {
        return prev;
      }
      const i = prev.length;
      const nextZ = Math.max(0, ...prev.map((p) => p.z)) + 1;
      const w = 440;
      const h = 520;
      return [
        ...prev,
        {
          visitId,
          label: label.slice(0, 80),
          x: 24 + (i % 5) * 28,
          y: 72 + (i % 4) * 24,
          width: w,
          height: h,
          z: nextZ,
          minimized: false,
          expanded: false,
        },
      ];
    });
  }, []);

  const closeWindow = useCallback((visitId: string) => {
    setWindows((prev) => prev.filter((w) => w.visitId !== visitId));
  }, []);

  const bringToFront = useCallback((visitId: string) => {
    setWindows((prev) => {
      const nextZ = Math.max(0, ...prev.map((p) => p.z)) + 1;
      return prev.map((w) => (w.visitId === visitId ? { ...w, z: nextZ } : w));
    });
  }, []);

  const updateWindow = useCallback((visitId: string, patch: Partial<ClinicalWindowState>) => {
    setWindows((prev) => prev.map((w) => (w.visitId === visitId ? { ...w, ...patch } : w)));
  }, []);

  const clearAll = useCallback(() => setWindows([]), []);

  const value = useMemo(
    () => ({ windows, openWindow, closeWindow, bringToFront, updateWindow, clearAll }),
    [windows, openWindow, closeWindow, bringToFront, updateWindow, clearAll]
  );

  return <ClinicalWindowsContext.Provider value={value}>{children}</ClinicalWindowsContext.Provider>;
}

export function useClinicalWindows() {
  const ctx = useContext(ClinicalWindowsContext);
  if (!ctx) {
    return {
      windows: [] as ClinicalWindowState[],
      openWindow: () => {},
      closeWindow: () => {},
      bringToFront: () => {},
      updateWindow: () => {},
      clearAll: () => {},
    };
  }
  return ctx;
}
