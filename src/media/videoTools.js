import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { uploadBufferAsset } from "../oss/bitifulClient.js";

function runFfmpeg(args, inputBuffer = null) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", ...args], {
      stdio: [inputBuffer ? "pipe" : "ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve(Buffer.concat(stdout));
      reject(new Error(Buffer.concat(stderr).toString("utf8") || `ffmpeg exited with ${code}`));
    });
    if (inputBuffer) {
      child.stdin.end(inputBuffer);
    }
  });
}

async function downloadBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`download video failed: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function extractFrame(videoFile, frameFile, mode) {
  const seekArgs = mode === "last" ? ["-sseof", "-1"] : [];
  await runFfmpeg([
    "-y",
    ...seekArgs,
    "-i", videoFile,
    "-frames:v", "1",
    "-q:v", "2",
    frameFile,
  ]);
  const frameInfo = await stat(frameFile).catch(() => null);
  if (!frameInfo || frameInfo.size < 1024) throw new Error(`${mode} frame extraction produced an invalid image (${frameInfo?.size || 0} bytes)`);
}

export async function uploadLastFrameFromVideo(videoUrl, { kind = "xhs-frame" } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "agnes-frame-"));
  try {
    const videoFile = join(dir, "source.mp4");
    const frameFile = join(dir, "last-frame.jpg");
    await writeFile(videoFile, await downloadBuffer(videoUrl));
    try {
      await extractFrame(videoFile, frameFile, "last");
    } catch {
      await extractFrame(videoFile, frameFile, "first");
    }
    const frame = await readFile(frameFile);
    if (frame.length < 1024) throw new Error(`last frame extraction produced an invalid image (${frame.length} bytes)`);
    return uploadBufferAsset(frame, { kind, filename: "last-frame.jpg", contentType: "image/jpeg", sourceUrl: videoUrl });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function concatVideosToOss(videoUrls, { kind = "xhs-final-video" } = {}) {
  if (!Array.isArray(videoUrls) || videoUrls.length === 0) throw new Error("videoUrls is required");
  const dir = await mkdtemp(join(tmpdir(), "agnes-xhs-"));
  try {
    const listLines = [];
    for (const [index, url] of videoUrls.entries()) {
      const file = join(dir, `segment-${index}.mp4`);
      await writeFile(file, await downloadBuffer(url));
      listLines.push(`file '${file.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`);
    }
    const listFile = join(dir, "concat.txt");
    const outputFile = join(dir, "final.mp4");
    await writeFile(listFile, listLines.join("\n"), "utf8");
    await runFfmpeg([
      "-f", "concat",
      "-safe", "0",
      "-i", listFile,
      "-c", "copy",
      outputFile,
    ]);
    const finalVideo = await readFile(outputFile);
    return uploadBufferAsset(finalVideo, { kind, filename: "xhs-30s-video.mp4", contentType: "video/mp4" });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
