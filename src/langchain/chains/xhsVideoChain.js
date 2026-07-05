import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createChatModel } from "../models/agnesChatModel.js";
import { imageGenerationRunnable } from "./imageRunnable.js";
import { createVideoWithAgnes, pollAgnesVideo } from "../../providers/agnes/videoClient.js";
import { getAgnesConfig, requireAgnesApiKey } from "../../providers/agnes/agnesConfig.js";
import { buildXhsPlannerPrompt, fallbackXhsPlan } from "../prompts/xhsVideoPrompt.js";
import { concatVideosToOss, uploadLastFrameFromVideo } from "../../media/videoTools.js";
import { uploadRemoteAsset } from "../../oss/bitifulClient.js";

function extractJson(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("planner did not return JSON");
  return JSON.parse(candidate.slice(start, end + 1));
}

function normalizePlan(plan, input) {
  const fallback = fallbackXhsPlan(input);
  return {
    ...fallback,
    ...plan,
    keyword: String(plan.keyword || fallback.keyword).trim(),
    storyboard: Array.isArray(plan.storyboard) && plan.storyboard.length ? plan.storyboard.slice(0, 5) : fallback.storyboard,
    character: { ...fallback.character, ...(plan.character || {}) },
    imagePrompt: String(plan.imagePrompt || fallback.imagePrompt).trim(),
    videoPrompt: String(plan.videoPrompt || fallback.videoPrompt).trim(),
    negativePrompt: String(plan.negativePrompt || fallback.negativePrompt).trim(),
  };
}

function hardenNoTextPrompt(prompt) {
  return [
    prompt,
    "No visible text, no letters, no words, no captions, no subtitles, no handwriting, no logo, no watermark, no signs, no posters, no labels, no readable UI.",
    "Use simple shapes and clean visual storytelling suitable for weaker image and video models.",
  ].join(", ");
}

function segmentPrompt(plan, shot, index) {
  return hardenNoTextPrompt([
    plan.videoPrompt,
    `Segment ${index + 1}: ${shot.scene || ""}`,
    shot.camera ? `Camera: ${shot.camera}` : "",
    shot.emotion ? `Emotion: ${shot.emotion}` : "",
    "Keep the same character identity and visual style from the input image.",
    "Smooth natural motion, stable subject, cinematic short-video rhythm.",
  ].filter(Boolean).join(", "));
}

async function withRetry(label, task, retries = 2) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      const message = error.message || String(error);
      const retryable = /503|busy|timeout|temporar|rate/i.test(message);
      if (!retryable || attempt === retries) break;
      await new Promise((resolve) => setTimeout(resolve, 5000 * (attempt + 1)));
    }
  }
  throw new Error(`${label} failed after retry: ${lastError?.message || String(lastError)}`);
}

function videoUrlFromResult(result) {
  return result?.remixed_from_video_id || result?.url || result?.video_url || null;
}

function videoSucceeded(result) {
  const status = String(result?.status || "").toLowerCase();
  return ["completed", "succeeded", "success"].includes(status) || Boolean(result?.remixed_from_video_id || result?.url || result?.video_url);
}

async function runVideoSegment({ index, shot, videoInput, existingSegment, onProgress, progress, videoSegments, transitionFrames }) {
  const segment = existingSegment || {
    index,
    shot,
    input: { ...videoInput, image: videoInput.imageObjectKey || videoInput.image },
    status: "creating",
  };

  if (!existingSegment) {
    videoSegments.push(segment);
  }

  if (!segment.created?.created) {
    await saveProgress(progress, onProgress, {
      statusDetail: `video_segment_${index + 1}_creating`,
      videoSegments,
      transitionFrames,
    });
    const createdVideo = await withRetry(`xhs video segment ${index + 1} create`, () => createVideoWithAgnes(videoInput));
    segment.created = {
      baseUrl: createdVideo.baseUrl,
      model: createdVideo.model,
      prompt: createdVideo.prompt,
      created: createdVideo.created,
    };
    segment.status = "created";
    await saveProgress(progress, onProgress, {
      statusDetail: `video_segment_${index + 1}_created`,
      videoSegments,
      transitionFrames,
    });
  }

  if (!segment.result || !videoSucceeded(segment.result)) {
    await saveProgress(progress, onProgress, {
      statusDetail: `video_segment_${index + 1}_polling`,
      videoSegments,
      transitionFrames,
    });
    const created = segment.created.created;
    const config = getAgnesConfig(videoInput);
    segment.result = await pollAgnesVideo({
      baseUrl: segment.created.baseUrl,
      apiKey: requireAgnesApiKey(config),
      model: segment.created.model,
      videoId: created.video_id || created.videoId,
      taskId: created.task_id || created.id,
    });
    segment.status = videoSucceeded(segment.result) ? "completed" : "failed";
    await saveProgress(progress, onProgress, {
      statusDetail: `video_segment_${index + 1}_${segment.status}`,
      videoSegments,
      transitionFrames,
    });
  }

  if (!videoSucceeded(segment.result)) {
    throw new Error(segment.result?.error ? JSON.stringify(segment.result.error) : `video segment ${index + 1} status: ${segment.result?.status || "unknown"}`);
  }

  if (!segment.ossVideo?.url) {
    const sourceUrl = videoUrlFromResult(segment.result);
    if (!sourceUrl) throw new Error(`video segment ${index + 1} did not return a video URL`);
    await saveProgress(progress, onProgress, {
      statusDetail: `video_segment_${index + 1}_uploading`,
      videoSegments,
      transitionFrames,
    });
    segment.videoUrl = sourceUrl;
    segment.ossVideo = await uploadRemoteAsset(sourceUrl, { kind: "video" });
    segment.status = "uploaded";
    await saveProgress(progress, onProgress, {
      statusDetail: `video_segment_${index + 1}_uploaded`,
      videoSegments,
      transitionFrames,
    });
  }

  return segment;
}

