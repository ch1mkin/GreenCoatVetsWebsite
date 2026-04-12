/**
 * Best-effort parsing of spoken clinical notes into form field keys.
 * Doctors can say labels like "Symptoms colon" or "Diagnosis —" before each section.
 */

export type ParsedVisitFields = Partial<{
  symptoms: string;
  diagnosis: string;
  treatment_plan: string;
  patient_complaint: string;
  cc_hp: string;
  physical_examination: string;
  section_deworming: string;
  section_vaccination: string;
}>;

const LABELS: { re: RegExp; key: keyof ParsedVisitFields }[] = [
  {
    re: /^(?:patient\s+complaint|presenting\s+complaint|reason\s+for\s+visit|complaint)\s*[:\-–—]\s*/i,
    key: "patient_complaint",
  },
  { re: /^(?:chief\s+complaint|cc\s*\/\s*hpi|hpi|history\s+of\s+present)\s*[:\-–—]\s*/i, key: "cc_hp" },
  { re: /^(?:symptoms?|subjective)\s*[:\-–—]\s*/i, key: "symptoms" },
  { re: /^(?:diagnosis|assessment)\s*[:\-–—]\s*/i, key: "diagnosis" },
  { re: /^(?:treatment(?:\s+plan)?|plan)\s*[:\-–—]\s*/i, key: "treatment_plan" },
  { re: /^(?:physical(?:\s+exam(?:ination)?)?|objective|exam)\s*[:\-–—]\s*/i, key: "physical_examination" },
  { re: /^deworming\s*[:\-–—]\s*/i, key: "section_deworming" },
  { re: /^vaccination\s*[:\-–—]\s*/i, key: "section_vaccination" },
];

/**
 * Split narrative into sections when lines start with recognized headers.
 */
export function parseLabeledClinicalSpeech(raw: string): ParsedVisitFields {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return {};

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const out: Record<string, string> = {};
  let current: keyof ParsedVisitFields | null = null;

  const tryStartLine = (line: string): boolean => {
    for (const { re, key } of LABELS) {
      const m = line.match(re);
      if (m) {
        current = key;
        const rest = line.slice(m[0].length).trim();
        if (rest) {
          out[key] = out[key] ? `${out[key]} ${rest}` : rest;
        }
        return true;
      }
    }
    return false;
  };

  for (const line of lines) {
    if (tryStartLine(line)) continue;
    if (current) {
      const k = current;
      out[k] = out[k] ? `${out[k]}\n${line}` : line;
    }
  }

  // Single block without labels: treat whole text as CC/HPI if nothing matched
  if (!Object.keys(out).length && text.length > 0) {
    return { cc_hp: text };
  }

  return out as ParsedVisitFields;
}
