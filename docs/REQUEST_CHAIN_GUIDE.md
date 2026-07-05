# 请求链路与自定义 Chain 学习文档

这份文档只讲当前项目的代码链路：一个请求从网页提交，到后端接收，到 LangChain / Agnes 执行，到轮询任务状态，再到 SQLite 入库，分别经过哪些文件。

## 1. 总体结构

项目分成几层：

```text
public/                 # 前端页面、提交、轮询、预览
src/routes/             # HTTP 路由分发
src/controllers/        # 接收请求、读取参数、返回 HTTP 响应
src/services/           # 创建任务、异步执行、更新状态
src/langchain/          # LangChain 模型、Prompt、Chain、Runnable
src/providers/agnes/    # Agnes 原始 API 封装
src/oss/                # OSS 上传
src/storage/            # SQLite 读写
sql/schema.sql          # 数据库表结构
```

入口关系：

```text
src/server.js
  -> src/app/server.js
  -> src/routes/apiRoutes.js
  -> src/controllers/*
  -> src/services/*
  -> src/langchain/*
  -> src/providers/agnes/*
  -> src/storage/*
```

前端入口：

- `public/index.html`：页面结构，包含 Chat、Image、Video 三个表单。
- `public/app.js:8-11`：初始化上传区，并分别绑定 `chat-form`、`image-form`、`video-form`。
- `public/js/taskSubmit.js:6`：绑定表单提交。
- `public/js/apiClient.js:11`：把表单字段转换成 JSON 请求体。

## 2. 数据库表

表结构在 `sql/schema.sql`。

核心表是 `chain_runs`：

- `request_id`：每次请求的唯一 ID。
- `kind`：任务类型，比如 `chat_chain`、`image_chain`、`video_chain`。
- `status`：`pending`、`running`、`succeeded`、`failed`。
- `request_json`：接口收到的请求参数。
- `response_json`：模型或 Runnable 最终返回的数据。
- `error_message`：失败原因。
- `started_at` / `finished_at` / `elapsed_ms`：任务时间信息。

数据库连接：

- `src/storage/sqlite.js:5`：读取 `SQLITE_PATH`，默认 `./data/langchain.sqlite`。
- `src/storage/sqlite.js:8`：启动时执行 `sql/schema.sql`，确保表存在。

数据库写入：

- `src/storage/runRepository.js:37`：`insertRun`，创建任务，状态为 `pending`，写入 `request_json`。
- `src/storage/runRepository.js:45`：`updateRunRunning`，任务开始时更新为 `running`。
- `src/storage/runRepository.js:54`：`updateRunDone`，任务完成时写入 `response_json` 或 `error_message`。
- `src/storage/runRepository.js:65`：`findRunByRequestId`，按 requestId 查询单个任务。
- `src/storage/runRepository.js:70`：`findRecentRuns`，查询最近任务列表。

统一任务服务：

- `src/services/runService.js:6`：`createPendingRun` 生成 `requestId` 并入库。
- `src/services/runService.js:11`：`markRunRunning` 更新运行中状态。
- `src/services/runService.js:15`：`markRunSucceeded` 写成功响应。
- `src/services/runService.js:19`：`markRunFailed` 写失败信息。
- `src/services/runService.js:23`：`getRun` 查询并刷新 OSS 签名链接。
- `src/services/runService.js:30`：`listRuns` 查询任务列表。
- `src/services/runService.js:31`：`runAsyncTask` 异步执行任务。

## 3. 前端轮询与预览

提交任务：

- `public/js/taskSubmit.js:6`：监听表单提交。
- `public/js/taskSubmit.js:9`：`formJson` 转换表单参数。
- `public/js/taskSubmit.js:17`：POST 到 `/api/{kind}/requests`。
- `public/js/taskSubmit.js:18`：把 `requestId` 放进前端轮询列表。
- `public/js/taskSubmit.js:20`：提交后 1 秒先查一次。

持续轮询：

- `public/js/polling.js:7`：`trackTask(kind, requestId)` 记录活跃任务。
- `public/js/polling.js:11`：`poll` 请求 `/api/{kind}/requests/{requestId}`。
- `public/js/polling.js:22`：每 30 秒轮询一次所有活跃任务。
- `public/js/polling.js:14-17`：任务不是 `pending/running` 后停止轮询，并刷新任务列表。

任务列表：

- `public/js/runList.js:4`：请求 `/api/runs?limit=20`。
- `public/js/runList.js:15`：点击某条历史任务后，按 kind 查询对应详情。

结果预览：

