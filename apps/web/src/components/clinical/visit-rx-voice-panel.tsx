"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { updatePrescriptionItemInstructionsAction } from "@/app/(portal)/prescriptions/actions";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";

type Line = { id: string; medicine_name: string; instructions: string | null };

function setInstructionField(el: HTMLTextAreaElement | null, value: string, append: boolean) {
  if (!el) return false;
  const next = append && el.value.trim() ? `${el.value.trim()}\n\n${value.trim()}` : value.trim();
  el.value = next;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.focus();
  return true;
}

/**
 * Mic + medicine dropdown scoped to the prescription block so staff need not scroll to the main dictation panel.
 */
export function VisitRxVoicePanel({
  embed,
  visitId,
  lines,
  onInstructionsSaved,
}: {
  embed: boolean;
  visitId: string;
  lines: Line[];
  onInstructionsSaved?: (itemId: string, instructions: string | null) => void;
}) {
  const panelId = useId();
  const [lang, setLang] = useState("en-IN");
  const [target, setTarget] = useState<"new" | string>("new");
  const [append, setAppend] = useState(true);
  const [savePending, setSavePending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { status, line, error, start, stop, clearLine } = useSpeechRecognition(lang);

  const selectedLabel = useMemo(() => {
    if (target === "new") return "New medicine line (Instructions field below)";
    const hit = lines.find((l) => l.id === target);
    return hit ? `Edit: ${hit.medicine_name}` : "Select a medicine";
  }, [target, lines]);

  const insertIntoField = useCallback(() => {
    if (!line.trim()) return;
    if (target === "new") {
      const el = document.querySelector<HTMLTextAreaElement>("#rx-new-instructions");
      if (setInstructionField(el, line, append)) clearLine();
      return;
    }
    const el = document.querySelector<HTMLTextAreaElement>("#rx-instructions-for-voice");
    if (setInstructionField(el, line, append)) clearLine();
  }, [line, target, append, clearLine]);

  const scrollToNewInstructions = useCallback(() => {
    document.getElementById("rx-new-instructions")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  if (status === "unsupported") {
    return (
      <section
        className={
          embed
            ? "rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] text-amber-900"
            : "rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-[12px] text-amber-950"
        }
        aria-label="Prescription voice dictation unavailable"
      >
        <p className="font-semibold">Voice dictation is not available in this browser.</p>
      </section>
    );
  }

  const listening = status === "listening";

  return (
    <section
      className={
        embed
          ? "rounded-lg border border-primary/25 bg-primary-fixed/10 px-2 py-2 text-[11px]"
          : "rounded-xl border border-primary/30 bg-surface-container-low px-3 py-3 text-[12px] shadow-sm"
      }
      aria-labelledby={panelId}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: embed ? 18 : 20 }}>
          mic
        </span>
        <h3 id={panelId} className="font-headline font-bold text-on-surface">
          Prescription — voice to instructions
        </h3>
      </div>
      <p className="mt-1 text-on-surface-variant">
        Choose which line to fill, then speak. Stays in this section — no need to scroll to the main dictation bar.
      </p>

      <div className={`mt-2 flex flex-wrap items-end gap-2 ${embed ? "" : "gap-3"}`}>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Language</span>
          <select
            className="input-soft input-compact max-w-[140px] text-[13px]"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            disabled={listening}
          >
            <option value="en-IN">English (India)</option>
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
          </select>
        </label>
        <label className="flex min-w-[200px] flex-col gap-0.5 sm:min-w-[260px]">
          <span className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Medicine / target</span>
          <select
            className="input-soft input-compact text-[13px]"
            value={target}
            onChange={(e) => {
              const v = e.target.value;
              setTarget(v === "new" ? "new" : v);
              if (v === "new") queueMicrotask(() => scrollToNewInstructions());
            }}
            disabled={listening}
          >
            <option value="new">New line — Instructions (add form below)</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.medicine_name || "Medicine"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 pb-1.5 text-[12px] text-on-surface-variant">
          <input type="checkbox" checked={append} onChange={(e) => setAppend(e.target.checked)} disabled={listening} />
          Append
        </label>
      </div>

      <p className="mt-1 text-[11px] font-medium text-primary">{selectedLabel}</p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {!listening ? (
          <button type="button" className="btn-primary btn-compact text-xs" onClick={start}>
            <span className="inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">fiber_manual_record</span>
              Start
            </span>
          </button>
        ) : (
          <button type="button" className="btn-secondary btn-compact animate-pulse text-xs" onClick={stop}>
            <span className="inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">stop</span>
              Stop
            </span>
          </button>
        )}
        <button type="button" className="btn-secondary btn-compact text-xs" onClick={clearLine} disabled={listening || !line}>
          Clear text
        </button>
        <button type="button" className="btn-primary btn-compact text-xs" onClick={insertIntoField} disabled={!line.trim() || listening}>
          Insert into instructions
        </button>
      </div>

      <label className="mt-2 flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Live transcript</span>
        <textarea
          className="input-soft min-h-[56px] w-full py-2 text-[13px]"
          readOnly
          value={line}
          aria-live="polite"
          placeholder={listening ? "Listening…" : "Transcript appears here."}
        />
      </label>

      {error ? <p className="mt-1 text-[12px] text-error">{error}</p> : null}

      {target !== "new" && lines.some((l) => l.id === target) ? (
        <form
          className="mt-3 space-y-2 rounded-lg border border-outline-variant/25 bg-surface-container-low/50 p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaveError(null);
            const form = e.currentTarget;
            const fd = new FormData(form);
            fd.set("item_id", target);
            fd.set("visit_id", visitId);
            fd.set("embed", embed ? "1" : "");
            setSavePending(true);
            try {
              const res = await updatePrescriptionItemInstructionsAction(fd);
              if (res.ok) {
                const instr = String(fd.get("instructions") ?? "").trim() || null;
                onInstructionsSaved?.(target, instr);
              } else {
                setSaveError(res.error);
              }
            } finally {
              setSavePending(false);
            }
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
              Instructions for selected medicine
            </span>
            <textarea
              id="rx-instructions-for-voice"
              name="instructions"
              className="input-soft min-h-[72px] w-full py-2 text-[13px]"
              defaultValue={lines.find((l) => l.id === target)?.instructions ?? ""}
              key={target}
            />
          </label>
          <button type="submit" className="btn-secondary btn-compact text-xs" disabled={savePending}>
            {savePending ? "Saving…" : "Save instructions for this line"}
          </button>
          {saveError ? <p className="text-[12px] text-error">{saveError}</p> : null}
        </form>
      ) : null}
    </section>
  );
}
