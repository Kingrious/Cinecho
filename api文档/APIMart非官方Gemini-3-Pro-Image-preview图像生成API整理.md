# APIMart 非官方 Gemini-3-Pro-Image-preview 图像生成 API 整理

来源：APIMart 文档「Gemini-3-Pro-Image-preview（Nano banana Pro）图像生成」

所属渠道：APIMart（第三方/非官方 OpenAI 兼容 API 网关）

归属说明：本文整理的是 APIMart 提供的第三方/非官方 Gemini 图像生成兼容网关接口，不是 Google 官方 Gemini API 文档，也不是 OpenAI 官方接口文档。文档中出现的“官方版本”“官方渠道兜底”均为 APIMart 页面中的渠道描述，接入时应按 APIMart 的鉴权、任务查询、计费和稳定性规则处理。

原文链接：https://docs.apimart.ai/cn/api-reference/images/gemini-3-pro/generation

页面更新时间：原页面未标注

整理时间：2026-05-25

## 1. 接口概览

### 1.1 创建图像生成任务

```http
POST https://api.apimart.ai/v1/images/generations
```

该接口用于通过 APIMart 非官方网关创建 Gemini-3-Pro-Image-preview（Nano banana Pro）图像生成任务。接口采用异步处理模式，提交成功后不会直接返回最终图片，而是返回 `task_id`。后续需要通过 APIMart 任务查询接口轮询任务状态，直到任务完成或失败。

页面标注的核心能力：

| 能力 | 说明 |
|---|---|
| 异步处理 | 创建任务后返回 `task_id`，后续查询任务结果 |
| 高质量图像生成 | 面向专业级图像创建 |
| 临时图片链接 | 生成结果链接有效期约 24 小时，需要尽快保存 |
| 文生图 | 仅传 `prompt` |
| 图生图/图像编辑 | 传 `prompt` + `image_urls` |

### 1.2 鉴权方式

所有接口都需要使用 Bearer Token 鉴权。这里使用的是 APIMart API Key，不是 Google 官方 Gemini API Key，也不是 OpenAI 官方 API Key。

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
    "model": "gemini-3-pro-image-preview",
    "prompt": "月光下的竹林小径",
    "size": "1:1",
    "n": 1,
    "resolution": "1K"
  }'
```

成功提交后返回示例：

```json
{
  "code": 200,
  "data": [
    {
      "status": "submitted",
      "task_id": "task_01K8SGYNNNVBQTXNR4MM964S7K"
    }
  ]
}
```

## 2. 请求体结构

最小请求体：

```json
{
  "model": "gemini-3-pro-image-preview",
  "prompt": "月光下的竹林小径"
}
```

常用完整请求体：

```json
{
  "model": "gemini-3-pro-image-preview",
  "prompt": "一个未来感电影海报，霓虹城市、雨夜、强烈轮廓光",
  "size": "16:9",
  "n": 1,
  "resolution": "2K",
  "image_urls": [
    "https://example.com/reference-a.png",
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABg..."
  ],
  "official_fallback": false
}
```

## 3. 请求参数

### 3.1 `model`

类型：`string`

必填：是

默认值：`gemini-3-pro-image-preview`

说明：图像生成模型名称。APIMart 页面列出的模型名：

| 模型 | APIMart 页面说明 |
|---|---|
| `gemini-3-pro-image-preview` | 标准版本 |
| `gemini-3-pro-image-preview-official` | APIMart 所称的官方版本 |

注意：即使使用 `gemini-3-pro-image-preview-official`，本文档仍然只表示 APIMart 网关的调用方式，不等同于 Google 官方 Gemini API 文档。

### 3.2 `prompt`

类型：`string`

必填：是

说明：图像生成的文本描述。建议写清楚主体、场景、风格、构图、镜头、光线、材质和约束。

示例：

```json
{
  "prompt": "月光下的竹林小径，薄雾，电影级光影，细节丰富"
}
```

### 3.3 `size`

类型：`string`

必填：否

说明：图像生成尺寸/比例。

支持的比例：

| `size` | 说明 |
|---|---|
| `auto` | 自动 |
| `1:1` | 正方图 |
| `2:3` | 竖图 |
| `3:2` | 横图 |
| `3:4` | 竖图 |
| `4:3` | 横图 |
| `4:5` | 竖图 |
| `5:4` | 横图 |
| `9:16` | 竖屏 |
| `16:9` | 横屏 |
| `21:9` | 超宽横屏 |

页面说明：

| 场景 | `size: "auto"` 行为 |
|---|---|
| 文生图 | 默认可能为 `1:1` 或 `16:9` |
| 图生图 | 以上游返回比例为准 |

工程建议：前端尽量让用户显式选择比例，避免 `auto` 在不同场景下产生不可预测的画幅。

### 3.4 `n`

类型：`integer`

必填：否

默认值：`1`

取值范围：`1-4`

说明：生成图像数量。必须传纯数字，不要传字符串。

正确：

```json
{
  "n": 1
}
```

错误：

```json
{
  "n": "1"
}
```

### 3.5 `resolution`

类型：`string`

必填：否

默认值：`1K`

可选值：

| 值 | 说明 |
|---|---|
| `1K` | 1K 分辨率，默认值 |
| `2K` | 2K 分辨率 |
| `4K` | 4K 分辨率 |

注意：页面特别提示，使用 base64 格式生成 4K 图像时，处理时间会较长。

### 3.6 `official_fallback`

类型：`boolean`

必填：否

默认值：`false`

说明：是否启用 APIMart 所称的“官方渠道兜底”。

| 值 | 说明 |
|---|---|
| `false` | 不使用，默认值 |
| `true` | 使用 APIMart 所称的官方渠道兜底 |

限制：当 `model` 使用 `gemini-3-pro-image-preview-official` 时，不能再使用 `official_fallback` 参数。

接入建议：默认保持 `false`，只有在业务明确接受 APIMart 兜底渠道的成本、耗时和稳定性差异时再打开。

### 3.7 `image_urls`

类型：`string[]`

必填：否

说明：参考图像列表，用于图生图或图像编辑。

支持两种格式：

| 格式 | 说明 |
|---|---|
| 公网图片 URL | 必须是公开可访问的 `http://` 或 `https://` 地址 |
| Base64 Data URI | 必须包含完整前缀，例如 `data:image/jpeg;base64,...` |

