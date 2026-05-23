import { DEFAULT_OPENROUTER_MODEL, requestOpenRouterChatCompletion } from "@saasclinics/lib";

export const DEEPSEEK_V4_FLASH_MODEL = DEFAULT_OPENROUTER_MODEL;

export type V4FlashChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type V4FlashStreamResult =
  | { ok: true; text: string; model: string }
  | { ok: false; error: string; model: string };

/** Non-stream completion with mandatory DeepSeek V4 reasoning handling. */
export async function streamDeepSeekV4FlashChat(params: {
  apiKey: string;
  messages: V4FlashChatMessage[];
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}): Promise<V4FlashStreamResult> {
  const model = process.env.OPENROUTER_MODEL?.trim() || DEEPSEEK_V4_FLASH_MODEL;
  const completion = await requestOpenRouterChatCompletion({
    apiKey: params.apiKey,
    model,
    modelOverride: model,
    messages: params.messages,
    max_tokens: params.maxTokens ?? 3600,
    temperature: params.temperature ?? 0.5,
    jsonMode: params.jsonMode,
  });

  if (!completion.ok) {
    return { ok: false, model: completion.model, error: completion.error };
  }

  return { ok: true, model: completion.model, text: completion.text };
}
