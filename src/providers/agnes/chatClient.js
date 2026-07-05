import { ChatOpenAI } from "@langchain/openai";
import { getAgnesConfig, requireAgnesApiKey } from "./agnesConfig.js";

export function createAgnesChatModel(input = {}) {
  const config = getAgnesConfig(input);
  const modelKwargs = {
    ...(input.chatTemplateKwargs ? { chat_template_kwargs: input.chatTemplateKwargs } : {}),
    ...(input.chat_template_kwargs ? { chat_template_kwargs: input.chat_template_kwargs } : {}),
    ...(input.thinking ? { thinking: input.thinking } : {}),
    ...(input.extraBody || {}),
  };
  return new ChatOpenAI({
    apiKey: requireAgnesApiKey(config),
    configuration: {
      baseURL: config.chatBaseUrl,
    },
    model: config.chatModel,
    temperature: Number.isFinite(Number(input.temperature)) ? Number(input.temperature) : 0.2,
    topP: Number.isFinite(Number(input.topP ?? input.top_p)) ? Number(input.topP ?? input.top_p) : undefined,
    maxTokens: Number.isFinite(Number(input.maxTokens ?? input.max_tokens)) ? Number(input.maxTokens ?? input.max_tokens) : undefined,
    streaming: input.stream === true || input.streaming === true,
    timeout: Math.max(1000, Number(input.timeoutMs || process.env.AGNES_CHAT_TIMEOUT_MS || 120000)),
    modelKwargs,
  });
}