function baseProgress(input, checkpoint = {}) {
  return {
    framework: "langchain-js",
    workflow: "xhs_30s_video",
    steps: ["hotword_or_keyword_planning", "storyboard", "character_design", "ai_image_generation", "chained_image_to_video_segments", "concat_final_video"],
    statusDetail: checkpoint.statusDetail || "starting",
    keyword: checkpoint.keyword || String(input.keyword || "").trim(),
    hook: checkpoint.hook || "",
    plannerText: checkpoint.plannerText || "",
    plan: checkpoint.plan || null,
    imageInput: checkpoint.imageInput || null,
    segmentConfig: checkpoint.segmentConfig || null,
    ossImages: checkpoint.ossImages || [],
    transitionFrames: checkpoint.transitionFrames || [],
    imageResult: checkpoint.imageResult || null,
    videoSegments: checkpoint.videoSegments || [],
    ossVideo: checkpoint.ossVideo || null,
  };
}

async function saveProgress(progress, onProgress, patch = {}) {
  Object.assign(progress, patch);
  if (onProgress) await onProgress(progress);
}

export async function invokeXhsVideoChain(input = {}, context = {}) {
  const onProgress = context.onProgress;
  const progress = baseProgress(input, context.checkpoint || {});
  const model = createChatModel({ ...input, temperature: input.temperature ?? 0.4, maxTokens: input.maxTokens ?? 1600 });
  const plannerPrompt = buildXhsPlannerPrompt(input);
  let plannerText = progress.plannerText || "";
  let plan = progress.plan || fallbackXhsPlan(input);

  if (!progress.plan) {
    await saveProgress(progress, onProgress, { statusDetail: "planning" });
    try {
      const plannerMessage = await model.invoke([
        new SystemMessage("You are a practical Xiaohongshu video planning assistant. Return valid JSON only."),
        new HumanMessage(plannerPrompt),
      ]);
      plannerText = typeof plannerMessage.content === "string" ? plannerMessage.content : JSON.stringify(plannerMessage.content);
      plan = normalizePlan(extractJson(plannerText), input);
    } catch (error) {
      plannerText = `fallback used: ${error.message || String(error)}`;
      plan = normalizePlan(plan, input);
    }
    await saveProgress(progress, onProgress, {
      statusDetail: "planned",
      keyword: plan.keyword,
      hook: plan.hook,
      plannerText,
      plan,
    });
  }

  const imageInput = progress.imageInput || {
    model: input.imageModel,
    prompt: hardenNoTextPrompt(plan.imagePrompt),
    size: input.imageSize || "768x1024",
    responseFormat: "url",
  };
  let imageResult = progress.imageResult;
  if (!imageResult?.ossImages?.[0]?.url) {
    await saveProgress(progress, onProgress, { statusDetail: "image_generating", imageInput });
    imageResult = await withRetry("xhs cover image", () => imageGenerationRunnable.invoke(imageInput));
    await saveProgress(progress, onProgress, {
      statusDetail: "image_generated",
      imageInput,
      imageResult,
      ossImages: imageResult.ossImages || [],
    });
  }
  const coverImage = imageResult.ossImages?.[0] || null;
  if (!coverImage?.url) throw new Error("image generation did not return an OSS image");

  const segmentCount = Math.max(1, Math.min(5, Number(input.segmentCount || 5)));
  const segmentFrames = Number(input.segmentFrames || input.numFrames || 121);
  const frameRate = Number(input.frameRate || 20);
  const storyboard = plan.storyboard.slice(0, segmentCount);
  while (storyboard.length < segmentCount) storyboard.push(plan.storyboard[storyboard.length % plan.storyboard.length]);

  const videoSegments = [];
  videoSegments.push(...(progress.videoSegments || []));
  const transitionFrames = [...(progress.transitionFrames || [])];
  let currentImage = videoSegments.length
    ? (transitionFrames[transitionFrames.length - 1]?.frame || coverImage)
    : coverImage;

  await saveProgress(progress, onProgress, {
    statusDetail: "video_segments_starting",
    segmentConfig: {
      segmentCount,
      segmentFrames,
      frameRate,
      estimatedSeconds: Number(((segmentFrames / frameRate) * segmentCount).toFixed(2)),
      chaining: "each segment uses the previous segment's last frame as the next segment's first image",
    },
    videoSegments,
    transitionFrames,
  });

  for (const [index, shot] of storyboard.entries()) {
    const existingSegment = videoSegments.find((segment) => Number(segment.index) === index);
    if (existingSegment) {
      if (!existingSegment.ossVideo?.url) {
        const videoInput = {
          ...(existingSegment.input || {}),
          image: currentImage.url,
        };
        await runVideoSegment({
          index,
          shot,
          videoInput,
          existingSegment,
          onProgress,
          progress,
          videoSegments,
          transitionFrames,
        });
      }
      if (index < storyboard.length - 1) {
        let existingFrame = transitionFrames.find((item) => Number(item.index) === index)?.frame;
        if (!existingFrame?.url) {
          await saveProgress(progress, onProgress, { statusDetail: `transition_frame_${index + 1}_extracting` });
          existingFrame = await uploadLastFrameFromVideo(existingSegment.ossVideo?.url || existingSegment.result?.videoUrl, { kind: "xhs-transition-frame" });
          transitionFrames.push({ index, frame: existingFrame });
          await saveProgress(progress, onProgress, {
            statusDetail: `transition_frame_${index + 1}_ready`,
            transitionFrames,
          });
        }
        currentImage = existingFrame;
      }
      continue;
    }
    const videoInput = {
      model: input.videoModel,
      prompt: segmentPrompt(plan, shot, index),
      image: currentImage.url,
      imageObjectKey: currentImage.objectKey,
      width: Number(input.width || 768),
      height: Number(input.height || 1152),
      numFrames: segmentFrames,
      frameRate,
      numInferenceSteps: input.numInferenceSteps ? Number(input.numInferenceSteps) : undefined,
      seed: input.seed ? Number(input.seed) + index : undefined,
      negativePrompt: plan.negativePrompt,
    };
    const segment = await runVideoSegment({
      index,
      shot,
      videoInput,
      existingSegment: null,
      onProgress,
      progress,
      videoSegments,
      transitionFrames,
    });
    if (index < storyboard.length - 1) {
      await saveProgress(progress, onProgress, { statusDetail: `transition_frame_${index + 1}_extracting` });
      const nextFrame = await uploadLastFrameFromVideo(segment.ossVideo?.url || segment.videoUrl, { kind: "xhs-transition-frame" });
      transitionFrames.push({ index, frame: nextFrame });
      currentImage = nextFrame;
      await saveProgress(progress, onProgress, {
        statusDetail: `transition_frame_${index + 1}_ready`,
        transitionFrames,
      });
    }
  }

  let finalVideo = progress.ossVideo;
  if (!finalVideo?.url) {
    await saveProgress(progress, onProgress, { statusDetail: "final_video_concatenating" });
    finalVideo = await concatVideosToOss(videoSegments.map((segment) => segment.ossVideo?.url || segment.result.videoUrl), { kind: "xhs-final-video" });
  }

  return {
    ...progress,
    statusDetail: "completed",
    keyword: plan.keyword,
    hook: plan.hook,
    plannerText,
    plan,
    imageInput,
    segmentConfig: {
      segmentCount,
      segmentFrames,
      frameRate,
      estimatedSeconds: Number(((segmentFrames / frameRate) * segmentCount).toFixed(2)),
      chaining: "each segment uses the previous segment's last frame as the next segment's first image",
    },
    ossImages: imageResult.ossImages || [],
    transitionFrames,
    imageResult,
    videoSegments,
    ossVideo: finalVideo,
  };
}
