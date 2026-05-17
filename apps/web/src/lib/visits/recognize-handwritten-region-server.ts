import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";
import { assertVisitReportAccess } from "@/lib/visits/visit-report-access";
import { normalizeHandwrittenOcrText, pickBestHandwrittenOcrText } from "@/lib/visits/handwritten-ocr-utils";

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

export async function recognizeHandwrittenRegionCore(input: {
  visitId: string;
  fieldId: string;
  fieldLabel: string;
  singleLine?: boolean;
  rawDataUrl: string;
  contrastDataUrl: string;
  boostedDataUrl: string;
  localCandidates?: string[];
}): Promise<RecognizeHandwrittenRegionResult> {
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
    const localCandidates = Array.isArray(input.localCandidates)
      ? input.localCandidates.map((c) => String(c ?? "").trim()).filter(Boolean).slice(0, 8)
      : [];

    if (!rawDataUrl || !contrastDataUrl || !boostedDataUrl) {
      return { ok: false, error: "Handwritten OCR images are missing." };
    }

    const localBest = pickBestHandwrittenOcrText(localCandidates);
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      if (!localBest) {
        return { ok: false, error: "Missing OPENROUTER_API_KEY and no on-device OCR result was available." };
      }
      return { ok: true, text: localBest, confidence: "low", source: "local" };
    }

    const model = process.env.OPENROUTER_VISION_MODEL || process.env.OPENROUTER_OCR_MODEL || "openai/gpt-4.1";
    const fieldLabel = String(input.fieldLabel ?? "").trim() || "clinical handwritten field";
    const fieldHint =
      HANDWRITTEN_FIELD_TRANSCRIPTION_HINTS[String(input.fieldId ?? "").trim()] ||
      "Transcribe handwriting exactly. Do not autocorrect.";

    const localHint =
      localCandidates.length > 0
        ? `On-device OCR candidates (may be imperfect): ${localCandidates.map((c) => JSON.stringify(c)).join(", ")}`
        : "";

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 320,
        messages: [
          {
            role: "system",
            content:
              'You transcribe messy veterinary handwriting from images. The writing may be cursive, faint, or abbreviated. Read each character visually; do not substitute common English words when letters do not match. Preserve abbreviations (q12h, PO, IM), numbers, slashes, and line breaks. Return JSON only: {"text":"...","confidence":"high|medium|low"}.',
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: [
                  `Field: ${fieldLabel}`,
                  `Layout: ${input.singleLine ? "single line" : "multi-line"}`,
                  `Hint: ${fieldHint}`,
                  localHint,
                  "Use all three image variants of the same crop. Prefer literal visible characters over dictionary guesses.",
                ]
                  .filter(Boolean)
                  .join("\n"),
              },
              { type: "image_url", image_url: { url: boostedDataUrl } },
              { type: "image_url", image_url: { url: contrastDataUrl } },
              { type: "image_url", image_url: { url: rawDataUrl } },
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
    const merged = pickBestHandwrittenOcrText([cloudText, ...localCandidates].filter(Boolean));

    if (merged) {
      const usedLocal = !cloudText || (localBest && merged === localBest && cloudText !== localBest);
      return {
        ok: true,
        text: merged,
        confidence: parsed?.confidence ?? (usedLocal ? "low" : "medium"),
        source: usedLocal && !cloudText ? "local" : "openrouter",
      };
    }

    if (localBest) {
      return { ok: true, text: localBest, confidence: "low", source: "local" };
    }

    return { ok: false, error: "No OCR text could be extracted from the handwritten region." };
  } catch (error) {
    const localCandidates = Array.isArray(input.localCandidates)
      ? input.localCandidates.map((c) => String(c ?? "").trim()).filter(Boolean)
      : [];
    const localBest = pickBestHandwrittenOcrText(localCandidates);
    if (localBest) {
      return { ok: true, text: localBest, confidence: "low", source: "local" };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to run handwritten OCR.",
    };
  }
}
