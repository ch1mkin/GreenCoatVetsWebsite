"use server";

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

const DEFAULT_DEEPSEEK_MODEL = "deepseek/deepseek-r1-0528";
const DEEPSEEK_MODEL_FALLBACKS = [
  "deepseek/deepseek-r1-0528",
  "deepseek/deepseek-chat-v3-0324:free",
] as const;

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

function resolveOpenRouterModel(): string {
  const configured = process.env.OPENROUTER_MODEL?.trim();
  if (!configured) return DEFAULT_DEEPSEEK_MODEL;
  if (/^deepseek\/deepseek-r1(:free)?$/i.test(configured)) return DEFAULT_DEEPSEEK_MODEL;
  if (/^deepseek\/deepseek-r1-0528:free$/i.test(configured)) return DEFAULT_DEEPSEEK_MODEL;
  if (/^deepseek\/deepseek-chat-v3-0324$/i.test(configured)) return "deepseek/deepseek-chat-v3-0324:free";
  return configured;
}

function modelHelpMessage(model: string): string {
  const fallbackList = DEEPSEEK_MODEL_FALLBACKS.map((item) => `\`${item}\``).join(", ");
  return `OpenRouter rejected model \`${model}\`. Try one of these DeepSeek models: ${fallbackList}.`;
}

async function parseOpenRouterResponse(response: Response): Promise<{
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}> {
  const raw = await response.text();
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };
  } catch {
    throw new Error("OpenRouter returned a non-JSON response. Check the API key, model slug, and provider status.");
  }
}

export async function generateInstagramPromptPack(
  input: InstagramPromptRequest,
): Promise<GenerateInstagramPromptPackResult> {
  const model = resolveOpenRouterModel();

  try {
    await requireSuperAdmin();

    const theme = input.theme.trim();
    if (!theme) return { ok: false, error: "Theme is required.", model };

    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      return { ok: false, error: "Missing OPENROUTER_API_KEY in environment.", model };
    }

    const clinicName = input.clinicName?.trim() || "GreenCoatVets";
    const audience = input.audience?.trim() || "pet parents in India";
    const campaignGoal = input.campaignGoal?.trim() || "increase engagement and shares";
    const season = input.season?.trim() || "current month";
    const tone = input.tone?.trim() || "warm, trustworthy, playful";

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2200,
        messages: [
          {
            role: "system",
            content:
              "You are a veterinary Instagram strategist and prompt engineer. Return strict JSON only. Focus on high-performing veterinary post ideas that feel timely, shareable, and suitable for 2D illustrated art. Avoid realistic photo language. Always make the art prompt explicitly non-photorealistic, hand-drawn, and suitable for Gemini image generation.",
          },
          {
            role: "user",
            content: [
              `Clinic brand: ${clinicName}`,
              `Theme: ${theme}`,
              `Audience: ${audience}`,
              `Campaign goal: ${campaignGoal}`,
              `Season or event context: ${season}`,
              `Tone: ${tone}`,
              "",
              "Return a JSON object with these exact keys:",
              "{",
              '  "conceptTitle": "short concept title",',
              '  "trendAngle": "why this concept works now",',
              '  "captionHook": "1 short hook line",',
              '  "captionBody": "2-4 sentence Instagram caption body",',
              '  "hashtags": ["5-10 hashtags"],',
              '  "postIdeas": ["exactly 5 trending post ideas"],',
              '  "geminiPrompt": "one detailed prompt for Gemini to generate a 2D illustrated non-realistic Instagram post",',
              '  "artDirection": ["3-6 short bullets about palette, composition, and illustration style"]',
              "}",
              "",
              "Requirements:",
              "- Keep the post ideas specific to a veterinary clinic audience.",
              "- The Gemini prompt must mention: 2D illustration, non-realistic, clean outlines, social-media friendly square composition, and no photo realism.",
              "- Do not include markdown fences, explanations, or extra keys.",
            ].join("\n"),
          },
        ],
      }),
    });

    const payload = await parseOpenRouterResponse(response);
    if (!response.ok) {
      const providerMessage = payload.error?.message ?? "AI generation failed.";
      const extra = /model|provider|not found|unsupported|unknown/i.test(providerMessage)
        ? ` ${modelHelpMessage(model)}`
        : "";
      return { ok: false, error: `${providerMessage}${extra}`, model };
    }

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return { ok: false, error: "No content returned by the selected OpenRouter model.", model };
    }

    return { ok: true, pack: normalizePromptPack(JSON.parse(extractJsonObject(content))), model };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate prompt.";
    return { ok: false, error: `${message} ${modelHelpMessage(model)}`.trim(), model };
  }
}
