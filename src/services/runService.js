import { randomUUID } from "node:crypto";
import { insertRun, updateRunDone, updateRunProgress, updateRunRunning, findRecentRuns, findRunByRequestId } from "../storage/runRepository.js";
import { refreshRunAssets } from "./assetService.js";

export function createPendingRun({ kind, request }) {
  const requestId = randomUUID();
  insertRun({ requestId, kind, request });
  return requestId;
}

export function markRunRunning(requestId) {
  updateRunRunning(requestId);
}

export function markRunSucceeded(requestId, response, startedAt) {
  updateRunDone(requestId, { status: "succeeded", response: { requestId, ...response }, startedAt });
}

export function markRunFailed(requestId, error, startedAt = null) {
  const existing = findRunByRequestId(requestId);
  updateRunDone(requestId, { status: "failed", response: existing?.response || null, error: error.message || String(error), startedAt });
}

export function markRunProgress(requestId, response) {
  updateRunProgress(requestId, { requestId, ...response });
}

export function getRun(requestId) {
  return refreshRunAssets(findRunByRequestId(requestId));
}

export function listRuns(limit) {
  return findRecentRuns(limit);
}

export function runAsyncTask(requestId, task) {
  setImmediate(async () => {
    const startedAt = new Date().toISOString();
    markRunRunning(requestId);
    try {
      markRunSucceeded(requestId, await task(), startedAt);
    } catch (error) {
      markRunFailed(requestId, error, startedAt);
    }
  });
}

export function resumeAsyncTask(requestId, task) {
  setImmediate(async () => {
    const startedAt = new Date().toISOString();
    markRunRunning(requestId);
    try {
      markRunSucceeded(requestId, await task(), startedAt);
    } catch (error) {
      markRunFailed(requestId, error, startedAt);
    }
  });
}
