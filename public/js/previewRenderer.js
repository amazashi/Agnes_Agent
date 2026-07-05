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

function segmentPromptsFrom(response) {
  const segments = Array.isArray(response.videoSegments) ? response.videoSegments : [];
  if (segments.length) return segments.map((segment) => segment.input?.prompt || "").filter(Boolean);
  const storyboard = Array.isArray(response.plan?.storyboard) ? response.plan.storyboard : [];
  return storyboard.map((shot, index) => `多个镜头。${shot.scene || ""} ${shot.camera || ""} ${shot.emotion || ""}。镜头稳定，动作自然，柔和电影光线。无文字。`);
}

function renderPromptEditor(response) {
  const imagePrompt = response.imageInput?.prompt || response.plan?.imagePrompt || "";
  const videoPrompt = response.plan?.videoPrompt || "";
  const segmentPrompts = segmentPromptsFrom(response);
  const negativePrompt = response.plan?.negativePrompt || "";
  return `
    <details class="prompt-editor" open>
      <summary>提示词，可编辑后继续处理</summary>
      <label>图片提示词<textarea data-xhs-field="imagePrompt" rows="4">${escapeHtml(imagePrompt)}</textarea></label>
      <label>视频总提示词<textarea data-xhs-field="videoPrompt" rows="4">${escapeHtml(videoPrompt)}</textarea></label>
      <label>分段视频提示词 JSON<textarea data-xhs-field="segmentPromptsJson" rows="7">${escapeHtml(JSON.stringify(segmentPrompts, null, 2))}</textarea></label>
      <label>负面提示词<textarea data-xhs-field="negativePrompt" rows="3">${escapeHtml(negativePrompt)}</textarea></label>
    </details>
  `;
}

function renderResumeAction(run) {
  if (run.status !== "failed" || !run.kind?.startsWith("xhs")) return "";
  return `
    <div class="resume-box">
      <div>
        <strong>任务中断</strong>
        <span>可以从已保存的 checkpoint 继续处理；如果你编辑了提示词，会带着新提示词继续。</span>
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
      ${renderPromptEditor(response)}
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

function editedPromptPayload() {
  const payload = {};
  document.querySelectorAll("[data-xhs-field]").forEach((field) => {
    const value = field.value.trim();
    if (!value) return;
    if (field.dataset.xhsField === "segmentPromptsJson") payload.segmentPrompts = JSON.parse(value);
    else payload[field.dataset.xhsField] = value;
  });
  return payload;
}

async function resumeXhsTask(button) {
  const requestId = button.dataset.requestId;
  button.disabled = true;
  button.textContent = "继续处理中...";
  const [{ api }, { trackTask, poll }] = await Promise.all([
    import("./apiClient.js"),
    import("./polling.js"),
  ]);
  await api(`/api/xhs/requests/${requestId}/resume`, { method: "POST", body: JSON.stringify(editedPromptPayload()) });
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
