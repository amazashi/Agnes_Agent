import { db } from "./sqlite.js";

function nowIso() {
  return new Date().toISOString();
}

function jsonText(value) {
  return JSON.stringify(value ?? null);
}

function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapRun(row) {
  return {
    id: row.id,
    requestId: row.request_id,
    kind: row.kind,
    status: row.status,
    request: parseJson(row.request_json, {}),
    response: parseJson(row.response_json, null),
    errorMessage: row.error_message,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    elapsedMs: row.elapsed_ms,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function insertRun({ requestId, kind, request }) {
  const ts = nowIso();
  db.prepare(`
    INSERT INTO chain_runs (request_id, kind, status, request_json, created_at, updated_at)
    VALUES (?, ?, 'pending', ?, ?, ?)
  `).run(requestId, kind, jsonText(request), ts, ts);
}

export function updateRunRunning(requestId) {
  const ts = nowIso();
  db.prepare(`
    UPDATE chain_runs
    SET status = 'running',
        started_at = COALESCE(started_at, ?),
        finished_at = NULL,
        error_message = NULL,
        updated_at = ?
    WHERE request_id = ?
  `).run(ts, ts, requestId);
}

export function updateRunProgress(requestId, response) {
  const ts = nowIso();
  db.prepare(`
    UPDATE chain_runs
    SET response_json = ?, updated_at = ?
    WHERE request_id = ?
  `).run(jsonText(response), ts, requestId);
}

export function updateRunDone(requestId, { status, response = null, error = null, startedAt = null }) {
  const finishedAt = nowIso();
  const started = startedAt ? new Date(startedAt).getTime() : Date.now();
  db.prepare(`
    UPDATE chain_runs
    SET status = ?, response_json = ?, error_message = ?, finished_at = ?,
        elapsed_ms = ?, updated_at = ?
    WHERE request_id = ?
  `).run(status, response == null ? null : jsonText(response), error, finishedAt, Math.max(0, Date.now() - started), finishedAt, requestId);
}

export function findRunByRequestId(requestId) {
  const row = db.prepare("SELECT * FROM chain_runs WHERE request_id = ?").get(requestId);
  return row ? mapRun(row) : null;
}

export function findRecentRuns(limit = 30) {
  return db.prepare("SELECT * FROM chain_runs ORDER BY id DESC LIMIT ?")
    .all(Math.max(1, Math.min(100, Number(limit) || 30)))
    .map(mapRun);
}