支持的图片格式：

```text
.jpeg / .jpg / .png / .webp
```

限制：

| 项目 | 限制 |
|---|---|
| 单张图片大小 | 不超过 10MB |
| 参考图数量 | 最多 14 张 |
| Base64 前缀 | 必须包含 `data:image/{格式};base64,` |

示例：

```json
{
  "model": "gemini-3-pro-image-preview",
  "prompt": "保持人物特征，把这张图改成电影海报风格",
  "size": "4:5",
  "resolution": "2K",
  "image_urls": [
    "https://example.com/person.jpg",
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
  ]
}
```

## 4. 使用场景示例

### 4.1 文生图：最简请求

```json
{
  "model": "gemini-3-pro-image-preview",
  "prompt": "月光下的竹林小径"
}
```

### 4.2 文生图：指定比例和 2K

```json
{
  "model": "gemini-3-pro-image-preview",
  "prompt": "雨夜霓虹城市街头，电影摄影，反射地面，强烈轮廓光",
  "size": "16:9",
  "n": 1,
  "resolution": "2K"
}
```

### 4.3 文生图：一次生成多张

```json
{
  "model": "gemini-3-pro-image-preview",
  "prompt": "同一个角色的四张不同海报构图，统一赛博朋克风格",
  "size": "4:5",
  "n": 4,
  "resolution": "1K"
}
```

### 4.4 图生图：URL 参考图

```json
{
  "model": "gemini-3-pro-image-preview",
  "prompt": "把参考图改成高级时尚杂志封面风格",
  "size": "4:5",
  "resolution": "2K",
  "image_urls": [
    "https://example.com/reference.jpg"
  ]
}
```

### 4.5 图生图：Base64 参考图

```json
{
  "model": "gemini-3-pro-image-preview",
  "prompt": "保持主体结构，把图片改成水彩插画风格",
  "resolution": "1K",
  "image_urls": [
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABg..."
  ]
}
```

### 4.6 使用 APIMart 所称的官方版本

```json
{
  "model": "gemini-3-pro-image-preview-official",
  "prompt": "一张专业级产品海报，白色背景，高级棚拍灯光",
  "size": "1:1",
  "n": 1,
  "resolution": "2K"
}
```

注意：使用 `gemini-3-pro-image-preview-official` 时，不要传 `official_fallback`。

## 5. 创建任务响应

提交成功后返回任务数组。重点读取 `data[0].task_id`。

