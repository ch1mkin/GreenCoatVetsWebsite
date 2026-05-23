import type { InstagramPromptPackFields } from "@saasclinics/lib";

/** Fixed image prompt skeleton — placeholders filled from admin form values. */
export const IMAGE_PROMPT_TEMPLATE =
  "A minimalist 2D flat vector illustration of {scene}. {style} doodle aesthetic, featuring clean and distinct outlines. Emphasize a {colorPalette} color palette. Completely flat design isolated on a solid {backgroundColor} background, with no gradients, no 3D rendering, and no realistic shading. Heartwarming, professional vibe, perfect for a modern social media graphic.";

export const DEFAULT_NEGATIVE_PROMPT =
  "photorealistic, realistic fur texture, 3D render, CGI, gradients, drop shadows, lens flare, watermark, text overlay, logo, blurry, noisy, photographic, hyperrealistic";

export const ILLUSTRATION_STYLE_OPTIONS = [
  "clean line art",
  "playful hand-drawn sketch",
  "cute storybook",
] as const;

export type InstagramPromptFormInput = {
  clinicName?: string;
  /** Scene, animals, or objects in the illustration. */
  scene: string;
  illustrationStyle?: string;
  colorPalette?: string;
  backgroundColor?: string;
  audience?: string;
  campaignGoal?: string;
  season?: string;
  tone?: string;
};

function fillTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key]?.trim() ?? "");
}

function buildCaptionPack(input: InstagramPromptFormInput): Pick<
  InstagramPromptPackFields,
  "conceptTitle" | "trendAngle" | "captionHook" | "captionBody" | "hashtags" | "postIdeas" | "artDirection"
> {
  const clinic = (input.clinicName ?? "GreenCoatVets").trim();
  const scene = input.scene.trim();
  const audience = input.audience?.trim() || "pet parents";
  const goal = input.campaignGoal?.trim() || "helpful engagement on Instagram";
  const season = input.season?.trim();
  const tone = input.tone?.trim() || "warm and trustworthy";

  const seasonBit = season ? `${season} — ` : "";
  const themeSlug = scene
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);

  return {
    conceptTitle: scene,
    trendAngle: `${seasonBit}${goal} for ${audience} at ${clinic}.`,
    captionHook: `Care tip from ${clinic} 🐾`,
    captionBody: [
      `${scene}.`,
      "",
      `At ${clinic}, we share practical advice in a ${tone} voice — because your pet's health matters.`,
      season ? `Timely note: ${season}.` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    hashtags: [
      "#vetcare",
      "#pethealth",
      "#petparents",
      "#veterinary",
      `#${clinic.replace(/\s+/g, "")}`,
      themeSlug ? `#${themeSlug}` : "#petwellness",
      "#instapets",
      "#dogsofinstagram",
      "#catsofinstagram",
    ],
    postIdeas: [
      `Carousel: 3 quick signs pet parents should watch for — ${scene.toLowerCase()}.`,
      `Reel idea: vet explains the topic in 30 seconds with on-screen tips.`,
      `Before/after style slide: myth vs fact about ${scene.toLowerCase()}.`,
      `Poll: “Did you know?” about ${scene.toLowerCase()} — yes / tell me more.`,
      `Story Q&A: invite questions about ${scene.toLowerCase()} for ${clinic}.`,
    ],
    artDirection: [
      `Tone: ${tone}.`,
      `Audience: ${audience}.`,
      `Goal: ${goal}.`,
      "Keep characters friendly; avoid scary medical imagery.",
      "Square 1:1 composition with clear focal point for Instagram feed.",
    ],
  };
}

export function buildInstagramPromptPackFromTemplate(
  input: InstagramPromptFormInput,
): InstagramPromptPackFields {
  const scene = input.scene.trim();
  const style = (input.illustrationStyle?.trim() || ILLUSTRATION_STYLE_OPTIONS[0]).replace(/\s+doodle aesthetic$/i, "");
  const colorPalette = input.colorPalette?.trim() || "pastel blues and warm cream";
  const backgroundColor = input.backgroundColor?.trim() || "white";

  const imagePrompt = fillTemplate(IMAGE_PROMPT_TEMPLATE, {
    scene,
    style,
    colorPalette,
    backgroundColor,
  });

  const imagePromptShort =
    imagePrompt.length > 300 ? `${imagePrompt.slice(0, 297).trimEnd()}…` : imagePrompt;

  return {
    ...buildCaptionPack(input),
    geminiPrompt: imagePrompt,
    imagePrompt,
    imagePromptShort,
    negativePrompt: DEFAULT_NEGATIVE_PROMPT,
  };
}
