import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";

function userContent(input) {
  const text = String(input.question || input.prompt || "").trim();
  const imageUrls = [
    ...(Array.isArray(input.imageUrls) ? input.imageUrls : []),
    String(input.imageUrl || input.image_url || "").trim(),
  ].filter(Boolean);
  if (!imageUrls.length) return text;
  return [
    { type: "text", text },
    ...imageUrls.map((url) => ({ type: "image_url", image_url: url })),
  ];
}

function normalizeMessage(message) {
  const role = String(message.role || "user").toLowerCase();
  if (role === "system") return new SystemMessage(message.content || "");
  if (role === "assistant") return new AIMessage(message.content || "");
  return new HumanMessage({ content: message.content || "" });
}

export function createChatMessages(input) {
  if (Array.isArray(input.messages) && input.messages.length) {
    return input.messages.map(normalizeMessage);
  }
  const messages = [];
  const systemPrompt = String(input.systemPrompt || "").trim();
  if (systemPrompt) messages.push(new SystemMessage(systemPrompt));
  messages.push(new HumanMessage({ content: userContent(input) }));
  return messages;
}