- `public/js/previewRenderer.js:11`：根据任务状态和 response 渲染预览。
- `public/js/previewRenderer.js:16`：文本结果渲染 `response.text`。
- `public/js/previewRenderer.js:17`：图片结果渲染 `response.ossImages`。
- `public/js/previewRenderer.js:26`：视频结果渲染 `response.ossVideo`。
- `public/js/previewRenderer.js:33`：`showRun` 同时更新状态、预览区、原始 JSON。

## 4. Chat 任务链路

### 4.1 普通异步 Chat

前端：

```text
public/index.html
  -> chat-form
public/app.js:9
  -> bindSubmit("chat", "chat-form")
public/js/taskSubmit.js:17
  -> POST /api/chat/requests
```

后端路由：

- `src/app/server.js:20`：把请求交给 `routeApi`。
- `src/routes/apiRoutes.js:14`：`POST /api/chat/requests` 进入 `createChatRequest`。
- `src/routes/apiRoutes.js:21`：`GET /api/chat/requests/:requestId` 进入 `getChatRequest`。

Controller：

- `src/controllers/chatController.js:5`：读取 JSON body。
- `src/controllers/chatController.js:7`：校验 `question` 或 `prompt`。
- `src/controllers/chatController.js:8`：调用 `startChatRun(body)`。
- `src/controllers/chatController.js:9`：返回 `202`、`requestId` 和 `statusUrl`。
- `src/controllers/chatController.js:12`：查询任务详情。

Service：

- `src/services/chatService.js:4`：`startChatRun(input)`。
- `src/services/chatService.js:5`：`createPendingRun`，先写 SQLite，状态 `pending`。
- `src/services/chatService.js:6`：`runAsyncTask` 异步执行 `invokeChatChain(input)`。

异步状态更新：

```text
src/services/runService.js:31
  -> setImmediate(...)
  -> markRunRunning
  -> await task()
  -> markRunSucceeded 或 markRunFailed
```

LangChain Chain：

- `src/langchain/chains/chatChain.js:39`：`invokeChatChain(input)`。
- `src/langchain/chains/chatChain.js:40`：`createChatChain(input)` 创建模型。
- `src/langchain/chains/chatChain.js:41`：`createChatMessages(input)` 构造消息。
- `src/langchain/chains/chatChain.js:42`：`model.invoke(messages, callOptions)` 调用文本模型。
- `src/langchain/chains/chatChain.js:45-58`：如果模型返回 `tool_calls`，执行本地工具，再二次调用模型。
- `src/langchain/chains/chatChain.js:60-75`：整理最终 response。

模型创建：

- `src/langchain/models/agnesChatModel.js:3`：LangChain 模型入口。
- `src/providers/agnes/chatClient.js:4`：创建 `ChatOpenAI`。
- `src/providers/agnes/chatClient.js:9-14`：设置 Agnes baseURL、model、temperature、topP、maxTokens、streaming、timeout、extraBody。

Prompt / Messages：

- `src/langchain/prompts/chatMessages.js`：把 `systemPrompt`、`question`、`messages`、`imageUrl/imageUrls` 转成 LangChain 消息。
- `src/langchain/prompts/chatPrompt.js`：基础 ChatPromptTemplate。

工具调用：

- `src/langchain/tools/toolRegistry.js`：工具 schema 和本地执行器。
- `src/langchain/chains/chatChain.js:45`：检测模型返回的 `tool_calls`。
- `src/langchain/chains/chatChain.js:49`：执行工具。
- `src/langchain/chains/chatChain.js:56`：把工具结果作为 `ToolMessage` 回传模型。

入库：

- 请求入库：`src/services/chatService.js:5` -> `src/services/runService.js:6` -> `src/storage/runRepository.js:37`。
- 成功入库：`src/services/runService.js:15` -> `src/storage/runRepository.js:54`。
- 失败入库：`src/services/runService.js:19` -> `src/storage/runRepository.js:54`。

### 4.2 流式 Chat

流式 Chat 是独立接口，不走普通异步 `runAsyncTask`，但仍然写 SQLite。

前端：

- `public/js/taskSubmit.js:10`：如果 `kind === "chat"` 且 `stream === true`，走流式提交。
- `public/js/taskSubmit.js:34`：调用 `streamApi("/api/chat/stream", body, handlers)`。
- `public/js/taskSubmit.js:40`：收到 `delta` 后把文本追加到页面。

后端：

