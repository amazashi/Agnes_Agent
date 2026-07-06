import { invokeXhsCardChain } from "../langchain/chains/xhsCardChain.js";
import { createPendingRun, markRunProgress, runAsyncTask } from "./runService.js";

export function startXhsCardRun(input) {
  const requestId = createPendingRun({ kind: "xhs_card_chain", request: input });
  runAsyncTask(requestId, () => invokeXhsCardChain(input, {
    onProgress: (progress) => markRunProgress(requestId, progress),
  }));
  return requestId;
}
