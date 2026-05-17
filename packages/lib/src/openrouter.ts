export const DEFAULT_OPENROUTER_MODEL = "deepseek/deepseek-v4-flash:free";

export const OPENROUTER_MODEL_FALLBACKS = [
  "deepseek/deepseek-v4-flash:free",
  "deepseek/deepseek-r1-0528",
] as const;

type MessageContentPart = { type?: string; text?: string };

export type OpenRouterChatMessage = {
  content?: string | MessageContentPart[] | null;
  reasoning?: string | null;
  reasoning_content?: string | null;
  reasoning_details?: Array<{ type?: string; text?: string; summary?: string }> | null;
};

export function resolveOpenRouterModel(configured?: string | null): string {
  const model = configured?.trim();
  if (!model) return DEFAULT_OPENROUTER_MODEL;
  if (/^deepseek\/deepseek-r1(:free)?$/i.test(model)) return "deepseek/deepseek-r1-0528";
  if (/^deepseek\/deepseek-chat-v3-0324(:free)?$/i.test(model)) return DEFAULT_OPENROUTER_MODEL;
  return model;
}

/** DeepSeek V4 endpoints on OpenRouter require reasoning and reject `enabled: false`. */
export function modelRequiresMandatoryReasoning(model: string): boolean {
  return /deepseek\/deepseek-v4-flash|deepseek\/deepseek-v4-pro|deepseek\/deepseek-v4\b/i.test(model);
}

function buildReasoningRequestBody(model: string, forceEnable = false): Record<string, unknown> | undefined {
  if (forceEnable || modelRequiresMandatoryReasoning(model)) {
    return { enabled: true, effort: "low" };
  }
  return undefined;
}

function isReasoningRequiredError(message: string): boolean {
  return /reasoning is mandatory|cannot be disabled|reasoning.*required/i.test(message);
}

function readMessageContent(message: OpenRouterChatMessage | null | undefined): string {
  if (!message) return "";
  const content = message.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => (part?.type === "text" && typeof part.text === "string" ? part.text : ""))
      .join("\n")
      .trim();
  }
  return "";
}

function readMessageReasoning(message: OpenRouterChatMessage | null | undefined): string {
  if (!message) return "";
  const chunks: string[] = [];

  if (typeof message.reasoning === "string" && message.reasoning.trim()) {
    chunks.push(message.reasoning.trim());
  }
  if (typeof message.reasoning_content === "string" && message.reasoning_content.trim()) {
    chunks.push(message.reasoning_content.trim());
  }

  const details = message.reasoning_details;
  if (Array.isArray(details)) {
    const fromDetails = details
      .map((item) => {
        if (item?.type === "text" && typeof item.text === "string") return item.text;
        if (typeof item.summary === "string") return item.summary;
        return "";
      })
      .join("\n")
      .trim();
    if (fromDetails) chunks.push(fromDetails);
  }

  return chunks.join("\n\n").trim();
}

export function extractOpenRouterMessageText(
  message: OpenRouterChatMessage | null | undefined,
  options?: { preferJson?: boolean },
): string {
  const content = readMessageContent(message);
  const reasoning = readMessageReasoning(message);

  if (options?.preferJson) {
    if (content.includes("{")) return content;
    if (reasoning.includes("{")) return reasoning;
  }

  if (content) return content;
  return reasoning;
}

export type OpenRouterChatRequest = {
  apiKey: string;
  model?: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  max_tokens?: number;
  temperature?: number;
  jsonMode?: boolean;
};

export type OpenRouterChatResult =
  | { ok: true; model: string; text: string }
  | { ok: false; model: string; error: string };

async function postOpenRouterChatCompletion(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<{
  ok: boolean;
  status: number;
  model: string;
  payload: {
    choices?: Array<{ message?: OpenRouterChatMessage }>;
    error?: { message?: string };
  };
  raw: string;
}> {
  const model = String(body.model ?? "");
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  let payload: {
    choices?: Array<{ message?: OpenRouterChatMessage }>;
    error?: { message?: string };
  } = {};

  if (raw.trim()) {
    try {
      payload = JSON.parse(raw) as typeof payload;
    } catch {
      return { ok: false, status: response.status, model, payload: {}, raw };
    }
  }

  return { ok: response.ok, status: response.status, model, payload, raw };
}

export async function requestOpenRouterChatCompletion(
  input: OpenRouterChatRequest & { modelOverride?: string },
): Promise<OpenRouterChatResult> {
  const model = input.modelOverride?.trim() || resolveOpenRouterModel(input.model);
  const body: Record<string, unknown> = {
    model,
    max_tokens: input.max_tokens ?? 2200,
    messages: input.messages,
  };
  if (input.temperature !== undefined) body.temperature = input.temperature;
  if (input.jsonMode) body.response_format = { type: "json_object" };

  const reasoning = buildReasoningRequestBody(model);
  if (reasoning) body.reasoning = reasoning;

  let attempt = await postOpenRouterChatCompletion(input.apiKey, body);
  const firstError = attempt.payload.error?.message ?? "";
  if (!attempt.ok && isReasoningRequiredError(firstError)) {
    body.reasoning = buildReasoningRequestBody(model, true);
    attempt = await postOpenRouterChatCompletion(input.apiKey, body);
  }

  if (!attempt.ok) {
    return { ok: false, model, error: attempt.payload.error?.message ?? "AI generation failed." };
  }

  const text = extractOpenRouterMessageText(attempt.payload.choices?.[0]?.message, { preferJson: input.jsonMode });
  if (!text) {
    return { ok: false, model, error: "No content returned by the selected OpenRouter model." };
  }

  return { ok: true, model, text };
}

export async function requestOpenRouterChatWithFallbacks(
  input: OpenRouterChatRequest & { fallbackModels?: readonly string[] },
): Promise<OpenRouterChatResult> {
  const primary = resolveOpenRouterModel(input.model);
  const fallbacks = input.fallbackModels ?? OPENROUTER_MODEL_FALLBACKS;
  const models = Array.from(new Set([primary, ...fallbacks.map((item) => resolveOpenRouterModel(item))]));

  let lastError = "AI generation failed.";
  for (const model of models) {
    const result = await requestOpenRouterChatCompletion({ ...input, model });
    if (result.ok) return result;
    lastError = result.error;
    if (!/no content|empty|non-json|reasoning is mandatory|cannot be disabled/i.test(result.error)) break;
  }

  return { ok: false, model: primary, error: lastError };
}
