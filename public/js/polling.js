import { api } from "./apiClient.js";
import { showRun } from "./previewRenderer.js";
import { refreshRuns } from "./runList.js";

const active = new Map();

export function trackTask(kind, requestId) {
  active.set(requestId, kind);
}

export async function poll(kind, requestId) {
  const data = await api(`/api/${kind}/requests/${requestId}`);
  showRun(data);
  if (!["pending", "running"].includes(data.request.status)) {
    active.delete(requestId);
    await refreshRuns();
  }
}

export function startPolling() {
  setInterval(() => {
    for (const [requestId, kind] of active.entries()) poll(kind, requestId).catch(console.error);
  }, 30000);
}
