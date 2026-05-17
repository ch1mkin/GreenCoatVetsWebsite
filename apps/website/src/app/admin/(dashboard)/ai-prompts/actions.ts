"use server";

import { parseJsonFromLlmOutput, requestOpenRouterChatCompletion, resolveOpenRouterModel } from "@saasclinics/lib";
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

function normalizePromptPack(value: unknown): InstagramPromptPack {
  const raw = (value ?? {}) as Record<string, unknown>;
  const toStringArray = (input: unknown) => {
    if (Array.isArray(input)) {
      return input.map((item) => String(item ?? "").trim()).filter(Boolean);
    }
    if (typeof input === "string" && input.trim()) {
      return input
        .split(/[,;\n]+/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  };

  const conceptTitle = String(raw.conceptTitle ?? raw.title ?? "").trim();
  const trendAngle = String(raw.trendAngle ?? raw.trend ?? "").trim();
  const captionHook = String(raw.captionHook ?? raw.hook ?? "").trim();
  const captionBody = String(raw.captionBody ?? raw.caption ?? raw.body ?? "").trim();
  const geminiPrompt = String(raw.geminiPrompt ?? raw.imagePrompt ?? raw.artPrompt ?? "").trim();
  const hashtags = toStringArray(raw.hashtags);
  const postIdeas = toStringArray(raw.postIdeas ?? raw.ideas);
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
    postIdeas: postIdeas.slice(0, 5),
    geminiPrompt,
    artDirection,
  };
}

function buildPromptMessages(input: InstagramPromptRequest, strictJson: boolean) {
  const clinicName = input.clinicName?.trim() || "GreenCoatVets";
  const theme = input.theme.trim();
  const audience = input.audience?.trim() || "pet parents in India";
  const campaignGoal = input.campaignGoal?.trim() || "increase engagement and shares";
  const season = input.season?.trim() || "current month";
  const tone = input.tone?.trim() || "warm, trustworthy, playful";

  const exampleJson = JSON.stringify(
    {
      conceptTitle: "Monsoon paw-care checkup",
      trendAngle: "Seasonal wellness posts get high saves before rains.",
      captionHook: "Rainy walks? Protect those paws.",
      captionBody:
        "Book a quick monsoon wellness check at GreenCoatVets. We help keep coats healthy, paws clean, and parasites away all season.",
      hashtags: ["#PetCare", "#MonsoonTips", "#VetClinic", "#DogHealth", "#CatCare"],
      postIdeas: [
        "5 monsoon safety tips carousel",
        "Before/after paw cleaning illustration",
        "Myth vs fact: ticks in wet weather",
        "Vet explains ear infections in rains",
        "Client story: happy dog after checkup",
      ],
      geminiPrompt:
        "2D illustrated Instagram square, friendly veterinary clinic scene, dog with umbrella and vet, clean outlines, soft colors, non-photorealistic, hand-drawn style, no photo realism",
      artDirection: ["Soft teal and cream palette", "Simple flat shapes", "Warm clinic signage", "Square 1:1 composition"],
    },
    null,
    0,
  );

  return [
    {
      role: "system" as const,
      content: strictJson
        ? "You output only one JSON object. Start with { and end with }. No markdown, no explanation."
        : "You are a veterinary Instagram strategist. Reply with one JSON object only — no markdown fences, no text before or after the JSON.",
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
        "Required JSON keys: conceptTitle, trendAngle, captionHook, captionBody, hashtags, postIdeas, geminiPrompt, artDirection",
        "- hashtags: array of 5-10 strings (include #)",
        "- postIdeas: array of exactly 5 strings",
        "- artDirection: array of 3-6 short strings",
        "- geminiPrompt: detailed 2D illustrated, non-photorealistic art prompt",
        "",
        "Example shape (replace all values for this theme):",
        exampleJson,
      ].join("\n"),
    },
  ];
}

const GENERATION_ATTEMPTS: Array<{ jsonMode: boolean; temperature: number; strictJson: boolean }> = [
  { jsonMode: true, temperature: 0.35, strictJson: true },
  { jsonMode: false, temperature: 0.45, strictJson: false },
];

export async function generateInstagramPromptPack(
  input: InstagramPromptRequest,
): Promise<GenerateInstagramPromptPackResult> {
  const defaultModel = resolveOpenRouterModel(process.env.OPENROUTER_MODEL);

  try {
    await requireSuperAdmin();

    const theme = input.theme.trim();
    if (!theme) return { ok: false, error: "Theme is required.", model: defaultModel };

    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      return { ok: false, error: "Missing OPENROUTER_API_KEY in environment.", model: defaultModel };
    }

    let lastError = "Failed to generate prompt.";

    for (const attempt of GENERATION_ATTEMPTS) {
      const completion = await requestOpenRouterChatCompletion({
        apiKey,
        model: process.env.OPENROUTER_MODEL,
        messages: buildPromptMessages(input, attempt.strictJson),
        max_tokens: 3200,
        temperature: attempt.temperature,
        jsonMode: attempt.jsonMode,
      });

      if (!completion.ok) {
        lastError = completion.error;
        continue;
      }

      try {
        const pack = normalizePromptPack(parseJsonFromLlmOutput(completion.text));
        return { ok: true, pack, model: completion.model };
      } catch (parseError) {
        lastError = parseError instanceof Error ? parseError.message : "AI response did not include valid JSON.";
      }
    }

    const fallback = await requestOpenRouterChatCompletion({
      apiKey,
      model: "deepseek/deepseek-r1-0528",
      messages: buildPromptMessages(input, false),
      max_tokens: 3200,
      temperature: 0.45,
      jsonMode: false,
    });

    if (fallback.ok) {
      try {
        const pack = normalizePromptPack(parseJsonFromLlmOutput(fallback.text));
        return { ok: true, pack, model: fallback.model };
      } catch (parseError) {
        lastError = parseError instanceof Error ? parseError.message : lastError;
      }
    } else if (fallback.error) {
      lastError = fallback.error;
    }

    return { ok: false, error: lastError, model: defaultModel };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate prompt.";
    return { ok: false, error: message, model: defaultModel };
  }
}
