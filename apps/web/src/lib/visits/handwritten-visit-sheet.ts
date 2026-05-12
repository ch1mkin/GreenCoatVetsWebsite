import { REFERRED_TEST_OPTIONS } from "@/lib/clinical/referred-tests";

export const HANDWRITTEN_VISIT_SHEET_WIDTH = 1000;
export const HANDWRITTEN_VISIT_SHEET_HEIGHT = 1414;
export const HANDWRITTEN_VISIT_STATE_VERSION = 2;

export type HandwrittenVisitPoint = { x: number; y: number };
export type HandwrittenVisitRect = { x: number; y: number; width: number; height: number };

export type HandwrittenVisitHighlightStroke = {
  id: string;
  width: number;
  points: HandwrittenVisitPoint[];
};

export type HandwrittenVisitWordToken = {
  id: string;
  fieldId: HandwrittenVisitFieldId;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
};

export type HandwrittenVisitWritableRegionMode = "ink" | "ocr";

export type HandwrittenVisitWritableRegionState = {
  mode: HandwrittenVisitWritableRegionMode;
  text: string;
  ocrText: string;
  fabricJson: Record<string, unknown> | null;
  ocrFabricJson: Record<string, unknown> | null;
  inkBounds: HandwrittenVisitRect | null;
  textBox: HandwrittenVisitRect | null;
  fontSize: number | null;
};

export type HandwrittenVisitFieldId =
  | "patientName"
  | "age"
  | "ownerName"
  | "mobile"
  | "date"
  | "ccHp"
  | "dewormingText"
  | "vaccinationText"
  | "rt"
  | "rr"
  | "hr"
  | "crt"
  | "allergic"
  | "bw"
  | "otherTests"
  | "physicalExamination"
  | "diagnosis"
  | "prescription";

export type HandwrittenVisitCheckboxId =
  | "speciesCanine"
  | "speciesFeline"
  | "speciesExotic"
  | "speciesAvian"
  | "speciesEquine"
  | "genderMale"
  | "genderFemale"
  | "deworming"
  | "vaccination"
  | "testCBC"
  | "testNSAID6"
  | "testCHEM17"
  | "testCHEM15"
  | "testCHEM10"
  | "testSDMA"
  | "testTT4"
  | "testFRU"
  | "testPHBR"
  | "testUPC"
  | "testCRP"
  | "testP4"
  | "testSnap4Dx"
  | "testParvo"
  | "testXRay"
  | "testUSG";

export type HandwrittenVisitSheetState = {
  version: number;
  fields: Record<HandwrittenVisitFieldId, string>;
  checkboxes: Record<HandwrittenVisitCheckboxId, boolean>;
  wordTokens: HandwrittenVisitWordToken[];
  highlights: HandwrittenVisitHighlightStroke[];
  inkFallbacks: HandwrittenVisitHighlightStroke[];
  ocrRegions: Record<HandwrittenVisitFieldId, HandwrittenVisitWritableRegionState>;
};

export type HandwrittenVisitInitialStateInput = {
  patientName?: string | null;
  patientAge?: string | null;
  ownerName?: string | null;
  mobile?: string | null;
  date?: string | null;
  species?: string | null;
  gender?: string | null;
  ccHp?: string | null;
  dewormingText?: string | null;
  vaccinationText?: string | null;
  rt?: string | null;
  rr?: string | null;
  hr?: string | null;
  crt?: string | null;
  allergic?: string | null;
  bw?: string | null;
  testsReferred?: string[] | null;
  otherTests?: string | null;
  physicalExamination?: string | null;
  diagnosis?: string | null;
  prescription?: string | null;
};

export const HANDWRITTEN_VISIT_FIELD_IDS: HandwrittenVisitFieldId[] = [
  "patientName",
  "age",
  "ownerName",
  "mobile",
  "date",
  "ccHp",
  "dewormingText",
  "vaccinationText",
  "rt",
  "rr",
  "hr",
  "crt",
  "allergic",
  "bw",
  "otherTests",
  "physicalExamination",
  "diagnosis",
  "prescription",
];

const CHECKBOX_IDS: HandwrittenVisitCheckboxId[] = [
  "speciesCanine",
  "speciesFeline",
  "speciesExotic",
  "speciesAvian",
  "speciesEquine",
  "genderMale",
  "genderFemale",
  "deworming",
  "vaccination",
  "testCBC",
  "testNSAID6",
  "testCHEM17",
  "testCHEM15",
  "testCHEM10",
  "testSDMA",
  "testTT4",
  "testFRU",
  "testPHBR",
  "testUPC",
  "testCRP",
  "testP4",
  "testSnap4Dx",
  "testParvo",
  "testXRay",
  "testUSG",
];

