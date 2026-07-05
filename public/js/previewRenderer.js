function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
}

export function kindFromRun(run) {
  if (run.kind?.startsWith("image")) return "image";
  if (run.kind?.startsWith("video")) return "video";
  return "chat";
}

export function renderAnswer(run) {
  const response = run.response || {};
  if (run.status === "pending" || run.status === "running") return "任务还在运行中。";
  if (run.status === "failed") return escapeHtml(run.errorMessage || "任务失败");
  if (response.text) return `<div class="text-preview">${escapeHtml(response.text)}</div>`;
  if (response.ossImages?.length) {
    return `<div class="media-grid">${response.ossImages.map((item) => `
      <figure>
        <img src="${escapeHtml(item.url)}" alt="generated image" />
        <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.objectKey || "OSS image")}</a>
      </figure>
    `).join("")}</div>`;
  }
  if (response.ossVideo?.url) {
    return `<div class="video-preview">
      <video src="${escapeHtml(response.ossVideo.url)}" controls playsinline></video>
      <a href="${escapeHtml(response.ossVideo.url)}" target="_blank" rel="noreferrer">${escapeHtml(response.ossVideo.objectKey || "OSS video")}</a>
    </div>`;
  }
  return "没有可预览内容。";
}

export function showRun(data) {
  const run = data.request || data;
  document.getElementById("raw").textContent = JSON.stringify(data, null, 2);
  document.getElementById("status").textContent = `${kindFromRun(run)} ${run.status || "unknown"}`;
  document.getElementById("answer").innerHTML = renderAnswer(run);
}
