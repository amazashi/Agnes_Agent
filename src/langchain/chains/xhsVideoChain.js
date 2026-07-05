import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createChatModel } from "../models/agnesChatModel.js";
import { imageGenerationRunnable } from "./imageRunnable.js";
import { videoGenerationRunnable } from "./videoRunnable.js";
import { buildXhsPlannerPrompt, fallbackXhsPlan } from "../prompts/xhsVideoPrompt.js";

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

export async function invokeXhsVideoChain(input = {}) {
  const model = createChatModel({ ...input, temperature: input.temperature ?? 0.4, maxTokens: input.maxTokens ?? 1600 });
  const plannerPrompt = buildXhsPlannerPrompt(input);
  let plannerText = "";
  let plan = fallbackXhsPlan(input);

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

  const imageInput = {
    model: input.imageModel,
    prompt: hardenNoTextPrompt(plan.imagePrompt),
    size: input.imageSize || "768x1024",
    responseFormat: "url",
  };
  const imageResult = await imageGenerationRunnable.invoke(imageInput);
  const coverImage = imageResult.ossImages?.[0] || null;
  if (!coverImage?.url) throw new Error("image generation did not return an OSS image");

  const videoInput = {
    model: input.videoModel,
    prompt: hardenNoTextPrompt(plan.videoPrompt),
    image: coverImage.url,
    width: Number(input.width || 768),
    height: Number(input.height || 1152),
    numFrames: Number(input.numFrames || 441),
    frameRate: Number(input.frameRate || 15),
    numInferenceSteps: input.numInferenceSteps ? Number(input.numInferenceSteps) : undefined,
    seed: input.seed ? Number(input.seed) : undefined,
    negativePrompt: plan.negativePrompt,
  };
  const videoResult = await videoGenerationRunnable.invoke(videoInput);

  return {
    framework: "langchain-js",
    workflow: "xhs_30s_video",
    steps: ["hotword_or_keyword_planning", "storyboard", "character_design", "ai_image_generation", "image_to_video_generation"],
    keyword: plan.keyword,
    hook: plan.hook,
    plannerText,
    plan,
    imageInput,
    videoInput: { ...videoInput, image: coverImage.objectKey || coverImage.url },
    ossImages: imageResult.ossImages || [],
    imageResult,
    ossVideo: videoResult.ossVideo,
    videoResult,
  };
}
