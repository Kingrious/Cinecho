# APIMart 非官方 GPT-Image-2 图像生成 API 整理

来源：APIMart 文档「GPT-Image-2 图像生成」

所属渠道：APIMart（第三方/非官方 OpenAI 兼容 API 网关）

归属说明：本文整理的是 APIMart 提供的第三方/非官方 OpenAI 兼容网关接口，不是 OpenAI 官方 GPT-Image-2 API 文档，也不代表 OpenAI 官方接口行为。接入时应按 APIMart 的鉴权、任务查询、计费和稳定性规则处理。

原文链接：https://docs.apimart.ai/cn/api-reference/images/gpt-image-2/generation

页面更新时间：原页面未标注

整理时间：2026-05-25

## 1. 接口概览

### 1.1 创建图像生成任务

```http
POST https://api.apimart.ai/v1/images/generations
```

该接口用于通过 APIMart 非官方网关创建 GPT-Image-2 图像生成任务。接口采用异步处理模式，提交成功后不会直接返回最终图片，而是返回 `task_id`。后续需要通过 APIMart 任务查询接口轮询任务状态，直到任务进入完成或失败状态。

支持两类核心场景：

| 场景 | 关键输入 | 说明 |
|---|---|---|
| 文生图 | `prompt` | 仅根据文本提示词生成图片 |
| 图生图 | `prompt` + `image_urls` | 基于一张或多张参考图生成/改写图片 |

### 1.2 鉴权方式

所有接口都需要使用 Bearer Token 鉴权。这里使用的是 APIMart API Key，不是 OpenAI 官方 API Key，可在 APIMart 控制台获取。

```http
Authorization: Bearer ${APIMART_API_KEY}
Content-Type: application/json
```

### 1.3 基本调用示例

```bash
curl --request POST \
  --url https://api.apimart.ai/v1/images/generations \
  --header "Authorization: Bearer $APIMART_API_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "model": "gpt-image-2",
    "prompt": "一只橘猫坐在窗台上看夕阳，水彩画风格",
    "n": 1,
    "size": "16:9",
    "resolution": "2k"
  }'
```

成功提交后返回示例：

```json
{
  "code": 200,
  "data": [
    {
      "status": "submitted",
      "task_id": "task_01KPQ7J7DWB7QZ3WCEK3YVPBRA"
    }
  ]
}
```

## 2. 请求体结构

最小请求体：

```json
{
  "model": "gpt-image-2",
  "prompt": "一只橘猫坐在窗台上看夕阳，水彩画风格"
}
```

常用完整请求体：

```json
{
  "model": "gpt-image-2",
  "prompt": "a corgi astronaut on the moon, cinematic lighting",
  "n": 1,
  "size": "16:9",
  "resolution": "2k",
  "image_urls": [
    "https://example.com/reference-a.png",
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
  ],
  "official_fallback": false
}
```

## 3. 请求参数

### 3.1 `model`

类型：`string`

必填：是

默认值：`gpt-image-2`

说明：图像生成模型名称，固定填写：

```text
gpt-image-2
```

### 3.2 `prompt`

类型：`string`

必填：是

说明：图像生成的文本描述。支持中文和英文，建议尽量描述清楚主体、风格、构图、光线、材质、镜头语言等信息。

注意事项：

| 项目 | 说明 |
|---|---|
| 内容审核 | 提交前会经过平台敏感词和安全审核 |
| 审核失败 | 命中违规内容会直接返回错误 |
| 比例描述 | 推荐使用 `size` 控制比例，不要在 prompt 里重复写比例，避免上游理解冲突 |

### 3.3 `n`

类型：`integer`

必填：否

默认值：`1`

取值范围：`1`

说明：生成图片张数。当前文档标注只支持 `1`，并要求传入数字类型，不要写成字符串。

正确：

```json
{
  "n": 1
}
```

不推荐：

```json
{
  "n": "1"
}
```

### 3.4 `size`

类型：`string`

必填：否

默认值：`1:1`

说明：控制输出图像比例，也可以直接传入像素尺寸。

支持的比例：

| `size` | 类型 |
|---|---|
| `auto` | 自动，服务端默认按 `1:1` 处理 |
| `1:1` | 正方 |
| `3:2` | 横图 |
| `2:3` | 竖图 |
| `4:3` | 横图 |
| `3:4` | 竖图 |
| `5:4` | 横图 |
| `4:5` | 竖图 |
| `16:9` | 横图 |
| `9:16` | 竖图 |
| `2:1` | 横图 |
| `1:2` | 竖图 |
| `3:1` | 横图 |
| `1:3` | 竖图 |
| `21:9` | 横图 |
| `9:21` | 竖图 |

也支持直接传入像素尺寸，例如：

```text
1881x836
887x1774
```

