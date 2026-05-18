import { OpenRouter } from "@openrouter/sdk";

export const DEEPSEEK_V4_FLASH_MODEL = "deepseek/deepseek-v4-flash:free";

export type V4FlashChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type V4FlashStreamResult =
  | { ok: true; text: string; model: string }
  | { ok: false; error: string; model: string };

/** Stream DeepSeek V4 Flash via OpenRouter SDK; only assistant `content` deltas are collected. */
export async function streamDeepSeekV4FlashChat(params: {
  apiKey: string;
  messages: V4FlashChatMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<V4FlashStreamResult> {
  const model = DEEPSEEK_V4_FLASH_MODEL;
  const openrouter = new OpenRouter({ apiKey: params.apiKey });

  try {
    const stream = await openrouter.chat.send({
      chatRequest: {
        model,
        messages: params.messages,
        stream: true,
        maxCompletionTokens: params.maxTokens ?? 3600,
        temperature: params.temperature ?? 0.5,
      },
    });

    let response = "";
    for await (const chunk of stream) {
      if (chunk.error?.message) {
        return { ok: false, model, error: chunk.error.message };
      }

      const content = chunk.choices[0]?.delta?.content;
      if (content) response += content;
    }

    const text = response.trim();
    if (!text) {
      return { ok: false, model, error: "No content returned by the selected OpenRouter model." };
    }

    return { ok: true, model, text };
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI generation failed.";
    return { ok: false, model, error: message };
  }
}
