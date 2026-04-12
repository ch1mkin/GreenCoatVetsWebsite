"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { parseLabeledClinicalSpeech } from "@/lib/clinical/visit-speech-parse";

/** Clinical + SOAP live in one form so dictation targets all fields under the same root. */
const FORM_VISIT_RECORD = "#form-visit-record";
/** Add-medicine row on the visit — instructions textarea lives in this form. */
const FORM_RX_ADD = "#form-rx-add";

type Target = { name: string; label: string };

const FIELD_TARGETS: Target[] = [
  { name: "patient_complaint", label: "Patient complaint" },
  { name: "cc_hp", label: "CC / HPI" },
  { name: "physical_examination", label: "Physical examination" },
  { name: "section_deworming", label: "Deworming" },
  { name: "section_vaccination", label: "Vaccination" },
  { name: "tests_other", label: "Other tests" },
  { name: "param_rt", label: "Parameter: RT" },
  { name: "param_rr", label: "Parameter: RR" },
  { name: "param_hr", label: "Parameter: HR" },
  { name: "param_crt", label: "Parameter: CRT" },
  { name: "param_allergic", label: "Parameter: Allergic" },
  { name: "param_bw", label: "Parameter: B/W" },
  { name: "symptoms", label: "SOAP — Symptoms" },
  { name: "diagnosis", label: "SOAP — Diagnosis" },
  { name: "treatment_plan", label: "SOAP — Treatment plan" },
  { name: "instructions", label: "Rx — Instructions (new medicine line)" },
];

function setNamedFieldValue(name: string, value: string, append: boolean): boolean {
  const roots = [document.querySelector(FORM_VISIT_RECORD), document.querySelector(FORM_RX_ADD)].filter(
    (n): n is Element => Boolean(n),
  );
  let el: Element | null = null;
  for (const root of roots) {
    el = root.querySelector(`[name="${CSS.escape(name)}"]`);
    if (el) break;
  }
  if (!el) return false;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const next =
      append && el.value.trim() ? `${el.value.trim()}\n\n${value.trim()}` : value.trim();
    el.value = next;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.focus();
    return true;
  }
  return false;
}

export function VisitVoiceDictation({ embed }: { embed?: boolean }) {
  const panelId = useId();
  const [lang, setLang] = useState("en-IN");
  const [target, setTarget] = useState<string>(FIELD_TARGETS[0]!.name);
  const [append, setAppend] = useState(true);
  const { status, line, error, start, stop, clearLine } = useSpeechRecognition(lang);

  const selected = useMemo(() => FIELD_TARGETS.find((t) => t.name === target) ?? FIELD_TARGETS[0]!, [target]);

  const insertIntoField = useCallback(() => {
    if (!line.trim()) return;
    const ok = setNamedFieldValue(selected.name, line, append);
    if (ok) clearLine();
  }, [line, selected, append, clearLine]);

  const applyParsedSections = useCallback(() => {
    if (!line.trim()) return;
    const parsed = parseLabeledClinicalSpeech(line);
    let n = 0;
    for (const [key, val] of Object.entries(parsed)) {
      if (!val?.trim()) continue;
      const t = FIELD_TARGETS.find((x) => x.name === key);
      if (!t) continue;
      if (setNamedFieldValue(key, val, append)) n += 1;
    }
    if (n > 0) clearLine();
  }, [line, append, clearLine]);

  if (status === "unsupported") {
    return (
      <section
        className={
          embed
            ? "rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] text-amber-900"
            : "rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950"
        }
        aria-label="Voice dictation unavailable"
      >
        <p className="font-semibold">Voice dictation is not available in this browser.</p>
        <p className="mt-1 opacity-90">Use Chrome or Edge on desktop for speech recognition, or type as usual.</p>
      </section>
    );
  }

  const listening = status === "listening";

  return (
    <section
      className={
        embed
          ? "rounded-lg border border-primary/25 bg-primary-fixed/15 px-2 py-2 text-[11px]"
          : "rounded-xl border border-primary/30 bg-surface-container-low px-4 py-3 text-sm shadow-sm"
      }
      aria-labelledby={panelId}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: embed ? 18 : 22 }}>
          mic
        </span>
        <h2 id={panelId} className="font-headline font-bold text-on-surface">
          Voice dictation
        </h2>
        <span className="text-on-surface-variant">Speak and insert into visit fields (on-device in supported browsers).</span>
      </div>

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
        <label className="flex min-w-[180px] flex-col gap-0.5 sm:min-w-[220px]">
          <span className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Target field</span>
          <select
            className="input-soft input-compact text-[13px]"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            disabled={listening}
          >
            {FIELD_TARGETS.map((t) => (
              <option key={t.name} value={t.name}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 pb-1.5 text-[12px] text-on-surface-variant">
          <input type="checkbox" checked={append} onChange={(e) => setAppend(e.target.checked)} disabled={listening} />
          Append
        </label>
      </div>

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
        <button
          type="button"
          className="btn-primary btn-compact text-xs"
          onClick={insertIntoField}
          disabled={!line.trim() || listening}
        >
          Insert into target field
        </button>
        <button
          type="button"
          className="btn-secondary btn-compact text-xs"
          onClick={applyParsedSections}
          disabled={!line.trim() || listening}
          title='Use lines like "Symptoms: …" or "Diagnosis: …" then apply to multiple fields'
        >
          Parse labeled speech
        </button>
      </div>

      <label className="mt-2 flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Live transcript</span>
        <textarea
          className="input-soft min-h-[72px] w-full py-2 text-[13px]"
          readOnly
          value={line}
          aria-live="polite"
          placeholder={listening ? "Listening…" : "Transcript appears here. You can edit the form fields directly anytime."}
        />
      </label>

      {error ? <p className="mt-1 text-[12px] text-error">{error}</p> : null}

      <p className="mt-2 text-[11px] leading-snug text-on-surface-variant">
        Tip: Say section names before each part, for example &quot;Symptoms colon lethargy&quot; then &quot;Diagnosis colon mild
        fever&quot;, then use <strong>Parse labeled speech</strong>. Grant microphone permission when prompted. Processing stays in
        your browser.
      </p>
    </section>
  );
}
