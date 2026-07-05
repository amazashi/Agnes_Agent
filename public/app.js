import { initTabs } from "./js/tabs.js";
import { bindSubmit } from "./js/taskSubmit.js";
import { startPolling } from "./js/polling.js";
import { refreshRuns } from "./js/runList.js";
import { initUploadZones } from "./js/uploadZones.js";

initTabs();
initUploadZones();
bindSubmit("chat", "chat-form");
bindSubmit("image", "image-form");
bindSubmit("video", "video-form");
startPolling();

document.getElementById("refresh").addEventListener("click", () => refreshRuns().catch((error) => {
  document.getElementById("answer").textContent = error.message;
}));

refreshRuns().catch(console.error);
