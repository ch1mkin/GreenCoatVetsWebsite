import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";
import { assertVisitReportAccess } from "@/lib/visits/visit-report-access";
import { normalizeHandwrittenOcrText, pickBestHandwrittenOcrText } from "@/lib/visits/handwritten-ocr-utils";
import {
  applyVeterinaryOcrCleanup,
  pickBestVeterinaryOcrCandidate,
  veterinaryOcrPromptForField,
} from "@/lib/visits/veterinary-ocr-vocabulary";

export type RecognizeHandwrittenRegionResult =
  | { ok: true; text: string; confidence: "high" | "medium" | "low"; source: "openrouter" | "local" }
  | { ok: false; error: string };

const HANDWRITTEN_FIELD_TRANSCRIPTION_HINTS: Record<string, string> = {
  patientName: "Pet name. Preserve unusual spellings letter by letter.",
  ownerName: "Person name. Preserve exact spelling.",
  mobile: "Phone number — digits, spaces, +, - only.",
  date: "Date with / or - separators.",
  age: "Short age like 2y, 8m, 4 years.",
  ccHp: "Chief complaint / history. Veterinary shorthand, abbreviations, multiple words.",
  dewormingText: "Short note — dates, medicine names.",
  vaccinationText: "Short note — dates, vaccine names.",
  rt: "Vital measurement — digits and units only.",
  rr: "Vital measurement — digits and units only.",
  hr: "Vital measurement — digits and units only.",
  crt: "Clinical value — digits, symbols, brief units.",
  allergic: "Short allergy note or yes/no.",
  bw: "Body weight — digits and units.",
  otherTests: "Test names and abbreviations.",
  physicalExamination: "Multi-line exam notes. Preserve abbreviations and line breaks.",
  diagnosis: "Diagnosis — medical terms, abbreviations.",
  prescription: "Medicines, doses, abbreviations, line breaks.",
};

function extractAssistantTextContent(
  content:
    | string
    | Array<{ type?: string; text?: string }>
    | null
    | undefined,
) {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((item) => (item?.type === "text" && typeof item.text === "string" ? item.text : ""))
    .join("\n")
    .trim();
}

function parseHandwrittenOcrJson(raw: string): { text: string; confidence: "high" | "medium" | "low" } | null {
  const trimmed = raw.trim();
  const jsonLike = trimmed.match(/\{[\s\S]*\}/)?.[0] ?? trimmed;
  try {
    const parsed = JSON.parse(jsonLike) as { text?: unknown; confidence?: unknown };
    const text = normalizeHandwrittenOcrText(typeof parsed.text === "string" ? parsed.text : "");
    const confidence =
      parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low"
        ? parsed.confidence
        : "medium";
    return { text, confidence };
  } catch {
    return null;
  }
}

function mergeOcrCandidates(fieldId: string, candidates: string[]) {
  const normalized = candidates.map((candidate) => normalizeHandwrittenOcrText(candidate)).filter(Boolean);
  if (!normalized.length) return "";
  const voted = pickBestHandwrittenOcrText(normalized);
  const veterinary = pickBestVeterinaryOcrCandidate(fieldId, normalized);
  if (!voted) return veterinary;
  if (!veterinary) return applyVeterinaryOcrCleanup(fieldId, voted);
  return pickBestVeterinaryOcrCandidate(fieldId, [voted, veterinary]);
}

