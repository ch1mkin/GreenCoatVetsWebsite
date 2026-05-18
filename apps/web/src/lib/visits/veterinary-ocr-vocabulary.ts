import type { HandwrittenVisitFieldId } from "@/lib/visits/handwritten-visit-sheet";
import {
  filterPlausibleHandwrittenCandidates,
  isPlausibleHandwrittenOcr,
  scoreHandwrittenOcrPlausibility,
  stripOcrGarbage,
} from "@/lib/visits/handwritten-ocr-utils";

/** Terms commonly seen on GreenCoat-style veterinary visit sheets. */
export const VETERINARY_OCR_REFERENCE_TERMS = [
  "Canine",
  "Feline",
  "Exotic",
  "Avian",
  "Equine",
  "Rabies",
  "Nobivac",
  "DHPPi",
  "DHPP",
  "FVRCP",
  "Meloxicam",
  "Melonex",
  "Amoxicillin",
  "Amoxyclav",
  "Ceftriaxone",
  "Cefpodoxime",
  "Enrofloxacin",
  "Metronidazole",
  "Praziquantel",
  "Ivermectin",
  "Doxycycline",
  "Ciprofloxacin",
  "Prednisolone",
  "Dexamethasone",
  "Ondansetron",
  "Maropitant",
  "Cerenia",
  "CBC",
  "Chem 17",
  "Chem 15",
  "Chem 10",
  "SDMA",
  "TT4",
  "Snap 4Dx",
  "Parvo",
  "USG",
  "X-Ray",
  "NSAID",
  "NSAID 6",
  "CRP",
  "UPC",
  "PHBR",
  "Deworming",
  "Vaccination",
  "Physical examination",
  "Chief complaint",
  "History",
  "Diagnosis",
  "Prescription",
  "PO",
  "IM",
  "IV",
  "SC",
  "SID",
  "BID",
  "TID",
  "QID",
  "q12h",
  "q8h",
  "BD",
  "OD",
  "mg",
  "ml",
  "mcg",
  "tab",
  "cap",
  "susp",
  "inj",
  "syrup",
  "CRT",
  "RT",
  "RR",
  "HR",
  "B/W",
  "BAR",
  "QAR",
  "DAR",
  "Allergic",
  "Mohali",
  "otitis",
  "gastroenteritis",
  "dermatitis",
  "pyoderma",
  "UTI",
  "pancreatitis",
  "vomiting",
  "diarrhoea",
  "diarrhea",
  "lethargy",
  "inappetence",
  "lameness",
  "fever",
  "H/C",
  "C/C",
  "H/P",
  "after food",
  "before food",
];

const FIELD_VOCABULARY: Partial<Record<HandwrittenVisitFieldId, string[]>> = {
  patientName: ["Canine", "Feline", "Max", "Bruno", "Bella", "Lucy", "Tiger", "Rocky", "Simba"],
  ownerName: ["Mr", "Mrs", "Ms", "Dr"],
  mobile: ["+91"],
  age: ["y", "m", "years", "months", "weeks"],
  ccHp: ["vomiting", "diarrhoea", "diarrhea", "lethargy", "inappetence", "lameness", "fever", "H/C", "C/C", "H/P", "anorexia", "coughing", "sneezing"],
  dewormingText: ["Deworming", "Praziquantel", "Ivermectin", "Febendazole"],
  vaccinationText: ["Rabies", "Nobivac", "DHPPi", "FVRCP", "Vaccination"],
  rt: ["°F", "°C", "normal", "elevated", "afebrile"],
  rr: ["/min", "normal", "elevated"],
  hr: ["bpm", "/min", "normal", "elevated"],
  crt: ["<2 sec", "seconds", "prolonged", "normal"],
  allergic: ["yes", "no", "None", "Nil", "NKDA"],
  bw: ["kg", "g", "body weight"],
  otherTests: ["CBC", "Chem 17", "Chem 15", "SDMA", "USG", "X-Ray", "Snap 4Dx", "Parvo", "TT4"],
  physicalExamination: ["BAR", "QAR", "DAR", "dehydrated", "afebrile", "pale mucous membranes", "lymph nodes", "normal"],
  diagnosis: ["otitis", "gastroenteritis", "dermatitis", "pyoderma", "UTI", "pancreatitis", "conjunctivitis", "FRV"],
  prescription: [
    "Meloxicam",
    "Amoxicillin",
    "Enrofloxacin",
    "Metronidazole",
    "Cefpodoxime",
    "Doxycycline",
    "tab",
    "cap",
    "BD",
    "TID",
    "SID",
    "q12h",
    "PO",
    "after food",
    "inj",
  ],
};

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) matrix[i]![0] = i;
  for (let j = 0; j < cols; j++) matrix[0]![j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(matrix[i - 1]![j]! + 1, matrix[i]![j - 1]! + 1, matrix[i - 1]![j - 1]! + cost);
    }
  }
  return matrix[a.length]![b.length]!;
}

function dictionaryForField(fieldId: string): string[] {
  const specific = FIELD_VOCABULARY[fieldId as HandwrittenVisitFieldId] ?? [];
  return Array.from(new Set([...VETERINARY_OCR_REFERENCE_TERMS, ...specific]));
}

