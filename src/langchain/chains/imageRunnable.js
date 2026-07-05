import { RunnableLambda } from "@langchain/core/runnables";
import { generateImageWithAgnes } from "../../providers/agnes/imageClient.js";
import { uploadBufferAsset, uploadRemoteAsset } from "../../oss/bitifulClient.js";

function imageBytesFromBase64(value) {
  const data = String(value || "");
  const match = data.match(/^data:([^;]+);base64,(.+)$/);
  if (match) return { contentType: match[1], bytes: Buffer.from(match[2], "base64") };
  return { contentType: "image/png", bytes: Buffer.from(data, "base64") };
}

export const imageGenerationRunnable = RunnableLambda.from(async (input) => {
  const { model, raw } = await generateImageWithAgnes(input);
  const images = raw.data || [];
  const ossImages = [];
  for (const item of images) {
    if (item?.url) {
      const uploaded = await uploadRemoteAsset(item.url, { kind: "image" });
      if (uploaded) ossImages.push(uploaded);
    } else if (item?.b64_json) {
      const parsed = imageBytesFromBase64(item.b64_json);
      const uploaded = await uploadBufferAsset(parsed.bytes, {
        kind: "image",
        filename: "generated-image.png",
        contentType: parsed.contentType,
      });
      if (uploaded) ossImages.push(uploaded);
    }
  }
  return { framework: "langchain-js", runnable: "RunnableLambda(imageGeneration)", model, images, ossImages, raw };
});