- `src/routes/apiRoutes.js:15`：`POST /api/chat/stream`。
- `src/controllers/chatStreamController.js:18`：读取 body。
- `src/controllers/chatStreamController.js:19`：创建 `chat_stream` 任务记录。
- `src/controllers/chatStreamController.js:29`：标记 `running`。
- `src/controllers/chatStreamController.js:35`：创建 ChatModel。
- `src/controllers/chatStreamController.js:39`：`for await` 读取模型流式 chunk。
- `src/controllers/chatStreamController.js:43`：每个 delta 写给前端。
- `src/controllers/chatStreamController.js:53`：结束后 `markRunSucceeded` 写入完整文本。
- `src/controllers/chatStreamController.js:56`：失败时 `markRunFailed`。

注意：当前流式 Chat 主要用于文本流式展示，不执行工具调用二次链路。普通异步 Chat 仍然支持工具调用。

## 5. Image 任务链路

前端：

```text
public/index.html
  -> image-form
public/app.js:10
  -> bindSubmit("image", "image-form")
public/js/taskSubmit.js:17
  -> POST /api/image/requests
```

图片上传：

- `public/app.js:8`：初始化上传区。
- `public/js/uploadZones.js:57`：绑定拖拽和点击选择文件。
- `public/js/uploadZones.js:42`：上传文件到 `/api/assets/upload`。
- `src/routes/apiRoutes.js:18`：进入 `uploadAssetRequest`。
- `src/controllers/assetController.js:14`：读取 Data URL。
- `src/controllers/assetController.js:17`：`uploadBufferAsset` 上传 OSS。
- `public/js/uploadZones.js:20-27`：把 OSS URL 写入隐藏字段。

后端路由：

- `src/routes/apiRoutes.js:16`：`POST /api/image/requests`。
- `src/routes/apiRoutes.js:24`：`GET /api/image/requests/:requestId`。

Controller：

- `src/controllers/imageController.js:5`：读取 JSON body。
- `src/controllers/imageController.js:7`：校验 `prompt`。
- `src/controllers/imageController.js:8`：调用 `startImageRun(body)`。
- `src/controllers/imageController.js:12`：查询任务详情。

Service：

- `src/services/imageService.js:4`：`startImageRun(input)`。
- `src/services/imageService.js:5`：创建 pending 任务并写 SQLite。
- `src/services/imageService.js:6`：异步执行 `imageGenerationRunnable.invoke(input)`。

LangChain Runnable：

- `src/langchain/chains/imageRunnable.js:12`：定义 `imageGenerationRunnable`。
- `src/langchain/chains/imageRunnable.js:13`：调用 `generateImageWithAgnes(input)`。
- `src/langchain/chains/imageRunnable.js`：把 URL 输出或 Base64 输出统一上传到 OSS。
- 返回结果里包含 `images`、`ossImages`、`raw`。

Agnes Image Provider：

- `src/providers/agnes/imageClient.js:5`：`generateImageWithAgnes(input)`。
- 这里构造 Agnes `/v1/images/generations` 请求。
- 图生图、多图合成会把输入图放到 `extra_body.image`。
- `response_format` 放在 `extra_body.response_format`。

入库：

- 请求入库：`src/services/imageService.js:5`。
- 状态 running：`src/services/runService.js:33`。
- 成功响应入库：`src/services/runService.js:15`。
- 失败信息入库：`src/services/runService.js:19`。

查询与预览：

- 前端轮询：`public/js/polling.js:11`。
- 后端查询：`src/controllers/imageController.js:12`。
- 渲染图片：`public/js/previewRenderer.js:17`。
- OSS 链接刷新：`src/services/assetService.js:4`。

## 6. Video 任务链路

前端：

```text
public/index.html
  -> video-form
public/app.js:11
  -> bindSubmit("video", "video-form")
public/js/taskSubmit.js:17
  -> POST /api/video/requests
```

视频参考图上传：

- 与 Image 一样，使用 `public/js/uploadZones.js`。
- 单张图写入隐藏字段 `image`。
- 多张图写入 `imageUrlsJson`。
- keyframes 写入 `keyframesJson`。
- 后端只收到 OSS URL，不需要用户手动输入图片地址。

后端路由：

- `src/routes/apiRoutes.js:17`：`POST /api/video/requests`。
- `src/routes/apiRoutes.js:27`：`GET /api/video/requests/:requestId`。

Controller：

- `src/controllers/videoController.js:5`：读取 JSON body。
- `src/controllers/videoController.js:7`：调用 `startVideoRun(body)`。
- `src/controllers/videoController.js:11`：查询任务详情。

Service：

