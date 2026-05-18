function repairJsonString(json: string): string {
  return json
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
    .replace(/,\s*([}\]])/g, "$1")
    .trim();
}

function extractBalancedObject(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }

  if (depth > 0) {
    return `${text.slice(start)}${"}".repeat(depth)}`;
  }
  return null;
}

function collectJsonCandidates(text: string): string[] {
  const trimmed = text.trim();
  const candidates: string[] = [];

  const fencePattern = /```(?:json)?\s*([\s\S]*?)```/gi;
  let fenceMatch = fencePattern.exec(trimmed);
  while (fenceMatch) {
    const block = fenceMatch[1]?.trim();
    if (block) candidates.push(block);
    fenceMatch = fencePattern.exec(trimmed);
  }

  for (let index = 0; index < trimmed.length; index += 1) {
    if (trimmed[index] !== "{") continue;
    const object = extractBalancedObject(trimmed, index);
    if (object) candidates.push(object);
  }

  if (trimmed.startsWith("{")) candidates.push(trimmed);

  return Array.from(new Set(candidates.filter(Boolean)));
}

/** Best-effort parse of JSON objects from LLM text (markdown fences, preamble, trailing prose). */
export function parseJsonFromLlmOutput(text: string): unknown {
  const candidates = collectJsonCandidates(text);
  if (!candidates.length) {
    throw new Error("AI response did not include valid JSON.");
  }

  let lastError: Error | null = null;
  for (const candidate of candidates) {
    const attempts = [candidate, repairJsonString(candidate)];
    for (const attempt of attempts) {
      try {
        return JSON.parse(attempt);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Invalid JSON.");
      }
    }
  }

  throw lastError ?? new Error("AI response did not include valid JSON.");
}

export type InstagramPromptPackFields = {
  conceptTitle: string;
  trendAngle: string;
  captionHook: string;
  captionBody: string;
  hashtags: string[];
  postIdeas: string[];
  /** Detailed prompt tuned for Gemini image generation. */
  geminiPrompt: string;
  /** Universal detailed prompt for any image generator (Midjourney, DALL·E, etc.). */
  imagePrompt: string;
  /** Short image prompt for tools with tight character limits. */
  imagePromptShort: string;
  /** Elements to exclude from generated artwork. */
  negativePrompt: string;
  artDirection: string[];
};

function readScalar(text: string, keys: string[]): string {
  for (const key of keys) {
    const patterns = [
      new RegExp(`^${key}\\s*[:=]\\s*(.+)$`, "im"),
      new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`, "i"),
      new RegExp(`'${key}'\\s*:\\s*'([^']*)'`, "i"),
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]?.trim()) return match[1].trim();
    }
  }
  return "";
}

function readListSection(text: string, sectionNames: string[]): string[] {
  for (const name of sectionNames) {
    const section = new RegExp(
      `(?:^|\\n)\\s*(?:#{1,3}\\s*)?(?:\\*\\*)?${name}(?:\\*\\*)?\\s*[:\\n]\\s*([\\s\\S]*?)(?=\\n\\s*(?:#{1,3}\\s*)?(?:\\*\\*)?[A-Z][A-Z0-9_ /-]+(?:\\*\\*)?\\s*[:\\n]|$)`,
      "i",
    );
    const match = text.match(section);
    if (!match?.[1]) continue;
    const items = match[1]
      .split(/\n/)
      .map((line) => line.replace(/^[-*•\d.)]+\s*/, "").trim())
      .filter(Boolean);
    if (items.length) return items;
  }
  return [];
}

