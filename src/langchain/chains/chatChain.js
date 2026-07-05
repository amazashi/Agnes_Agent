import { createChatModel } from "../models/agnesChatModel.js";
import { createChatMessages } from "../prompts/chatMessages.js";
import { ToolMessage } from "@langchain/core/messages";
import { defaultTools, executeToolCall } from "../tools/toolRegistry.js";

function contentToText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === "string") return part;
      return part.text || "";
    }).join("");
  }
  return "";
}

function serializeMessage(message) {
  return {
    content: message.content,
    tool_calls: message.tool_calls || message.additional_kwargs?.tool_calls || [],
    response_metadata: message.response_metadata || {},
    usage_metadata: message.usage_metadata || null,
    additional_kwargs: message.additional_kwargs || {},
  };
}

function createCallOptions(input) {
  const tools = defaultTools(input);
  return {
    ...(tools.length ? { tools } : {}),
    ...(input.toolChoice || input.tool_choice ? { tool_choice: input.toolChoice || input.tool_choice } : {}),
  };
}

export function createChatChain(input = {}) {
  return createChatModel(input);
}

export async function invokeChatChain(input) {
  const model = createChatChain(input);
  const messages = createChatMessages(input);
  const firstMessage = await model.invoke(messages, createCallOptions(input));
  const toolCalls = firstMessage.tool_calls || [];
  const toolResults = [];
  let finalMessage = firstMessage;

  if (toolCalls.length && input.executeTools !== false) {
    const toolMessages = [];
    for (const toolCall of toolCalls) {
      const output = await executeToolCall(toolCall);
      toolResults.push({ toolCall, output });
      toolMessages.push(new ToolMessage({
        content: JSON.stringify(output),
        tool_call_id: toolCall.id,
        name: toolCall.name,
      }));
    }
    finalMessage = await model.invoke([...messages, firstMessage, ...toolMessages], createCallOptions({ ...input, toolChoice: undefined, tool_choice: undefined }));
  }

  return {
    framework: "langchain-js",
    chain: toolCalls.length ? ["AgnesChatModel", "LocalToolExecution", "AgnesChatModel"] : ["AgnesChatModel"],
    requestShape: {
      supportsMessages: true,
      supportsImageUrl: true,
      supportsTools: true,
      supportsThinking: true,
    },
    text: contentToText(finalMessage.content),
    rawMessage: serializeMessage(finalMessage),
    firstMessage: serializeMessage(firstMessage),
    toolResults,
  };
}
