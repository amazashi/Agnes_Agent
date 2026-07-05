# Agnes Agent / LangChain JS SQLite Workbench

这是一个用于学习和验证 LangChain.js 架构的 Node.js 工作台，已经接入 Agnes 的文本、图片、视频能力，并使用 SQLite 记录每次请求和最终响应。

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

## 当前能力

- Chat 普通异步请求
- Chat stream 流式返回
- 图片生成、图生图、多图输入
- 视频生成、图生视频、多图/keyframes 参数链路
- 图片拖拽/点击上传 OSS
- 生成图片和视频上传 OSS
- SQLite 保存请求、响应、状态、错误和耗时
- 前端轮询任务状态
- 文本、图片、视频结果预览

## API

创建 Chat 任务：

```text
POST /api/chat/requests
```

创建 Chat 流式任务：

```text
POST /api/chat/stream
```

创建图片任务：

```text
POST /api/image/requests
```

创建视频任务：

```text
POST /api/video/requests
```

查询任务：

```text
GET /api/chat/requests/:requestId
GET /api/image/requests/:requestId
GET /api/video/requests/:requestId
GET /api/runs?limit=20
```

上传输入图片到 OSS：

```text
POST /api/assets/upload
```

## 文档

- [LangChain 学习文档](docs/LANGCHAIN_LEARNING.md)
- [请求链路学习文档](docs/REQUEST_CHAIN_GUIDE.md)
- [XHS 长任务断点续做策略](docs/XHS_RESUME_STRATEGY.md)
- [项目过程记录](docs/PROJECT_PROGRESS.md)

## Git 进度规则

每次 push 前先更新：

```text
docs/PROJECT_PROGRESS.md
```

然后执行：

```bash
npm run check
git status
git add .
git commit -m "描述本次进度"
git push
```
