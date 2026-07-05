function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
}

export function kindFromRun(run) {
  if (run.kind?.startsWith("image")) return "image";
  if (run.kind?.startsWith("video")) return "video";
  if (run.kind?.startsWith("xhs")) return "xhs";
  return "chat";
}

function renderImages(items = [], alt = "generated image") {
  return `<div class="media-grid">${items.map((item) => `
    <figure>
      <img src="${escapeHtml(item.url)}" alt="${escapeHtml(alt)}" />
      <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.objectKey || "OSS image")}</a>
    </figure>
  `).join("")}</div>`;
}

function renderVideo(item) {
  return `<div class="video-preview">
    <video src="${escapeHtml(item.url)}" controls playsinline></video>
    <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.objectKey || "OSS video")}</a>
  </div>`;
}

function renderXhs(response) {
  const storyboard = Array.isArray(response.plan?.storyboard) ? response.plan.storyboard : [];
  return `
    <div class="xhs-preview">
      <div class="text-preview">
        <strong>关键词：</strong>${escapeHtml(response.keyword || "")}
        <br /><strong>钩子：</strong>${escapeHtml(response.hook || "")}
      </div>
      <div class="storyboard-list">
        ${storyboard.map((shot) => `
          <article>
            <strong>${escapeHtml(shot.time || "")}</strong>
            <span>${escapeHtml(shot.scene || "")}</span>
          </article>
        `).join("")}
      </div>
      ${response.ossImages?.length ? renderImages(response.ossImages, "xhs generated image") : ""}
      ${response.ossVideo?.url ? renderVideo(response.ossVideo) : ""}
    </div>
  `;
}

export function renderAnswer(run) {
  const response = run.response || {};
  if (run.status === "pending" || run.status === "running") return "任务还在运行中。";
  if (run.status === "failed") return escapeHtml(run.errorMessage || "任务失败");
  if (response.workflow === "xhs_30s_video") return renderXhs(response);
  if (response.text) return `<div class="text-preview">${escapeHtml(response.text)}</div>`;
  if (response.ossImages?.length) return renderImages(response.ossImages);
  if (response.ossVideo?.url) return renderVideo(response.ossVideo);
  return "没有可预览内容。";
}

export function showRun(data) {
  const run = data.request || data;
  document.getElementById("raw").textContent = JSON.stringify(data, null, 2);
  document.getElementById("status").textContent = `${kindFromRun(run)} ${run.status || "unknown"}`;
  document.getElementById("answer").innerHTML = renderAnswer(run);
}
