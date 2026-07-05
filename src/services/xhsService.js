import { invokeXhsVideoChain } from "../langchain/chains/xhsVideoChain.js";
import { createPendingRun, getRun, markRunProgress, resumeAsyncTask, runAsyncTask } from "./runService.js";

export function startXhsRun(input) {
  const requestId = createPendingRun({ kind: "xhs_video_chain", request: input });
  runAsyncTask(requestId, () => invokeXhsVideoChain(input, {
    onProgress: (progress) => markRunProgress(requestId, progress),
  }));
  return requestId;
}

export function resumeXhsRun(requestId, overrides = {}) {
  const run = getRun(requestId);
  if (!run) throw new Error("request not found");
  if (run.kind !== "xhs_video_chain") throw new Error("request is not an XHS video chain");
  if (run.status === "succeeded") throw new Error("request already succeeded");
  const request = { ...run.request, ...overrides };
  resumeAsyncTask(requestId, () => invokeXhsVideoChain(request, {
    checkpoint: run.response,
    onProgress: (progress) => markRunProgress(requestId, progress),
  }));
  return requestId;
}
