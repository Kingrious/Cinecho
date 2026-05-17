# Seedance 2.0 查询视频生成任务 API 整理

来源：火山引擎方舟官方文档「查询视频生成任务 API」

原文链接：https://www.volcengine.com/docs/82379/1521309?lang=zh

官方更新时间：2026-04-25 18:45:21（北京时间）

整理时间：2026-05-17

## 1. 接口概览

### 1.1 查询任务接口

```http
GET https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/{id}
```

这个接口用于查询视频生成任务的当前状态和结果。它通常配合「创建视频生成任务 API」一起使用：

1. 先调用创建接口，拿到任务 `id`
2. 再轮询本接口，直到任务进入终态
3. 当状态为 `succeeded` 时，从响应里读取 `content.video_url`

### 1.2 查询时效

官方说明：仅支持查询最近 7 天的历史数据。

时间规则：

| 项目 | 说明 |
|---|---|
| 时间基准 | 统一按 UTC 计算 |
| 可查范围 | `[T-7天, T)` |
| 精度 | 到秒 |

这意味着：

| 情况 | 结果 |
|---|---|
| 任务创建未超过 7 天 | 可以查询 |
| 任务创建已超过 7 天 | 任务可能已被清理，无法再查 |

### 1.3 鉴权方式

本接口支持 API Key 鉴权。

请求头示例：

```http
Authorization: Bearer ${ARK_API_KEY}
```

## 2. 请求参数

### 2.1 路径参数 `id`

类型：`string`

必填：是

说明：要查询的视频生成任务 ID。

这是创建任务接口返回的 `id`，例如：

```text
cgt-20250331175019-68d9t
```

示例请求：

```http
GET https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/cgt-20250331175019-68d9t
Authorization: Bearer ${ARK_API_KEY}
```

## 3. 响应结构总览

查询成功时，接口返回的是一个任务对象。核心字段大致如下：

```json
{
  "id": "cgt-20250331175019-68d9t",
  "model": "doubao-seedance-2-0-260128",
  "status": "running",
  "error": null,
  "created_at": 1743414619,
  "updated_at": 1743414625,
  "content": {
    "video_url": "https://...",
    "last_frame_url": "https://..."
  },
  "seed": 11,
  "resolution": "720p",
  "ratio": "16:9",
  "duration": 5,
  "generate_audio": true,
  "service_tier": "default",
  "execution_expires_after": 172800,
  "usage": {
    "completion_tokens": 12345,
    "total_tokens": 12345
  }
}
```

注意：不是所有字段都会在所有任务里返回。比如：

| 字段 | 返回条件 |
|---|---|
| `content.video_url` | 通常在成功后返回 |
| `content.last_frame_url` | 创建任务时传了 `return_last_frame: true` 才会返回 |
| `generate_audio` | 仅 Seedance 2.0 / 2.0 fast / 1.5 pro 等支持音频的模型返回 |
| `draft` | 仅 Seedance 1.5 pro Draft 场景返回 |
| `draft_task_id` | 基于 Draft 生成正式视频时返回 |
| `tools` / `usage.tool_usage` | 开启并实际使用工具时返回 |

## 4. 任务状态字段

### 4.1 `status`

类型：`string`

说明：任务当前状态。

官方枚举值：

| 状态 | 含义 |
|---|---|
| `queued` | 排队中 |
| `running` | 运行中 |
| `cancelled` | 已取消，仅支持取消排队中的任务；取消状态保留约 4 小时后自动删除 |
| `succeeded` | 任务成功 |
| `failed` | 任务失败 |
| `expired` | 任务超时 |

### 4.2 轮询建议

工程上可以把状态分成两类：

| 分类 | 状态 |
|---|---|
| 非终态 | `queued`、`running` |
| 终态 | `cancelled`、`succeeded`、`failed`、`expired` |

建议逻辑：

1. `queued`：继续轮询
2. `running`：继续轮询
3. `succeeded`：读取结果并结束
4. `failed`：读取 `error` 并结束
5. `expired`：提示任务超时并结束
6. `cancelled`：视为结束态

