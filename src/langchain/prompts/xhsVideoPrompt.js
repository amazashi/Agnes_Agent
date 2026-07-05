export function buildXhsPlannerPrompt(input = {}) {
  const keyword = String(input.keyword || "").trim();
  const topicHint = String(input.topicHint || "AI tools, side hustle, productivity, personal growth").trim();
  return `
You are a Xiaohongshu short-video planner.
Create a simple 30-second fan-growth video plan.

Keyword: ${keyword || "(recommend one high-potential keyword yourself)"}
Topic hints: ${topicHint}

Rules:
- Keep image and video prompts short and clear.
- Use multi-shot video language: shot 1, shot 2, shot 3.
- Describe scene, subject, action, camera movement, and light.
- Do not render any visible text in images or videos.
- Avoid captions, subtitles, letters, words, logos, signs, posters, labels, UI text, and watermarks.
- Prefer one stable character, one clear action, soft cinematic motion.

Return strict JSON only:
{
  "keyword": "Chinese keyword",
  "hook": "Chinese hook for copywriting only",
  "storyboard": [
    {
      "time": "0-6s",
      "scene": "simple visual scene, no text",
      "camera": "stable camera movement",
      "emotion": "viewer emotion"
    }
  ],
  "character": {
    "role": "simple role",
    "appearance": "stable appearance",
    "props": "simple props without text"
  },
  "imagePrompt": "short English image prompt, no text",
  "videoPrompt": "short English video prompt, no text",
  "negativePrompt": "text, captions, subtitles, letters, words, logo, watermark, sign, poster, label, ui text, blurry, low quality"
}
`.trim();
}

export function fallbackXhsPlan(input = {}) {
  const keyword = String(input.keyword || "AI side hustle").trim();
  return {
    keyword,
    hook: `${keyword}: start with one simple idea`,
    storyboard: [
      { time: "0-6s", scene: "A young creator opens a laptop in a cozy room.", camera: "Slow push-in.", emotion: "Curiosity" },
      { time: "6-12s", scene: "Soft glowing idea shapes appear around the creator.", camera: "Gentle side move.", emotion: "Surprise" },
      { time: "12-18s", scene: "The creator arranges simple visual cards on a clean desk.", camera: "Top-down smooth slide.", emotion: "Clarity" },
      { time: "18-24s", scene: "Friendly audience silhouettes gather around warm screen light.", camera: "Wide reveal.", emotion: "Trust" },
      { time: "24-30s", scene: "The creator smiles and looks at the camera in soft morning light.", camera: "Slow cinematic push-in.", emotion: "Action" },
    ],
    character: {
      role: "young creative solo founder",
      appearance: "friendly person in neutral casual clothes, clean modern style",
      props: "laptop, blank notebook, simple desk objects",
    },
    imagePrompt: "Vertical cinematic image. A young creative founder at a clean desk with a laptop, soft glowing idea shapes, cozy room, pastel warm light, simple composition, no text.",
    videoPrompt: "Multiple shots. A young creator opens a laptop in a cozy room. Soft glowing idea shapes appear. The creator arranges simple visual cards on a clean desk. The camera moves slowly and smoothly. Warm cinematic light, no text.",
    negativePrompt: "text, captions, subtitles, letters, words, logo, watermark, sign, poster, label, ui text, blurry, distorted hands, low quality",
  };
}