/** Parse labeled plain-text blocks when models refuse strict JSON. */
export function parseInstagramPromptPackFromText(text: string): InstagramPromptPackFields | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    const json = parseJsonFromLlmOutput(trimmed) as Record<string, unknown>;
    const toArray = (value: unknown) => {
      if (Array.isArray(value)) return value.map((item) => String(item ?? "").trim()).filter(Boolean);
      if (typeof value === "string") {
        return value
          .split(/[,;\n]+/)
          .map((item) => item.trim())
          .filter(Boolean);
      }
      return [];
    };
    const geminiPrompt = String(json.geminiPrompt ?? "").trim();
    const imagePrompt = String(json.imagePrompt ?? json.imageGenPrompt ?? "").trim();
    const pack: InstagramPromptPackFields = {
      conceptTitle: String(json.conceptTitle ?? json.title ?? "").trim(),
      trendAngle: String(json.trendAngle ?? json.trend ?? "").trim(),
      captionHook: String(json.captionHook ?? json.hook ?? "").trim(),
      captionBody: String(json.captionBody ?? json.caption ?? json.body ?? "").trim(),
      geminiPrompt: geminiPrompt || imagePrompt,
      imagePrompt: imagePrompt || geminiPrompt,
      imagePromptShort: String(json.imagePromptShort ?? json.shortImagePrompt ?? "").trim(),
      negativePrompt: String(json.negativePrompt ?? json.negative_prompt ?? "").trim(),
      hashtags: toArray(json.hashtags),
      postIdeas: toArray(json.postIdeas ?? json.ideas),
      artDirection: toArray(json.artDirection),
    };
    if (pack.conceptTitle && pack.captionHook && (pack.geminiPrompt || pack.imagePrompt)) return pack;
  } catch {
    // Fall through to labeled format.
  }

  const conceptTitle = readScalar(trimmed, ["CONCEPT_TITLE", "conceptTitle", "Concept Title"]);
  const trendAngle = readScalar(trimmed, ["TREND_ANGLE", "trendAngle", "Trend Angle"]);
  const captionHook = readScalar(trimmed, ["CAPTION_HOOK", "captionHook", "Caption Hook"]);
  const captionBody = readScalar(trimmed, ["CAPTION_BODY", "captionBody", "Caption Body"]);
  const geminiPrompt = readScalar(trimmed, ["GEMINI_PROMPT", "geminiPrompt", "Gemini Prompt"]);
  const imagePrompt = readScalar(trimmed, ["IMAGE_PROMPT", "imagePrompt", "Image Prompt", "IMAGE_GEN_PROMPT"]);
  const imagePromptShort = readScalar(trimmed, ["IMAGE_PROMPT_SHORT", "imagePromptShort", "Short Image Prompt"]);
  const negativePrompt = readScalar(trimmed, ["NEGATIVE_PROMPT", "negativePrompt", "Negative Prompt"]);
  const hashtags =
    readListSection(trimmed, ["HASHTAGS", "Hashtags"]) ||
    trimmed.match(/#[\w]+/g)?.map((tag) => tag.trim()) ||
    [];
  const postIdeas = readListSection(trimmed, ["POST_IDEAS", "Post Ideas", "POST IDEAS"]);
  const artDirection = readListSection(trimmed, ["ART_DIRECTION", "Art Direction", "ART DIRECTION"]);

  const resolvedGemini = geminiPrompt || imagePrompt;
  const resolvedImage = imagePrompt || geminiPrompt;
  if (!conceptTitle || !captionHook || !resolvedGemini) return null;

  return {
    conceptTitle,
    trendAngle: trendAngle || "Timely veterinary social content for pet parents.",
    captionHook,
    captionBody: captionBody || captionHook,
    hashtags: hashtags.length ? hashtags : ["#PetCare", "#VetClinic", "#DogHealth"],
    postIdeas: postIdeas.length ? postIdeas.slice(0, 5) : [conceptTitle],
    geminiPrompt: resolvedGemini,
    imagePrompt: resolvedImage,
    imagePromptShort:
      imagePromptShort ||
      `${resolvedImage.slice(0, 280)}${resolvedImage.length > 280 ? "…" : ""}`.trim(),
    negativePrompt:
      negativePrompt ||
      "photorealistic, stock photo, watermark, text overlay, blurry, distorted anatomy, extra limbs",
    artDirection: artDirection.length ? artDirection : ["2D illustration", "Non-photorealistic", "Square composition"],
  };
}
