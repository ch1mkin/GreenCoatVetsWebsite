"use server";

import { revalidatePath } from "next/cache";
import { createHostingerTransport, getHostingerFromAddress } from "@/lib/email/hostinger-mail";
import { renderBrandedEmail } from "@/lib/email/render-branded-email";
import { fetchClinicLogoBytesForPdf } from "@/lib/invoicing/fetch-clinic-logo";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { getPlatformBranding } from "@/lib/platform-branding";
import { buildHandwrittenCanvasPdfBytes } from "@/lib/pdf/clinic-documents";
import { createClient } from "@/lib/supabase/server";
import { buildVisitReportPdfForVisit } from "@/lib/pdf/visit-report-pdf";
import { buildHandwrittenVisitStatePath } from "@/lib/visits/handwritten-visit-sheet";
import { assertVisitReportAccess } from "@/lib/visits/visit-report-access";

const BUCKET = "medical-files";

type RecognizeHandwrittenRegionResult =
  | { ok: true; text: string; confidence: "high" | "medium" | "low"; source: "openrouter" | "local" }
  | { ok: false; error: string };

const HANDWRITTEN_FIELD_TRANSCRIPTION_HINTS: Record<string, string> = {
  patientName: "This is usually a pet name. Do not autocorrect into common English words if the letters look unusual.",
  ownerName: "This is a person's name. Preserve the visible spelling exactly and do not normalize it.",
  mobile: "This should usually be digits, spaces, plus signs, or hyphens only.",
  date: "This should usually be a date, often numbers with / or - separators.",
  age: "This is usually a short age value such as 2y, 8m, 4 years, or similar.",
  ccHp: "This may contain short complaint or history notes, abbreviations, and multiple words. Preserve veterinary shorthand exactly.",
  dewormingText: "This may contain dates, medicine names, or brief note text. Preserve short handwritten note wording exactly.",
  vaccinationText: "This may contain dates, vaccine names, or brief note text. Preserve short handwritten note wording exactly.",
  rt: "This is a short vital measurement. Keep digits, decimals, and brief units exactly as written.",
  rr: "This is a short vital measurement. Keep digits, decimals, and brief units exactly as written.",
  hr: "This is a short vital measurement. Keep digits, decimals, and brief units exactly as written.",
  crt: "This is a short clinical value. Keep digits, decimals, symbols, and brief units exactly as written.",
  allergic: "This is usually a short allergy note or yes/no style entry. Preserve the visible characters exactly.",
  bw: "This is a short body-weight value. Keep digits, decimals, and units exactly as written.",
  otherTests: "This may contain test names, abbreviations, or short clinical note text. Preserve spelling exactly.",
  physicalExamination: "This may contain multiple lines of veterinary examination notes. Preserve abbreviations and line breaks exactly.",
  diagnosis: "This may contain diagnosis names, abbreviations, and multiple words. Preserve medical spelling exactly as written.",
  prescription: "This may include medicine names, doses, numbers, short abbreviations, and line breaks.",
};

function extractAssistantTextContent(
  content:
    | string
    | Array<{
        type?: string;
        text?: string;
      }>
    | null
    | undefined,
) {
  if (typeof content === "string") {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((item) => (item?.type === "text" && typeof item.text === "string" ? item.text : ""))
    .join("\n")
    .trim();
}

function normalizeHandwrittenOcrText(input: string) {
  return input
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trimEnd())
    .join("\n")
    .trim();
}

function parseHandwrittenOcrJson(raw: string): { text: string; confidence: "high" | "medium" | "low" } | null {
  const trimmed = raw.trim();
  const jsonLike = trimmed.match(/\{[\s\S]*\}/)?.[0] ?? trimmed;
  try {
    const parsed = JSON.parse(jsonLike) as {
      text?: unknown;
      confidence?: unknown;
    };
    const text = normalizeHandwrittenOcrText(typeof parsed.text === "string" ? parsed.text : "");
    const confidence = parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low"
      ? parsed.confidence
      : "medium";
    return { text, confidence };
  } catch {
    return null;
  }
}