## 5. 错误字段

### 5.1 `error`

类型：`object | null`

说明：

| 情况 | 值 |
|---|---|
| 任务成功 | `null` |
| 任务失败 | 错误对象 |

结构：

```json
{
  "code": "SomeErrorCode",
  "message": "错误说明"
}
```

字段说明：

| 字段 | 类型 | 说明 |
|---|---|---|
| `error.code` | `string` | 错误码 |
| `error.message` | `string` | 错误提示文本 |

工程建议：

| 场景 | 建议 |
|---|---|
| 前端用户提示 | 优先展示 `error.message` |
| 排查/日志 | 同时记录 `error.code` 与 `error.message` |
| 自动重试 | 先区分是否是网络层错误还是任务本身失败 |

## 6. 时间字段

### 6.1 `created_at`

类型：`integer`

说明：任务创建时间的 Unix 时间戳，单位秒。

### 6.2 `updated_at`

类型：`integer`

说明：任务当前状态最后一次更新时间的 Unix 时间戳，单位秒。

工程建议：

| 用途 | 建议 |
|---|---|
| 前端展示 | 转换为本地时区显示 |
| 排序 | 可以按 `updated_at` 或 `created_at` 排序 |
| 超时分析 | 与当前时间对比，判断任务是否卡住 |

## 7. 输出内容字段

### 7.1 `content`

类型：`object`

说明：视频生成任务的输出内容对象。

### 7.2 `content.video_url`

类型：`string`

说明：生成视频的 URL，格式为 `mp4`。

有效期：

| 字段 | 有效期 |
|---|---|
| `content.video_url` | 24 小时 |

官方说明：视频结果 24 小时后会被清理，建议及时转存。文档特别推荐把结果转存到自有 TOS，用于长期备份或二次处理。

工程建议：

1. 不要把这个 URL 当永久地址保存
2. 任务成功后尽快下载到本地或转存到对象存储
3. 如果产品里有历史记录页，最好保存本地路径或自己的持久化 URL

### 7.3 `content.last_frame_url`

类型：`string`

说明：视频尾帧图像 URL。

返回条件：创建任务时传入了

```json
"return_last_frame": true
```

有效期：

| 字段 | 有效期 |
|---|---|
| `content.last_frame_url` | 24 小时 |

典型用途：

| 场景 | 用法 |
|---|---|
| 连续镜头生成 | 把当前视频尾帧作为下一个视频的首帧 |
| 自动拼镜头工作流 | 作为下一镜头的参考图 |
| UI 预览 | 让用户快速看到结尾画面 |

## 8. 任务生成配置回显字段

这些字段用于回显本次任务实际使用的生成配置，便于前端展示、日志记录和复用任务参数。

### 8.1 `model`

类型：`string`

说明：任务使用的模型名称与版本，例如：

```text
doubao-seedance-2-0-260128
```

### 8.2 `seed`

类型：`integer`

说明：本次请求实际使用的种子值。

用途：

| 用途 | 说明 |
|---|---|
| 复现相似结果 | 记录后再次生成时可复用 |
| 历史记录 | 给用户展示生成参数 |

### 8.3 `resolution`

类型：`string`

说明：生成视频的分辨率，例如 `720p`、`1080p`。

### 8.4 `ratio`

类型：`string`

说明：生成视频的宽高比，例如 `16:9`、`9:16`、`adaptive` 最终落地的比例。

这点很有用，因为如果创建任务时传的是 `adaptive`，最终实际比例可以通过查询接口的 `ratio` 得到。

### 8.5 `duration`

类型：`integer`

说明：生成视频时长，单位秒。

注意：`duration` 和 `frames` 不会同时返回。

返回规则：

| 创建任务时传参 | 查询结果返回 |
|---|---|
| 未指定 `frames` | 返回 `duration` |
| 指定了 `frames` | 可能只返回 `frames` |

### 8.6 `frames`

类型：`integer`

说明：生成视频的帧数。

文档说明：`duration` 和 `frames` 只会返回一个。如果创建任务时指定了 `frames`，则查询时返回 `frames`。

