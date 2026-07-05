import { startImageRun } from "../services/imageService.js";
import { getRun } from "../services/runService.js";
import { readJson, sendJson } from "../http.js";

export async function createImageRequest(req, res) {
  const body = await readJson(req);
  if (!String(body.prompt || "").trim()) return sendJson(res, 400, { ok: false, error: "prompt is required" });
  const requestId = startImageRun(body);
  return sendJson(res, 202, { ok: true, requestId, status: "pending", statusUrl: `/api/image/requests/${requestId}` });
}

export function getImageRequest(_req, res, requestId) {
  const run = getRun(requestId);
  if (!run) return sendJson(res, 404, { ok: false, error: "request not found" });
  return sendJson(res, 200, { ok: true, request: run });
}