function fuzzyCorrectToken(token: string, dictionary: string[]): string {
  const trimmed = token.trim();
  if (trimmed.length < 2) return token;
  if (/^\d+([./]\d+)?$/.test(trimmed)) return token;

  const lower = trimmed.toLowerCase();
  const exact = dictionary.find((entry) => entry.toLowerCase() === lower);
  if (exact) return exact;

  const maxDistance = trimmed.length <= 4 ? 1 : trimmed.length <= 7 ? 2 : 3;
  let best = trimmed;
  let bestDistance = maxDistance + 1;

  for (const entry of dictionary) {
    if (Math.abs(entry.length - trimmed.length) > maxDistance + 1) continue;
    const distance = levenshtein(lower, entry.toLowerCase());
    if (distance < bestDistance) {
      bestDistance = distance;
      best = entry;
    }
  }

  return bestDistance <= maxDistance ? best : token;
}

export function veterinaryOcrPromptForField(fieldId: string, fieldLabel: string): string {
  const vocab = dictionaryForField(fieldId).slice(0, 100);
  return [
    `Field: ${fieldLabel}`,
    `Likely veterinary terms for this box: ${vocab.join(", ")}.`,
    "This is handwriting from a veterinary consultation form at an Indian small-animal clinic.",
    "Transcribe exactly what is written — use the vocabulary only as context, not to invent words.",
    "Prefer veterinary drug names, doses, vitals, and lab abbreviations over generic English.",
  ].join("\n");
}

/** Regex + fuzzy dictionary cleanup for OCR output. */
const NAME_FIELDS = new Set<HandwrittenVisitFieldId>(["patientName", "ownerName"]);

export function applyVeterinaryOcrCleanup(fieldId: string, text: string): string {
  let value = stripOcrGarbage(text.trim());
  if (!value) return value;

  if (NAME_FIELDS.has(fieldId as HandwrittenVisitFieldId)) {
    value = value
      .replace(/[^A-Za-z\s'.-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return value;
  }

  const replacements: Array<[RegExp, string]> = [
    [/\bChem\s*1\s*7\b/gi, "Chem 17"],
    [/\bChem\s*1\s*5\b/gi, "Chem 15"],
    [/\bChem\s*1\s*0\b/gi, "Chem 10"],
    [/\bNSAID\s*6\b/gi, "NSAID 6"],
    [/\bSnap\s*4\s*Dx\b/gi, "Snap 4Dx"],
    [/\bX\s*[- ]?\s*Ray\b/gi, "X-Ray"],
    [/\bUSG\b/gi, "USG"],
    [/\bq\s*12\s*h\b/gi, "q12h"],
    [/\bq\s*8\s*h\b/gi, "q8h"],
    [/\bB\s*\/\s*D\b/gi, "BD"],
    [/\bT\s*I\s*D\b/gi, "TID"],
    [/\bS\s*I\s*D\b/gi, "SID"],
    [/\bP\s*O\b/gi, "PO"],
    [/\bI\s*M\b/gi, "IM"],
    [/\bI\s*V\b/gi, "IV"],
    [/\bS\s*C\b/gi, "SC"],
    [/\bC\s*\/\s*C\b/gi, "C/C"],
    [/\bH\s*\/\s*P\b/gi, "H/P"],
    [/\bMelonex\b/gi, "Meloxicam"],
    [/\b0titis\b/gi, "otitis"],
  ];

  for (const [pattern, replacement] of replacements) {
    value = value.replace(pattern, replacement);
  }

  const dictionary = dictionaryForField(fieldId);
  value = value
    .split(/(\s+)/)
    .map((part) => (/\s/.test(part) ? part : fuzzyCorrectToken(part, dictionary)))
    .join("");

  return value.replace(/\s+/g, " ").trim();
}

export function scoreVeterinaryOcrText(fieldId: string, text: string): number {
  const normalized = text.trim();
  if (!normalized) return 0;
  if (!isPlausibleHandwrittenOcr(fieldId, normalized)) return -1000;
  const plausibility = scoreHandwrittenOcrPlausibility(fieldId, normalized);
  const dictionary = dictionaryForField(fieldId);
  const lowerDict = new Set(dictionary.map((entry) => entry.toLowerCase()));
  const tokens = normalized.split(/\s+/).filter(Boolean);
  let score = Math.min(normalized.length, 80) * 0.05;
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (lowerDict.has(lower)) score += 8;
    if (/^\d+([./]\d+)?$/.test(token)) score += 3;
    if (/^(mg|ml|tab|cap|bd|tid|sid|po|im|iv|sc)$/i.test(token)) score += 5;
  }
  if (fieldId === "mobile" && /\d{8,}/.test(normalized)) score += 10;
  if (["rt", "rr", "hr", "bw", "crt"].includes(fieldId) && /\d/.test(normalized)) score += 6;
  return score + plausibility;
}

export function pickBestVeterinaryOcrCandidate(fieldId: string, candidates: string[]): string {
  const plausible = filterPlausibleHandwrittenCandidates(fieldId, candidates);
  const source = plausible.length ? plausible : candidates;
  const cleaned = source
    .map((candidate) => applyVeterinaryOcrCleanup(fieldId, candidate))
    .filter((candidate) => candidate.length > 0 && isPlausibleHandwrittenOcr(fieldId, candidate));
  if (!cleaned.length) return "";
  return cleaned.sort((a, b) => scoreVeterinaryOcrText(fieldId, b) - scoreVeterinaryOcrText(fieldId, a))[0] ?? "";
}
