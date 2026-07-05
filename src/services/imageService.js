import { imageGenerationRunnable } from "../langchain/chains/imageRunnable.js";
import { createPendingRun, runAsyncTask } from "./runService.js";

export function startImageRun(input) {
  const requestId = createPendingRun({ kind: "image_chain", request: input });
  runAsyncTask(requestId, () => imageGenerationRunnable.invoke(input));
  return requestId;
}