- `src/services/videoService.js:4`：`startVideoRun(input)`。
- `src/services/videoService.js:5`：创建 pending 任务并写 SQLite。
- `src/services/videoService.js:6`：异步执行 `videoGenerationRunnable.invoke(input)`。

LangChain Runnable：

- `src/langchain/chains/videoRunnable.js:28`：定义 `videoGenerationRunnable`。
- `src/langchain/chains/videoRunnable.js:33-35`：如果收到 Data URL / Base64 输入图，先上传 OSS。
- `src/langchain/chains/videoRunnable.js:38-46`：多张 Data URL / keyframe Data URL 也上传 OSS。
- `src/langchain/chains/videoRunnable.js:50`：调用 `createVideoWithAgnes(request)` 创建视频任务。
- `src/langchain/chains/videoRunnable.js:52`：调用 `pollAgnesVideo(...)` 持续轮询 Agnes 任务。
- `src/langchain/chains/videoRunnable.js:62`：生成成功后把视频上传 OSS。
- `src/langchain/chains/videoRunnable.js:64`：如果 Agnes 任务失败，抛错进入统一失败入库。

Agnes Video Provider：

- `src/providers/agnes/videoClient.js:37`：`createVideoWithAgnes(input)`。
- `src/providers/agnes/videoClient.js:41-52`：构造 `extra_body`，处理多图和 keyframes。
- `src/providers/agnes/videoClient.js:55-66`：构造 Agnes `/v1/videos` 请求体。
- `src/providers/agnes/videoClient.js:68`：本地校验视频参数。
- `src/providers/agnes/videoClient.js:79`：`pollAgnesVideo` 轮询视频结果。

视频 Prompt：

- `src/providers/agnes/videoPrompt.js`：把 `scene`、`subject`、`action`、`camera`、`lighting` 或直接 `prompt` 拼成最终视频提示词。

入库：

- 请求入库：`src/services/videoService.js:5`。
- 运行中：`src/services/runService.js:33`。
- 成功后写入完整 response，包括 Agnes 原始结果、源视频 URL、OSS 视频 URL：`src/services/runService.js:15`。
- 失败后写入错误：`src/services/runService.js:19`。

查询与预览：

- 前端轮询：`public/js/polling.js:11`。
- 后端查询：`src/controllers/videoController.js:11`。
- 渲染视频：`public/js/previewRenderer.js:26`。
- OSS 链接刷新：`src/services/assetService.js:5`。

## 7. 三条链路对比

| 类型 | Controller | Service | LangChain 层 | Agnes Provider | 是否上传 OSS |
| --- | --- | --- | --- | --- | --- |
| Chat | `chatController.js` | `chatService.js` | `chatChain.js` | `chatClient.js` | 否 |
| Image | `imageController.js` | `imageService.js` | `imageRunnable.js` | `imageClient.js` | 是 |
| Video | `videoController.js` | `videoService.js` | `videoRunnable.js` | `videoClient.js` | 是 |

共同点：

- 都通过 `/api/{kind}/requests` 创建任务。
- 都先写 SQLite，状态是 `pending`。
- 都通过 `runAsyncTask` 异步执行。
- 都会更新为 `running`。
- 成功后写 `response_json`。
- 失败后写 `error_message`。
- 前端都用 requestId 轮询状态。

不同点：

- Chat 直接调用 LangChain ChatModel。
- Image 把 Agnes Image API 包装成 LangChain `RunnableLambda`。
- Video 把 Agnes Video 创建、远端轮询、OSS 上传包装成 LangChain `RunnableLambda`。

## 8. 如果你要自己搭一条新的 Chain

假设你要新增一个 `audio` chain，或者一个自定义 `summary` chain，建议按下面步骤做。

### 第一步：确定请求和响应结构

先写清楚：

- 前端要提交什么字段。
- 后端 request_json 要保存什么。
- 模型最终 response_json 要保存什么。
- 是否需要异步。
- 是否需要轮询远端任务。
- 是否需要 OSS。

例子：

```text
kind: summary_chain
request:
  model
  text
  style
response:
  text
  rawMessage
```

### 第二步：新增前端表单

改：

- `public/index.html`：增加一个表单或 tab。
- `public/app.js`：加 `bindSubmit("summary", "summary-form")`。

如果要上传文件：

- 继续复用 `public/js/uploadZones.js`。
- 后端上传接口已经是 `/api/assets/upload`。

### 第三步：新增路由

改：

- `src/routes/apiRoutes.js`

新增：

```text
POST /api/summary/requests
GET  /api/summary/requests/:requestId
```

路由只负责把请求分发到 controller，不写业务逻辑。

### 第四步：新增 Controller

