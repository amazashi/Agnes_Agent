# Agnes Agent 项目过程记录

这份文档用于记录项目当前进度。以后每次 push 前，都先更新这里，说明本次完成了什么、验证了什么、下一步做什么。

## 当前阶段

阶段：`v0.2 小红书视频链路接入中`

当前项目已经完成一个可运行的 LangChain.js + Agnes + SQLite + OSS 工作台：

- 支持文本对话任务。
- 支持文本流式返回。
- 支持图片生成、图生图、多图输入。
- 支持视频生成、图生视频、多图/keyframes 参数链路。
- 支持图片拖拽/点击上传到 OSS。
- 支持生成图片和视频上传到 OSS。
- 支持每次请求和最终响应写入 SQLite。
- 支持前端轮询任务状态。
- 支持任务结果预览：文字、图片、视频。
- 支持小红书 30s 打粉视频链路：热词/关键词 -> 分镜构思 -> 角色设定 -> AI 出图 -> 图生视频。
- 已初始化 Git，并推送到 GitHub。

## 已完成模块

### 1. 项目基础

- Node.js ESM 项目。
- 原生 HTTP server。
- SQLite 数据库。
- LangChain.js 依赖。
- Agnes provider 分层。
- OSS 上传封装。

核心文件：

- `src/server.js`
- `src/app/server.js`
- `src/routes/apiRoutes.js`
- `src/storage/sqlite.js`
- `src/storage/runRepository.js`

### 2. 数据库任务记录

已完成：

- 创建任务时写入 `pending`。
- 异步开始时更新 `running`。
- 成功时写入 `succeeded + response_json`。
- 失败时写入 `failed + error_message`。
- 保存请求体 `request_json`。
- 保存耗时 `elapsed_ms`。

核心文件：

- `sql/schema.sql`
- `src/services/runService.js`
- `src/storage/runRepository.js`

### 3. Chat 文本模型

已完成：

- Agnes OpenAI-compatible chat 接入。
- 普通异步 Chat。
- Stream Chat。
- Tool calling 示例。
- 图像理解输入格式。
- 请求和响应入库。

核心文件：

- `src/providers/agnes/chatClient.js`
- `src/langchain/models/agnesChatModel.js`
- `src/langchain/chains/chatChain.js`
- `src/controllers/chatController.js`
- `src/controllers/chatStreamController.js`

### 4. Image 图片模型

已完成：

- `agnes-image-2.0-flash`
- `agnes-image-2.1-flash`
- 文生图。
- 图生图。
- 多图合成。
- URL 输出。
- Base64 输出。
- 生成结果上传 OSS。
- 上传后的 OSS 链接写入响应。

核心文件：

- `src/providers/agnes/imageClient.js`
- `src/langchain/chains/imageRunnable.js`
- `src/services/imageService.js`
- `src/controllers/imageController.js`

### 5. Video 视频模型

已完成：

- `agnes-video-v2.0`
- 文生视频。
- 图生视频参数链路。
- 多图/keyframes 参数链路。
- 视频参数校验。
- 远端视频任务轮询。
- 生成视频上传 OSS。
- OSS 视频链接写入响应。

核心文件：

- `src/providers/agnes/videoClient.js`
- `src/providers/agnes/videoPrompt.js`
- `src/langchain/chains/videoRunnable.js`
- `src/services/videoService.js`
- `src/controllers/videoController.js`

### 6. 前端工作台

已完成：

- Chat/Image/Video 三个任务面板。
- 图片拖拽上传。
- 点击按钮上传图片。
- Stream 文本实时显示。
- 任务状态轮询。
- 任务历史列表。
- 文本/图片/视频预览。

### 7. 小红书 30s 视频链路

已完成：

- 新增 XHS 前端 tag。
- 支持输入一个关键词。
- 关键词为空时由文本模型推荐热词。
- 文本模型生成分镜构思。
- 文本模型生成角色设定。
- 文本模型生成图片提示词和视频提示词。
- 默认提示词要求图片和视频中不要出现文字、字幕、logo、水印、标牌、海报、UI 文本。
- 图片模型生成无字视觉封面/参考图。
- 视频模型基于参考图生成多段连续短视频。
- 每一段会抽取上一段最后一帧，作为下一段图生视频的输入图。
- 最后使用 ffmpeg 临时拼接多段视频并上传 OSS，临时文件会删除。
- 由于 Agnes 视频限制 `num_frames <= 441` 且 `8n + 1`，默认使用 `5 段 * 121 frames / 20 fps = 30.25s`。
- 每段视频生成遇到上游 `503 / busy / timeout` 会自动重试。
- XHS 任务请求和最终响应写入 SQLite。

