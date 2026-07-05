import { sendJson } from "../http.js";
import { createChatRequest, getChatRequest } from "../controllers/chatController.js";
import { createImageRequest, getImageRequest } from "../controllers/imageController.js";
import { createVideoRequest, getVideoRequest } from "../controllers/videoController.js";
import { createXhsRequest, getXhsRequest } from "../controllers/xhsController.js";
import { listRunRequests } from "../controllers/runController.js";
import { uploadAssetRequest } from "../controllers/assetController.js";
import { streamChatRequest } from "../controllers/chatStreamController.js";

export async function routeApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, service: "langchain-js-sqlite-workbench" });
  }

  if (req.method === "POST" && url.pathname === "/api/chat/requests") return createChatRequest(req, res);
  if (req.method === "POST" && url.pathname === "/api/chat/stream") return streamChatRequest(req, res);
  if (req.method === "POST" && url.pathname === "/api/image/requests") return createImageRequest(req, res);
  if (req.method === "POST" && url.pathname === "/api/video/requests") return createVideoRequest(req, res);
  if (req.method === "POST" && url.pathname === "/api/xhs/requests") return createXhsRequest(req, res);
  if (req.method === "POST" && url.pathname === "/api/assets/upload") return uploadAssetRequest(req, res);

  const chatMatch = url.pathname.match(/^\/api\/chat\/requests\/([^/]+)$/);
  if (req.method === "GET" && chatMatch) return getChatRequest(req, res, chatMatch[1]);

  const imageMatch = url.pathname.match(/^\/api\/image\/requests\/([^/]+)$/);
  if (req.method === "GET" && imageMatch) return getImageRequest(req, res, imageMatch[1]);

  const videoMatch = url.pathname.match(/^\/api\/video\/requests\/([^/]+)$/);
  if (req.method === "GET" && videoMatch) return getVideoRequest(req, res, videoMatch[1]);

  const xhsMatch = url.pathname.match(/^\/api\/xhs\/requests\/([^/]+)$/);
  if (req.method === "GET" && xhsMatch) return getXhsRequest(req, res, xhsMatch[1]);

  if (req.method === "GET" && url.pathname === "/api/runs") return listRunRequests(req, res);
  return false;
}
