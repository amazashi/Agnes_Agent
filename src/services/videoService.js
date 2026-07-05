import { videoGenerationRunnable } from "../langchain/chains/videoRunnable.js";
import { createPendingRun, runAsyncTask } from "./runService.js";

export function startVideoRun(input) {
  const requestId = createPendingRun({ kind: "video_chain", request: input });
  runAsyncTask(requestId, () => videoGenerationRunnable.invoke(input));
  return requestId;
}