### 8.7 `framespersecond`

类型：`integer`

说明：生成视频的帧率。

工程用途：

| 用途 | 说明 |
|---|---|
| 计算精确时长 | 可与 `frames` 联动 |
| 导出到剪辑工具 | 可用于时间轴换算 |

### 8.8 `generate_audio`

类型：`boolean`

说明：生成的视频是否包含与画面同步的声音。

仅以下模型会返回该字段：

| 模型 | 返回情况 |
|---|---|
| Seedance 2.0 |
| Seedance 2.0 fast |
| Seedance 1.5 pro |

取值：

| 值 | 含义 |
|---|---|
| `true` | 有声视频 |
| `false` | 无声视频 |

这对 Cinecho 很重要，因为我们可以通过查询结果确认最终生成的是不是有声版本，而不只依赖本地请求参数。

### 8.9 `draft`

类型：`boolean`

说明：当前输出是否为 Draft 视频。

仅 Seedance 1.5 pro 返回。

| 值 | 含义 |
|---|---|
| `true` | 当前输出是 Draft 视频 |
| `false` | 当前输出是正常视频 |

### 8.10 `draft_task_id`

类型：`string`

说明：Draft 视频任务 ID。基于 Draft 视频生成正式视频时返回。

### 8.11 `service_tier`

类型：`string`

说明：任务实际使用的服务等级，例如 `default`。

### 8.12 `execution_expires_after`

类型：`integer`

说明：任务超时阈值，单位秒。

可以用来判断这次任务被设置了多长的过期时间。

## 9. 工具相关字段

### 9.1 `tools`

类型：`object[]`

说明：本次请求里模型实际使用过的工具。未使用工具时不返回。

当前文档列出的工具类型：

| 字段 | 说明 |
|---|---|
| `tools[].type = web_search` | 联网搜索工具 |

这意味着：

| 情况 | 含义 |
|---|---|
| 请求里配置了 `tools`，但查询结果里没有 `tools` | 可能模型没有实际用到工具 |
| 查询结果里有 `tools` | 表示模型在本次任务中确实用了这些工具 |

### 9.2 `safety_identifier`

类型：`string`

说明：终端用户唯一标识。

如果创建任务时传了 `safety_identifier`，查询接口会原样返回，适合：

| 用途 | 说明 |
|---|---|
| 审计 | 关联到终端用户 |
| 风控 | 与内部用户 ID 做映射 |
| 历史任务归属 | 查询时确认是谁发起的 |

## 10. 用量字段

### 10.1 `usage`

类型：`object`

说明：本次请求的 token 用量信息。

### 10.2 `usage.completion_tokens`

类型：`integer`

说明：模型输出视频消耗的 token 数量，可用于计费对账。

文档强调：Seedance 2.0 系列存在最小 token 用量限制。如果实际 token 用量低于最小值，这个字段会直接返回最小 token 用量，平台也按最小 token 用量计费。

这意味着：

| 场景 | 结果 |
|---|---|
| 实际消耗大于最小值 | 返回实际 completion_tokens |
| 实际消耗小于最小值 | 返回最小 token 用量 |

### 10.3 `usage.total_tokens`

类型：`integer`

说明：本次请求总 token 数量。

视频生成模型不统计输入 token，因此：

```text
total_tokens = completion_tokens
```

### 10.4 `usage.tool_usage`

类型：`object`

说明：工具使用统计信息。

当前文档列出的字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `usage.tool_usage.web_search` | `integer` | 联网搜索工具实际调用次数 |

如果开了联网搜索，这个字段可以帮助我们区分：

| 值 | 含义 |
|---|---|
| `0` | 本次任务没有实际搜索 |
| `> 0` | 模型进行了若干次搜索 |

## 11. 典型响应示例

### 11.1 运行中

```json
{
  "id": "cgt-20250331175019-68d9t",
  "model": "doubao-seedance-2-0-260128",
  "status": "running",
  "error": null,
  "created_at": 1743414619,
  "updated_at": 1743414625
}
```

### 11.2 成功

