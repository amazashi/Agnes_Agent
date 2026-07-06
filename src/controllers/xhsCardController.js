import { startXhsCardRun } from "../services/xhsCardService.js";
import { getRun } from "../services/runService.js";
import { readJson, sendJson } from "../http.js";

export async function createXhsCardRequest(req, res) {
  const body = await readJson(req);
  const requestId = startXhsCardRun(body);
  return sendJson(res, 202, { ok: true, requestId, status: "pending", statusUrl: `/api/xhs-card/requests/${requestId}` });
}

export function getXhsCardRequest(_req, res, requestId) {
  const run = getRun(requestId);
  if (!run) return sendJson(res, 404, { ok: false, error: "request not found" });
  return sendJson(res, 200, { ok: true, request: run });
}
