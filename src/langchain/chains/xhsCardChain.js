import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createChatModel } from "../models/agnesChatModel.js";
import { buildXhsCardPlannerPrompt, fallbackXhsCardPlan } from "../prompts/xhsCardPrompt.js";
import { uploadBufferAsset } from "../../oss/bitifulClient.js";

function extractJson(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("card planner did not return JSON");
  return JSON.parse(candidate.slice(start, end + 1));
}

function clampText(value, fallback, maxLength) {
  const text = String(value || fallback || "").trim();
  return [...text].slice(0, maxLength).join("");
}

function splitTitle(title, titleLines) {
  const lines = Array.isArray(titleLines) ? titleLines.map((line) => String(line || "").trim()).filter(Boolean) : [];
  if (lines.length) return lines.slice(0, 3).map((line) => clampText(line, "", 6));
  const chars = [...title];
  if (chars.length <= 4) return [title];
  if (chars.length <= 8) return [chars.slice(0, 4).join(""), chars.slice(4).join("")];
  return [chars.slice(0, 4).join(""), chars.slice(4, 8).join(""), chars.slice(8, 12).join("")];
}

function normalizePlan(plan, input) {
  const fallback = fallbackXhsCardPlan(input);
  const merged = { ...fallback, ...(plan || {}) };
  const theme = { ...fallback.theme, ...(merged.theme || {}) };
  const title = clampText(input.title || merged.title, fallback.title, 12);
  return {
    ...merged,
    title,
    subtitle: clampText(input.subtitle || merged.subtitle, fallback.subtitle, 22),
    badge: clampText(input.badge || merged.badge, fallback.badge, 16),
    footer: clampText(input.footer || merged.footer, fallback.footer, 16),
    theme,
    layout: {
      ...fallback.layout,
      ...(merged.layout || {}),
      titleLines: splitTitle(title, input.titleLines || merged.layout?.titleLines),
    },
  };
}

function escapeXml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&apos;",
  }[char]));
}

function textElement({ text, x, y, size, weight = 800, fill, anchor = "middle", letterSpacing = 0 }) {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Arial, 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif" font-size="${size}" font-weight="${weight}" letter-spacing="${letterSpacing}" fill="${escapeXml(fill)}">${escapeXml(text)}</text>`;
}

function renderCardSvg(plan, input = {}) {
  const width = Number(input.width || 1242);
  const height = Number(input.height || 1660);
  const theme = plan.theme;
  const paperMargin = 56;
  const paperWidth = width - paperMargin * 2;
  const paperHeight = height - paperMargin * 2;
  const titleLines = plan.layout.titleLines;
  const titleSize = titleLines.length >= 3 ? 168 : 206;
  const titleStartY = titleLines.length >= 3 ? 530 : 620;
  const titleGap = titleLines.length >= 3 ? 178 : 210;
  const subtitleY = 1070;
  const badgeY = 1245;
  const footerY = 1548;
  const badgeWidth = Math.min(680, 310 + [...plan.badge].length * 34);
  const badgeX = (width - badgeWidth) / 2;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#e9d9bd" flood-opacity="0.42"/>
    </filter>
    <linearGradient id="badgeGradient" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="${escapeXml(theme.accent)}"/>
      <stop offset="1" stop-color="#e94720"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="${escapeXml(theme.background)}"/>
  <rect x="${paperMargin}" y="${paperMargin}" width="${paperWidth}" height="${paperHeight}" rx="0" fill="${escapeXml(theme.paper)}" filter="url(#softShadow)"/>
  ${titleLines.map((line, index) => textElement({
    text: line,
    x: width / 2,
    y: titleStartY + index * titleGap,
    size: titleSize,
    weight: 900,
    fill: theme.primaryText,
  })).join("\n  ")}
  ${textElement({ text: plan.subtitle, x: width / 2, y: subtitleY, size: 72, weight: 900, fill: theme.mutedText })}
  <rect x="${badgeX}" y="${badgeY - 62}" width="${badgeWidth}" height="108" rx="54" fill="url(#badgeGradient)"/>
  ${textElement({ text: plan.badge, x: width / 2, y: badgeY + 14, size: 50, weight: 900, fill: theme.accentText })}
  ${textElement({ text: plan.footer, x: width - 116, y: footerY, size: 40, weight: 900, fill: theme.mutedText, anchor: "end" })}
</svg>`;
}

export async function invokeXhsCardChain(input = {}, context = {}) {
  const onProgress = context.onProgress;
  const progress = {
    framework: "langchain-js",
    workflow: "xhs_card",
    statusDetail: "planning",
    request: input,
  };
  if (onProgress) await onProgress(progress);

  const model = createChatModel({ ...input, temperature: input.temperature ?? 0.35, maxTokens: input.maxTokens ?? 1200 });
  let plannerText = "";
  let plan = fallbackXhsCardPlan(input);

  try {
    const plannerMessage = await model.invoke([
      new SystemMessage("你是小红书卡片视觉设计和中文短文案专家。只返回 JSON。"),
      new HumanMessage(buildXhsCardPlannerPrompt(input)),
    ]);
    plannerText = typeof plannerMessage.content === "string" ? plannerMessage.content : JSON.stringify(plannerMessage.content);
    plan = normalizePlan(extractJson(plannerText), input);
  } catch (error) {
    plannerText = `fallback used: ${error.message || String(error)}`;
    plan = normalizePlan(plan, input);
  }

  Object.assign(progress, { statusDetail: "rendering", plannerText, plan });
  if (onProgress) await onProgress(progress);

  const svg = renderCardSvg(plan, input);
  const ossImage = await uploadBufferAsset(Buffer.from(svg, "utf8"), {
    kind: "xhs-card",
    filename: "xhs-card.svg",
    contentType: "image/svg+xml",
  });

  return {
    ...progress,
    statusDetail: "completed",
    svg,
    ossImage,
    ossImages: [ossImage],
  };
}
