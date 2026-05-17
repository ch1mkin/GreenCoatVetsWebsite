"use server";

import {
  parseInstagramPromptPackFromText,
  requestOpenRouterChatCompletion,
  type InstagramPromptPackFields,
} from "@saasclinics/lib";
import { requireSuperAdmin } from "@/lib/admin/auth";

export type InstagramPromptRequest = {
  clinicName?: string;
  theme: string;
  audience?: string;
  campaignGoal?: string;
  season?: string;
  tone?: string;
};

export type InstagramPromptPack = InstagramPromptPackFields;

export type GenerateInstagramPromptPackResult =
  | { ok: true; pack: InstagramPromptPack; model: string }
  | { ok: false; error: string; model: string };

const INSTAGRAM_PROMPT_MODELS = [
  "deepseek/deepseek-r1-0528",
  "deepseek/deepseek-v4-flash:free",
] as const;

function finalizePromptPack(pack: InstagramPromptPackFields): InstagramPromptPack {
  if (!pack.postIdeas.length) {
    throw new Error("AI response was incomplete. Please try again.");
  }
  return {
    ...pack,
    postIdeas: pack.postIdeas.slice(0, 5),
    hashtags: pack.hashtags.slice(0, 12),
  };
}

function buildJsonMessages(input: InstagramPromptRequest) {
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
        'Reply with one JSON object only. Keys: conceptTitle, trendAngle, captionHook, captionBody, hashtags, postIdeas, geminiPrompt, artDirection. Start with { and end with }.',
    },
    {
      role: "user" as const,
      content: [
        `Clinic: ${clinicName}`,
        `Theme: ${theme}`,
        `Audience: ${audience}`,
        `Goal: ${campaignGoal}`,
        `Season: ${season}`,
        `Tone: ${tone}`,
        "hashtags must be a JSON array of 5-10 strings with #.",
        "postIdeas must be a JSON array of exactly 5 strings.",
        "geminiPrompt must describe a 2D illustrated non-photorealistic Instagram square image.",
      ].join("\n"),
    },
  ];
}

function buildLabeledMessages(input: InstagramPromptRequest) {
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
        "You are a veterinary Instagram strategist. Use the exact labeled format below. Do not use JSON or markdown code blocks.",
    },
    {
      role: "user" as const,
      content: [
        `Clinic: ${clinicName}`,
        `Theme: ${theme}`,
        `Audience: ${audience}`,
        `Goal: ${campaignGoal}`,
        `Season: ${season}`,
        `Tone: ${tone}`,
        "",
        "Reply using exactly these labels (one value per line, lists as bullet lines):",
        "CONCEPT_TITLE:",
        "TREND_ANGLE:",
        "CAPTION_HOOK:",
        "CAPTION_BODY:",
        "HASHTAGS:",
        "- #example",
        "POST_IDEAS:",
        "- idea one",
        "- idea two",
        "- idea three",
        "- idea four",
        "- idea five",
        "GEMINI_PROMPT:",
        "ART_DIRECTION:",
        "- bullet",
      ].join("\n"),
    },
  ];
}

type GenerationStrategy = {
  model: string;
  messages: ReturnType<typeof buildJsonMessages>;
  jsonMode: boolean;
  temperature: number;
};

async function tryGeneratePack(
  apiKey: string,
  strategy: GenerationStrategy,
): Promise<{ ok: true; pack: InstagramPromptPack; model: string } | { ok: false; error: string }> {
  const completion = await requestOpenRouterChatCompletion({
    apiKey,
    modelOverride: strategy.model,
    messages: strategy.messages,
    max_tokens: 3600,
    temperature: strategy.temperature,
    jsonMode: strategy.jsonMode,
  });

  if (!completion.ok) {
    return { ok: false, error: completion.error };
  }

  const parsed = parseInstagramPromptPackFromText(completion.text);
  if (!parsed) {
    return {
      ok: false,
      error: `Could not read a complete prompt pack from ${strategy.model}. Try again or switch OPENROUTER_MODEL.`,
    };
  }

  try {
    return { ok: true, pack: finalizePromptPack(parsed), model: completion.model };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "AI response was incomplete." };
  }
}

export async function generateInstagramPromptPack(
  input: InstagramPromptRequest,
): Promise<GenerateInstagramPromptPackResult> {
  const defaultModel = INSTAGRAM_PROMPT_MODELS[0];

  try {
    await requireSuperAdmin();

    const theme = input.theme.trim();
    if (!theme) return { ok: false, error: "Theme is required.", model: defaultModel };

    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      return { ok: false, error: "Missing OPENROUTER_API_KEY in environment.", model: defaultModel };
    }

    const configuredModel = process.env.OPENROUTER_MODEL?.trim();
    const models = Array.from(
      new Set([configuredModel, ...INSTAGRAM_PROMPT_MODELS].filter((value): value is string => Boolean(value?.trim()))),
    );

    const strategies: GenerationStrategy[] = [];
    for (const model of models) {
      strategies.push(
        { model, messages: buildLabeledMessages(input), jsonMode: false, temperature: 0.5 },
        { model, messages: buildJsonMessages(input), jsonMode: true, temperature: 0.3 },
        { model, messages: buildJsonMessages(input), jsonMode: false, temperature: 0.4 },
      );
    }

    let lastError = "Failed to generate prompt.";
    for (const strategy of strategies) {
      const result = await tryGeneratePack(apiKey, strategy);
      if (result.ok) {
        return { ok: true, pack: result.pack, model: result.model };
      }
      lastError = result.error;
    }

    return { ok: false, error: lastError, model: defaultModel };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate prompt.";
    return { ok: false, error: message, model: defaultModel };
  }
}