```json
{
  "code": 200,
  "data": [
    {
      "status": "submitted",
      "task_id": "task_01K8SGYNNNVBQTXNR4MM964S7K"
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

创建任务接口只返回 `task_id`。提交成功后需要轮询 APIMart 任务查询接口：

```http
GET https://api.apimart.ai/v1/tasks/{task_id}
```

推荐取图逻辑：

```text
data.result.images[0].url[0]
```

常见任务状态：

| 状态 | 含义 | 处理方式 |
|---|---|---|
| `submitted` | 已提交 | 等待后继续轮询 |
| `processing` | 处理中 | 继续轮询 |
| `completed` | 成功 | 读取 `result.images` |
| `failed` | 失败 | 读取错误信息并提示用户 |

轮询建议：

| 项目 | 建议 |
|---|---|
| 首次查询 | 提交后等待 10-20 秒再查 |
| 查询间隔 | 每 3-5 秒查询一次 |
| 多图任务 | `n` 大于 1 时适当拉长超时时间 |
| 4K + Base64 | 处理时间可能明显变长 |
| 结果保存 | 图片链接有效期约 24 小时，成功后尽快下载或转存 |

## 7. 错误与状态码

文档列出的响应状态码：

| HTTP 状态码 | 含义 |
|---:|---|
| `200` | 请求成功，任务已提交 |
| `400` | 请求参数错误或内容审核不通过 |
| `401` | 鉴权失败，检查 APIMart API Key |
| `402` | 余额不足或计费相关问题 |
| `403` | 权限不足或模型/渠道不可用 |
| `429` | 请求过于频繁或触发限流 |
| `500` | 服务端错误 |
| `502` | 上游或网关错误 |

工程处理建议：

| 场景 | 建议 |
|---|---|
| `400` | 检查 `n` 是否为数字、`image_urls` 是否合规、参考图是否超过限制 |
| `401` | 引导用户检查 APIMart API Key |
| `402` | 提示余额或套餐不足 |
| `403` | 检查模型名、渠道权限、官方版本/兜底参数组合 |
| `429` | 做退避重试，前端不要无间隔重试 |
| `500` / `502` | 可提示稍后重试，并记录请求参数摘要 |

## 8. 结果 URL 与存储

APIMart 页面说明，生成的图像链接有效期约 24 小时，请尽快保存。

需要注意：

| 项目 | 说明 |
|---|---|
| 图片地址 | 从任务查询结果的 `data.result.images` 中读取 |
| 有效期 | 约 24 小时 |
| 长期保存 | 建议生成完成后立即下载到本地或转存到自有对象存储/CDN |
| 多图输出 | `n` 可为 1-4，需要遍历 `images` 数组保存全部结果 |

## 9. 计费与耗时

页面没有在该接口页列出具体单价，但参数会影响成本和耗时。

建议记录这些字段：

| 字段 | 用途 |
|---|---|
| `model` | 区分标准版本和 APIMart 所称官方版本 |
| `n` | 生成张数，影响成本 |
| `resolution` | 分辨率档位，影响成本与耗时 |
| `size` | 回放生成参数 |
| `image_urls.length` | 参考图数量，便于排查 |
| `task_id` | 查询和排查问题 |
| `cost` | 如果任务查询返回费用字段，保存实际费用 |
| `actual_time` | 如果任务查询返回耗时字段，保存生成耗时 |

## 10. Cinecho 接入建议

如果在 Cinecho 中接入 Gemini-3-Pro-Image-preview，建议按异步任务模型封装：

1. 提交生成任务：`POST /v1/images/generations`
2. 保存 `task_id`、`model`、`prompt`、`size`、`resolution`、`n`、参考图摘要
3. 延迟 10-20 秒后开始轮询：`GET /v1/tasks/{task_id}`
4. 状态为 `completed` 后遍历 `data.result.images`
5. 下载图片到本地 `roles`、`scenes`、`costumes` 或 `storyboards` 对应目录
6. 把本地路径、远端 URL、过期时间、生成参数写入素材 JSON/任务记录

建议内部类型：

```ts
type ApimartGeminiImageTaskStatus = 'submitted' | 'processing' | 'completed' | 'failed'

interface ApimartGeminiImageGenerationRequest {
  model: 'gemini-3-pro-image-preview' | 'gemini-3-pro-image-preview-official'
  prompt: string
  size?: 'auto' | '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9'
  n?: 1 | 2 | 3 | 4
  resolution?: '1K' | '2K' | '4K'
  official_fallback?: boolean
  image_urls?: string[]
}

interface ApimartGeminiImageGenerationSubmitResult {
  taskId: string
  status: 'submitted'
}

