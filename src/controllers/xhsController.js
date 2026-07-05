import { startXhsRun } from "../services/xhsService.js";
import { getRun } from "../services/runService.js";
import { readJson, sendJson } from "../http.js";

export async function createXhsRequest(req, res) {
  const body = await readJson(req);
  const requestId = startXhsRun(body);
  return sendJson(res, 202, { ok: true, requestId, status: "pending", statusUrl: `/api/xhs/requests/${requestId}` });
}

export function getXhsRequest(_req, res, requestId) {
  const run = getRun(requestId);
  if (!run) return sendJson(res, 404, { ok: false, error: "request not found" });
  return sendJson(res, 200, { ok: true, request: run });
}
