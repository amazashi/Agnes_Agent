import { listRuns } from "../services/runService.js";
import { sendJson } from "../http.js";

export function listRunRequests(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  return sendJson(res, 200, { ok: true, runs: listRuns(url.searchParams.get("limit")) });
}
