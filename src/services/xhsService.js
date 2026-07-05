import { invokeXhsVideoChain } from "../langchain/chains/xhsVideoChain.js";
import { createPendingRun, runAsyncTask } from "./runService.js";

export function startXhsRun(input) {
  const requestId = createPendingRun({ kind: "xhs_video_chain", request: input });
  runAsyncTask(requestId, () => invokeXhsVideoChain(input));
  return requestId;
}
