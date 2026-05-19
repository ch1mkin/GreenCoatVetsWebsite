"use server";

import { parseInstagramPromptPackFromText, type InstagramPromptPackFields } from "@saasclinics/lib";
import {
  DEEPSEEK_V4_FLASH_MODEL,
  streamDeepSeekV4FlashChat,
  type V4FlashChatMessage,
} from "@/lib/openrouter/v4-flash-stream";
import { requireAdmin } from "@/lib/admin/auth";

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

function buildLabeledMessages(input: InstagramPromptRequest): V4FlashChatMessage[] {
  const clinicName = input.clinicName?.trim() || "GreenCoatVets";
  const theme = input.theme.trim();
  const audience = input.audience?.trim() || "pet parents in India";
  const campaignGoal = input.campaignGoal?.trim() || "increase engagement and shares";
  const season = input.season?.trim() || "current month";
  const tone = input.tone?.trim() || "warm, trustworthy, playful";

  return [
    {
      role: "system",
      content:
        "You are a veterinary Instagram strategist. Produce both social post CONTENT (captions, hashtags, ideas) and IMAGE GENERATION prompts (detailed scene descriptions for AI art tools). Use the exact labeled format below. Do not use JSON or markdown code blocks.",
    },
    {
      role: "user",
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
        "(detailed 2D illustrated square image for Gemini — scene, style, colors, composition)",
        "IMAGE_PROMPT:",
        "(universal detailed image prompt for any generator — same scene, tool-agnostic)",
        "IMAGE_PROMPT_SHORT:",
        "(under 300 characters, key visual only)",
        "NEGATIVE_PROMPT:",
        "(comma-separated elements to avoid: photorealistic, watermark, etc.)",
        "ART_DIRECTION:",
        "- bullet",
      ].join("\n"),
    },
  ];
}

function buildJsonMessages(input: InstagramPromptRequest): V4FlashChatMessage[] {
  const clinicName = input.clinicName?.trim() || "GreenCoatVets";
  const theme = input.theme.trim();
  const audience = input.audience?.trim() || "pet parents in India";
  const campaignGoal = input.campaignGoal?.trim() || "increase engagement and shares";
  const season = input.season?.trim() || "current month";
  const tone = input.tone?.trim() || "warm, trustworthy, playful";

  return [
    {
      role: "system",
      content:
        'Reply with one JSON object only. Keys: conceptTitle, trendAngle, captionHook, captionBody, hashtags, postIdeas, geminiPrompt, imagePrompt, imagePromptShort, negativePrompt, artDirection. Start with { and end with }.',
    },
    {
      role: "user",
      content: [
        `Clinic: ${clinicName}`,
        `Theme: ${theme}`,
        `Audience: ${audience}`,
        `Goal: ${campaignGoal}`,
        `Season: ${season}`,
        `Tone: ${tone}`,
        "hashtags must be a JSON array of 5-10 strings with #.",
        "postIdeas must be a JSON array of exactly 5 strings.",
        "geminiPrompt and imagePrompt must each describe a 2D illustrated non-photorealistic Instagram square image (full scene, style, palette, composition).",
        "imagePromptShort must be under 300 characters.",
        "negativePrompt must list elements to exclude from the artwork.",
      ].join("\n"),
    },
  ];
}

async function tryGeneratePack(
  apiKey: string,
  messages: V4FlashChatMessage[],
  temperature: number,
): Promise<{ ok: true; pack: InstagramPromptPack; model: string } | { ok: false; error: string }> {
  const completion = await streamDeepSeekV4FlashChat({ apiKey, messages, temperature });

  if (!completion.ok) {
    return { ok: false, error: completion.error };
  }

  const parsed = parseInstagramPromptPackFromText(completion.text);
  if (!parsed) {
    return {
      ok: false,
      error: "Could not read a complete prompt pack from the model. Please try again.",
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
  const model = DEEPSEEK_V4_FLASH_MODEL;

  try {
    await requireAdmin();

    const theme = input.theme.trim();
    if (!theme) return { ok: false, error: "Theme is required.", model };

    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      return { ok: false, error: "Missing OPENROUTER_API_KEY in environment.", model };
    }

    const strategies: Array<{ messages: V4FlashChatMessage[]; temperature: number }> = [
      { messages: buildLabeledMessages(input), temperature: 0.5 },
      { messages: buildJsonMessages(input), temperature: 0.3 },
    ];

    let lastError = "Failed to generate prompt.";
    for (const strategy of strategies) {
      const result = await tryGeneratePack(apiKey, strategy.messages, strategy.temperature);
      if (result.ok) {
        return { ok: true, pack: result.pack, model: result.model };
      }
      lastError = result.error;
    }

    return { ok: false, error: lastError, model };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate prompt.";
    return { ok: false, error: message, model };
  }
}
