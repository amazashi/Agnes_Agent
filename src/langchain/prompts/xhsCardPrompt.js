export function buildXhsCardPlannerPrompt(input = {}) {
  const topic = String(input.topic || "").trim();
  const audience = String(input.audience || "小红书用户").trim();
  const style = String(input.style || "极简、留白、黑色大字、暖色按钮").trim();
  return `
你是一位小红书封面卡片设计师。
请为一张竖版小红书卡片规划文案和视觉样式。

主题：${topic || "面试必问"}
目标人群：${audience}
风格偏好：${style}

要求：
- 卡片尺寸适合小红书竖图，默认 1242x1660。
- 图片里面必须有文字，文字要短、清晰、适合封面。
- 主标题最多 8 个中文字符，适合拆成 1-3 行。
- 副标题最多 18 个中文字符。
- 按钮文案最多 12 个中文字符，可以带一个 emoji。
- 页脚文案最多 14 个中文字符。
- 版式参考：大面积留白、中心大标题、底部副标题、橙色圆角按钮、右下角小页脚。
- 不要输出 Markdown，不要解释。

只返回严格 JSON：
{
  "title": "主标题",
  "subtitle": "副标题",
  "badge": "按钮文案",
  "footer": "页脚文案",
  "theme": {
    "background": "#fffaf1",
    "paper": "#fffefe",
    "primaryText": "#26231f",
    "mutedText": "#34302b",
    "accent": "#f15b2a",
    "accentText": "#ffffff"
  },
  "layout": {
    "titleLines": ["第一行", "第二行"],
    "mood": "干净、直接、适合收藏"
  }
}
`.trim();
}

export function fallbackXhsCardPlan(input = {}) {
  const topic = String(input.topic || "面试必问").trim();
  return {
    title: topic.slice(0, 8) || "面试必问",
    subtitle: "为什么想加入我们公司？",
    badge: "🔥 满分回答模板来了",
    footer: "收藏备用 · 面试不慌",
    theme: {
      background: "#fff7e8",
      paper: "#fffefe",
      primaryText: "#28231f",
      mutedText: "#34302b",
      accent: "#f15b2a",
      accentText: "#ffffff",
    },
    layout: {
      titleLines: topic.length > 4 ? [topic.slice(0, 4), topic.slice(4, 8)] : [topic],
      mood: "clean and direct",
    },
  };
}
