import { ChatPromptTemplate } from "@langchain/core/prompts";

export function createChatPrompt() {
  return ChatPromptTemplate.fromMessages([
    ["system", "{systemPrompt}"],
    ["human", "{question}"],
  ]);
}
