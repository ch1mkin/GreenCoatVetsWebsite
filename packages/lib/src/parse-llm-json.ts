function repairJsonString(json: string): string {
  return json
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
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
