import { api, formJson, streamApi } from "./apiClient.js";
import { showRun } from "./previewRenderer.js";
import { trackTask, poll } from "./polling.js";
import { refreshRuns } from "./runList.js";

export function bindSubmit(kind, formId) {
  document.getElementById(formId).addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = formJson(event.currentTarget);
    if (kind === "chat" && body.stream === true) {
      await submitStreamingChat(body);
      return;
    }

    document.getElementById("status").textContent = `${kind} submitted`;
    document.getElementById("answer").textContent = "任务已提交，等待后台运行。";
    const data = await api(`/api/${kind}/requests`, { method: "POST", body: JSON.stringify(body) });
    trackTask(kind, data.requestId);
    showRun({ request: { ...data, kind: `${kind}_chain` } });
    setTimeout(() => poll(kind, data.requestId), 1000);
    await refreshRuns();
  });
}

async function submitStreamingChat(body) {
  const answer = document.getElementById("answer");
  const raw = document.getElementById("raw");
  const status = document.getElementById("status");
  let fullText = "";
  status.textContent = "chat streaming";
  answer.innerHTML = `<div class="text-preview stream-preview"></div>`;
  const target = answer.querySelector(".stream-preview");

  await streamApi("/api/chat/stream", body, {
    start(data) {
      raw.textContent = JSON.stringify(data, null, 2);
      trackTask("chat", data.requestId);
    },
    delta(data) {
      fullText += data.text || "";
      target.textContent = fullText;
    },
    done(data) {
      status.textContent = "chat succeeded";
      raw.textContent = JSON.stringify(data, null, 2);
      refreshRuns().catch(console.error);
    },
    error(data) {
      status.textContent = "chat failed";
      target.textContent = data.error || "stream failed";
      raw.textContent = JSON.stringify(data, null, 2);
    },
  });
}
