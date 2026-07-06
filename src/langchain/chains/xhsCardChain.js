import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createChatModel } from "../models/agnesChatModel.js";
import { imageGenerationRunnable } from "./imageRunnable.js";
import { buildXhsCardPlannerPrompt, fallbackXhsCardPlan } from "../prompts/xhsCardPrompt.js";

function extractJson(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("card planner did not return JSON");
  return JSON.parse(candidate.slice(start, end + 1));
}

function chars(value) {
  return [...String(value || "").trim()];
}

function clampText(value, fallback, maxLength) {
  const text = String(value || fallback || "").trim();
  return chars(text).slice(0, maxLength).join("");
}

function normalizeTheme(theme = {}, fallbackTheme = {}) {
  return {
    background: theme.background || fallbackTheme.background || "#fffaf1",
    paper: theme.paper || fallbackTheme.paper || "#fffefe",
    primaryText: theme.primaryText || fallbackTheme.primaryText || "#26231f",
    mutedText: theme.mutedText || fallbackTheme.mutedText || "#34302b",
    accent: theme.accent || fallbackTheme.accent || "#f15b2a",
    accentText: theme.accentText || fallbackTheme.accentText || "#ffffff",
  };
}

function normalizeCard(card = {}, index, input, theme) {
  const type = ["cover", "content", "ending"].includes(card.type) ? card.type : (index === 0 ? "cover" : "content");
  const title = clampText(input.title && index === 0 ? input.title : card.title, card.section || input.topic || "小红书卡片", type === "cover" ? 14 : 18);
  return {
    index,
    type,
    title,
    subtitle: clampText(index === 0 && input.subtitle ? input.subtitle : card.subtitle, "", 34),
    badge: clampText(index === 0 && input.badge ? input.badge : card.badge, type === "ending" ? "收藏备用" : "🔥 收藏备用", 18),
    footer: clampText(index === 0 && input.footer ? input.footer : card.footer, "收藏备用", 18),
    section: clampText(card.section, title, 12),
    headline: clampText(card.headline, card.subtitle || "", 24),
    bullets: (Array.isArray(card.bullets) ? card.bullets : []).map((item) => clampText(item, "", 28)).filter(Boolean).slice(0, 4),
    theme: normalizeTheme(card.theme, theme),
  };
}

function normalizePlan(plan, input) {
  const fallback = fallbackXhsCardPlan(input);
  const source = plan && typeof plan === "object" ? plan : fallback;
  const theme = normalizeTheme(source.theme, fallback.theme);
  const maxCards = Math.max(3, Math.min(12, Number(input.maxCards || 8)));
  let cards = Array.isArray(source.cards) && source.cards.length ? source.cards : fallback.cards;
  cards = cards.slice(0, maxCards).map((card, index) => normalizeCard(card, index, input, theme));
  if (!cards.some((card) => card.type === "cover")) cards.unshift(normalizeCard(fallback.cards[0], 0, input, theme));
  if (!cards.some((card) => card.type === "ending")) cards.push(normalizeCard(fallback.cards.at(-1), cards.length, input, theme));
  cards = cards.slice(0, maxCards).map((card, index) => ({ ...card, index }));
  return {
    topic: clampText(source.topic, input.topic || fallback.topic, 24),
    summary: clampText(source.summary, fallback.summary, 80),
    theme,
    cards,
  };
}

function quotedLines(lines) {
  return lines.filter(Boolean).map((line) => `"${line}"`).join(", ");
}

function cardTextSpec(card) {
  if (card.type === "content") {
    return [
      `Section title: "${card.section}"`,
      card.headline ? `Headline: "${card.headline}"` : "",
      card.bullets.length ? `Bullet list: ${quotedLines(card.bullets)}` : "",
      card.footer ? `Footer: "${card.footer}"` : "",
    ].filter(Boolean).join("\n");
  }
  if (card.type === "ending") {
    return [
      `Large ending title: "${card.title}"`,
      card.subtitle ? `Subtitle: "${card.subtitle}"` : "",
      card.badge ? `Button text: "${card.badge}"` : "",
      card.footer ? `Footer: "${card.footer}"` : "",
    ].filter(Boolean).join("\n");
  }
  return [
    `Large cover title: "${card.title}"`,
    card.subtitle ? `Subtitle: "${card.subtitle}"` : "",
    card.badge ? `Button text: "${card.badge}"` : "",
    card.footer ? `Footer: "${card.footer}"` : "",
  ].filter(Boolean).join("\n");
}

