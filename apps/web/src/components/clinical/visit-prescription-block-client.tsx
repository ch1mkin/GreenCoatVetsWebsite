"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addPrescriptionItemAction,
  type RxLineItem,
} from "@/app/(portal)/prescriptions/actions";
import { VisitRxVoicePanel } from "@/components/clinical/visit-rx-voice-panel";

export function VisitPrescriptionBlockClient({
  initialItems,
  prescriptionId,
  visitId,
  embed,
  showVoiceDictation,
}: {
  initialItems: RxLineItem[];
  prescriptionId: string;
  visitId: string;
  embed: boolean;
  showVoiceDictation: boolean;
}) {
  const [items, setItems] = useState<RxLineItem[]>(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const onInstructionsSaved = useCallback((itemId: string, instructions: string | null) => {
    setItems((prev) =>
      prev.map((row) => (row.id === itemId ? { ...row, instructions } : row)),
    );
  }, []);

  async function onAddMedicine(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("prescription_id", prescriptionId);
    fd.set("visit_id", visitId);
    fd.set("embed", embed ? "1" : "");

    setPending(true);
    try {
      const res = await addPrescriptionItemAction(fd);
      if (res.ok) {
        setItems((prev) => [...prev, res.item]);
        form.reset();
        const ta = document.getElementById("rx-new-instructions") as HTMLTextAreaElement | null;
        if (ta) ta.value = "";
        setJustAdded(true);
        window.setTimeout(() => setJustAdded(false), 2500);
      } else {
        setError(res.error);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      {showVoiceDictation ? (
        <VisitRxVoicePanel
          embed={embed}
          visitId={visitId}
          lines={items.map((r) => ({
            id: r.id,
            medicine_name: r.medicine_name,
            instructions: r.instructions,
          }))}
          onInstructionsSaved={onInstructionsSaved}
        />
      ) : null}

      <form id="form-rx-add" className="grid gap-2 md:grid-cols-2" onSubmit={onAddMedicine}>
        <input className="input-soft input-compact md:col-span-2" name="medicine_name" placeholder="Medicine name *" required />
        <input className="input-soft input-compact" name="dosage" placeholder="Dosage *" required />
        <input className="input-soft input-compact" name="frequency" placeholder="Frequency" />
        <input className="input-soft input-compact" name="duration" placeholder="Duration" />
        <textarea
          id="rx-new-instructions"
          className="input-soft input-compact md:col-span-2 min-h-[48px]"
          name="instructions"
          placeholder="Instructions (use the prescription mic above, or type here)"
        />
        <button type="submit" className="btn-primary btn-compact md:col-span-2" disabled={pending}>
          {pending ? "Adding…" : "Add medicine line"}
        </button>
      </form>

      {error ? (
        <p className="rounded-lg border border-error/40 bg-error-container/30 px-3 py-2 text-[12px] text-error" role="alert">
          {error}
        </p>
      ) : null}
      {justAdded ? (
        <p className="text-[11px] font-medium text-emerald-800" role="status">
          Medicine line saved — it will appear in visit reports and prescription PDFs when you generate them.
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-[11px]">
          <thead>
            <tr className="border-b border-outline-variant/20 text-[10px] font-bold uppercase text-on-surface-variant">
              <th className="py-1.5 pr-2">Medicine</th>
              <th className="py-1.5 pr-2">Dosage</th>
              <th className="py-1.5 pr-2">Frequency</th>
              <th className="py-1.5 pr-2">Duration</th>
              <th className="py-1.5">Instructions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-outline-variant/10">
                <td className="py-1.5 pr-2">{item.medicine_name}</td>
                <td className="py-1.5 pr-2">{item.dosage}</td>
                <td className="py-1.5 pr-2">{item.frequency ?? "—"}</td>
                <td className="py-1.5 pr-2">{item.duration ?? "—"}</td>
                <td className="py-1.5">{item.instructions ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length ? <p className="py-2 text-on-surface-variant">No line items yet.</p> : null}
      </div>
    </div>
  );
}
