"use server";

import { requestOpenRouterChatWithFallbacks } from "@saasclinics/lib";
import { requireSuperAdmin } from "@/lib/admin/auth";

export type InstagramPromptRequest = {
  clinicName?: string;
  theme: string;
  audience?: string;
  campaignGoal?: string;
  season?: string;
  tone?: string;
};

export type InstagramPromptPack = {
  conceptTitle: string;
  trendAngle: string;
  captionHook: string;
  captionBody: string;
  hashtags: string[];
  postIdeas: string[];
  geminiPrompt: string;
  artDirection: string[];
};

export type GenerateInstagramPromptPackResult =
  | { ok: true; pack: InstagramPromptPack; model: string }
  | { ok: false; error: string; model: string };

function extractJsonObject(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  throw new Error("AI response did not include valid JSON.");
}

function normalizePromptPack(value: unknown): InstagramPromptPack {
  const raw = (value ?? {}) as Record<string, unknown>;
  const toStringArray = (input: unknown) =>
    Array.isArray(input)
      ? input.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [];

  const conceptTitle = String(raw.conceptTitle ?? "").trim();
  const trendAngle = String(raw.trendAngle ?? "").trim();
  const captionHook = String(raw.captionHook ?? "").trim();
  const captionBody = String(raw.captionBody ?? "").trim();
  const geminiPrompt = String(raw.geminiPrompt ?? "").trim();
  const hashtags = toStringArray(raw.hashtags);
  const postIdeas = toStringArray(raw.postIdeas);
  const artDirection = toStringArray(raw.artDirection);

  if (!conceptTitle || !trendAngle || !captionHook || !captionBody || !geminiPrompt || !hashtags.length || !postIdeas.length) {
    throw new Error("AI response was incomplete. Please try again.");
  }

  return {
    conceptTitle,
    trendAngle,
    captionHook,
    captionBody,
    hashtags,
    postIdeas,
    geminiPrompt,
    artDirection,
  };
}

function buildPromptMessages(input: InstagramPromptRequest) {
  const clinicName = input.clinicName?.trim() || "GreenCoatVets";
  const theme = input.theme.trim();
  const audience = input.audience?.trim() || "pet parents in India";
  const campaignGoal = input.campaignGoal?.trim() || "increase engagement and shares";
  const season = input.season?.trim() || "current month";
  const tone = input.tone?.trim() || "warm, trustworthy, playful";

  return [
    {
      role: "system" as const,
      content:
        "You are a veterinary Instagram strategist. You must respond with a single valid JSON object only — no markdown fences, no commentary, no reasoning preamble.",
    },
    {
      role: "user" as const,
      content: [
        `Clinic brand: ${clinicName}`,
        `Theme: ${theme}`,
        `Audience: ${audience}`,
        `Campaign goal: ${campaignGoal}`,
        `Season or event context: ${season}`,
        `Tone: ${tone}`,
        "",
        "Return JSON with exactly these keys:",
        "conceptTitle, trendAngle, captionHook, captionBody, hashtags, postIdeas, geminiPrompt, artDirection",
        "",
        "Rules:",
        "- hashtags: array of 5-10 strings",
        "- postIdeas: array of exactly 5 strings",
        "- artDirection: array of 3-6 short strings",
        "- geminiPrompt: detailed 2D illustrated, non-photorealistic Instagram art prompt for Gemini",
        "- Keep ideas specific to veterinary clinics in India",
      ].join("\n"),
    },
  ];
}

export async function generateInstagramPromptPack(
  input: InstagramPromptRequest,
): Promise<GenerateInstagramPromptPackResult> {
  try {
    await requireSuperAdmin();

    const theme = input.theme.trim();
    if (!theme) return { ok: false, error: "Theme is required.", model: "deepseek/deepseek-v4-flash:free" };

    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      return { ok: false, error: "Missing OPENROUTER_API_KEY in environment.", model: "deepseek/deepseek-v4-flash:free" };
    }

    const completion = await requestOpenRouterChatWithFallbacks({
      apiKey,
      model: process.env.OPENROUTER_MODEL,
      messages: buildPromptMessages(input),
      max_tokens: 2800,
      temperature: 0.8,
      jsonMode: true,
    });

    if (!completion.ok) {
      return { ok: false, error: completion.error, model: completion.model };
    }

    const pack = normalizePromptPack(JSON.parse(extractJsonObject(completion.text)));
    return { ok: true, pack, model: completion.model };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate prompt.";
    return { ok: false, error: message, model: "deepseek/deepseek-v4-flash:free" };
  }
}
