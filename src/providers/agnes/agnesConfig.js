export function getAgnesConfig(input = {}) {
  const apiKey = String(input.apiKey || process.env.AGNES_API_KEY || process.env.OPENAI_API_KEY || "").trim();
  const baseUrl = String(input.baseUrl || process.env.AGNES_BASE_URL || "https://apihub.agnes-ai.com").replace(/\/+$/, "");
  return {
    apiKey,
    baseUrl,
    chatBaseUrl: input.chatBaseUrl || process.env.OPENAI_BASE_URL || `${baseUrl}/v1`,
    chatModel: input.model || process.env.AGNES_CHAT_MODEL || process.env.OPENAI_MODEL || "agnes-2.0-flash",
    imageModel: input.model || process.env.AGNES_IMAGE_MODEL || "agnes-image-2.0-flash",
    videoModel: input.model || process.env.AGNES_VIDEO_MODEL || "agnes-video-v2.0",
  };
}

export function requireAgnesApiKey(config) {
  if (!config.apiKey) throw new Error("AGNES_API_KEY or OPENAI_API_KEY is required");
  return config.apiKey;
}
