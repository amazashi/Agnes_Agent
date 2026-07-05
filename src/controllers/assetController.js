import { readJson, sendJson } from "../http.js";
import { uploadBufferAsset } from "../oss/bitifulClient.js";

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("dataUrl must be a base64 data URL");
  return {
    contentType: match[1],
    bytes: Buffer.from(match[2], "base64"),
  };
}

export async function uploadAssetRequest(req, res) {
  try {
    const body = await readJson(req, 30_000_000);
    const parsed = parseDataUrl(body.dataUrl);
    const asset = await uploadBufferAsset(parsed.bytes, {
      kind: body.kind || "input-image",
      filename: body.filename || "input-image",
      contentType: parsed.contentType,
    });
    return sendJson(res, 200, { ok: true, asset });
  } catch (error) {
    return sendJson(res, 400, { ok: false, error: error.message || String(error) });
  }
}
