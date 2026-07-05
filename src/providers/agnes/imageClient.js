import { agnesEndpoint } from "./endpoint.js";
import { getAgnesConfig, requireAgnesApiKey } from "./agnesConfig.js";
import { readUpstreamError } from "../../utils/upstreamError.js";

export async function generateImageWithAgnes(input) {
  const config = getAgnesConfig(input);
  const apiKey = requireAgnesApiKey(config);

  const inputImages = [
    ...(Array.isArray(input.image) ? input.image : (input.image ? [input.image] : [])),
    ...(Array.isArray(input.images) ? input.images : []),
    ...(Array.isArray(input.imageUrls) ? input.imageUrls : []),
    ...(input.imageUrl ? [input.imageUrl] : []),
    ...(input.imageDataUrl ? [input.imageDataUrl] : []),
  ].filter(Boolean);
  const responseFormat = input.responseFormat || input.response_format || (input.returnBase64 ? "b64_json" : "url");
  const body = {
    model: config.imageModel,
    prompt: String(input.prompt || "").trim(),
    size: input.size || "1024x1024",
    extra_body: {
      ...(input.extraBody || {}),
      ...(input.extra_body || {}),
      ...(inputImages.length ? { image: inputImages } : {}),
      response_format: responseFormat,
    },
  };
  if (input.returnBase64 || input.return_base64) body.return_base64 = true;
  if (Number.isFinite(Number(input.n))) body.n = Math.max(1, Math.min(4, Number(input.n)));
  if (!body.prompt) throw new Error("prompt is required");

  const response = await fetch(agnesEndpoint(config.baseUrl, "/v1/images/generations"), {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await readUpstreamError(response));
  return { model: config.imageModel, raw: await response.json() };
}
