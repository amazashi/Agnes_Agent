import { invokeChatChain } from "../langchain/chains/chatChain.js";
import { createPendingRun, runAsyncTask } from "./runService.js";

export function startChatRun(input) {
  const requestId = createPendingRun({ kind: "chat_chain", request: input });
  runAsyncTask(requestId, () => invokeChatChain(input));
  return requestId;
}
