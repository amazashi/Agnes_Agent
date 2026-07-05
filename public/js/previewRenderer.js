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

function renderResumeAction(run) {
  if (run.status !== "failed" || !run.kind?.startsWith("xhs")) return "";
  return `
    <div class="resume-box">
      <div>
        <strong>任务中断</strong>
        <span>可以从已保存的 checkpoint 继续处理，不会重做已完成步骤。</span>
      </div>
      <button type="button" class="resume-button" data-resume-kind="xhs" data-request-id="${escapeHtml(run.requestId)}">继续处理</button>
    </div>
  `;
}

function renderXhs(run, response) {
  const storyboard = Array.isArray(response.plan?.storyboard) ? response.plan.storyboard : [];
  const progressText = response.statusDetail ? `<div class="meta">当前阶段：${escapeHtml(response.statusDetail)}</div>` : "";
  const errorText = run.status === "failed" ? `<div class="error-text">${escapeHtml(run.errorMessage || "任务失败")}</div>` : "";
  return `
    <div class="xhs-preview">
      ${renderResumeAction(run)}
      ${errorText}
      <div class="text-preview">
        <strong>关键词：</strong>${escapeHtml(response.keyword || "")}
        <br /><strong>钩子：</strong>${escapeHtml(response.hook || "")}
        ${progressText}
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
  if (response.workflow === "xhs_30s_video") return renderXhs(run, response);
  if (run.status === "pending" || run.status === "running") return "任务还在运行中。";
  if (run.status === "failed" && run.kind?.startsWith("xhs")) {
    return `${renderResumeAction(run)}<div class="error-text">${escapeHtml(run.errorMessage || "任务失败")}</div>`;
  }
  if (run.status === "failed") return escapeHtml(run.errorMessage || "任务失败");
  if (response.text) return `<div class="text-preview">${escapeHtml(response.text)}</div>`;
  if (response.ossImages?.length) return renderImages(response.ossImages);
  if (response.ossVideo?.url) return renderVideo(response.ossVideo);
  return "没有可预览内容。";
}

async function resumeXhsTask(button) {
  const requestId = button.dataset.requestId;
  button.disabled = true;
  button.textContent = "继续处理中...";
  const [{ api }, { trackTask, poll }] = await Promise.all([
    import("./apiClient.js"),
    import("./polling.js"),
  ]);
  await api(`/api/xhs/requests/${requestId}/resume`, { method: "POST", body: JSON.stringify({}) });
  trackTask("xhs", requestId);
  await poll("xhs", requestId);
}

function bindResumeButtons() {
  document.querySelectorAll("[data-resume-kind='xhs']").forEach((button) => {
    button.addEventListener("click", () => {
      resumeXhsTask(button).catch((error) => {
        button.disabled = false;
        button.textContent = "继续处理";
        document.getElementById("status").textContent = "xhs resume failed";
        document.getElementById("answer").insertAdjacentHTML("afterbegin", `<div class="error-text">${escapeHtml(error.message)}</div>`);
      });
    });
  });
}

export function showRun(data) {
  const run = data.request || data;
  document.getElementById("raw").textContent = JSON.stringify(data, null, 2);
  document.getElementById("status").textContent = `${kindFromRun(run)} ${run.status || "unknown"}`;
  document.getElementById("answer").innerHTML = renderAnswer(run);
  bindResumeButtons();
}
