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

export async function generateInstagramPromptPack(input: InstagramPromptRequest): Promise<InstagramPromptPack> {
  await requireSuperAdmin();

  const theme = input.theme.trim();
  if (!theme) throw new Error("Theme is required.");

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "deepseek/deepseek-r1-0528";
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY in environment.");
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

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "AI generation failed.");
  }

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("No content returned by AI model.");

  return normalizePromptPack(JSON.parse(extractJsonObject(content)));
}
