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

function chars(value) {
  return [...String(value || "").trim()];
}

function clampText(value, fallback, maxLength) {
  const text = String(value || fallback || "").trim();
  return chars(text).slice(0, maxLength).join("");
}

function splitTitle(title, titleLines) {
  const lines = Array.isArray(titleLines) ? titleLines.map((line) => clampText(line, "", 12)).filter(Boolean) : [];
  if (lines.length) return lines.slice(0, 3);
  const list = chars(title);
  if (list.length <= 4) return [title];
  if (list.length <= 8) return [list.slice(0, 4).join(""), list.slice(4).join("")];
  return [list.slice(0, 4).join(""), list.slice(4, 8).join(""), list.slice(8, 12).join("")];
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
    titleLines: splitTitle(title, card.titleLines),
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

function escapeXml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&apos;",
  }[char]));
}

function wrapText(text, maxChars, maxLines = 4) {
  const list = chars(text);
  const lines = [];
  for (let index = 0; index < list.length && lines.length < maxLines; index += maxChars) {
    lines.push(list.slice(index, index + maxChars).join(""));
  }
  return lines;
}

function textBlock({ lines, x, y, size, lineHeight, weight = 800, fill, anchor = "middle" }) {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Arial, 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif" font-size="${size}" font-weight="${weight}" fill="${escapeXml(fill)}">${lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`).join("")}</text>`;
}

function roundedCard({ x, y, width, height, radius = 34, fill = "rgba(255,255,255,0.64)", stroke = "" }) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="3"` : ""}/>`;
}

function renderBadge(card, width, y) {
  const badgeWidth = Math.min(760, 280 + chars(card.badge).length * 34);
  const badgeX = (width - badgeWidth) / 2;
  return `
  <rect x="${badgeX}" y="${y - 62}" width="${badgeWidth}" height="108" rx="54" fill="url(#badgeGradient)"/>
  ${textBlock({ lines: [card.badge], x: width / 2, y: y + 14, size: 50, weight: 900, fill: card.theme.accentText })}`;
}

function renderBase({ width, height, theme }) {
  const paperMargin = 56;
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
  <rect x="${paperMargin}" y="${paperMargin}" width="${width - paperMargin * 2}" height="${height - paperMargin * 2}" rx="0" fill="${escapeXml(theme.paper)}" filter="url(#softShadow)"/>`;
}

function renderCover(card, width, height) {
  const longestTitleLine = Math.max(...card.titleLines.map((line) => chars(line).length), 1);
  const titleSize = card.titleLines.length >= 3 ? 150 : (longestTitleLine > 9 ? 166 : 206);
  const titleStartY = card.titleLines.length >= 3 ? 500 : 600;
  const titleGap = card.titleLines.length >= 3 ? 166 : (longestTitleLine > 9 ? 178 : 210);
  return `${renderBase({ width, height, theme: card.theme })}
  ${textBlock({ lines: card.titleLines, x: width / 2, y: titleStartY, size: titleSize, lineHeight: titleGap, weight: 900, fill: card.theme.primaryText })}
  ${textBlock({ lines: wrapText(card.subtitle, 14, 2), x: width / 2, y: 1080, size: 72, lineHeight: 86, weight: 900, fill: card.theme.mutedText })}
  ${renderBadge(card, width, 1260)}
  ${textBlock({ lines: [card.footer], x: width - 116, y: height - 112, size: 40, lineHeight: 46, weight: 900, fill: card.theme.mutedText, anchor: "end" })}
</svg>`;
}

function renderContent(card, width, height) {
  const bullets = card.bullets.length ? card.bullets : wrapText(card.headline || card.title, 18, 3);
  return `${renderBase({ width, height, theme: card.theme })}
  <rect x="106" y="132" width="18" height="86" rx="9" fill="${escapeXml(card.theme.accent)}"/>
  ${textBlock({ lines: [card.section], x: 150, y: 198, size: 72, lineHeight: 82, weight: 900, fill: card.theme.primaryText, anchor: "start" })}
  ${textBlock({ lines: wrapText(card.headline, 15, 2), x: 150, y: 330, size: 54, lineHeight: 68, weight: 900, fill: card.theme.mutedText, anchor: "start" })}
  ${bullets.map((bullet, index) => {
    const y = 520 + index * 220;
    return `
  ${roundedCard({ x: 126, y: y - 82, width: width - 252, height: 158, fill: "#fff8ef", stroke: "#f4dfc2" })}
  <circle cx="178" cy="${y - 4}" r="18" fill="${escapeXml(card.theme.accent)}"/>
  ${textBlock({ lines: wrapText(bullet, 20, 2), x: 224, y: y - 16, size: 46, lineHeight: 58, weight: 900, fill: card.theme.primaryText, anchor: "start" })}`;
  }).join("")}
  ${textBlock({ lines: [card.footer], x: width - 116, y: height - 112, size: 38, lineHeight: 44, weight: 900, fill: card.theme.mutedText, anchor: "end" })}
</svg>`;
}

function renderEnding(card, width, height) {
  return `${renderBase({ width, height, theme: card.theme })}
  ${textBlock({ lines: splitTitle(card.title, card.titleLines), x: width / 2, y: 560, size: 174, lineHeight: 188, weight: 900, fill: card.theme.primaryText })}
  ${textBlock({ lines: wrapText(card.subtitle, 13, 3), x: width / 2, y: 980, size: 62, lineHeight: 76, weight: 900, fill: card.theme.mutedText })}
  ${renderBadge(card, width, 1235)}
  ${textBlock({ lines: [card.footer], x: width / 2, y: height - 118, size: 42, lineHeight: 48, weight: 900, fill: card.theme.mutedText })}
</svg>`;
}

function renderCardSvg(card, input = {}) {
  const width = Number(input.width || 1242);
  const height = Number(input.height || 1660);
  if (card.type === "content") return renderContent(card, width, height);
  if (card.type === "ending") return renderEnding(card, width, height);
  return renderCover(card, width, height);
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

  Object.assign(progress, { statusDetail: "rendering", plannerText, plan });
  if (onProgress) await onProgress(progress);

  const renderedCards = [];
  const ossImages = [];
  for (const card of plan.cards) {
    const svg = renderCardSvg(card, input);
    const ossImage = await uploadBufferAsset(Buffer.from(svg, "utf8"), {
      kind: "xhs-card",
      filename: `xhs-card-${String(card.index + 1).padStart(2, "0")}.svg`,
      contentType: "image/svg+xml",
    });
    renderedCards.push({ ...card, svg, ossImage });
    ossImages.push(ossImage);
    Object.assign(progress, { statusDetail: `rendered_${card.index + 1}_of_${plan.cards.length}`, renderedCards, ossImages });
    if (onProgress) await onProgress(progress);
  }

  return {
    ...progress,
    statusDetail: "completed",
    plan,
    renderedCards,
    ossImage: ossImages[0] || null,
    ossImages,
  };
}