新增：

```text
src/controllers/summaryController.js
```

Controller 负责：

- `readJson(req)`。
- 做最基本的必填校验。
- 调用 service 的 `startSummaryRun(body)`。
- 返回 `202 + requestId + statusUrl`。
- 提供 `getSummaryRequest` 查询任务。

不要在 Controller 里直接调模型。

### 第五步：新增 Service

新增：

```text
src/services/summaryService.js
```

Service 负责：

- `createPendingRun({ kind: "summary_chain", request: input })`
- `runAsyncTask(requestId, () => yourChain.invoke(input))`

Service 不写 prompt，不写 provider，不写 SQL 细节。

### 第六步：新增 LangChain Chain / Runnable

如果是文本模型：

```text
src/langchain/chains/summaryChain.js
```

可以引用：

- `src/langchain/models/agnesChatModel.js`
- `src/langchain/prompts/*`
- `src/langchain/parsers/*`

文本模型引用方式：

```js
import { createChatModel } from "../models/agnesChatModel.js";
```

然后在 chain 里：

```js
const model = createChatModel(input);
const result = await model.invoke(messages);
```

如果是图片模型：

```text
src/langchain/chains/myImageRunnable.js
```

引用：

```js
import { generateImageWithAgnes } from "../../providers/agnes/imageClient.js";
```

图片模型通常适合用 `RunnableLambda.from(async (input) => { ... })` 包起来。

如果是视频模型：

```text
src/langchain/chains/myVideoRunnable.js
```

引用：

```js
import { createVideoWithAgnes, pollAgnesVideo } from "../../providers/agnes/videoClient.js";
```

视频模型通常要做三步：

1. 创建远端视频任务。
2. 轮询远端任务状态。
3. 完成后上传视频到 OSS。

### 第七步：如果要新模型，新增 Provider

如果只是用 Agnes 已有模型，不一定要新增 provider，复用即可：

- 文本：`src/providers/agnes/chatClient.js`
- 图片：`src/providers/agnes/imageClient.js`
- 视频：`src/providers/agnes/videoClient.js`

如果接入另一个厂商，建议新增：

```text
src/providers/newProvider/config.js
src/providers/newProvider/chatClient.js
src/providers/newProvider/imageClient.js
src/providers/newProvider/videoClient.js
```

不要把厂商 API 细节写进 `controllers` 或 `services`。

### 第八步：确认入库

只要你走了这个标准 service 写法：

```text
createPendingRun
runAsyncTask
markRunSucceeded / markRunFailed
```

就会自动记录：

- 请求参数
- 状态变化
- 成功响应
- 失败错误
- 开始和结束时间

你不需要在 chain 里手动写 SQL。

### 第九步：确认前端轮询

只要新增接口遵循这个格式：

```text
POST /api/{kind}/requests
GET  /api/{kind}/requests/:requestId
```

并且前端 `bindSubmit("{kind}", "{kind}-form")`，就可以复用：

- `public/js/taskSubmit.js`
- `public/js/polling.js`
- `public/js/runList.js`
- `public/js/previewRenderer.js`

如果新增的 response 类型不是 text/image/video，就需要扩展：

```text
public/js/previewRenderer.js
```

### 第十步：把新文件加入检查脚本

改：

```text
package.json
```

把新增 JS 文件加入：

```text
npm run check
```

这样以后可以用 `node --check` 快速发现语法错误。

## 9. 新 Chain 文件清单模板

新增一条标准异步 chain，通常至少需要：

```text
src/controllers/xxxController.js
src/services/xxxService.js
src/langchain/chains/xxxChain.js 或 xxxRunnable.js
src/routes/apiRoutes.js
public/index.html
public/app.js
package.json
```

如果要接新厂商模型，再加：

```text
src/providers/xxx/xxxClient.js
src/providers/xxx/xxxConfig.js
```

如果要新增 prompt：

```text
src/langchain/prompts/xxxPrompt.js
```

如果要新增输出解析：

```text
src/langchain/parsers/xxxParser.js
```

如果要新增工具调用：

```text
src/langchain/tools/xxxTool.js
```

## 10. 最重要的设计原则

1. Controller 只管 HTTP。
2. Service 只管任务生命周期。
3. Chain / Runnable 只管 LangChain 编排。
4. Provider 只管外部模型 API。
5. Storage 只管 SQLite。
6. OSS 只管文件上传和链接刷新。
7. 前端只管提交、轮询、预览。

这样项目会比较容易维护，不会出现一个文件里同时写模型、提示词、SQL、OSS、路由和页面逻辑。
