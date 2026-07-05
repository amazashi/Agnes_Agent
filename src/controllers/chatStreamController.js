import { readJson } from "../http.js";
import { createPendingRun, markRunFailed, markRunRunning, markRunSucceeded } from "../services/runService.js";
import { createChatModel } from "../langchain/models/agnesChatModel.js";
import { createChatMessages } from "../langchain/prompts/chatMessages.js";

function contentToText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => part.text || "").join("");
  return "";
}

function writeEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export async function streamChatRequest(req, res) {
  const body = await readJson(req);
  const requestId = createPendingRun({ kind: "chat_stream", request: { ...body, stream: true } });
  const startedAt = new Date().toISOString();

  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "access-control-allow-origin": "*",
  });

  markRunRunning(requestId);
  writeEvent(res, "start", { ok: true, requestId, statusUrl: `/api/chat/requests/${requestId}` });

  try {
    const model = createChatModel({ ...body, stream: true });
    const messages = createChatMessages(body);
    let text = "";

    for await (const chunk of await model.stream(messages)) {
      const delta = contentToText(chunk.content);
      if (!delta) continue;
      text += delta;
      writeEvent(res, "delta", { text: delta });
    }

    const response = {
      framework: "langchain-js",
      chain: ["AgnesChatModel.stream"],
      text,
      stream: true,
    };
    markRunSucceeded(requestId, response, startedAt);
    writeEvent(res, "done", { requestId, text });
  } catch (error) {
    markRunFailed(requestId, error, startedAt);
    writeEvent(res, "error", { requestId, error: error.message || String(error) });
  } finally {
    res.end();
  }
}
