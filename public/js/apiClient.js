export async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

export function formJson(form) {
  const body = Object.fromEntries([...new FormData(form).entries()].map(([key, value]) => [key, String(value).trim()]));
  for (const key of ["temperature", "topP", "maxTokens", "thinkingBudgetTokens", "width", "height", "numFrames", "segmentFrames", "segmentCount", "frameRate", "seed", "numInferenceSteps"]) {
    if (body[key]) body[key] = Number(body[key]);
    else delete body[key];
  }
  if (body.stream === "true") body.stream = true;
  else delete body.stream;
  if (body.enableThinking === "true") {
    body.thinking = {
      type: "enabled",
      budget_tokens: Number(body.thinkingBudgetTokens || 2048),
    };
    body.chatTemplateKwargs = { enable_thinking: true };
  }
  delete body.enableThinking;
  delete body.thinkingBudgetTokens;
  if (body.toolsJson) body.tools = JSON.parse(body.toolsJson);
  delete body.toolsJson;
  if (body.imageUrlsJson) body.imageUrls = JSON.parse(body.imageUrlsJson);
  delete body.imageUrlsJson;
  if (body.keyframesJson) body.keyframes = JSON.parse(body.keyframesJson);
  delete body.keyframesJson;
  if (body.imageDataUrlsJson) body.imageDataUrls = JSON.parse(body.imageDataUrlsJson);
  delete body.imageDataUrlsJson;
  if (body.extraBodyJson) body.extraBody = JSON.parse(body.extraBodyJson);
  delete body.extraBodyJson;
  if (body.returnBase64 === "true") body.returnBase64 = true;
  else delete body.returnBase64;
  if (body.enableBuiltinTools === "true") body.enableBuiltinTools = true;
  else delete body.enableBuiltinTools;
  if (body.executeTools === "false") body.executeTools = false;
  else delete body.executeTools;
  if (!body.toolChoice) delete body.toolChoice;
  Object.keys(body).forEach((key) => {
    if (body[key] === "") delete body[key];
  });
  return body;
}

export async function streamApi(path, body, handlers = {}) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "message";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      if (!line) {
        event = "message";
        continue;
      }
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
        continue;
      }
      if (line.startsWith("data:")) {
        const data = JSON.parse(line.slice(5).trim());
        handlers[event]?.(data);
      }
    }
  }
}