export async function recognizeHandwrittenRegionAction(input: {
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
      ? input.localCandidates
          .map((candidate) => String(candidate ?? "").trim())
          .filter(Boolean)
          .slice(0, 5)
      : [];

    if (!rawDataUrl || !contrastDataUrl || !boostedDataUrl) {
      return { ok: false, error: "Handwritten OCR images are missing." };
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      const fallbackText = normalizeHandwrittenOcrText(localCandidates[0] ?? "");
      if (!fallbackText) {
        return { ok: false, error: "Missing OPENROUTER_API_KEY and no fallback OCR result was available." };
      }
      return {
        ok: true,
        text: fallbackText,
        confidence: "low",
        source: "local",
      };
    }

    const model = process.env.OPENROUTER_VISION_MODEL || process.env.OPENROUTER_OCR_MODEL || "openai/gpt-4.1";
    const fieldLabel = String(input.fieldLabel ?? "").trim() || "clinical handwritten field";
    const fieldHint =
      HANDWRITTEN_FIELD_TRANSCRIPTION_HINTS[String(input.fieldId ?? "").trim()] ||
      "Transcribe the handwriting exactly as seen. Do not autocorrect names, spellings, abbreviations, or numbers.";

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 240,
        messages: [
          {
            role: "system",
            content:
              "You are an expert handwriting transcription model for veterinary notes. Compare all provided images of the same handwritten crop and return the exact visible text. Preserve spelling, case, numbers, abbreviations, and line breaks. Never autocorrect. For short or messy handwriting, prefer the closest visible characters over guessing a common English word. If a single letter is written, return that single letter only. Respond with JSON only: {\"text\":\"...\",\"confidence\":\"high|medium|low\"}.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: [
                  `Field label: ${fieldLabel}`,
                  `Layout: ${input.singleLine ? "single-line region" : "multi-line region"}`,
                  `Field-specific hint: ${fieldHint}`,
                  "Task: read the handwritten text exactly from these three images of the same crop.",
                  "Rules:",
                  "- inspect the characters visually before deciding on a word",
                  "- prefer the literal visible letters or numbers over dictionary-style corrections",
                  "- do not add words that are not visible",
                  "- do not normalize spelling",
                  "- do not wrap the result in markdown or quotes outside JSON",
                ].join("\n"),
              },
              {
                type: "image_url",
                image_url: {
                  url: rawDataUrl,
                },
              },
              {
                type: "image_url",
                image_url: {
                  url: contrastDataUrl,
                },
              },
              {
                type: "image_url",
                image_url: {
                  url: boostedDataUrl,
                },
              },
            ],
          },
        ],
      }),
    });

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?:
            | string
            | Array<{
                type?: string;
                text?: string;
              }>;
        };
      }>;
      error?: { message?: string };
    };
    if (!response.ok) {
      const fallbackText = normalizeHandwrittenOcrText(localCandidates[0] ?? "");
      if (fallbackText) {
        return {
          ok: true,
          text: fallbackText,
          confidence: "low",
          source: "local",
        };
      }
      return { ok: false, error: payload.error?.message ?? "Handwritten OCR failed." };
    }

    const rawContent = extractAssistantTextContent(payload.choices?.[0]?.message?.content);
    const parsed = parseHandwrittenOcrJson(rawContent);
    const bestText = normalizeHandwrittenOcrText(parsed?.text || rawContent);
    if (bestText) {
      return {
        ok: true,
        text: bestText,
        confidence: parsed?.confidence ?? "medium",
        source: "openrouter",
      };
    }

    const fallbackText = normalizeHandwrittenOcrText(localCandidates[0] ?? "");
    if (fallbackText) {
      return {
        ok: true,
        text: fallbackText,
        confidence: "low",
        source: "local",
      };
    }

    return { ok: false, error: "No OCR text could be extracted from the handwritten region." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to run handwritten OCR.",
    };
  }
}

/**
 * Generates the PDF, uploads to medical-files, and stores the path on the visit row (attachment for pet profile).
 */
export async function regenerateVisitReportPdfAttachment(visitId: string, options?: { force?: boolean }) {
  const access = await getUserAccess();
  if (access.membership?.role === "pet_owner") {
    throw new Error("Only clinic staff can save visit PDFs to the record.");
  }
  const supabase = createClient();
  await assertVisitReportAccess(supabase, access, visitId);

  const { data: visit, error: vErr } = await supabase
    .from("visits")
    .select("*")
    .eq("id", visitId)
    .single();

  if (vErr || !visit) throw new Error(vErr?.message ?? "Visit not found.");
  if ((visit as { visit_report_pdf_source?: string | null }).visit_report_pdf_source === "handwritten" && !options?.force) {
    return;
  }

  const bytes = await buildVisitReportPdfForVisit(supabase, visitId);
  const path = `${visit.clinic_id}/pets/${visit.pet_id}/visits/${visitId}/visit-report.pdf`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (upErr) throw new Error(upErr.message);

  const nowIso = new Date().toISOString();
  let { error: upRow } = await supabase
    .from("visits")
    .update({
      visit_report_pdf_path: path,
      visit_report_pdf_generated_at: nowIso,
      visit_report_pdf_source: "generated",
    })
    .eq("id", visitId)
    .eq("clinic_id", visit.clinic_id as string);

  if (upRow && /visit_report_pdf_source/i.test(upRow.message)) {
    const fallback = await supabase
      .from("visits")
      .update({
        visit_report_pdf_path: path,
        visit_report_pdf_generated_at: nowIso,
      })
      .eq("id", visitId)
      .eq("clinic_id", visit.clinic_id as string);
    upRow = fallback.error;
  }

  if (upRow) throw new Error(upRow.message);

  revalidatePath(`/visits/${visitId}`);
  revalidatePath(`/pets/${visit.pet_id}`);
}

