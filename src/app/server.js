import { createServer } from "node:http";
import { loadDotEnv } from "../env.js";
import { sendJson, serveStatic } from "../http.js";
import { routeApi } from "../routes/apiRoutes.js";

loadDotEnv();

export function startServer() {
  const port = Number(process.env.PORT || 8930);
  return createServer((req, res) => {
    route(req, res).catch((error) => sendJson(res, 500, { ok: false, error: error.message }));
  }).listen(port, () => {
    console.log(`LangChain JS SQLite workbench listening on http://localhost:${port}`);
  });
}

async function route(req, res) {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const handled = await routeApi(req, res, url);
  if (handled !== false) return;
  if (req.method === "GET" && serveStatic(req, res)) return;
  sendJson(res, 404, { ok: false, error: "not found" });
}