interface ApimartGeminiImageTaskResult {
  id: string
  status: ApimartGeminiImageTaskStatus
  progress?: number
  imageUrls?: string[]
  expiresAt?: number
  cost?: number
  actualTime?: number
  errorMessage?: string
}
```

### 10.1 与现有素材工作流的对应关系

| Cinecho 场景 | 建议参数 |
|---|---|
| 角色设定图 | `size: "1:1"` 或 `4:5`，`resolution: "2K"` |
| 三视图/设定板 | `size: "16:9"` 或 `4:3`，`resolution: "2K"` |
| 场景概念图 | `size: "16:9"`，`resolution: "2K"` |
| 分镜图 | 按视频比例选择 `16:9` 或 `9:16` |
| 一次出多张候选 | `n: 2-4`，先用 `resolution: "1K"` 控成本 |
| 高精度海报/封面 | `resolution: "4K"`，生成完成后立即本地化保存 |

### 10.2 前端体验建议

| 环节 | 建议 |
|---|---|
| 生成张数 | 前端限制 `n` 为 1-4 的数字输入或分段控件 |
| 参考图 | 前端限制最多 14 张，每张不超过 10MB |
| Base64 | 大图优先上传成 URL，避免 4K + base64 请求过慢 |
| 提交后 | 显示“任务已提交”，不要假装立即生成完成 |
| 首次轮询 | 10 秒后开始 |
| 轮询频率 | 3-5 秒一次 |
| 图片保存 | 一拿到 URL 就下载到本地，避免 24 小时后失效 |
| 错误提示 | 优先展示可读错误，同时保留完整响应用于排查 |

## 11. 非官方网关与 OpenAI 兼容点

APIMart 文档将该接口放在 OpenAI 兼容 API 网关下，但它仍然是 APIMart 的第三方/非官方实现，不应假设与 Google 官方 Gemini API 或 OpenAI 官方 Images API 完全一致。

| 项目 | APIMart 非官方 Gemini-3-Pro-Image-preview 网关行为 |
|---|---|
| 路径 | `POST /v1/images/generations` |
| 标准模型 | `gemini-3-pro-image-preview` |
| APIMart 所称官方版本 | `gemini-3-pro-image-preview-official` |
| 生成模式 | 异步，创建任务后返回 `task_id` |
| 参考图字段 | `image_urls` |
| 结果获取 | 通过 `/v1/tasks/{task_id}` 查询 |
| 生成张数 | `n` 支持 1-4 |
| URL 时效 | 约 24 小时，建议及时转存 |

## 12. 最小可用封装流程

伪代码：

```ts
async function generateGemini3ProImage(apiKey: string, payload: ApimartGeminiImageGenerationRequest) {
  const submitRes = await fetch('https://api.apimart.ai/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gemini-3-pro-image-preview',
      n: 1,
      resolution: '1K',
      ...payload
    })
  })

  const submitJson = await submitRes.json()
  const taskId = submitJson.data?.[0]?.task_id
  if (!taskId) throw new Error('Gemini-3-Pro-Image-preview task_id missing')

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
      return task.result.images.flatMap((image: { url: string[] }) => image.url)
    }

    if (task.status === 'failed') {
      throw new Error(task.error?.message || 'Gemini-3-Pro-Image-preview generation failed')
    }

    await delay(5000)
  }
}
```

## 13. 接入检查清单

| 检查项 | 建议 |
|---|---|
| API Key | 单独保存 APIMart Key，不要和 Google 官方 Key、OpenAI 官方 Key、Ark Key 混用 |
| 模型名 | 区分 `gemini-3-pro-image-preview` 和 `gemini-3-pro-image-preview-official` |
| 兜底参数 | 使用 `gemini-3-pro-image-preview-official` 时不要传 `official_fallback` |
| 请求参数 | `n` 使用数字，范围 1-4 |
| 比例 | 建议显式传 `size`，少用 `auto` |
| 参考图数量 | 前端限制最多 14 张 |
| 参考图大小 | 单张不超过 10MB |
| Base64 | 必须带完整 `data:image/{格式};base64,` 前缀 |
| 分辨率 | 只使用 `1K` / `2K` / `4K`，注意大小写 |
| 轮询 | 首次延迟 10-20 秒，之后 3-5 秒一次 |
| 结果保存 | 图片 URL 到期前下载到本地 |
| 失败处理 | 区分鉴权、余额、权限、限流、参数、上游网关错误 |