export async function recognizeHandwrittenRegionCore(input: {
  visitId: string;
  fieldId: string;
  fieldLabel: string;
  singleLine?: boolean;
  rawDataUrl: string;
  contrastDataUrl: string;
  boostedDataUrl: string;
  thinStrokeDataUrl?: string;
  localCandidates?: string[];
}): Promise<RecognizeHandwrittenRegionResult> {
  const fieldId = String(input.fieldId ?? "").trim();
  const localCandidates = Array.isArray(input.localCandidates)
    ? input.localCandidates.map((c) => String(c ?? "").trim()).filter(Boolean).slice(0, 8)
    : [];

  try {
    const access = await getUserAccess();
    if (access.membership?.role === "pet_owner") {
      return { ok: false, error: "Only clinic staff can run handwritten OCR." };
    }

    const visitId = String(input.visitId ?? "").trim();
    if (!visitId) {
      return { ok: false, error: "Visit id is required for OCR." };
    }

    const supabase = createClient();
    await assertVisitReportAccess(supabase, access, visitId);

    const rawDataUrl = String(input.rawDataUrl ?? "").trim();
    const contrastDataUrl = String(input.contrastDataUrl ?? "").trim();
    const boostedDataUrl = String(input.boostedDataUrl ?? "").trim();
    const thinStrokeDataUrl = String(input.thinStrokeDataUrl ?? "").trim();

    if (!rawDataUrl || !contrastDataUrl || !boostedDataUrl) {
      return { ok: false, error: "Handwritten OCR images are missing." };
    }

    const localBest = mergeOcrCandidates(fieldId, localCandidates);
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      if (!localBest) {
        return { ok: false, error: "Missing OPENROUTER_API_KEY and no on-device OCR result was available." };
      }
      return { ok: true, text: localBest, confidence: "low", source: "local" };
    }

    const model =
      process.env.OPENROUTER_VISION_MODEL ||
      process.env.OPENROUTER_OCR_MODEL ||
      "openai/gpt-4o";
    const fieldLabel = String(input.fieldLabel ?? "").trim() || "clinical handwritten field";
    const fieldHint =
      HANDWRITTEN_FIELD_TRANSCRIPTION_HINTS[fieldId] || "Transcribe veterinary clinic handwriting exactly.";
    const vetContext = veterinaryOcrPromptForField(fieldId, fieldLabel);

    const localHint =
      localCandidates.length > 0
        ? `Weak on-device guesses (use only if they match the image): ${localCandidates.slice(0, 4).map((c) => JSON.stringify(c)).join(", ")}`
        : "";

    const imageParts = [
      { type: "image_url", image_url: { url: boostedDataUrl } },
      { type: "image_url", image_url: { url: thinStrokeDataUrl || contrastDataUrl } },
      { type: "image_url", image_url: { url: contrastDataUrl } },
      { type: "image_url", image_url: { url: rawDataUrl } },
    ];

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 420,
        messages: [
          {
            role: "system",
            content: [
              "You are a veterinary clinical handwriting transcription specialist for Indian small-animal clinics.",
              "The images are crops from a printed visit form filled in by a veterinarian.",
              "Expect pet names, owner names, drug names (Meloxicam, Amoxicillin, Enrofloxacin), doses (mg, ml, tab, BD, TID, q12h, PO, IM),",
              "vitals (RT, RR, HR, CRT, B/W), lab tests (CBC, Chem 17, SDMA, Snap 4Dx, USG, X-Ray), vaccines, and diagnosis shorthand.",
              "Read cursive and messy script letter-by-letter. Never replace visible letters with unrelated common English words.",
              "Preserve veterinary abbreviations exactly. Keep numbers, decimals, slashes, and line breaks.",
              'Return JSON only: {"text":"...","confidence":"high|medium|low"}.',
            ].join(" "),
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: [
                  vetContext,
                  `Layout: ${input.singleLine ? "single line" : "multi-line"}`,
                  `Field-specific: ${fieldHint}`,
                  localHint,
                  "Compare all enhanced images of the same ink. Output only text that is visibly written.",
                ]
                  .filter(Boolean)
                  .join("\n"),
              },
              ...imageParts,
            ],
          },
        ],
      }),
    });

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: { content?: string | Array<{ type?: string; text?: string }> };
      }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      if (localBest) {
        return { ok: true, text: localBest, confidence: "low", source: "local" };
      }
      return { ok: false, error: payload.error?.message ?? "Handwritten OCR failed." };
    }

    const rawContent = extractAssistantTextContent(payload.choices?.[0]?.message?.content);
    const parsed = parseHandwrittenOcrJson(rawContent);
    const cloudText = normalizeHandwrittenOcrText(parsed?.text || rawContent);
    const merged = mergeOcrCandidates(fieldId, [cloudText, localBest, ...localCandidates]);

    if (merged) {
      return {
        ok: true,
        text: merged,
        confidence: parsed?.confidence ?? (cloudText ? "high" : "low"),
        source: cloudText ? "openrouter" : "local",
      };
    }

    return { ok: false, error: "No OCR text could be extracted from the handwritten region." };
  } catch (error) {
    const localBest = mergeOcrCandidates(fieldId, localCandidates);
    if (localBest) {
      return { ok: true, text: localBest, confidence: "low", source: "local" };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to run handwritten OCR.",
    };
  }
}