```json
{
  "id": "cgt-20250331175019-68d9t",
  "model": "doubao-seedance-2-0-260128",
  "status": "succeeded",
  "error": null,
  "created_at": 1743414619,
  "updated_at": 1743414655,
  "content": {
    "video_url": "https://example.com/output.mp4",
    "last_frame_url": "https://example.com/last-frame.png"
  },
  "resolution": "720p",
  "ratio": "16:9",
  "duration": 5,
  "generate_audio": true,
  "usage": {
    "completion_tokens": 12345,
    "total_tokens": 12345,
    "tool_usage": {
      "web_search": 0
    }
  }
}
```

### 11.3 失败

```json
{
  "id": "cgt-20250331175019-68d9t",
  "model": "doubao-seedance-2-0-260128",
  "status": "failed",
  "error": {
    "code": "InvalidParameter",
    "message": "some parameter is invalid"
  },
  "created_at": 1743414619,
  "updated_at": 1743414628
}
```

## 12. Cinecho 接入建议

### 12.1 轮询逻辑

建议把主进程的轮询逻辑写成：

1. 创建任务后拿到 `id`
2. 每 2 到 5 秒查询一次
3. `queued/running` 继续查
4. `succeeded` 时取 `content.video_url`
5. `failed/expired/cancelled` 时结束并展示错误

### 12.2 本地落盘建议

查询成功后，最好立即做这几件事：

1. 下载 `content.video_url`
2. 如果存在 `content.last_frame_url`，按需也下载
3. 把 `resolution`、`ratio`、`duration`、`generate_audio`、`seed`、`usage` 一起保存到本地元数据

原因：

| 字段 | 风险 |
|---|---|
| `video_url` | 24 小时后失效 |
| `last_frame_url` | 24 小时后失效 |
| 任务记录 | 7 天后查询不到 |

### 12.3 适合保存到本地元数据的字段

如果我们在项目里给每个生成视频保存 `.json`，建议至少写入：

```json
{
  "taskId": "cgt-20250331175019-68d9t",
  "model": "doubao-seedance-2-0-260128",
  "status": "succeeded",
  "videoUrl": "https://...",
  "lastFrameUrl": "https://...",
  "resolution": "720p",
  "ratio": "16:9",
  "duration": 5,
  "framespersecond": 24,
  "generateAudio": true,
  "seed": 11,
  "serviceTier": "default",
  "executionExpiresAfter": 172800,
  "usage": {
    "completionTokens": 12345,
    "totalTokens": 12345
  },
  "createdAt": 1743414619,
  "updatedAt": 1743414655
}
```

### 12.4 对 UI 的帮助

这个查询接口返回的信息足够支持这些前端能力：

| UI 能力 | 依赖字段 |
|---|---|
| 任务进度状态 | `status` |
| 失败原因弹窗 | `error.message` |
| 展示有声/无声 | `generate_audio` |
| 展示真实输出比例 | `ratio` |
| 展示真实输出时长 | `duration` 或 `frames` |
| 展示真实视频地址 | `content.video_url` |
| 连续镜头工作流 | `content.last_frame_url` |
| 成本统计 | `usage.completion_tokens` |

## 13. 和创建接口联动时最重要的点

### 13.1 创建接口里设置了什么，会影响查询结果

| 创建接口参数 | 查询接口体现 |
|---|---|
| `return_last_frame: true` | 返回 `content.last_frame_url` |
| `generate_audio` | 返回 `generate_audio` |
| `duration` | 返回 `duration` |
| `frames` | 返回 `frames` |
| `tools` | 可能返回 `tools` 与 `usage.tool_usage` |
| `safety_identifier` | 原样返回 `safety_identifier` |
| `service_tier` | 返回 `service_tier` |
| `execution_expires_after` | 返回 `execution_expires_after` |

### 13.2 Seedance 2.0 特别值得关注的字段

如果目标是稳定支持 Seedance 2.0，查询接口里最值得保存和展示的是：

1. `status`
2. `content.video_url`
3. `content.last_frame_url`
4. `generate_audio`
5. `ratio`
6. `duration`
7. `usage.completion_tokens`

