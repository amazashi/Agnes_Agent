# XHS 长任务断点续做与重试策略

XHS 30s 视频链路是长任务，不应该只依赖内存一次跑完。当前链路已经按“阶段检查点”设计，支持失败后从已完成阶段继续。

## 为什么需要断点续做

XHS 链路包含：

1. 文本模型生成热词、分镜、角色设定。
2. 图片模型生成参考图。
3. 视频模型生成第 1 段。
4. 抽取第 1 段最后一帧。
5. 用上一段最后一帧生成下一段。
6. 重复多段。
7. ffmpeg 拼接最终视频。
8. 上传 OSS。

其中视频模型可能等待很久，也可能遇到上游 `503 Service busy`、timeout、网络中断、Node 进程重启等问题。

## 当前实现

### 1. 运行中保存进度

每完成一个阶段，都会把当前进度写入 `chain_runs.response_json`。

实现位置：

- `src/services/runService.js`
- `src/storage/runRepository.js`
- `src/langchain/chains/xhsVideoChain.js`

进度字段：

- `statusDetail`
- `plan`
- `imageResult`
- `ossImages`
- `segmentConfig`
- `videoSegments`
- `transitionFrames`
- `ossVideo`

### 2. 失败不清空进度

失败时：

- `status` 更新为 `failed`
- `error_message` 写入错误
- 已经保存的 `response_json` 保留

这样可以看到任务失败前已经完成到哪一步。

### 3. Resume API

失败后可以调用：

```text
POST /api/xhs/requests/:requestId/resume
```

它会读取原始 `request_json` 和已有 `response_json`，然后从 checkpoint 继续。

### 4. Chain 内部跳过已完成阶段

resume 时会跳过：

- 已完成的文本规划。
- 已完成的图片生成。
- 已完成的视频段。
- 已完成的过渡帧。
- 已完成的最终视频拼接。

如果某段视频已经完成，但最后一帧还没抽取，resume 会先补抽这一帧，再继续下一段。

### 5. Retry

视频段生成和图片生成有轻量重试：

- 匹配 `503`
- 匹配 `busy`
- 匹配 `timeout`
- 匹配 `temporary`
- 匹配 `rate`

每次失败后等待一段时间再重试。

## 当前还不是完整队列系统

当前实现适合本地学习和中小规模任务，但还不是生产级任务队列。

生产级建议继续补：

- 独立 `chain_run_steps` 表，每一步单独入库。
- 后台 worker 进程。
- 任务锁，避免同一个 requestId 被两个 worker 同时 resume。
- 最大重试次数入库。
- 每段视频任务创建后，把 Agnes `task_id/video_id` 单独保存，进程重启后继续 poll，而不是重新创建该段。
- 心跳字段，用于识别卡死任务。
- 定时扫描 `running` 但长时间未更新的任务，自动 resume。

## 推荐的数据表升级方向

后续可以新增：

```sql
CREATE TABLE chain_run_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL,
  step_key TEXT NOT NULL,
  status TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 0,
  request_json TEXT,
  response_json TEXT,
  error_message TEXT,
  started_at TEXT,
  finished_at TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(request_id, step_key)
);
```

这样每一步都可以独立重试：

- `plan`
- `cover_image`
- `segment_1_video`
- `segment_1_last_frame`
- `segment_2_video`
- `segment_2_last_frame`
- `concat_final`

当前版本先用 `chain_runs.response_json` 做 checkpoint，代码更轻，适合学习和快速迭代。