export async function regenerateVisitReportPdfFormAction(formData: FormData) {
  const visitId = String(formData.get("visit_id") ?? "").trim();
  if (!visitId) throw new Error("Visit id is required.");
  await regenerateVisitReportPdfAttachment(visitId, { force: true });
}

type SaveHandwrittenVisitPdfResult = { ok: true; pdfPath: string } | { ok: false; error: string };

function decodeImageDataUrl(dataUrl: string): Uint8Array {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i);
  if (!match) {
    throw new Error("Handwritten visit image is invalid.");
  }
  return Uint8Array.from(Buffer.from(match[2] ?? "", "base64"));
}

async function readHandwrittenImageUpload(formData: FormData): Promise<Uint8Array> {
  const uploaded = formData.get("image_file");
  const file = uploaded instanceof File ? uploaded : null;
  if (file && file.size > 0) {
    if (!(file.type || "").startsWith("image/")) {
      throw new Error("Handwritten visit upload must be an image.");
    }
    return new Uint8Array(await file.arrayBuffer());
  }

  const imageDataUrl = String(formData.get("image_data_url") ?? "").trim();
  if (!imageDataUrl) {
    throw new Error("Visit and handwritten image are required.");
  }
  return decodeImageDataUrl(imageDataUrl);
}

export async function saveHandwrittenVisitPdfAction(formData: FormData): Promise<SaveHandwrittenVisitPdfResult> {
  try {
    const access = await getUserAccess();
    if (access.membership?.role === "pet_owner") {
      return { ok: false, error: "Only clinic staff can save handwritten visit sheets." };
    }

    const visitId = String(formData.get("visit_id") ?? "").trim();
    if (!visitId) {
      return { ok: false, error: "Visit and handwritten image are required." };
    }

    const supabase = createClient();
    await assertVisitReportAccess(supabase, access, visitId);

    const { data: visit, error: visitError } = await supabase
      .from("visits")
      .select("id, clinic_id, pet_id, branch_id")
      .eq("id", visitId)
      .single();

    if (visitError || !visit) {
      return { ok: false, error: visitError?.message ?? "Visit not found." };
    }

    const uploadedImageBytes = await readHandwrittenImageUpload(formData);
    const { data: brandingRow } = await supabase.from("platform_branding").select("logo_url").eq("id", "default").maybeSingle();
    const logoBytes = await fetchClinicLogoBytesForPdf(supabase, (brandingRow?.logo_url as string | null | undefined) ?? null);
    const pdfBytes = await buildHandwrittenCanvasPdfBytes({
      imageBytes: uploadedImageBytes,
      footerText: `Handwritten visit sheet saved ${new Date().toLocaleString()}.`,
      logoBytes,
    });
    const path = `${visit.clinic_id}/pets/${visit.pet_id}/visits/${visitId}/visit-report-handwritten.pdf`;
    const stateJson = String(formData.get("editor_state_json") ?? "").trim();

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (uploadError) return { ok: false, error: uploadError.message };

    if (stateJson) {
      const statePath = buildHandwrittenVisitStatePath(
        String(visit.clinic_id),
        String(visit.pet_id),
        visitId,
      );
      const stateBytes = new TextEncoder().encode(stateJson);
      const { error: stateUploadError } = await supabase.storage.from(BUCKET).upload(statePath, stateBytes, {
        contentType: "application/json",
        upsert: true,
      });
      if (stateUploadError) return { ok: false, error: stateUploadError.message };
    }

    const nowIso = new Date().toISOString();
    let { error: visitUpdateError } = await supabase
      .from("visits")
      .update({
        visit_report_pdf_path: path,
        visit_report_pdf_generated_at: nowIso,
        visit_report_pdf_source: "handwritten",
      })
      .eq("id", visitId)
      .eq("clinic_id", visit.clinic_id as string);
    if (visitUpdateError && /visit_report_pdf_source/i.test(visitUpdateError.message)) {
      const fallback = await supabase
        .from("visits")
        .update({
          visit_report_pdf_path: path,
          visit_report_pdf_generated_at: nowIso,
        })
        .eq("id", visitId)
        .eq("clinic_id", visit.clinic_id as string);
      visitUpdateError = fallback.error;
    }
    if (visitUpdateError) return { ok: false, error: visitUpdateError.message };

    revalidatePath(`/visits/${visitId}`);
    revalidatePath(`/pets/${visit.pet_id}`);
    return { ok: true, pdfPath: path };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save handwritten visit PDF." };
  }
}

