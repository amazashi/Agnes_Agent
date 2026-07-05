import { RunnableLambda } from "@langchain/core/runnables";
import { createVideoWithAgnes, pollAgnesVideo } from "../../providers/agnes/videoClient.js";
import { uploadBufferAsset, uploadRemoteAsset } from "../../oss/bitifulClient.js";

function parseImageInput(input) {
  if (input.imageDataUrl) {
    const match = String(input.imageDataUrl).match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error("imageDataUrl must be a base64 data URL");
    return { contentType: match[1], bytes: Buffer.from(match[2], "base64"), filename: input.imageFilename || "video-input-image" };
  }
  return {
    contentType: input.imageContentType || "image/png",
    bytes: Buffer.from(String(input.imageBase64 || ""), "base64"),
    filename: input.imageFilename || "video-input-image",
  };
}

function collectArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
}

async function uploadDataImage(value, index) {
  const parsed = parseImageInput({ imageDataUrl: value, imageFilename: `video-input-${index}.png` });
  return uploadBufferAsset(parsed.bytes, { kind: "video-input", filename: parsed.filename, contentType: parsed.contentType });
}

export const videoGenerationRunnable = RunnableLambda.from(async (input) => {
  let inputImage = null;
  const inputImages = [];
  const request = { ...input };
  if (input.imageDataUrl || input.imageBase64) {
    const parsed = parseImageInput(input);
    inputImage = await uploadBufferAsset(parsed.bytes, { kind: "video-input", filename: parsed.filename, contentType: parsed.contentType });
    request.image = inputImage.url;
  }
  const dataImages = [
    ...collectArray(input.imageDataUrls),
    ...collectArray(input.keyframeDataUrls),
  ];
  for (const [index, dataUrl] of dataImages.entries()) {
    const uploaded = await uploadDataImage(dataUrl, index);
    inputImages.push(uploaded);
  }
  const uploadedUrls = inputImages.map((item) => item.url).filter(Boolean);
  if (uploadedUrls.length) {
    request.imageUrls = [...collectArray(request.imageUrls), ...uploadedUrls];
  }

  const createdVideo = await createVideoWithAgnes(request);
  const created = createdVideo.created;
  const result = await pollAgnesVideo({
    baseUrl: createdVideo.baseUrl,
    apiKey: createdVideo.apiKey,
    model: createdVideo.model,
    videoId: created.video_id || created.videoId,
    taskId: created.task_id || created.id,
  });
  const finalStatus = String(result.status || "").toLowerCase();
  const ok = ["completed", "succeeded", "success"].includes(finalStatus) || result.remixed_from_video_id;
  const videoUrl = result.remixed_from_video_id || result.url || result.video_url || null;
  const ossVideo = ok && videoUrl ? await uploadRemoteAsset(videoUrl, { kind: "video" }) : null;
  if (!ok) throw new Error(result.error ? JSON.stringify(result.error) : `video status: ${finalStatus || "unknown"}`);
  return {
    framework: "langchain-js",
    runnable: "RunnableLambda(videoGeneration)",
    model: createdVideo.model,
    prompt: createdVideo.prompt,
    inputImage,
    inputImages,
    created,
    result,
    videoUrl,
    ossVideo,
  };
});
