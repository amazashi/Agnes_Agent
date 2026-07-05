import { api } from "./apiClient.js";
import { kindFromRun, showRun } from "./previewRenderer.js";

export async function refreshRuns() {
  const data = await api("/api/runs?limit=20");
  const runs = document.getElementById("runs");
  runs.innerHTML = data.runs.map((run) => `
    <article class="run" data-kind="${kindFromRun(run)}" data-id="${run.requestId}">
      <strong>${run.kind} / ${run.status}</strong>
      <div class="meta">${run.requestId}</div>
      <div class="meta">${run.updatedAt}</div>
    </article>
  `).join("");
  document.querySelectorAll(".run").forEach((item) => {
    item.addEventListener("click", async () => showRun(await api(`/api/${item.dataset.kind}/requests/${item.dataset.id}`)));
  });
}
