import { startChatRun } from "../services/chatService.js";
import { getRun } from "../services/runService.js";
import { readJson, sendJson } from "../http.js";

export async function createChatRequest(req, res) {
  const body = await readJson(req);
  if (!String(body.question || body.prompt || "").trim()) return sendJson(res, 400, { ok: false, error: "question is required" });
  const requestId = startChatRun(body);
  return sendJson(res, 202, { ok: true, requestId, status: "pending", statusUrl: `/api/chat/requests/${requestId}` });
}

export function getChatRequest(_req, res, requestId) {
  const run = getRun(requestId);
  if (!run) return sendJson(res, 404, { ok: false, error: "request not found" });
  return sendJson(res, 200, { ok: true, request: run });
}
