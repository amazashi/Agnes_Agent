export function buildXhsPlannerPrompt(input = {}) {
  const keyword = String(input.keyword || "").trim();
  const fallbackTopic = String(input.topicHint || "AI tools, side hustle, productivity, personal growth").trim();
  return `
You are a Xiaohongshu short-video creative planner.
Create a 30-second fan-growth video concept. The video is for attraction, curiosity, and saves.

User keyword: ${keyword || "(recommend a current high-potential keyword yourself)"}
Topic hints: ${fallbackTopic}

Important visual rule:
- The generated image and generated video must contain NO visible text.
- Do not ask image/video models to render titles, captions, subtitles, handwriting, UI text, logos, labels, posters, signs, watermarks, or readable characters.
- Use simple scenes, clear subjects, strong emotion, and visual metaphors that weak image/video models can follow.

Return strict JSON only:
{
  "keyword": "one chosen keyword in Chinese",
  "hook": "one short Chinese hook for human copywriting only, not for image/video",
  "storyboard": [
    {
      "time": "0-6s",
      "scene": "visual scene idea, no text",
      "camera": "camera movement",
      "emotion": "viewer emotion"
    }
  ],
  "character": {
    "role": "simple character role",
    "appearance": "stable visual appearance",
    "props": "simple props"
  },
  "imagePrompt": "English image prompt, no text in image",
  "videoPrompt": "English video prompt, no text in video",
  "negativePrompt": "text, captions, subtitles, letters, words, logo, watermark, sign, poster, label, ui text, blurry, distorted hands, low quality"
}
`.trim();
}

export function fallbackXhsPlan(input = {}) {
  const keyword = String(input.keyword || "AI副业").trim();
  return {
    keyword,
    hook: `${keyword}，普通人也能马上开始`,
    storyboard: [
      { time: "0-6s", scene: "a calm creator opens a laptop in a cozy room, no text", camera: "slow push-in", emotion: "curiosity" },
      { time: "6-12s", scene: "soft glowing ideas float as abstract shapes around the creator, no words", camera: "gentle orbit", emotion: "possibility" },
      { time: "12-18s", scene: "the creator arranges simple visual cards and tools on a clean desk, no readable marks", camera: "top-down smooth slide", emotion: "clarity" },
      { time: "18-24s", scene: "a small audience of friendly silhouettes gathers around a warm screen glow, no text", camera: "wide reveal", emotion: "trust" },
      { time: "24-30s", scene: "the creator smiles with a finished visual board, soft morning light, no text", camera: "cinematic push-in", emotion: "action" },
    ],
    character: {
      role: "young creative solo founder",
      appearance: "friendly person in neutral casual clothes, clean modern style",
      props: "laptop, notebook without visible writing, simple desk objects",
    },
    imagePrompt: "vertical cinematic lifestyle image, young creative solo founder at a clean desk with laptop and abstract glowing idea shapes, cozy room, pastel warm lighting, simple composition, no text, no letters, no logo, no watermark, no signs, no readable marks",
    videoPrompt: "vertical 30 second cinematic short video, young creative solo founder builds an idea into a simple visual workflow, cozy desk, laptop, abstract glowing idea shapes, friendly audience silhouettes, warm soft light, smooth camera movement, no text, no letters, no captions, no subtitles, no logo, no watermark, no signs",
    negativePrompt: "text, captions, subtitles, letters, words, logo, watermark, sign, poster, label, ui text, blurry, distorted hands, low quality",
  };
}