const TEST_CHECKBOX_MAP: Record<string, HandwrittenVisitCheckboxId> = {
  CBC: "testCBC",
  "NSAID 6": "testNSAID6",
  "CHEM 17": "testCHEM17",
  "CHEM 15": "testCHEM15",
  "CHEM 10": "testCHEM10",
  SDMA: "testSDMA",
  TT4: "testTT4",
  FRU: "testFRU",
  PHBR: "testPHBR",
  UPC: "testUPC",
  CRP: "testCRP",
  P4: "testP4",
  "Snap 4Dx": "testSnap4Dx",
  Parvo: "testParvo",
  "X ray": "testXRay",
  USG: "testUSG",
};

function createEmptyFields(): Record<HandwrittenVisitFieldId, string> {
  return HANDWRITTEN_VISIT_FIELD_IDS.reduce(
    (acc, fieldId) => {
      acc[fieldId] = "";
      return acc;
    },
    {} as Record<HandwrittenVisitFieldId, string>,
  );
}

function createEmptyWritableRegions(): Record<HandwrittenVisitFieldId, HandwrittenVisitWritableRegionState> {
  return HANDWRITTEN_VISIT_FIELD_IDS.reduce(
    (acc, fieldId) => {
      acc[fieldId] = {
        mode: "ink",
        text: "",
        ocrText: "",
        fabricJson: null,
        ocrFabricJson: null,
        inkBounds: null,
        textBox: null,
        fontSize: null,
      };
      return acc;
    },
    {} as Record<HandwrittenVisitFieldId, HandwrittenVisitWritableRegionState>,
  );
}

function createEmptyCheckboxes(): Record<HandwrittenVisitCheckboxId, boolean> {
  return CHECKBOX_IDS.reduce(
    (acc, checkboxId) => {
      acc[checkboxId] = false;
      return acc;
    },
    {} as Record<HandwrittenVisitCheckboxId, boolean>,
  );
}

function inferGenderCheckboxes(gender: string | null | undefined): Partial<Record<HandwrittenVisitCheckboxId, boolean>> {
  const normalized = String(gender ?? "").trim().toLowerCase();
  if (normalized.startsWith("m")) return { genderMale: true };
  if (normalized.startsWith("f")) return { genderFemale: true };
  return {};
}

export function formatPrescriptionLines(
  items: Array<{
    medicine_name?: string | null;
    dosage?: string | null;
    frequency?: string | null;
    duration?: string | null;
    instructions?: string | null;
  }>,
): string {
  return items
    .map((item) => {
      const name = String(item.medicine_name ?? "").trim();
      if (!name) return "";
      const parts = [
        String(item.dosage ?? "").trim(),
        String(item.frequency ?? "").trim(),
        String(item.duration ?? "").trim(),
      ].filter(Boolean);
      const instructions = String(item.instructions ?? "").trim();
      return `${name}${parts.length ? ` - ${parts.join("; ")}` : ""}${instructions ? `. ${instructions}` : ""}`.trim();
    })
    .filter(Boolean)
    .join("\n");
}

export function createHandwrittenVisitSheetState(
  input: HandwrittenVisitInitialStateInput,
): HandwrittenVisitSheetState {
  const fields = createEmptyFields();
  const checkboxes = createEmptyCheckboxes();

  fields.patientName = String(input.patientName ?? "").trim();
  fields.age = String(input.patientAge ?? "").trim();
  fields.ownerName = String(input.ownerName ?? "").trim();
  fields.mobile = String(input.mobile ?? "").trim();
  fields.date = String(input.date ?? "").trim();
  Object.assign(checkboxes, inferGenderCheckboxes(input.gender));

  return {
    version: HANDWRITTEN_VISIT_STATE_VERSION,
    fields,
    checkboxes,
    wordTokens: [],
    highlights: [],
    inkFallbacks: [],
    ocrRegions: createEmptyWritableRegions(),
  };
}