图生图场景中，不传 `size` 时，输出分辨率会跟随输入图分辨率；传入 `size` 时，会强制按指定尺寸出图。

### 3.5 `resolution`

类型：`string`

必填：否

默认值：`1k`

可选值：

| 值 | 说明 |
|---|---|
| `1k` | 低分辨率档位 |
| `2k` | 中分辨率档位 |
| `4k` | 高分辨率档位 |

说明：`resolution` 和 `size` 共同决定实际输出像素。计费也按 1K / 2K / 4K 分辨率档位区分。

常用比例与像素对应关系：

| `size` | `1k` | `2k` | `4k` |
|---|---:|---:|---:|
| `1:1` | 1024x1024 / 1254x1254 | 2048x2048 | 2880x2880 |
| `3:2` | 1536x1024 | 2048x1360 | 3520x2336 |
| `2:3` | 1024x1536 | 1360x2048 | 2336x3520 |
| `4:3` | 1024x768 | 2048x1536 | 3312x2480 |
| `3:4` | 768x1024 | 1536x2048 | 2480x3312 |
| `5:4` | 1280x1024 / 1448x1086 | 2560x2048 | 3216x2576 |
| `4:5` | 1024x1280 / 1122x1402 | 2048x2560 | 2576x3216 |
| `16:9` | 1536x864 / 1672x941 | 2048x1152 | 3840x2160 |
| `9:16` | 864x1536 / 941x1672 | 1152x2048 | 2160x3840 |
| `2:1` | 2048x1024 / 1774x887 | 2688x1344 | 3840x1920 |
| `1:2` | 1024x2048 / 887x1774 | 1344x2688 | 1920x3840 |
| `3:1` | 1881x836 / 1536x512 | 3072x1024 | 3840x1280 |
| `1:3` | 887x1774 / 512x1536 | 1024x3072 | 1280x3840 |
| `21:9` | 2016x864 / 1915x821 | 2688x1152 | 3840x1648 |
| `9:21` | 864x2016 / 821x1915 | 1152x2688 | 1648x3840 |

4K 支持上述 15 个比例，也可以直接通过 `size` 传入表格里的像素尺寸。

### 3.6 `image_urls`

类型：`string[]`

必填：否

说明：参考图数组。传入后走图生图模式，字段名为 APIMart 在其 OpenAI 兼容网关中定义的兼容字段。

规则：

| 项目 | 说明 |
|---|---|
| 最大数量 | 最多 16 张，超过会返回 `image_urls exceeds max 16` |
| URL | 支持公网可访问的稳定图片链接 |
| Base64 | 支持 `data:image/png;base64,...` 这类 data URI |
| 混填 | 同一个数组里可以同时放 URL 和 base64 |
| 尺寸 | 不传 `size` 时跟随输入图分辨率；传 `size` 时按指定尺寸输出 |

示例：

```json
{
  "model": "gpt-image-2",
  "prompt": "把两张参考图融合成一张电影海报",
  "size": "4:3",
  "resolution": "2k",
  "image_urls": [
    "https://example.com/photo-a.jpg",
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
  ]
}
```

### 3.7 `official_fallback`

类型：`boolean`

必填：否

默认值：`false`

说明：是否启用 APIMart 所称的“官方渠道兜底”。这里的“官方渠道”是 APIMart 文档中的渠道描述，不等同于本文档为 OpenAI 官方接口背书。

| 值 | 说明 |
|---|---|
| `false` | 不使用 APIMart 所称的官方渠道兜底，默认值 |
| `true` | 使用 APIMart 所称的官方渠道兜底 |

工程上建议默认保持 `false`，只有在业务明确接受兜底渠道的成本、耗时和稳定性差异时再打开。

## 4. 使用场景示例

### 4.1 文生图：最简请求

```json
{
  "model": "gpt-image-2",
  "prompt": "一只橘猫坐在窗台上看夕阳，水彩画风格"
}
```

### 4.2 文生图：指定比例和 2K

```json
{
  "model": "gpt-image-2",
  "prompt": "a corgi astronaut on the moon, cinematic, detailed",
  "size": "16:9",
  "resolution": "2k"
}
```

### 4.3 文生图：4K 输出

```json
{
  "model": "gpt-image-2",
  "prompt": "星空下的古老城堡，电影级光影，细节丰富",
  "size": "16:9",
  "resolution": "4k"
}
```

### 4.4 图生图：URL 参考图

```json
{
  "model": "gpt-image-2",
  "prompt": "把这张照片变成水彩画风格",
  "image_urls": [
    "https://example.com/photo.jpg"
  ]
}
```

### 4.5 图生图：Base64 参考图

```json
{
  "model": "gpt-image-2",
  "prompt": "保持主体和构图，把照片改成赛博朋克电影海报风格",
  "image_urls": [
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
  ]
}
```

### 4.6 图生图：多参考图融合

