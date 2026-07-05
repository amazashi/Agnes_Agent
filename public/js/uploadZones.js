import { api } from "./apiClient.js";

const uploaded = new Map();

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function setFields(target, urls) {
  const listValue = urls.length ? JSON.stringify(urls) : "";
  document.querySelectorAll(`[data-upload-field="${target}"]`).forEach((field) => {
    field.value = listValue;
  });
  document.querySelectorAll(`[data-upload-field="${target}-single"]`).forEach((field) => {
    field.value = urls[0] || "";
  });
  document.querySelectorAll(`[data-upload-field="${target}-keyframes"]`).forEach((field) => {
    field.value = listValue;
  });
}

function renderList(zone, assets) {
  const list = zone.querySelector(".upload-list");
  list.innerHTML = assets.map((asset) => `
    <a href="${asset.url}" target="_blank" rel="noreferrer">${asset.objectKey || asset.url}</a>
  `).join("");
}

async function uploadFiles(zone, files) {
  const target = zone.dataset.uploadTarget;
  const assets = uploaded.get(target) || [];
  zone.classList.add("uploading");
  zone.querySelector("span").textContent = "正在上传到 OSS...";
  try {
    for (const file of files) {
      const dataUrl = await fileToDataUrl(file);
      const response = await api("/api/assets/upload", {
        method: "POST",
        body: JSON.stringify({ dataUrl, filename: file.name, kind: target }),
      });
      assets.push(response.asset);
    }
    uploaded.set(target, assets);
    setFields(target, assets.map((asset) => asset.url));
    renderList(zone, assets);
    zone.querySelector("span").textContent = `已上传 ${assets.length} 个文件`;
  } finally {
    zone.classList.remove("uploading");
  }
}

export function initUploadZones() {
  document.querySelectorAll(".upload-zone").forEach((zone) => {
    const input = zone.querySelector(".file-input");
    zone.addEventListener("click", () => input.click());
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("change", () => {
      uploadFiles(zone, [...input.files]).catch((error) => {
        zone.querySelector("span").textContent = error.message;
      });
      input.value = "";
    });
    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      zone.classList.add("dragging");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("dragging"));
    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      zone.classList.remove("dragging");
      uploadFiles(zone, [...event.dataTransfer.files].filter((file) => file.type.startsWith("image/"))).catch((error) => {
        zone.querySelector("span").textContent = error.message;
      });
    });
  });
}