核心文件：

- `src/langchain/prompts/xhsVideoPrompt.js`
- `src/langchain/chains/xhsVideoChain.js`
- `src/services/xhsService.js`
- `src/controllers/xhsController.js`
- `src/routes/apiRoutes.js`
- `public/index.html`
- `public/app.js`
- `public/js/previewRenderer.js`

核心文件：

- `public/index.html`
- `public/app.js`
- `public/js/taskSubmit.js`
- `public/js/uploadZones.js`
- `public/js/polling.js`
- `public/js/previewRenderer.js`
- `public/styles.css`

## 已验证内容

### 代码检查

最近一次完整检查：

```bash
npm run check
```

结果：通过。

### API 验证

已验证：

- Chat stream 可以返回 `start / delta / done`。
- Chat stream 完整结果可以写入 SQLite。
- 图片上传接口可以把 Data URL 上传到 OSS。
- 文生视频可以创建、轮询完成、上传 OSS，并写入 SQLite。
- XHS 链路新增代码已通过 `npm run check`。
- XHS 短帧数冒烟测试已通过：`db1fb8ab-6bfb-4c8e-8b2a-6123722d2f9c`。
- XHS 冒烟测试完成了文本规划、AI 出图、图生视频、OSS 上传、SQLite 入库。
- XHS 单段拼接测试已通过：`a6c5d425-e912-4922-adcd-04d3ece2b3e3`。

已知未完全覆盖的验证：

- 图生视频完整生成。
- 多图/keyframes 视频完整生成。
- 工具调用 + stream 的组合。
- XHS 30s 完整生成链路。当前只验证了短帧数链路，默认 30s 配置为 `5 * 121 frames / 20 fps = 30.25s`。
- XHS 2 段连续性测试遇到 Agnes 上游 `503 Service busy`，已补重试机制。

## 当前 Git 状态

远程仓库：

```text
https://github.com/amazashi/Agnes_Agent.git
```

当前主分支：

```text
main
```

当前基线提交：

```text
f9f0340 Initial langchain sqlite workbench
```

## 后续计划

### P0：稳定性

- 给远端 Agnes API 调用补更细的超时和错误分类。
- 给 OSS 上传失败增加更清晰的错误提示。
- 前端显示上传失败、任务失败、参数错误的结构化提示。
- 给 XHS 链路增加更细的阶段状态，例如 planning、image_generating、video_generating。

### P1：视频能力验证

- 实测 XHS 30s 视频完整链路。
- 实测图生视频完整链路。
- 实测多图视频完整链路。
- 实测 keyframes 视频完整链路。
- 把测试 requestId 和结果记录进本文档。

### P2：LangChain 学习模块

- 增加 Structured Output 示例。
- 增加 Message History 示例。
- 增加 RAG 示例。
- 增加 Agent / Tool-calling Agent 示例。
- 增加 LangGraph StateGraph 示例。

### P3：工程化

- 增加统一参数校验层。
- 增加更细粒度日志。
- 增加测试脚本。
- 增加 GitHub Actions。
- 增加 README 快速启动说明。

## 每次 Push 前的更新流程

以后每次 push 前按这个顺序做：

1. 更新本文件的“当前阶段”“已完成模块”“已验证内容”“后续计划”。
2. 执行：

```bash
npm run check
```

3. 查看 Git 状态：

```bash
git status
```

4. 提交：

```bash
git add .
git commit -m "描述本次进度"
```

5. 推送：

```bash
git push
```

## 更新日志

### 2026-07-05

- 建立项目进度文档。
- 记录当前工作台能力。
- 记录已验证接口和后续计划。
- 新增小红书 30s 打粉视频链路规划和代码接入。
- 新增 XHS 前端 tag。
- 新增 XHS 链路文案约束：图片和视频内禁止出现文字。
- 完成 XHS 短帧数冒烟测试，确认链路可以跑通并写入 SQLite。
- 修正 XHS 视频生成策略：从单个低 fps 视频改为多段连续图生视频。
- 增加 ffmpeg 抽取上一段最后一帧，并作为下一段输入图。
- 增加 ffmpeg 拼接最终视频并上传 OSS。
- 增加 XHS 分段视频生成重试机制。
