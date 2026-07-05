import { createHmac, createHash, randomUUID } from "node:crypto";

function hmac(key, data) {
  return createHmac("sha256", key).update(data).digest();
}

function hmacHex(key, data) {
  return createHmac("sha256", key).update(data).digest("hex");
}

function signingKey(secret, date, region, service) {
  const kDate = hmac(Buffer.from(`AWS4${secret}`, "utf8"), date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

function amzEncode(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalQuery(values) {
  return [...values.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${amzEncode(key)}=${amzEncode(value)}`)
    .join("&");
}

function isoStamp(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function dateStamp(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function extFromContentType(contentType) {
  if (/png/i.test(contentType)) return ".png";
  if (/jpe?g/i.test(contentType)) return ".jpg";
  if (/webp/i.test(contentType)) return ".webp";
  if (/gif/i.test(contentType)) return ".gif";
  if (/mp4/i.test(contentType)) return ".mp4";
  return ".bin";
}

function objectKey({ kind, sourceUrl = "", contentType, filename = "" }) {
  const prefix = String(process.env.BITIFUL_OBJECT_PREFIX || "langchain/generated").replace(/^\/+|\/+$/g, "");
  const sourcePath = (() => {
    try {
      return new URL(sourceUrl).pathname;
    } catch {
      return "";
    }
  })();
  const sourceName = filename || sourcePath;
  const suffix = sourceName.match(/\.[a-z0-9]{2,5}$/i)?.[0] || extFromContentType(contentType);
  const stamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  return `${prefix}/${kind}/${stamp}_${randomUUID()}${suffix}`;
}

function signUrl({ method, objectKey, contentType = "" }) {
  const accessKey = process.env.BITIFUL_ACCESS_KEY;
  const secretKey = process.env.BITIFUL_SECRET_KEY;
  const bucket = process.env.BITIFUL_BUCKET;
  if (!accessKey || !secretKey || !bucket) throw new Error("Bitiful OSS is not configured");

  const endpoint = String(process.env.BITIFUL_ENDPOINT || "https://s3.bitiful.net").replace(/\/+$/, "");
  const region = process.env.BITIFUL_REGION || "cn-east-1";
  const expires = Math.max(60, Number(process.env.BITIFUL_PRESIGN_TTL_SECONDS || 3600));
  const parsed = new URL(endpoint);
  const now = new Date();
  const date = dateStamp(now);
  const amzDate = isoStamp(now);
  const scope = `${date}/${region}/s3/aws4_request`;
  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKey}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "host",
  });
  const canonicalUri = `/${bucket}/${objectKey.replace(/^\/+/, "")}`;
  const canonicalRequest = [method, canonicalUri, canonicalQuery(query), `host:${parsed.host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
  query.set("X-Amz-Signature", hmacHex(signingKey(secretKey, date, region, "s3"), stringToSign));
  return {
    url: `${endpoint}${canonicalUri}?${canonicalQuery(query)}`,
    headers: { host: parsed.host, ...(contentType ? { "content-type": contentType } : {}) },
  };
}

export function ossConfigured() {
  return Boolean(process.env.BITIFUL_ACCESS_KEY && process.env.BITIFUL_SECRET_KEY && process.env.BITIFUL_BUCKET);
}

export function signedGetUrl(key) {
  return key && ossConfigured() ? signUrl({ method: "GET", objectKey: key }).url : null;
}

export function refreshOssAssetUrl(asset) {
  if (!asset?.objectKey) return asset;
  return { ...asset, url: signedGetUrl(asset.objectKey) || asset.url };
}

export async function uploadRemoteAsset(sourceUrl, { kind }) {
  if (!ossConfigured() || !sourceUrl) return null;
  const source = await fetch(sourceUrl);
  if (!source.ok) throw new Error(`download generated asset failed: HTTP ${source.status}`);
  const contentType = source.headers.get("content-type") || "application/octet-stream";
  const bytes = Buffer.from(await source.arrayBuffer());
  return uploadBufferAsset(bytes, { kind, filename: new URL(sourceUrl).pathname, contentType, sourceUrl });
}

export async function uploadBufferAsset(bytes, { kind, filename = "", contentType = "application/octet-stream", sourceUrl = "" }) {
  if (!ossConfigured()) throw new Error("Bitiful OSS is not configured");
  const body = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const key = objectKey({ kind, filename, contentType, sourceUrl });
  const put = signUrl({ method: "PUT", objectKey: key, contentType });
  const uploaded = await fetch(put.url, { method: "PUT", headers: put.headers, body });
  if (!uploaded.ok) throw new Error(`Bitiful upload failed: HTTP ${uploaded.status}: ${await uploaded.text().catch(() => "")}`);
  return {
    objectKey: key,
    url: signedGetUrl(key),
    sourceUrl,
    contentType,
    sizeBytes: body.length,
  };
}
