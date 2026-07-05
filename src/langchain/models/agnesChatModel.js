import { createAgnesChatModel } from "../../providers/agnes/chatClient.js";

export function createChatModel(input = {}) {
  return createAgnesChatModel(input);
}
