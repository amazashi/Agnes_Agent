# LangChain.js + Agnes + SQLite 学习文档

这个项目是一个用于学习 LangChain.js 架构的 Node.js 工作台。它参考了 `activation-llm-gateway`，但重新拆成了更清晰的模块：

```text
网页 -> Node API -> Service -> LangChain Chain/Runnable -> Agnes Provider -> OSS/SQLite
```

## 1. 已接入能力

### Chat / 文本模型

核心文件：

- `src/providers/agnes/chatClient.js`
- `src/langchain/models/agnesChatModel.js`
- `src/langchain/chains/chatChain.js`
- `src/langchain/prompts/chatMessages.js`
- `src/langchain/tools/toolRegistry.js`

设计说明：

- Agnes 文本接口是 OpenAI-compatible，因此 LangChain 层使用 `ChatOpenAI`。
- Agnes 的 key、baseUrl、model 等细节统一放在 `providers/agnes`。
- `chatChain.js` 只负责编排：构造消息、调用模型、执行工具调用、整理返回。

当前文本请求支持：

- `model`
- `systemPrompt`
- `question` / `prompt`
- `messages`
- `temperature`
- `topP` / `top_p`
- `maxTokens` / `max_tokens`
- `stream`
- `imageUrl` / `image_url`
- `imageUrls`
- `tools`
- `toolChoice` / `tool_choice`
- `enableBuiltinTools`
- `executeTools`
- `thinking`
- `chatTemplateKwargs` / `chat_template_kwargs`
- `extraBody`

已支持两个扩展能力：

- 工具调用：模型返回 `tool_calls` 后，由 `src/langchain/tools/toolRegistry.js` 执行本地工具，再把 `ToolMessage` 回传模型。
- 图像理解：通过 `messages[].content` 的多模态格式传入 `text + image_url`，它属于 Agnes Chat 能力，不属于生图模型。

### Image / 图像生成与编辑

核心文件：

- `src/providers/agnes/imageClient.js`
- `src/langchain/chains/imageRunnable.js`
- `src/services/imageService.js`
- `src/controllers/imageController.js`

当前支持模型：

- `agnes-image-2.0-flash`
- `agnes-image-2.1-flash`

当前支持工作流：

- 文生图
- 图生图
- 多图合成
- URL 输入图
- Data URI Base64 输入图
- URL 输出
- Base64 输出
- 生成结果自动上传 OSS

当前图像请求支持：

- `model`
- `prompt`
- `size`
- `image`
- `images`
- `imageUrl`
- `imageUrls`
- `imageDataUrl`
- `returnBase64` / `return_base64`
- `responseFormat` / `response_format`
- `extraBody` / `extra_body`

Agnes Image 文档要求：

- 图生图、多图合成的输入图片放在 `extra_body.image`。
- `response_format` 放在 `extra_body.response_format`，不要放在顶层。
- 当前实现已经按这个规则发送。

### Video / 视频生成

核心文件：

- `src/providers/agnes/videoClient.js`
- `src/providers/agnes/videoPrompt.js`
- `src/langchain/chains/videoRunnable.js`
- `src/services/videoService.js`
- `src/controllers/videoController.js`

当前支持工作流：

- 文生视频
- 图生视频
- 多图生视频
- 首尾帧 / keyframes
- Data URI / Base64 输入图先上传 OSS，再把 OSS 可访问 URL 传给 Agnes
- 生成视频完成后自动上传 OSS
- 轮询 Agnes 视频任务结果
- 请求和最终响应写入 SQLite

当前视频请求支持：

- `model`
- `prompt`
- `scene`
- `subject`
- `action`
- `camera`
- `lighting`
- `image`
- `imageUrl`
- `imageDataUrl`
- `imageBase64`
- `images`
- `imageUrls`
- `imageDataUrls`
- `keyframes`
- `keyframeDataUrls`
- `mode`
- `extraMode`
- `width`
- `height`
- `numFrames` / `num_frames`
- `frameRate` / `frame_rate`
- `numInferenceSteps` / `num_inference_steps`
- `seed`
- `negativePrompt` / `negative_prompt`
- `extraBody` / `extra_body`

视频参数校验：

- `width`、`height` 必须是正整数。
- `num_frames` 必须是 `1-441` 的整数。
- `num_frames` 必须满足 `8n + 1`，例如 `121`。
- `frame_rate` 必须是 `1-30` 的整数。
- `num_inference_steps` 必须是正整数。
- `seed` 必须是整数。

请求结构对应 Agnes 文档：

- 文生视频：顶层传 `prompt`、`width`、`height`、`num_frames`、`frame_rate`。
- 图生视频：顶层传 `image`。
- 多图输入：放入 `extra_body.image`。
- Keyframes：放入 `extra_body.image`，并设置 `extra_body.mode = "keyframes"`。

## 2. 数据库记录

核心文件：

