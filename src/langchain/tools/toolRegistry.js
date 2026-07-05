export const builtinToolSchemas = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get the current weather for a location",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "The city and country",
          },
        },
        required: ["location"],
      },
    },
  },
];

const toolHandlers = {
  get_weather: async ({ location }) => ({
    location,
    note: "This demo tool is wired into the local LangChain app. Connect a real weather API here for live data.",
    weather: "unknown",
  }),
};

export function defaultTools(input) {
  if (Array.isArray(input.tools) && input.tools.length) return input.tools;
  return input.enableBuiltinTools ? builtinToolSchemas : [];
}

export async function executeToolCall(toolCall) {
  const handler = toolHandlers[toolCall.name];
  if (!handler) {
    return {
      ok: false,
      name: toolCall.name,
      error: `No local tool handler registered for ${toolCall.name}`,
    };
  }
  return {
    ok: true,
    name: toolCall.name,
    result: await handler(toolCall.args || {}),
  };
}
