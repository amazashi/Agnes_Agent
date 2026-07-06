export function buildXhsCardPlannerPrompt(input = {}) {
  const topic = String(input.topic || "").trim();
  const audience = String(input.audience || "小红书用户").trim();
  const style = String(input.style || "极简、留白、黑色大字、暖色按钮").trim();
  const maxCards = Math.max(3, Math.min(12, Number(input.maxCards || 8)));
  const sourceText = String(input.sourceText || input.longText || "").trim();
  return `
你是一位小红书图文卡片组策划师和视觉设计师。
请把用户给的一大段资料，规划成一组竖版小红书卡片。

主题：${topic || "由资料自动提炼"}
目标人群：${audience}
风格偏好：${style}
最多卡片数：${maxCards}

原始资料：
${sourceText || "(用户没有提供长资料，请围绕主题生成一组卡片)"}

规划要求：
- 你要自己判断生成几张图，数量 3-${maxCards} 张。
- 必须包含 1 张封面图 cover。
- 必须包含若干张内容图 content，用来承载回答思路、错误回答、正确回答、模板等核心内容。
- 必须包含 1 张结尾图 ending，用来总结、引导收藏或行动。
- 图片里面必须有文字，文字要短、清晰、适合小红书。
- 每张内容图不要塞太满，最多 4 条 bullets，每条不超过 24 个中文字符。
- 如果原始资料很长，要提炼，不要逐字照搬。
- 封面图要像爆款封面：大标题、强钩子、收藏按钮。
- 内容图要像知识卡：小标题 + 关键 bullet。
- 结尾图要像收束页：一句总结 + 行动提示。
- 不要输出 Markdown，不要解释。

只返回严格 JSON：
{
  "topic": "提炼后的主题",
  "summary": "这组卡片的内容定位",
  "theme": {
    "background": "#fffaf1",
    "paper": "#fffefe",
    "primaryText": "#26231f",
    "mutedText": "#34302b",
    "accent": "#f15b2a",
    "accentText": "#ffffff"
  },
  "cards": [
    {
      "type": "cover",
      "title": "主标题",
      "subtitle": "副标题",
      "badge": "按钮文案",
      "footer": "页脚文案",
      "titleLines": ["第一行", "第二行"]
    },
    {
      "type": "content",
      "section": "内容页标题",
      "headline": "一句话重点",
      "bullets": ["要点1", "要点2", "要点3"],
      "footer": "页脚文案"
    },
    {
      "type": "ending",
      "title": "结尾标题",
      "subtitle": "行动提示",
      "badge": "收藏备用",
      "footer": "页脚文案"
    }
  ]
}
`.trim();
}

export function fallbackXhsCardPlan(input = {}) {
  const topic = String(input.topic || "面试必问").trim();
  return {
    topic,
    summary: "面试问答模板卡片组",
    theme: {
      background: "#fff7e8",
      paper: "#fffefe",
      primaryText: "#28231f",
      mutedText: "#34302b",
      accent: "#f15b2a",
      accentText: "#ffffff",
    },
    cards: [
      {
        type: "cover",
        title: topic,
        subtitle: "为什么想加入我们公司？",
        badge: "🔥 满分回答模板来了",
        footer: "收藏备用 · 面试不慌",
        titleLines: topic.length > 4 ? [topic.slice(0, 4), topic.slice(4, 8)] : [topic],
      },
      {
        type: "content",
        section: "回答思路",
        headline: "先讲依据，再讲弹性",
        bullets: ["展示市场调研", "说明能力匹配", "保留沟通空间", "关注长期发展"],
        footer: "回答要专业，也要灵活",
      },
      {
        type: "content",
        section: "错误回答",
        headline: "这几种说法要避开",
        bullets: ["只报底线太强硬", "完全随意显得没准备", "脱离市场不可信", "纠结回避不成熟"],
        footer: "别让 HR 误判你的职业度",
      },
      {
        type: "content",
        section: "正确模板",
        headline: "给区间 + 给依据 + 给弹性",
        bullets: ["参考市场薪资区间", "结合经验和技术栈", "强调岗位成长空间", "愿意基于表现沟通"],
        footer: "照这个结构回答更稳",
      },
      {
        type: "ending",
        title: "面试不慌",
        subtitle: "收藏这套回答结构，薪资问题更好谈",
        badge: "收藏备用",
        footer: "下一题继续拆",
      },
    ],
  };
}