- `src/storage/sqlite.js`
- `src/storage/runRepository.js`
- `sql/schema.sql`

每次接口调用都会写入 `chain_runs`：

- `request_id`
- `kind`
- `endpoint`
- `method`
- `status`
- `http_status`
- `request_json`
- `response_json`
- `error_message`
- `started_at`
- `finished_at`
- `elapsed_ms`
- `created_at`
- `updated_at`

项目只把请求和响应存入 SQLite，不把生成图片或视频文件保存到本地。媒体文件会上传到 OSS，数据库里保存返回 JSON 中的 OSS 链接和 objectKey。

## 3. OSS 资源保存

核心文件：

- `src/oss.js`
- `src/oss/bitifulClient.js`
- `src/services/assetService.js`

当前保存规则：

- 上传用户输入的 Data URI / Base64 图片到 OSS。
- 上传生成图片到 OSS。
- 上传生成视频到 OSS。
- 返回 `objectKey`、签名访问链接、contentType、sizeBytes。

## 4. 前端链路

核心文件：

- `public/index.html`
- `public/app.js`
- `public/js/apiClient.js`
- `public/js/taskSubmit.js`
- `public/js/polling.js`
- `public/js/previewRenderer.js`
- `public/js/runList.js`
- `public/js/tabs.js`

前端职责：

- 左侧 tag 切换 Chat / Image / Video。
- 中间显示当前模型输入表单。
- 右侧显示 Task Monitor。
- 提交任务后自动轮询状态。
- 支持手动查询任务。
- 查询结果区域支持文字、图片、视频预览。

## 5. 当前模块边界

```text
src/
  app/                  # Express 应用组装
  routes/               # API 路由
  controllers/          # HTTP 参数和响应
  services/             # 业务流程和任务状态
  langchain/
    models/             # LangChain 模型封装
    prompts/            # Prompt 和消息构造
    parsers/            # 输出解析
    chains/             # Chain / Runnable 编排
    tools/              # 工具 schema 和执行器
  providers/agnes/      # Agnes 原始 API 客户端
  storage/              # SQLite 连接和 repository
  oss/                  # OSS 客户端
  utils/                # 通用工具
```

这个拆法避免了一个文件里同时写模型、提示词、SQL、OSS 和路由。

## 6. 还没接入的 LangChain / LangGraph 模块

### Models

已接入：

- Chat Model
- 自定义 Image Runnable
- 自定义 Video Runnable

未接入：

- Embedding Models：用于 RAG 检索。
- Audio Models：语音识别、语音合成。
- Model fallback / retry：主模型失败后切换备用模型。
- Streaming：边生成边返回 token。

### Prompts

已接入：

- ChatPromptTemplate
- 自定义多模态消息构造

未接入：

- PromptTemplate
- Few-shot Prompt Templates
- MessagesPlaceholder
- partial variables

### Output Parsers

已接入：

- StringOutputParser

未接入：

- JsonOutputParser
- StructuredOutputParser
- Zod schema parser
- List parser
- Retry / fixing parser

### Runnables / LCEL

已接入：

- RunnableSequence
- RunnableLambda

未接入：

- RunnableMap
- RunnablePassthrough
- RunnableBranch
- batch
- stream
- withConfig 的 tags / metadata / callbacks

### Memory

未接入：

- Chat message history
- Conversation memory
- SQLite / Redis / Postgres 持久化记忆

### Retrieval / RAG

未接入：

- Document Loaders
- Text Splitters
- Embeddings
- Vector Stores
- Retrievers
- Contextual compression
- RAG chain

### Tools / Agents

部分接入：

- 已接入本地工具调用示例 `get_weather`。

未接入：

- DynamicStructuredTool
- Tool-calling Agent
- ReAct Agent
- AgentExecutor
- 多工具规划
- 中间步骤记录

### LangGraph

未接入：

- StateGraph
- Nodes / Edges
- Conditional edges
- Checkpointer
- Human-in-the-loop
- Interrupt / resume
- Multi-agent
- Long-term memory

### Observability / Evaluation

未接入：

- callbacks
- LangSmith tracing
- token 成本统计
- 数据集评测
- RAG 检索质量评估

### Production

未接入：

- 限流
- 队列
- 重试
- 超时取消
- 用户隔离
- 权限
- 多租户
- 密钥管理
- 成本统计

## 7. 建议学习顺序

1. Chat Model + Prompt + Parser + Runnable
2. Streaming
3. Structured Output
4. Message History
5. Tools
6. Agent
7. RAG
8. LangGraph StateGraph
9. LangGraph Checkpointer
10. LangSmith tracing / evaluation

## 8. 官方资料

- LangChain JS 文档：https://js.langchain.com/
- LangChain Expression Language：https://js.langchain.com/docs/concepts/lcel/
- LangGraph JS 文档：https://langchain-ai.github.io/langgraphjs/