```json
{
  "model": "gpt-image-2",
  "prompt": "把这些参考图融合成一张统一风格的角色概念图",
  "size": "4:3",
  "resolution": "2k",
  "image_urls": [
    "https://example.com/reference-a.jpg",
    "https://example.com/reference-b.jpg"
  ]
}
```

## 5. 创建任务响应

提交成功后返回任务数组。当前接口一次请求通常只生成 1 张图，因此重点读取 `data[0].task_id`。

```json
{
  "code": 200,
  "data": [
    {
      "status": "submitted",
      "task_id": "task_01KPQ7J7DWB7QZ3WCEK3YVPBRA"
    }
  ]
}
```

字段说明：

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` | `integer` | 响应状态码 |
| `data` | `array` | 返回数据数组 |
| `data[].status` | `string` | 任务状态，提交成功时为 `submitted` |
| `data[].task_id` | `string` | 任务唯一标识符，用于后续查询结果 |

## 6. 查询任务结果

创建任务接口只返回 `task_id`。提交成功后需要轮询任务查询接口：

```http
GET https://api.apimart.ai/v1/tasks/{task_id}
```

成功完成的任务示例：

```json
{
  "code": 200,
  "data": {
    "id": "task_01KPQ7J7DWB7QZ3WCEK3YVPBRA",
    "status": "completed",
    "progress": 100,
    "created": 1776748674,
    "completed": 1776748726,
    "actual_time": 52,
    "cost": 0.05279,
    "estimated_time": 100,
    "result": {
      "images": [
        {
          "url": [
            "https://upload.apimart.ai/f/image/xxxxxxxx-gpt_image_2_task_xxx_0.png"
          ],
          "expires_at": 1776835126
        }
      ]
    }
  }
}
```

取图路径：

```text
data.result.images[0].url[0]
```

任务状态：

| 状态 | 含义 | 处理方式 |
|---|---|---|
| `submitted` | 已提交 | 等待后继续轮询 |
| `processing` | 上游处理中 | 继续轮询 |
| `completed` | 成功 | 读取 `result.images` |
| `failed` | 失败 | 读取 `error.message` 并提示用户 |

轮询建议：

| 项目 | 建议 |
|---|---|
| 首次查询 | 提交后等待 10-20 秒再查 |
| 查询间隔 | 每 3-5 秒查询一次 |
| 单图耗时 | 通常 30-60 秒，可按 2 分钟做前端体验兜底 |
| 批量查询 | 多任务并发时可用 `POST /v1/tasks/batch`，请求体为 `{"task_ids": ["task_xxx", "task_yyy"]}` |

## 7. 错误与状态码

文档列出的响应状态码：

| HTTP 状态码 | 含义 |
|---:|---|
| `200` | 请求成功，任务已提交 |
| `400` | 请求参数错误或内容审核不通过 |
| `401` | 鉴权失败，检查 API Key |
| `402` | 余额不足或计费相关问题 |
| `429` | 请求过于频繁或触发限流 |
| `500` | 服务端错误 |
| `503` | 服务暂不可用 |

工程处理建议：

| 场景 | 建议 |
|---|---|
| `400` | 把可读错误展示给用户，并保留原始错误日志 |
| `401` | 引导用户检查 APIMart API Key |
| `402` | 提示余额或套餐不足 |
| `429` | 做退避重试，前端不要无间隔重试 |
| `500` / `503` | 可提示稍后重试，并记录请求参数摘要 |

## 8. 结果 URL 与存储

文档说明，平台会把上游临时签名链接镜像到 APIMart 自有对象存储，返回给客户端的是可直接访问的图片链接。

需要注意：

| 项目 | 说明 |
|---|---|
| 图片地址 | 从 `data.result.images[0].url[0]` 读取 |
| 有效期 | `expires_at` 一般等于任务完成时间加 24 小时 |
| 长期保存 | 建议生成完成后尽快下载到本地或转存到自有对象存储/CDN |
| 任务保留 | `task_id` 默认保留若干天，过期后查询可能返回任务不存在或已过期 |

## 9. 计费规则

文档给出的计费核心规则：

| 项目 | 说明 |
|---|---|
| 计费维度 | 按 `resolution` 分辨率档位计费 |
| 档位 | `1k` / `2k` / `4k` |
| 失败任务 | 失败不扣费 |
| 审核未通过 | 不扣费 |

接入时建议在任务记录里保存：

| 字段 | 用途 |
|---|---|
| `resolution` | 成本估算和账单核对 |
| `size` | 回放生成参数 |
| `task_id` | 查询和排查问题 |
| `cost` | 查询结果返回后记录实际费用 |
| `actual_time` | 统计生成耗时 |

## 10. Cinecho 接入建议

如果在 Cinecho 中接入 GPT-Image-2，建议按异步任务模型封装：

1. 提交生成任务：`POST /v1/images/generations`
2. 保存 `task_id`、`prompt`、`size`、`resolution`、参考图摘要等任务信息
3. 延迟 10-20 秒后开始轮询：`GET /v1/tasks/{task_id}`
4. 状态为 `completed` 后读取 `data.result.images[0].url[0]`
5. 下载图片到本地 `roles`、`scenes`、`costumes` 或 `storyboards` 对应目录
6. 把本地路径、远端 URL、过期时间、生成参数写入素材 JSON/任务记录

建议内部类型：

```ts
type ApimartImageTaskStatus = 'submitted' | 'processing' | 'completed' | 'failed'

