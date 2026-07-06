function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[char]));
}

export function kindFromRun(run) {
  if (run.kind?.startsWith("image")) return "image";
  if (run.kind?.startsWith("video")) return "video";
  if (run.kind?.startsWith("xhs")) return "xhs";
  return "chat";
}

function renderImages(items = [], alt = "generated image", title = "Images") {
  if (!items.length) return "";
  return `
    <section class="preview-block">
      <h3>${escapeHtml(title)}</h3>
      <div class="media-grid">
        ${items.map((item) => `
          <figure>
            <img src="${escapeHtml(item.url)}" alt="${escapeHtml(alt)}" />
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.objectKey || "OSS image")}</a>
          </figure>
        `).join("")}
      </div>
    </section>
  `;
}

function renderVideo(item, title = "Video") {
  if (!item?.url) return "";
  return `
    <section class="preview-block">
      <h3>${escapeHtml(title)}</h3>
      <div class="video-preview">
        <video src="${escapeHtml(item.url)}" controls playsinline></video>
        <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.objectKey || "OSS video")}</a>
      </div>
    </section>
  `;
}

function segmentPromptsFrom(response) {
  const segments = Array.isArray(response.videoSegments) ? response.videoSegments : [];
  if (segments.length) return segments.map((segment) => segment.input?.prompt || "").filter(Boolean);
  const storyboard = Array.isArray(response.plan?.storyboard) ? response.plan.storyboard : [];
  return storyboard.map((shot, index) => [
    `Multiple shots. Segment ${index + 1}: ${shot.scene || ""}.`,
    shot.camera ? `Camera: ${shot.camera}.` : "",
    shot.emotion ? `Emotion: ${shot.emotion}.` : "",
    "Keep the same character identity from the reference image.",
    "Smooth natural motion, soft cinematic light, no text.",
  ].filter(Boolean).join(" "));
}

function renderPromptEditor(response) {
  const characterPrompt = response.characterInput?.prompt || "";
  const imagePrompt = response.imageInput?.prompt || response.plan?.imagePrompt || "";
  const videoPrompt = response.plan?.videoPrompt || "";
  const segmentPrompts = segmentPromptsFrom(response);
  const negativePrompt = response.plan?.negativePrompt || "";
  return `
    <details class="prompt-editor" open>
      <summary>Prompts: edit and resume</summary>
      <label>Character reference prompt<textarea data-xhs-field="characterPrompt" rows="4">${escapeHtml(characterPrompt)}</textarea></label>
      <label>Image prompt<textarea data-xhs-field="imagePrompt" rows="4">${escapeHtml(imagePrompt)}</textarea></label>
      <label>Base video prompt<textarea data-xhs-field="videoPrompt" rows="4">${escapeHtml(videoPrompt)}</textarea></label>
      <label>Segment video prompts JSON<textarea data-xhs-field="segmentPromptsJson" rows="7">${escapeHtml(JSON.stringify(segmentPrompts, null, 2))}</textarea></label>
      <label>Negative prompt<textarea data-xhs-field="negativePrompt" rows="3">${escapeHtml(negativePrompt)}</textarea></label>
    </details>
  `;
}

function renderResumeAction(run) {
  if (run.status !== "failed" || !run.kind?.startsWith("xhs")) return "";
  return `
    <div class="resume-box">
      <div>
        <strong>Task interrupted</strong>
        <span>Resume from the saved checkpoint. Edited prompts above will be used for the next unfinished step.</span>
      </div>
      <button type="button" class="resume-button" data-resume-kind="xhs" data-request-id="${escapeHtml(run.requestId)}">Resume</button>
    </div>
  `;
}

function renderStoryboard(storyboard = []) {
  if (!storyboard.length) return "";
  return `
    <section class="preview-block">
      <h3>Storyboard</h3>
      <div class="storyboard-list">
        ${storyboard.map((shot) => `
          <article>
            <strong>${escapeHtml(shot.time || "")}</strong>
            <span>${escapeHtml(shot.scene || "")}</span>
            <small>${escapeHtml(shot.camera || "")}</small>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderXhs(run, response) {
  const storyboard = Array.isArray(response.plan?.storyboard) ? response.plan.storyboard : [];
  const progressText = response.statusDetail ? `<div class="meta">Stage: ${escapeHtml(response.statusDetail)}</div>` : "";
  const errorText = run.status === "failed" ? `<div class="error-text">${escapeHtml(run.errorMessage || "Task failed")}</div>` : "";
  return `
    <div class="xhs-preview">
      ${renderResumeAction(run)}
      ${errorText}
      <section class="preview-block text-preview">
        <h3>XHS Plan</h3>
        <p><strong>Keyword:</strong> ${escapeHtml(response.keyword || "")}</p>
        <p><strong>Hook:</strong> ${escapeHtml(response.hook || "")}</p>
        ${progressText}
      </section>
      ${renderStoryboard(storyboard)}
      ${renderPromptEditor(response)}
      ${renderImages(response.ossCharacterImages || [], "character reference", "Character Reference")}
      ${renderImages(response.ossImages || [], "xhs cover image", "Cover Image")}
      ${renderVideo(response.ossVideo, "Final Video")}
    </div>
  `;
}

function renderXhsCard(_run, response) {
  const plan = response.plan || {};
  const image = response.ossImage || response.ossImages?.[0];
  return `
    <div class="xhs-preview">
      <section class="preview-block text-preview">
        <h3>XHS Card Plan</h3>
        <p><strong>Title:</strong> ${escapeHtml(plan.title || "")}</p>
        <p><strong>Subtitle:</strong> ${escapeHtml(plan.subtitle || "")}</p>
        <p><strong>Badge:</strong> ${escapeHtml(plan.badge || "")}</p>
        <p><strong>Footer:</strong> ${escapeHtml(plan.footer || "")}</p>
        <div class="meta">Stage: ${escapeHtml(response.statusDetail || "")}</div>
      </section>
      ${image ? renderImages([image], "xhs card image", "Card Image") : ""}
    </div>
  `;
}

export function renderAnswer(run) {
  const response = run.response || {};
  if (response.workflow === "xhs_30s_video") return renderXhs(run, response);
  if (response.workflow === "xhs_card") return renderXhsCard(run, response);
  if (run.status === "pending" || run.status === "running") return "Task is still running.";
  if (run.status === "failed" && run.kind?.startsWith("xhs")) {
    return `${renderResumeAction(run)}<div class="error-text">${escapeHtml(run.errorMessage || "Task failed")}</div>`;
  }
  if (run.status === "failed") return escapeHtml(run.errorMessage || "Task failed");
  if (response.text) return `<div class="text-preview">${escapeHtml(response.text)}</div>`;
  if (response.ossImages?.length) return renderImages(response.ossImages);
  if (response.ossVideo?.url) return renderVideo(response.ossVideo);
  return "No preview content.";
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
  button.textContent = "Resuming...";
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
        button.textContent = "Resume";
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