type ShareVisitReportPdfResult = { ok: true; sentTo: string } | { ok: false; error: string };

export async function shareVisitReportPdfByEmailAction(formData: FormData): Promise<ShareVisitReportPdfResult> {
  try {
    const access = await getUserAccess();
    if (access.membership?.role === "pet_owner") {
      return { ok: false, error: "Only clinic staff can share visit PDFs by email." };
    }

    const visitId = String(formData.get("visit_id") ?? "").trim();
    if (!visitId) {
      return { ok: false, error: "Visit id is required." };
    }

    const manualRecipient = String(formData.get("recipient_email") ?? "").trim().toLowerCase();
    const supabase = createClient();
    await assertVisitReportAccess(supabase, access, visitId);

    const { data: visit, error: visitError } = await supabase
      .from("visits")
      .select("id, clinic_id, visit_report_pdf_path, pets(name), owners(full_name, email), appointments(owner_intake)")
      .eq("id", visitId)
      .maybeSingle();
    if (visitError || !visit) {
      return { ok: false, error: visitError?.message ?? "Visit not found." };
    }

    const path = String((visit as { visit_report_pdf_path?: string | null }).visit_report_pdf_path ?? "").trim();
    if (!path) {
      return { ok: false, error: "Save the visit report PDF before sharing it." };
    }

    const appointmentRaw = (visit as { appointments?: Record<string, unknown> | Record<string, unknown>[] | null }).appointments ?? null;
    const appointment = Array.isArray(appointmentRaw) ? appointmentRaw[0] ?? null : appointmentRaw;
    const intake =
      appointment?.owner_intake && typeof appointment.owner_intake === "object" && !Array.isArray(appointment.owner_intake)
        ? (appointment.owner_intake as Record<string, unknown>)
        : null;
    const intakeEmail = String(intake?.contact_email ?? "").trim().toLowerCase();
    const owner = visit.owners as { full_name?: string | null; email?: string | null } | { full_name?: string | null; email?: string | null }[] | null;
    const ownerRow = Array.isArray(owner) ? owner[0] ?? null : owner;
    const recipient = manualRecipient || intakeEmail || String(ownerRow?.email ?? "").trim().toLowerCase();
    if (!recipient) {
      return { ok: false, error: "No recipient email is available for this visit." };
    }

    const transporter = createHostingerTransport();
    const from = getHostingerFromAddress();
    if (!transporter || !from) {
      return { ok: false, error: "Hostinger SMTP is not configured on the server." };
    }

    const { data: blob, error: downloadError } = await supabase.storage.from(BUCKET).download(path);
    if (downloadError || !blob) {
      return { ok: false, error: "Visit report file is missing from storage." };
    }

    const pet = visit.pets as { name?: string | null } | { name?: string | null }[] | null;
    const petRow = Array.isArray(pet) ? pet[0] ?? null : pet;
    const ownerName = String(ownerRow?.full_name ?? "").trim() || "pet owner";
    const petName = String(petRow?.name ?? "").trim() || "patient";
    const attachmentName = `visit-report-${petName.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase() || visitId.slice(0, 8)}.pdf`;
    const fileBytes = Buffer.from(await blob.arrayBuffer());
    const branding = await getPlatformBranding();
    const brandName = branding.product_name || "GreenCoatVets";
    const mail = renderBrandedEmail({
      brandName,
      heading: `Visit report for ${petName}`,
      intro: `Hi ${ownerName}, your saved visit report PDF for ${petName} is attached.`,
      body: ["Keep this report for your records and contact the clinic if you need any clarification on the visit summary."],
      footer: `${brandName} visit reports`,
    });

    await transporter.sendMail({
      from,
      to: recipient,
      subject: `Visit report for ${petName}`,
      text: mail.text,
      html: mail.html,
      attachments: [
        {
          filename: attachmentName,
          content: fileBytes,
          contentType: "application/pdf",
        },
      ],
    });

    revalidatePath(`/visits/${visitId}`);
    return { ok: true, sentTo: recipient };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to email the visit report." };
  }
}
