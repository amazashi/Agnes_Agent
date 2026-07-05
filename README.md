# LangChain JS SQLite Workbench

一个用于学习 LangChain.js 的项目，已迁移 `activation-llm-gateway` 的语言、图片、视频生成能力。

## 启动

```powershell
cd E:\yunxiang\langchain-js-sqlite-workbench
copy .env.example .env
npm install
npm start
```

打开：

```text
http://localhost:8930
```

## API

### 创建语言 Chain 任务

`POST /api/chat/requests`

```json
{
  "model": "agnes-2.0-flash",
  "systemPrompt": "You are a helpful assistant.",
  "question": "用一句话解释 LangChain 的 Runnable 是什么。"
}
```

### 查询任务

```text
GET /api/chat/requests/:requestId
GET /api/image/requests/:requestId
GET /api/video/requests/:requestId
```

### 创建图片 Runnable 任务

`POST /api/image/requests`

```json
{
  "prompt": "minimal LangChain workflow dashboard icon",
  "size": "1024x1024"
}
```

图片完成后会自动上传 OSS，响应里保留 `ossImages`。

### 创建视频 Runnable 任务

`POST /api/video/requests`

```json
{
  "scene": "clean modern LangChain workflow studio",
  "subject": "a soft clay-style AI workflow dashboard",
  "action": "nodes connect and animate smoothly",
  "camera": "slow cinematic push-in",
  "lighting": "bright soft studio lighting"
}
```

视频完成后会自动上传 OSS，响应里保留 `ossVideo`。

### 查看最近任务

`GET /api/runs?limit=20`

## 学习文档

见：

`docs/LANGCHAIN_LEARNING.md`