function imagePromptForCard(card, plan, input) {
  const theme = card.theme || plan.theme;
  return `
Create a vertical Xiaohongshu card image with accurate Chinese typography.

Card ${card.index + 1} of ${plan.cards.length}.
Card type: ${card.type}.
Topic: ${plan.topic}.

Required visible text, copy exactly:
${cardTextSpec(card)}

Visual style:
- ${input.style || "minimal white space, bold black Chinese text, orange rounded button, clean knowledge-card layout"}
- Background color ${theme.background}, inner paper color ${theme.paper}.
- Primary text color ${theme.primaryText}, muted text color ${theme.mutedText}, accent button color ${theme.accent}.
- Vertical poster layout, 1242x1660 ratio, clean margins, strong hierarchy.
- Use large readable Chinese fonts.
- Do not add any extra words, random letters, English text, watermarks, logos, QR codes, signatures, or UI chrome.
- Preserve all Chinese characters exactly as provided.
`.trim();
}

export async function invokeXhsCardChain(input = {}, context = {}) {
  const onProgress = context.onProgress;
  const progress = {
    framework: "langchain-js",
    workflow: "xhs_card",
    renderMode: "image_model",
    statusDetail: "planning",
    request: input,
  };
  if (onProgress) await onProgress(progress);

  const model = createChatModel({ ...input, temperature: input.temperature ?? 0.35, maxTokens: input.maxTokens ?? 2600 });
  let plannerText = "";
  let plan = fallbackXhsCardPlan(input);

  try {
    const plannerMessage = await model.invoke([
      new SystemMessage("你是小红书图文卡片组策划师。只返回 JSON。"),
      new HumanMessage(buildXhsCardPlannerPrompt(input)),
    ]);
    plannerText = typeof plannerMessage.content === "string" ? plannerMessage.content : JSON.stringify(plannerMessage.content);
    plan = normalizePlan(extractJson(plannerText), input);
  } catch (error) {
    plannerText = `fallback used: ${error.message || String(error)}`;
    plan = normalizePlan(plan, input);
  }

  Object.assign(progress, { statusDetail: "planned", plannerText, plan });
  if (onProgress) await onProgress(progress);

  const imageInputs = [];
  const imageResults = [];
  const ossImages = [];
  for (const card of plan.cards) {
    const imageInput = {
      provider: "agnes",
      model: input.imageModel,
      prompt: imagePromptForCard(card, plan, input),
      size: input.imageSize || input.size || "768x1024",
      responseFormat: input.responseFormat || "url",
    };
    imageInputs.push({ cardIndex: card.index, cardType: card.type, ...imageInput });
    Object.assign(progress, { statusDetail: `image_${card.index + 1}_of_${plan.cards.length}_generating`, imageInputs, imageResults, ossImages });
    if (onProgress) await onProgress(progress);

    const imageResult = await imageGenerationRunnable.invoke(imageInput);
    imageResults.push({ cardIndex: card.index, cardType: card.type, card, imageResult });
    ossImages.push(...(imageResult.ossImages || []).map((image) => ({
      ...image,
      cardIndex: card.index,
      cardType: card.type,
    })));
    Object.assign(progress, { statusDetail: `image_${card.index + 1}_of_${plan.cards.length}_generated`, imageInputs, imageResults, ossImages });
    if (onProgress) await onProgress(progress);
  }

  return {
    ...progress,
    statusDetail: "completed",
    plan,
    imageInputs,
    imageResults,
    ossImage: ossImages[0] || null,
    ossImages,
  };
}