export function normalizeHandwrittenVisitSheetState(
  raw: unknown,
  fallback: HandwrittenVisitSheetState,
): HandwrittenVisitSheetState {
  if (!raw || typeof raw !== "object") return fallback;
  const value = raw as Partial<HandwrittenVisitSheetState>;
  const fields = createEmptyFields();
  const checkboxes = createEmptyCheckboxes();
  const ocrRegions = createEmptyWritableRegions();

  for (const fieldId of HANDWRITTEN_VISIT_FIELD_IDS) {
    fields[fieldId] = typeof value.fields?.[fieldId] === "string" ? value.fields[fieldId] : fallback.fields[fieldId];
    const rawRegion = value.ocrRegions?.[fieldId];
    ocrRegions[fieldId] = {
      mode: rawRegion?.mode === "ocr" ? "ocr" : "ink",
      text: typeof rawRegion?.text === "string" ? rawRegion.text : "",
      ocrText: typeof rawRegion?.ocrText === "string" ? rawRegion.ocrText : "",
      fabricJson:
        rawRegion?.fabricJson && typeof rawRegion.fabricJson === "object" && !Array.isArray(rawRegion.fabricJson)
          ? rawRegion.fabricJson
          : null,
      ocrFabricJson:
        rawRegion?.ocrFabricJson && typeof rawRegion.ocrFabricJson === "object" && !Array.isArray(rawRegion.ocrFabricJson)
          ? rawRegion.ocrFabricJson
          : null,
      inkBounds:
        rawRegion?.inkBounds &&
        typeof rawRegion.inkBounds === "object" &&
        typeof rawRegion.inkBounds.x === "number" &&
        typeof rawRegion.inkBounds.y === "number" &&
        typeof rawRegion.inkBounds.width === "number" &&
        typeof rawRegion.inkBounds.height === "number"
          ? rawRegion.inkBounds
          : null,
      textBox:
        rawRegion?.textBox &&
        typeof rawRegion.textBox === "object" &&
        typeof rawRegion.textBox.x === "number" &&
        typeof rawRegion.textBox.y === "number" &&
        typeof rawRegion.textBox.width === "number" &&
        typeof rawRegion.textBox.height === "number"
          ? rawRegion.textBox
          : null,
      fontSize:
        typeof rawRegion?.fontSize === "number" && Number.isFinite(rawRegion.fontSize) ? rawRegion.fontSize : null,
    };
  }
  for (const checkboxId of CHECKBOX_IDS) {
    checkboxes[checkboxId] =
      typeof value.checkboxes?.[checkboxId] === "boolean" ? value.checkboxes[checkboxId] : fallback.checkboxes[checkboxId];
  }

  const highlights = Array.isArray(value.highlights)
    ? value.highlights.filter(
        (stroke): stroke is HandwrittenVisitHighlightStroke =>
          Boolean(stroke) &&
          typeof stroke === "object" &&
          typeof stroke.id === "string" &&
          typeof stroke.width === "number" &&
          Array.isArray(stroke.points),
      )
    : fallback.highlights;
  const wordTokens = Array.isArray(value.wordTokens)
    ? value.wordTokens.filter(
        (token): token is HandwrittenVisitWordToken =>
          Boolean(token) &&
          typeof token === "object" &&
          typeof token.id === "string" &&
          typeof token.fieldId === "string" &&
          typeof token.text === "string" &&
          typeof token.x === "number" &&
          typeof token.y === "number" &&
          typeof token.width === "number" &&
          typeof token.height === "number" &&
          typeof token.fontSize === "number",
      )
    : [];
  const inkFallbacks = Array.isArray(value.inkFallbacks)
    ? value.inkFallbacks.filter(
        (stroke): stroke is HandwrittenVisitHighlightStroke =>
          Boolean(stroke) &&
          typeof stroke === "object" &&
          typeof stroke.id === "string" &&
          typeof stroke.width === "number" &&
          Array.isArray(stroke.points),
      )
    : fallback.inkFallbacks;

  return {
    version:
      typeof value.version === "number" && Number.isFinite(value.version)
        ? value.version
        : HANDWRITTEN_VISIT_STATE_VERSION,
    fields,
    checkboxes,
    wordTokens,
    highlights,
    inkFallbacks,
    ocrRegions,
  };
}

export function buildHandwrittenVisitStatePath(clinicId: string, petId: string, visitId: string) {
  return `${clinicId}/pets/${petId}/visits/${visitId}/visit-report-handwritten-state.json`;
}

export function listCheckedReferredTests(
  checkboxes: Record<HandwrittenVisitCheckboxId, boolean>,
): string[] {
  return REFERRED_TEST_OPTIONS.filter((code) => {
    const checkboxId = TEST_CHECKBOX_MAP[code];
    return checkboxId ? Boolean(checkboxes[checkboxId]) : false;
  });
}
