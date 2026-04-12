import type { PrescriptionItemLine } from "../types/app";

export function formatPrescriptionItemLine(row: PrescriptionItemLine): string {
  const parts = [row.medicine_name?.trim() || "Medication", row.dosage?.trim() || "—"].filter(Boolean);
  const mid = [row.frequency?.trim(), row.duration?.trim()].filter(Boolean).join("; ");
  const base = mid ? `${parts[0]} — ${parts[1]}; ${mid}` : `${parts[0]} — ${parts[1]}`;
  const ins = row.instructions?.trim();
  return ins ? `${base}. ${ins}` : base;
}

export function summarizePrescriptionForDashboard(rx: {
  prescription_items?: PrescriptionItemLine[] | null;
  notes?: string | null;
}): string {
  const lines = rx.prescription_items ?? [];
  if (lines.length) {
    const first = formatPrescriptionItemLine(lines[0]);
    if (lines.length === 1) return first;
    return `${first} (+${lines.length - 1} more)`;
  }
  return rx.notes?.trim() || "Prescription";
}
