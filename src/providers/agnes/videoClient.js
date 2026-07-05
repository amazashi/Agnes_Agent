import { agnesEndpoint } from "./endpoint.js";
import { buildVideoPrompt } from "./videoPrompt.js";
import { getAgnesConfig, requireAgnesApiKey } from "./agnesConfig.js";
import { readUpstreamError } from "../../utils/upstreamError.js";

function numberOrDefault(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validateVideoRequest(body) {
  if (!body.prompt) throw new Error("prompt is required");
  if (!Number.isInteger(body.width) || body.width <= 0) throw new Error("width must be a positive integer");
  if (!Number.isInteger(body.height) || body.height <= 0) throw new Error("height must be a positive integer");
  if (!Number.isInteger(body.num_frames) || body.num_frames < 1 || body.num_frames > 441) {
    throw new Error("num_frames must be an integer between 1 and 441");
  }
  if ((body.num_frames - 1) % 8 !== 0) {
    throw new Error("num_frames must satisfy 8n + 1, for example 121");
  }
  if (!Number.isInteger(body.frame_rate) || body.frame_rate < 1 || body.frame_rate > 30) {
    throw new Error("frame_rate must be an integer between 1 and 30");
  }
  if (body.num_inference_steps !== undefined && (!Number.isInteger(body.num_inference_steps) || body.num_inference_steps <= 0)) {
    throw new Error("num_inference_steps must be a positive integer");
  }
  if (body.seed !== undefined && !Number.isInteger(body.seed)) {
    throw new Error("seed must be an integer");
  }
}

export async function createVideoWithAgnes(input) {
  const config = getAgnesConfig(input);
  const apiKey = requireAgnesApiKey(config);

  const extraBody = {
    ...(input.extraBody || {}),
    ...(input.extra_body || {}),
  };
  const extraImages = [
    ...(Array.isArray(input.images) ? input.images : []),
    ...(Array.isArray(input.imageUrls) ? input.imageUrls : []),
    ...(Array.isArray(input.keyframes) ? input.keyframes : []),
  ].filter(Boolean);
  if (extraImages.length) extraBody.image = extraImages;
  if (input.extraMode || input.extra_body_mode) extraBody.mode = input.extraMode || input.extra_body_mode;
  if (input.mode === "keyframes" && !extraBody.mode) extraBody.mode = "keyframes";

  const body = {
    model: config.videoModel,
    prompt: buildVideoPrompt(input),
    width: numberOrDefault(input.width, 768),
    height: numberOrDefault(input.height, 1152),
    num_frames: numberOrDefault(input.numFrames || input.num_frames, 121),
    frame_rate: numberOrDefault(input.frameRate || input.frame_rate, 24),
    ...(input.image ? { image: input.image } : {}),
    ...(input.mode ? { mode: input.mode } : {}),
    ...(optionalNumber(input.numInferenceSteps ?? input.num_inference_steps) !== null ? { num_inference_steps: optionalNumber(input.numInferenceSteps ?? input.num_inference_steps) } : {}),
    ...(optionalNumber(input.seed) !== null ? { seed: optionalNumber(input.seed) } : {}),
    ...(input.negativePrompt || input.negative_prompt ? { negative_prompt: input.negativePrompt || input.negative_prompt } : {}),
    ...(Object.keys(extraBody).length ? { extra_body: extraBody } : {}),
  };
  validateVideoRequest(body);

  const response = await fetch(agnesEndpoint(config.baseUrl, "/v1/videos"), {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await readUpstreamError(response));
  return { apiKey, baseUrl: config.baseUrl, model: config.videoModel, prompt: body.prompt, created: await response.json() };
}

export async function pollAgnesVideo({ baseUrl, apiKey, videoId, taskId, model }) {
  let last = {};
  for (let attempt = 0; attempt < 90; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 3000 : 10000));
    const url = videoId
      ? `${String(baseUrl).replace(/\/+$/, "")}/agnesapi?video_id=${encodeURIComponent(videoId)}&model_name=${encodeURIComponent(model)}`
      : agnesEndpoint(baseUrl, `/v1/videos/${encodeURIComponent(taskId || "")}`);
    const response = await fetch(url, { headers: { authorization: `Bearer ${apiKey}` } });
    if (!response.ok) {
      last = { status: "failed", error: await readUpstreamError(response) };
      continue;
    }
    last = await response.json();
    const status = String(last.status || "").toLowerCase();
    if (["completed", "succeeded", "success", "failed", "error"].includes(status) || last.remixed_from_video_id) return last;
  }
  return { ...last, status: last.status || "timeout" };
}