interface ApimartImageGenerationRequest {
  model: 'gpt-image-2'
  prompt: string
  n?: 1
  size?: string
  resolution?: '1k' | '2k' | '4k'
  image_urls?: string[]
  official_fallback?: boolean
}

interface ApimartImageGenerationSubmitResult {
  taskId: string
  status: 'submitted'
}

interface ApimartImageTaskResult {
  id: string
  status: ApimartImageTaskStatus
  progress?: number
  imageUrl?: string
  expiresAt?: number
  cost?: number
  actualTime?: number
  errorMessage?: string
}
```

### 10.1 与现有素材工作流的对应关系

| Cinecho 场景 | 建议参数 |
|---|---|
| 角色设定图 | `size: "1:1"` 或 `4:5`，`resolution: "2k"` |
| 三视图/设定板 | `size: "16:9"` 或 `4:3`，`resolution: "2k"` |
| 场景概念图 | `size: "16:9"`，`resolution: "2k"` |
| 分镜图 | 按视频比例选择 `16:9` 或 `9:16` |
| 高精度海报/封面 | `resolution: "4k"`，生成完成后立即本地化保存 |

### 10.2 前端体验建议

| 环节 | 建议 |
|---|---|
| 提交后 | 显示“任务已提交”，不要假装立即生成完成 |
| 首次轮询 | 10 秒后开始 |
| 轮询频率 | 3-5 秒一次 |
| 超时提示 | 2 分钟未完成时提示仍在生成，可继续后台等待 |
| 图片保存 | 一拿到 URL 就下载到本地，避免 24 小时后失效 |
| 错误提示 | 优先展示 `error.message`，同时保留完整响应用于排查 |

## 11. 非官方网关与 OpenAI Images 的兼容点

APIMart 文档说明该接口基于 OpenAI Images 兼容协议，但它仍然是 APIMart 的第三方/非官方网关实现，不应假设与 OpenAI 官方接口完全一致。接入时有几个差异需要注意：

| 项目 | APIMart 非官方 GPT-Image-2 网关行为 |
|---|---|
| 路径 | `POST /v1/images/generations` |
| 模型 | `gpt-image-2` |
| 生成模式 | 异步，创建任务后返回 `task_id` |
| 参考图字段 | `image_urls` |
| 结果获取 | 通过 `/v1/tasks/{task_id}` 查询 |
| 输出图片路径 | `data.result.images[0].url[0]` |
| URL 时效 | 建议按 24 小时内转存处理 |

## 12. 最小可用封装流程

伪代码：

```ts
async function generateGptImage2Image(apiKey: string, payload: ApimartImageGenerationRequest) {
  const submitRes = await fetch('https://api.apimart.ai/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-image-2',
      n: 1,
      resolution: '2k',
      ...payload
    })
  })

  const submitJson = await submitRes.json()
  const taskId = submitJson.data?.[0]?.task_id
  if (!taskId) throw new Error('GPT-Image-2 task_id missing')

  await delay(15000)

  while (true) {
    const taskRes = await fetch(`https://api.apimart.ai/v1/tasks/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    })
    const taskJson = await taskRes.json()
    const task = taskJson.data

    if (task.status === 'completed') {
      return task.result.images[0].url[0]
    }

    if (task.status === 'failed') {
      throw new Error(task.error?.message || 'GPT-Image-2 generation failed')
    }

    await delay(5000)
  }
}
```

## 13. 接入检查清单

| 检查项 | 建议 |
|---|---|
| API Key | 单独保存 APIMart Key，不要和 OpenAI 官方 Key、Ark Key 混用 |
| 请求参数 | `n` 使用数字 `1` |
| 比例 | 用 `size` 控制，不在 prompt 重复强调 |
| 参考图数量 | 前端限制最多 16 张 |
| Base64 | 大图 base64 可能导致请求体很大，优先使用 URL |
| 轮询 | 首次延迟 10-20 秒，之后 3-5 秒一次 |
| 结果保存 | 图片 URL 到期前下载到本地 |
| 计费记录 | 保存 `resolution`、`cost`、`actual_time` |
| 失败处理 | 区分鉴权、余额、限流、审核、服务端错误 |
