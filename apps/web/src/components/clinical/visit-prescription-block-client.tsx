"use client";

import { useCallback, useMemo, useState } from "react";
import {
  addPrescriptionItemAction,
  type RxLineItem,
} from "@/app/(portal)/prescriptions/actions";
import {
  findBestMedicineCatalogMatch,
  medicineCatalogLabel,
  normalizeMedicineQuery,
  shouldAutoCorrectMedicine,
  type MedicineCatalogEntry,
} from "@/lib/medicines/catalog";
import { VisitRxVoicePanel } from "@/components/clinical/visit-rx-voice-panel";

type DraftState = {
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
};

const EMPTY_DRAFT: DraftState = {
  medicine_name: "",
  dosage: "",
  frequency: "",
  duration: "",
  instructions: "",
};

export function VisitPrescriptionBlockClient({
  initialItems,
  prescriptionId,
  visitId,
  embed,
  showVoiceDictation,
  medicineCatalog,
}: {
  initialItems: RxLineItem[];
  prescriptionId: string;
  visitId: string;
  embed: boolean;
  showVoiceDictation: boolean;
  medicineCatalog: MedicineCatalogEntry[];
}) {
  /** Do not sync from server props after mount — revalidation can briefly return stale rows and wipe optimistic UI. */
  const [items, setItems] = useState<RxLineItem[]>(initialItems);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [correctionNote, setCorrectionNote] = useState<string | null>(null);

  const onInstructionsSaved = useCallback((itemId: string, instructions: string | null) => {
    setItems((prev) =>
      prev.map((row) => (row.id === itemId ? { ...row, instructions } : row)),
    );
  }, []);

  const bestMatch = useMemo(
    () => findBestMedicineCatalogMatch(draft.medicine_name, medicineCatalog),
    [draft.medicine_name, medicineCatalog],
  );

  const filteredCatalog = useMemo(() => {
    const query = normalizeMedicineQuery(draft.medicine_name);
    if (!query) return medicineCatalog.slice(0, 8);
    return medicineCatalog
      .filter((entry) => {
        const haystacks = [entry.name, ...(entry.aliases ?? []), entry.strength ?? "", entry.form ?? ""]
          .map(normalizeMedicineQuery)
          .filter(Boolean);
        return haystacks.some((value) => value.includes(query) || query.includes(value));
      })
      .slice(0, 8);
  }, [draft.medicine_name, medicineCatalog]);

  const applyCatalogEntry = useCallback((entry: MedicineCatalogEntry) => {
    setDraft((prev) => ({
      medicine_name: entry.name,
      dosage: prev.dosage || entry.default_dosage || "",
      frequency: prev.frequency || entry.default_frequency || "",
      duration: prev.duration || entry.default_duration || "",
      instructions: prev.instructions,
    }));
    setCorrectionNote(`Using catalog entry: ${medicineCatalogLabel(entry)}`);
  }, []);

  const applyVoiceMedicineName = useCallback(
    (transcript: string) => {
      const match = findBestMedicineCatalogMatch(transcript, medicineCatalog);
      const autoMatch = shouldAutoCorrectMedicine(match) ? match : null;
      if (autoMatch) {
        applyCatalogEntry(autoMatch.entry);
        setCorrectionNote(`Voice match corrected "${transcript}" to "${autoMatch.entry.name}".`);
        return;
      }
      setDraft((prev) => ({ ...prev, medicine_name: transcript }));
      setCorrectionNote(`Voice text inserted as typed: "${transcript}". You can edit it before saving.`);
    },
    [applyCatalogEntry, medicineCatalog],
  );

  async function onAddMedicine(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCorrectionNote(null);
    const fd = new FormData();
    fd.set("prescription_id", prescriptionId);
    fd.set("visit_id", visitId);
    fd.set("embed", embed ? "1" : "");
    fd.set("medicine_name", draft.medicine_name);
    fd.set("dosage", draft.dosage);
    fd.set("frequency", draft.frequency);
    fd.set("duration", draft.duration);
    fd.set("instructions", draft.instructions);

    setPending(true);
    try {
      const res = await addPrescriptionItemAction(fd);
      if (res.ok) {
        setItems((prev) => [...prev, res.item]);
        setDraft(EMPTY_DRAFT);
        setJustAdded(true);
        setCorrectionNote(res.correction ? `Saved as "${res.correction.to}" after matching the medicine catalog.` : null);
        window.setTimeout(() => setJustAdded(false), 2500);
      } else {
        setError(res.error);
      }
    } finally {
      setPending(false);
    }
  }

  function maybeAutocorrectMedicine() {
    if (!draft.medicine_name.trim()) return;
    const autoMatch = shouldAutoCorrectMedicine(bestMatch) ? bestMatch : null;
    if (!autoMatch) return;
    if (autoMatch.entry.name === draft.medicine_name.trim()) return;
    applyCatalogEntry(autoMatch.entry);
    setCorrectionNote(`Auto-corrected to catalog entry "${autoMatch.entry.name}". You can still edit it manually.`);
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
          onInsertMedicineName={applyVoiceMedicineName}
        />
      ) : null}

      <form id="form-rx-add" className="grid gap-2 md:grid-cols-2" onSubmit={onAddMedicine}>
        <div className="space-y-2 md:col-span-2">
          <div className="relative">
            <input
              className="input-soft input-compact w-full"
              name="medicine_name"
              placeholder="Medicine name *"
              required
              value={draft.medicine_name}
              onChange={(e) => setDraft((prev) => ({ ...prev, medicine_name: e.target.value }))}
              onBlur={maybeAutocorrectMedicine}
            />
            {!!filteredCatalog.length && (
              <div className="mt-2 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-2">
                <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                  Searchable medicine picker
                </p>
                <div className="grid gap-1">
                  {filteredCatalog.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className="rounded-xl border border-transparent px-3 py-2 text-left text-[12px] hover:border-outline-variant/20 hover:bg-surface-container-low"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyCatalogEntry(entry)}
                    >
                      <div className="font-semibold text-on-background">{entry.name}</div>
                      <div className="text-[11px] text-on-surface-variant">
                        {[entry.strength, entry.form, entry.default_dosage].filter(Boolean).join(" • ") || "Tap to use defaults"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {bestMatch ? (
            <p className="text-[11px] text-on-surface-variant">
              Closest catalog match: <strong>{bestMatch.entry.name}</strong>
              {shouldAutoCorrectMedicine(bestMatch) ? " (will auto-correct on blur/save)." : " (review before saving)."}
            </p>
          ) : (
            <p className="text-[11px] text-on-surface-variant">
              Manual typing is still allowed. If no match exists, the typed name will be saved as-is.
            </p>
          )}
        </div>

        <input
          className="input-soft input-compact"
          name="dosage"
          placeholder="Dosage *"
          required
          value={draft.dosage}
          onChange={(e) => setDraft((prev) => ({ ...prev, dosage: e.target.value }))}
        />
        <input
          className="input-soft input-compact"
          name="frequency"
          placeholder="Frequency"
          value={draft.frequency}
          onChange={(e) => setDraft((prev) => ({ ...prev, frequency: e.target.value }))}
        />
        <input
          className="input-soft input-compact"
          name="duration"
          placeholder="Duration"
          value={draft.duration}
          onChange={(e) => setDraft((prev) => ({ ...prev, duration: e.target.value }))}
        />
        <textarea
          id="rx-new-instructions"
          className="input-soft input-compact md:col-span-2 min-h-[48px]"
          name="instructions"
          placeholder="Instructions (use the prescription mic above, or type here)"
          value={draft.instructions}
          onChange={(e) => setDraft((prev) => ({ ...prev, instructions: e.target.value }))}
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
      {correctionNote ? (
        <p className="rounded-lg border border-primary/25 bg-primary-fixed/10 px-3 py-2 text-[11px] text-primary">{correctionNote}</p>
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
