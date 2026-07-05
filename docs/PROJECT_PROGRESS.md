# Agnes Agent 项目过程记录

这个文档用于记录项目当前进度。以后每次 push 前，先更新这里，说明本次完成内容、验证情况和下一步计划。

## 当前阶段

阶段：`v0.3 XHS 小红书视频链路稳定性与人物一致性`

当前项目是一个可运行的 `LangChain.js + Agnes + SQLite + OSS` 工作台，已经支持：

- 文本对话任务和 stream 返回。
- 图片生成、图生图、多图合成。
- 视频生成、图生视频、keyframes 参数链路。
- 图片拖拽/点击上传到 OSS。
- 生成图片和视频上传到 OSS。
- 每次任务请求、进度 checkpoint、最终响应写入 SQLite。
- 前端轮询任务状态，并预览文字、图片、视频结果。
- XHS 30s 视频链路：关键词/热词 -> 分镜构思 -> 角色设定 -> 人物参考图 -> 封面图 -> 多段图生视频 -> 拼接最终视频。

## 核心模块

### 1. 服务入口与路由

- `src/server.js`
- `src/app/server.js`
- `src/routes/apiRoutes.js`

### 2. SQLite 任务记录

- `sql/schema.sql`
- `src/services/runService.js`
- `src/storage/runRepository.js`

记录内容：

- `request_json`：前端提交的请求参数。
- `response_json`：运行中的 checkpoint 和最终响应。
- `status`：pending / running / succeeded / failed。
- `error_message`：失败原因。
- `elapsed_ms`：耗时。

### 3. Agnes Provider

- `src/providers/agnes/chatClient.js`
- `src/providers/agnes/imageClient.js`
- `src/providers/agnes/videoClient.js`
- `src/providers/agnes/agnesConfig.js`

### 4. LangChain / Runnable

- `src/langchain/models/agnesChatModel.js`
- `src/langchain/chains/chatChain.js`
- `src/langchain/chains/imageRunnable.js`
- `src/langchain/chains/videoRunnable.js`
- `src/langchain/chains/xhsVideoChain.js`
- `src/langchain/prompts/xhsVideoPrompt.js`

### 5. 前端工作台

- `public/index.html`
- `public/app.js`
- `public/js/taskSubmit.js`
- `public/js/uploadZones.js`
- `public/js/polling.js`
- `public/js/previewRenderer.js`
- `public/styles.css`

## XHS 链路现状

已完成：

- 新增 XHS 前端 tag。
- 支持输入关键词，留空时由文本模型推荐热词。
- 文本模型生成分镜、角色设定、图片提示词、视频提示词。
- 默认提示词限制图片和视频中不要出现文字、字幕、logo、水印、标牌、海报、UI 文本。
- 新增人物参考图阶段：先生成一个稳定人物图片，并上传 OSS。
- 封面图阶段使用人物参考图作为图生图参考，增强人物一致性。
- 视频分段生成时，提示词要求保持同一人物身份、脸、服装和风格。
- 每段视频完成后抽取最后一帧，并作为下一段视频的第一张输入图。
- 最终使用 ffmpeg 临时拼接多段视频，上传 OSS，临时文件会删除。
- 支持 checkpoint：规划、人物图、封面图、每段视频、过渡帧、最终视频都会写入 SQLite。
- 支持失败后 `POST /api/xhs/requests/:requestId/resume` 断点续做。
- 前端结果区显示人物提示词、图片提示词、视频提示词、分段提示词 JSON、负面提示词，并支持编辑后继续处理。

当前推荐参数：

- 默认 30s：`5 段 * 121 frames / 20 fps = 30.25s`
- 60fps 接近 30s：`5 段 * 361 frames / 60 fps = 30.08s`

## 本次更新

日期：2026-07-06

- 新增 XHS 人物参考图生成阶段。
- XHS checkpoint 增加 `characterInput`、`characterResult`、`ossCharacterImages`。
- 封面图生成自动引用人物参考图 OSS URL。
- 前端 XHS 表单新增 `Character Reference Prompt` 和 `Character Size`。
- 前端 XHS 预览区新增人物参考图展示。
- 前端 XHS 提示词编辑器新增人物参考提示词。
- 修复 `public/index.html` 与 `public/js/previewRenderer.js` 乱码导致的结构风险。
- OSS 签名刷新逻辑支持人物参考图。

## 验证记录

本次已执行：

```bash
node --check public/js/previewRenderer.js
node --check src/langchain/chains/xhsVideoChain.js
node --check src/langchain/prompts/xhsVideoPrompt.js
npm run check
```

## 后续计划

### P0 稳定性

- 实测新人物一致性链路，确认人物参考图、封面图、视频段都写入 SQLite。
- 检查 XHS resume 时编辑人物提示词是否会按预期影响未完成步骤。
- 对 Agnes 视频长时间 pending 增加更清晰的超时与用户提示。

### P1 视频质量

- 实测 60fps / 361 frames 参数。
- 对比“人物参考图 + 上一段末帧”与旧链路的视频一致性。
- 根据实际输出继续简化视频提示词。

### P2 LangChain 学习模块

- 增加 Structured Output 示例。
- 增加 Message History 示例。
- 增加 RAG 示例。
- 增加 Agent / Tool-calling Agent 示例。
- 增加 LangGraph StateGraph 示例。

## Push 前流程

1. 更新本文件。
2. 执行：

```bash
npm run check
```

3. 检查 git 状态：

```bash
git status
```

4. 提交并推送：

```bash
git add .
git commit -m "描述本次进度"
git push
```
