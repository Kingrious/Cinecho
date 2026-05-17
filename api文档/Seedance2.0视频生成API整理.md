# Seedance 2.0 视频生成 API 整理

来源：火山引擎方舟官方文档「创建视频生成任务 API」

原文链接：https://www.volcengine.com/docs/82379/1520757?lang=zh

官方更新时间：2026-05-11 14:44:55（北京时间）

整理时间：2026-05-17

## 1. 接口概览

### 1.1 创建任务接口

```http
POST https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks
```

该接口用于创建异步视频生成任务。模型会根据传入的文本、图片、视频、音频、样片任务 ID 等内容生成视频。创建任务成功后返回任务 `id`，后续需要调用「查询视频生成任务 API」轮询或通过回调获取最终状态与 `video_url`。

### 1.2 鉴权方式

接口仅支持 API Key 鉴权。

请求头示例：

```http
Authorization: Bearer ${ARK_API_KEY}
Content-Type: application/json
```

### 1.3 账户/模型开通要求

官方文档提示：开通 Seedance 2.0 与 Seedance 2.0 fast 前，需要确保账户余额满足要求，或已购买资源包。实际接入时应在控制台确认模型已开通，并使用正确的 Model ID 或 Endpoint ID。

## 2. Seedance 2.0 能力范围

Seedance 2.0 系列支持有声视频和无声视频。是否输出声音由 `generate_audio` 控制。

### 2.1 支持的生成模式

| 模式 | 输入组合 | 说明 |
|---|---|---|
| 文生视频 | 文本提示词 | 不上传参考图/视频/音频，仅由文本生成目标视频。 |
| 图生视频：首帧 | 1 张首帧图片 + 可选文本 | 图片 `role` 可为 `first_frame`，也可不填。 |
| 图生视频：首尾帧 | 首帧图片 + 尾帧图片 + 可选文本 | 两张图片需要分别指定 `role: first_frame` 与 `role: last_frame`。 |
| 多模态参考生视频 | 参考图片 1-9 张、参考视频 0-3 个、参考音频 0-3 段、可选文本 | 仅 Seedance 2.0 系列支持。音频不能单独输入，必须至少同时包含 1 个参考图片或参考视频。可用于全新视频、编辑视频、延长视频等场景。 |

### 2.2 与其他 Seedance 模型的差异

| 模型 | 有声/无声 | 文生视频 | 首帧图生视频 | 首尾帧图生视频 | 多模态参考 | 输入视频 | 输入音频 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Seedance 2.0 系列 | 支持 | 支持 | 支持 | 支持 | 支持 | 支持 | 支持 |
| Seedance 1.5 pro | 支持 | 支持 | 支持 | 支持 | 不按 2.0 多模态参考方式支持 | 未在本页标为 2.0 同等支持 | 未在本页标为 2.0 同等支持 |
| Seedance 1.0 pro | 未标明有声 | 支持 | 支持 | 支持 | 不支持 | 不支持 | 不支持 |
| Seedance 1.0 pro fast | 未标明有声 | 支持 | 支持 | 不支持 | 不支持 | 不支持 | 不支持 |

## 3. 请求体总结构

最小请求体：

```json
{
  "model": "doubao-seedance-2-0-260128",
  "content": [
    {
      "type": "text",
      "text": "一只橘猫在阳光下跳上窗台，镜头缓慢推进"
    }
  ]
}
```

更完整请求体：

```json
{
  "model": "doubao-seedance-2-0-260128",
  "content": [
    {
      "type": "text",
      "text": "清晨的海边，一位旅行者背着包走向灯塔，浪声与海鸥声自然出现"
    }
  ],
  "resolution": "720p",
  "ratio": "16:9",
  "duration": 5,
  "generate_audio": true,
  "watermark": false,
  "return_last_frame": false,
  "service_tier": "default",
  "execution_expires_after": 172800,
  "safety_identifier": "hashed_user_id_001"
}
```

## 4. 顶层请求参数

### 4.1 `model`

类型：`string`

必填：是

说明：要调用的模型 ID，也可以使用 Endpoint ID。Seedance 2.0 示例 Model ID：

```text
doubao-seedance-2-0-260128
```

### 4.2 `content`

类型：`object[]`

必填：是

说明：输入给模型用于生成视频的内容。支持的元素类型包括：

| 类型 | `type` | Seedance 2.0 支持情况 | 说明 |
|---|---|---:|---|
| 文本 | `text` | 支持 | 提示词，描述目标视频。 |
| 图片 | `image_url` | 支持 | URL、Base64 或素材 ID。 |
| 视频 | `video_url` | 支持 | URL 或素材 ID。 |
| 音频 | `audio_url` | 支持 | URL、Base64 或素材 ID，不能单独使用。 |
| 样片任务 | `draft_task` | 本页标注仅 Seedance 1.5 pro 支持 | 基于 Draft 任务生成正式视频。 |

Seedance 2.0 对真人脸素材有额外限制：不支持直接上传含真人人脸的参考图/视频。官方提供了授权素材、虚拟人像、平台可信产物等方案，实际产品接入时应单独核对合规流程。

### 4.3 `callback_url`

类型：`string`

必填：否

说明：任务状态变化时，方舟向该地址发起 POST 回调。回调体结构与查询任务 API 的返回体一致。

回调状态包括：

| 状态 | 含义 |
|---|---|
| `queued` | 排队中 |
| `running` | 运行中 |
| `succeeded` | 成功 |
| `failed` | 失败 |
| `expired` | 任务排队或运行超过过期时间 |

### 4.4 `return_last_frame`

类型：`boolean`

默认值：`false`

说明：是否在任务成功后返回生成视频的尾帧图像。

| 值 | 说明 |
|---|---|
| `true` | 查询任务时可获取尾帧图像。尾帧为 PNG，宽高与视频一致，无水印。适合连续生成：把上一个视频尾帧作为下一个视频首帧。 |
| `false` | 不返回尾帧图像。 |

注意：Draft 样片模式不支持返回尾帧。

### 4.5 `service_tier`

类型：`string`

默认值：`default`

枚举值：

| 值 | 说明 |
|---|---|
| `default` | 在线推理，适合对时效性要求较高的场景。 |
| `flex` | 离线推理，价格通常更低、TPD 更高，但 Seedance 2.0 系列不支持离线推理。 |

Seedance 2.0 接入时建议固定为：

```json
"service_tier": "default"
```

### 4.6 `execution_expires_after`

类型：`integer`

默认值：`172800`

单位：秒

取值范围：`[3600, 259200]`

说明：任务从 `created_at` 开始计算的过期时间。超过该时间后任务会被自动终止并标记为 `expired`。默认 172800 秒，即 48 小时。

### 4.7 `generate_audio`

类型：`boolean`

默认值：`true`

支持模型：Seedance 2.0 系列、Seedance 1.5 pro

说明：控制输出视频是否包含与画面同步的声音。

| 值 | 说明 |
|---|---|
| `true` | 输出有声视频。模型会根据文本与视觉内容生成匹配的人声、音效、背景音乐。 |
| `false` | 输出无声视频。 |

接入建议：

| 产品选项 | API 参数 |
|---|---|
| 输出声音 | `"generate_audio": true` |
| 无声视频 | `"generate_audio": false` |

提示词建议：如果希望生成对话音频，建议把台词放在中文或英文引号内，便于模型识别对话内容。

注意：有声视频输出为单声道，和输入参考音频的声道数无关。

### 4.8 `draft`

类型：`boolean`

默认值：`false`

官方本页标注：仅 Seedance 1.5 pro 支持

说明：控制是否开启样片模式。`true` 时生成预览视频，用较低成本快速验证场景结构、镜头调度、主体动作与 prompt 意图。开启样片模式后使用 480p 分辨率，不支持返回尾帧，不支持离线推理。

Seedance 2.0 接入时不要默认暴露该参数，除非后续文档明确支持。

### 4.9 `tools`

类型：`object[]`

支持模型：仅 Seedance 2.0 系列

说明：配置模型可调用的工具。本页列出的工具类型：

```json
{
  "tools": [
    {
      "type": "web_search"
    }
  ]
}
```

`web_search` 用于联网搜索。开启后模型会根据提示词自行判断是否搜索互联网信息。可能提升视频内容的时效性，但也会增加延迟。实际搜索次数可在查询任务 API 返回的 `usage.tool_usage.web_search` 中查看。

### 4.10 `safety_identifier`

类型：`string`

必填：否

说明：终端用户唯一标识，用于辅助平台识别可能违反使用政策的用户。要求：

| 规则 | 说明 |
|---|---|
| 唯一且稳定 | 同一终端用户应固定使用同一标识。 |
| 英文字符串 | 文档要求英文字符串。 |
| 长度 | 不超过 64 个字符。 |
| 隐私 | 推荐对用户名、用户 ID 或邮箱做哈希，避免泄露隐私。 |

## 5. `content` 详细说明

### 5.1 文本信息

结构：

```json
{
  "type": "text",
  "text": "提示词内容"
}
```

字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `type` | `string` | 是 | 固定为 `text`。 |
| `text` | `string` | 是 | 输入给模型的视频提示词。 |

提示词规则：

| 项目 | 说明 |
|---|---|
| 语言 | 所有模型支持中文、英文；Seedance 2.0 与 Seedance 2.0 fast 额外支持日语、印尼语、西班牙语、葡萄牙语。 |
| 长度建议 | 中文不超过 500 字，英文不超过 1000 词。太长可能导致信息分散。 |
| 音频提示 | 需要人物说话时，把台词放进引号内，有助于有声视频生成。 |

### 5.2 图片信息

结构：

```json
{
  "type": "image_url",
  "image_url": {
    "url": "https://example.com/first-frame.png"
  },
  "role": "first_frame"
}
```

字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `type` | `string` | 是 | 固定为 `image_url`。 |
| `image_url.url` | `string` | 是 | 图片 URL、Base64 或素材 ID。 |
| `role` | `string` | 条件必填 | 图片位置或用途。不同生成模式取值不同。 |

`image_url.url` 支持：

| 输入形式 | 格式 |
|---|---|
| 公网 URL | `https://...` |
| Base64 | `data:image/<格式>;base64,<Base64编码>`，图片格式需小写，例如 `data:image/png;base64,...` |
| 素材 ID | `asset://<ASSET_ID>` |

单张图片要求：

| 规则 | 要求 |
|---|---|
| 格式 | jpeg、png、webp、bmp、tiff、gif；Seedance 1.5 pro 与 Seedance 2.0 系列新增支持 heic、heif。 |
| 宽高比 | 宽 / 高在 `(0.4, 2.5)`。 |
| 宽高边长 | 每边像素在 `(300, 6000)`。 |
| 大小 | 单张小于 30 MB。 |
| 请求体大小 | 不超过 64 MB。大文件不建议使用 Base64。 |

图片数量：

| 场景 | 图片数量 |
|---|---:|
| 首帧图生视频 | 1 张 |
| 首尾帧图生视频 | 2 张 |
| Seedance 2.0 多模态参考生视频 | 1-9 张 |

图片 `role` 取值：

| 场景 | role | 说明 |
|---|---|---|
| 首帧图生视频 | `first_frame` 或不填 | 传 1 个 `image_url` 对象。 |
| 首尾帧图生视频 | `first_frame` 和 `last_frame` | 传 2 个 `image_url` 对象，role 必填。 |
| 多模态参考图 | `reference_image` | Seedance 2.0 系列支持 1-9 张参考图，role 必填且均为 `reference_image`。 |

重要互斥规则：

| 规则 | 说明 |
|---|---|
| 首帧、首尾帧、多模态参考互斥 | `first_frame/last_frame` 与 `reference_image/reference_video/reference_audio` 不应混用在同一次请求中。 |
| 多模态参考也可表达首尾意图 | 可以通过提示词要求某张参考图作为首帧/尾帧，但如果必须严格保证首尾帧一致，应优先使用 `first_frame` / `last_frame` 模式。 |
| 首尾帧图片可相同 | 如果首尾帧宽高比不一致，以首帧为主，尾帧会裁剪适配。 |

### 5.3 视频信息

仅 Seedance 2.0 系列支持输入视频。

结构：

```json
{
  "type": "video_url",
  "video_url": {
    "url": "https://example.com/reference.mp4"
  },
  "role": "reference_video"
}
```

字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `type` | `string` | 是 | 固定为 `video_url`。 |
| `video_url.url` | `string` | 是 | 视频 URL 或素材 ID。 |
| `role` | `string` | 条件必填 | 当前仅支持 `reference_video`。 |

视频输入支持：

| 输入形式 | 格式 |
|---|---|
| 公网 URL | `https://...` |
| 素材 ID | `asset://<ASSET_ID>` |

单个视频要求：

| 规则 | 要求 |
|---|---|
| 容器格式 | mp4、mov |
| 分辨率 | 480p、720p、1080p |
| 时长 | 单个视频 `[2, 15]` 秒 |
| 数量 | 最多 3 个参考视频 |
| 总时长 | 所有输入视频总时长不超过 15 秒 |
| 宽高比 | 宽 / 高在 `[0.4, 2.5]` |
| 宽高边长 | 每边像素在 `[300, 6000]` |
| 总像素数 | 宽高乘积在 `[409600, 2086876]` |
| 大小 | 单个视频不超过 50 MB |
| FPS | `[24, 60]` |

支持编码：

| 容器 | 扩展名 | MIME | 视频编码 | 音频编码 |
|---|---|---|---|---|
| MP4 | `.mp4` | `video/mp4` | H.264/AVC、H.265/HEVC | AAC、MP3 |
| QuickTime | `.mov` | `video/quicktime` | H.264/AVC、H.265/HEVC | AAC、MP3 |

### 5.4 音频信息

仅 Seedance 2.0 系列支持输入音频。

注意：音频不能单独输入，必须至少同时包含 1 个参考图片或参考视频。

结构：

```json
{
  "type": "audio_url",
  "audio_url": {
    "url": "https://example.com/reference.wav"
  },
  "role": "reference_audio"
}
```

字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `type` | `string` | 是 | 固定为 `audio_url`。 |
| `audio_url.url` | `string` | 是 | 音频 URL、Base64 或素材 ID。 |
| `role` | `string` | 条件必填 | 当前仅支持 `reference_audio`。 |

`audio_url.url` 支持：

| 输入形式 | 格式 |
|---|---|
| 公网 URL | `https://...` |
| Base64 | `data:audio/<格式>;base64,<Base64编码>`，音频格式需小写，例如 `data:audio/wav;base64,...` |
| 素材 ID | `asset://<ASSET_ID>` |

单个音频要求：

| 规则 | 要求 |
|---|---|
| 格式 | wav、mp3 |
| 时长 | 单段 `[2, 15]` 秒 |
| 数量 | 最多 3 段参考音频 |
| 总时长 | 所有输入音频总时长不超过 15 秒 |
| 大小 | 单段音频不超过 15 MB |
| 请求体大小 | 不超过 64 MB。大文件不建议使用 Base64。 |

### 5.5 样片任务信息

官方本页标注：仅 Seedance 1.5 pro 支持。

结构：

```json
{
  "type": "draft_task",
  "draft_task": {
    "id": "draft_task_id"
  }
}
```

字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `type` | `string` | 是 | 固定为 `draft_task`。 |
| `draft_task.id` | `string` | 是 | Draft 样片任务 ID。 |

平台会复用 Draft 视频任务里的部分用户输入，例如 `model`、文本、图片、`generate_audio`、`seed`、`ratio`、`duration`、`camera_fixed` 等，再生成正式视频。

## 6. 输出格式与生成控制参数

官方文档说明：`resolution`、`ratio`、`duration`、`frames`、`seed`、`camera_fixed`、`watermark` 已升级为推荐直接写在 request body 中。旧方式仍兼容，即把 `--参数` 追加到文本提示词末尾。

### 6.1 推荐的新方式

```json
{
  "model": "doubao-seedance-2-0-260128",
  "content": [
    {
      "type": "text",
      "text": "小猫对着镜头打哈欠"
    }
  ],
  "resolution": "720p",
  "ratio": "16:9",
  "duration": 5,
  "seed": 11,
  "camera_fixed": false,
  "watermark": true
}
```

新方式属于强校验：参数不合法时，模型会返回错误提示。

### 6.2 兼容旧方式

```json
{
  "model": "doubao-seedance-2-0-260128",
  "content": [
    {
      "type": "text",
      "text": "小猫对着镜头打哈欠 --rs 720p --rt 16:9 --dur 5 --seed 11 --cf false --wm true"
    }
  ]
}
```

旧方式属于弱校验：参数不合法时可能被忽略，也可能报错。新接入建议使用 request body 顶层字段。

### 6.3 `resolution`

类型：`string`

默认值：

| 模型 | 默认值 |
|---|---|
| Seedance 2.0 系列、Seedance 1.5 pro | `720p` |
| Seedance 1.0 pro / pro-fast | `1080p` |

枚举值：

| 值 | 说明 |
|---|---|
| `480p` | 支持 |
| `720p` | 支持 |
| `1080p` | 支持，但 Seedance 2.0 fast 不支持 |

### 6.4 `ratio`

类型：`string`

默认值：

| 场景/模型 | 默认值 |
|---|---|
| Seedance 2.0 系列、Seedance 1.5 pro | `adaptive` |
| 其他模型文生视频 | `16:9` |
| 其他模型图生视频 | `adaptive` |

枚举值：

```text
16:9
4:3
1:1
3:4
9:16
21:9
adaptive
```

`adaptive` 适配规则：

| 场景 | 规则 |
|---|---|
| 文生视频 | 根据提示词智能选择宽高比。 |
| 首帧 / 首尾帧图生视频 | 根据上传的首帧图片比例选择最接近的宽高比。 |
| 多模态参考生视频 | 如果提示词意图是首帧生成、编辑或延长，以对应图片/视频为准；否则以第一个媒体文件为准，视频优先于图片。 |

注意：图生视频选择的宽高比与上传图片不一致时，平台会居中裁剪图片。

### 6.5 分辨率与像素尺寸

| 分辨率 | 宽高比 | Seedance 1.0 系列 | Seedance 1.5 pro / Seedance 2.0 系列 |
|---|---|---:|---:|
| 480p | 16:9 | 864×480 | 864×496 |
| 480p | 4:3 | 736×544 | 752×560 |
| 480p | 1:1 | 640×640 | 640×640 |
| 480p | 3:4 | 544×736 | 560×752 |
| 480p | 9:16 | 480×864 | 496×864 |
| 480p | 21:9 | 960×416 | 992×432 |
| 720p | 16:9 | 1248×704 | 1280×720 |
| 720p | 4:3 | 1120×832 | 1112×834 |
| 720p | 1:1 | 960×960 | 960×960 |
| 720p | 3:4 | 832×1120 | 834×1112 |
| 720p | 9:16 | 704×1248 | 720×1280 |
| 720p | 21:9 | 1504×640 | 1470×630 |
| 1080p | 16:9 | 1920×1088 | 1920×1080 |
| 1080p | 4:3 | 1664×1248 | 1664×1248 |
| 1080p | 1:1 | 1440×1440 | 1440×1440 |
| 1080p | 3:4 | 1248×1664 | 1248×1664 |
| 1080p | 9:16 | 1088×1920 | 1080×1920 |
| 1080p | 21:9 | 2176×928 | 2206×946 |

备注：Seedance 2.0 fast 不支持 1080p。

### 6.6 `duration`

类型：`integer`

默认值：`5`

单位：秒

说明：生成视频时长。`duration` 与 `frames` 二选一；如果两者都传，`frames` 优先级更高。但 Seedance 2.0 系列暂不支持 `frames`，因此应使用 `duration`。

取值：

| 模型 | 取值 |
|---|---|
| Seedance 1.0 pro / pro-fast | `[2, 12]` 秒 |
| Seedance 1.5 pro | `[4, 12]` 或 `-1` |
| Seedance 2.0 系列 | `[4, 15]` 或 `-1` |

Seedance 2.0 支持两种配置：

| 配置 | 说明 |
|---|---|
| 指定具体整数秒 | 例如 `5`、`8`、`15`。 |
| `-1` | 由模型在有效范围内自动选择整数秒，实际时长需查询任务结果。注意时长影响计费。 |

### 6.7 `frames`

类型：`integer`

说明：指定生成帧数，可用于控制小数秒长度。

限制：

| 项目 | 说明 |
|---|---|
| Seedance 2.0 系列 | 暂不支持 |
| Seedance 1.5 pro | 暂不支持 |
| 计算公式 | 帧数 = 时长 × 24 |
| 取值范围 | `[29, 289]` 且满足 `25 + 4n`，n 为正整数 |

Seedance 2.0 接入时不建议传 `frames`。

### 6.8 `seed`

类型：`integer`

默认值：`-1`

取值范围：`[-1, 2^32 - 1]`

说明：控制随机性。`-1` 或不传表示使用随机种子。相同请求 + 相同 seed 会生成相似结果，但不保证完全一致。

### 6.9 `camera_fixed`

类型：`boolean`

默认值：`false`

限制：参考图场景不支持；Seedance 2.0 系列暂不支持。

说明：

| 值 | 说明 |
|---|---|
| `true` | 固定摄像头。平台会追加固定摄像头相关提示，但效果不保证。 |
| `false` | 不固定摄像头。 |

Seedance 2.0 接入时不建议传该字段，或需要在 UI 中禁用。

### 6.10 `watermark`

类型：`boolean`

默认值：`false`

说明：控制输出视频是否带水印。

| 值 | 说明 |
|---|---|
| `true` | 右下角展示 `AI 生成` 水印。 |
| `false` | 不展示水印。 |

## 7. 首帧、首尾帧、多模态参考的接入要点

### 7.1 首帧图生视频

请求示例：

```json
{
  "model": "doubao-seedance-2-0-260128",
  "content": [
    {
      "type": "image_url",
      "image_url": {
        "url": "https://example.com/first.png"
      },
      "role": "first_frame"
    },
    {
      "type": "text",
      "text": "角色从画面左侧转身看向镜头，背景有轻微风动"
    }
  ],
  "duration": 5,
  "ratio": "adaptive",
  "generate_audio": false
}
```

也可以不传 `role`，但为了工程上稳定识别，建议显式传 `first_frame`。

### 7.2 首尾帧图生视频

请求示例：

```json
{
  "model": "doubao-seedance-2-0-260128",
  "content": [
    {
      "type": "image_url",
      "image_url": {
        "url": "https://example.com/first.png"
      },
      "role": "first_frame"
    },
    {
      "type": "image_url",
      "image_url": {
        "url": "https://example.com/last.png"
      },
      "role": "last_frame"
    },
    {
      "type": "text",
      "text": "从第一张画面自然过渡到第二张画面，保持角色身份和服装一致"
    }
  ],
  "duration": 6,
  "resolution": "720p",
  "ratio": "adaptive",
  "generate_audio": false
}
```

工程判断：

| 用户选择 | content 构造 |
|---|---|
| 文生视频 | 只传 `text`。 |
| 首帧生成 | 传 1 张图，`role: first_frame`，可选 `text`。 |
| 首尾帧生成 | 传 2 张图，分别是 `first_frame` 和 `last_frame`，可选 `text`。 |
| 多模态参考 | 参考图用 `reference_image`，参考视频用 `reference_video`，参考音频用 `reference_audio`，可选 `text`。 |

### 7.3 多模态参考生视频

请求示例：

```json
{
  "model": "doubao-seedance-2-0-260128",
  "content": [
    {
      "type": "image_url",
      "image_url": {
        "url": "https://example.com/reference-1.png"
      },
      "role": "reference_image"
    },
    {
      "type": "video_url",
      "video_url": {
        "url": "https://example.com/reference.mp4"
      },
      "role": "reference_video"
    },
    {
      "type": "audio_url",
      "audio_url": {
        "url": "https://example.com/reference.wav"
      },
      "role": "reference_audio"
    },
    {
      "type": "text",
      "text": "参考图保持人物造型，参考视频保持动作节奏，生成一个 16:9 的电影感镜头"
    }
  ],
  "duration": 8,
  "ratio": "16:9",
  "generate_audio": true
}
```

注意：多模态参考模式不要和 `first_frame` / `last_frame` role 混用。如果需要严格首尾帧，优先使用首尾帧图生视频模式。

## 8. 响应参数

创建任务接口返回：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 视频生成任务 ID。任务 ID 仅保存 7 天，从 `created_at` 开始计算。 |

说明：

| 场景 | `id` 含义 |
|---|---|
| `draft: true` | Draft 视频任务 ID。 |
| `draft: false` 或不传 | 正常视频任务 ID。 |

创建任务是异步接口。拿到 `id` 后，需要调用查询接口获取状态、视频 URL、可能的尾帧图像和用量信息。

## 9. 工程接入建议

### 9.1 必须显式支持的 UI/配置项

| UI 项 | 对应 API 字段 | Seedance 2.0 建议 |
|---|---|---|
| 生成模式 | `content[].role` | 至少支持：文生、首帧、首尾帧、多模态参考。 |
| 是否输出声音 | `generate_audio` | 默认可按官方默认 `true`，但产品最好提供开关。 |
| 是否水印 | `watermark` | 默认 `false`，可提供开关。 |
| 时长 | `duration` | Seedance 2.0 支持 `[4,15]` 或 `-1`。 |
| 分辨率 | `resolution` | 默认 `720p`；2.0 fast 不可选 1080p。 |
| 宽高比 | `ratio` | 默认 `adaptive`，也可提供常见比例。 |
| 随机种子 | `seed` | 可高级设置，默认 `-1`。 |
| 返回尾帧 | `return_last_frame` | 用于连续视频生成工作流。 |
| 固定镜头 | `camera_fixed` | Seedance 2.0 暂不支持，不建议展示或发送。 |

### 9.2 接入时容易踩坑的点

| 问题 | 建议 |
|---|---|
| 把首尾帧和参考图混用 | 不要在同一次请求中混用 `first_frame/last_frame` 与 `reference_image/reference_video/reference_audio`。 |
| 还使用文本后缀参数 | 新接入建议使用 request body 顶层参数，例如 `duration`、`resolution`、`watermark`。 |
| 忘记声音开关 | Seedance 2.0 默认 `generate_audio: true`，如果产品希望默认无声，应显式传 `false`。 |
| 继续传 `camera_fixed` | 文档标注 Seedance 2.0 暂不支持，建议禁用。 |
| 时长仍限制为 5/10 秒 | Seedance 2.0 支持 4-15 秒整数或 `-1` 智能时长，应放宽。 |
| 1080p 默认 | Seedance 2.0 默认是 720p，不是 1080p。 |
| 输入音频单独使用 | 不允许单独音频，必须同时有参考图或参考视频。 |
| 上传真人脸参考图/视频 | Seedance 2.0 对真人脸参考素材有限制，应走官方授权/虚拟人像/可信产物方案。 |

### 9.3 Cinecho 项目适配重点

如果在本项目中支持 Seedance 2.0，应至少考虑以下改动：

1. 视频模型配置中加入 `doubao-seedance-2-0-260128`。
2. 把 Seedance 2.0 的时长范围改为 `[4,15]`，并可选 `-1` 智能时长。
3. 默认分辨率使用 `720p`，宽高比默认 `adaptive`。
4. 增加「生成模式」选择：文生、首帧、首尾帧、多模态参考。
5. 根据模式生成不同 `role`：
   - 首帧：`first_frame`
   - 首尾帧：`first_frame` + `last_frame`
   - 多模态参考图：`reference_image`
   - 多模态参考视频：`reference_video`
   - 多模态参考音频：`reference_audio`
6. 增加声音开关，并映射为 `generate_audio`。
7. 不再只用 `--wm`、`--dur` 这类文本后缀，优先使用顶层 request body 字段。
8. 对 Seedance 2.0 禁用或不发送 `camera_fixed`。
9. 可选支持 `return_last_frame`，为连续镜头工作流打基础。
10. 如后续接入参考视频/音频，需要增加本地素材选择、URL/Base64/素材 ID 处理、大小和时长校验。

## 10. 常用请求模板

### 10.1 文生无声视频

```json
{
  "model": "doubao-seedance-2-0-260128",
  "content": [
    {
      "type": "text",
      "text": "夜晚的赛博朋克街道，霓虹灯倒映在雨水中，镜头低角度缓慢前推"
    }
  ],
  "duration": 5,
  "resolution": "720p",
  "ratio": "16:9",
  "generate_audio": false,
  "watermark": false
}
```

### 10.2 文生有声视频

```json
{
  "model": "doubao-seedance-2-0-260128",
  "content": [
    {
      "type": "text",
      "text": "清晨咖啡馆里，男人看向窗外说：“今天会是很好的一天。”背景有轻柔咖啡馆音乐和杯碟声"
    }
  ],
  "duration": 6,
  "resolution": "720p",
  "ratio": "16:9",
  "generate_audio": true,
  "watermark": false
}
```

### 10.3 首帧图生视频

```json
{
  "model": "doubao-seedance-2-0-260128",
  "content": [
    {
      "type": "image_url",
      "image_url": {
        "url": "https://example.com/first.png"
      },
      "role": "first_frame"
    },
    {
      "type": "text",
      "text": "从这张画面开始，人物缓慢抬头，镜头轻微推进，保持服装和场景一致"
    }
  ],
  "duration": 5,
  "ratio": "adaptive",
  "generate_audio": false
}
```

### 10.4 首尾帧图生视频

```json
{
  "model": "doubao-seedance-2-0-260128",
  "content": [
    {
      "type": "image_url",
      "image_url": {
        "url": "https://example.com/start.png"
      },
      "role": "first_frame"
    },
    {
      "type": "image_url",
      "image_url": {
        "url": "https://example.com/end.png"
      },
      "role": "last_frame"
    },
    {
      "type": "text",
      "text": "自然连接两张画面，中间过渡流畅，人物身份、服装、环境保持一致"
    }
  ],
  "duration": 8,
  "resolution": "720p",
  "ratio": "adaptive",
  "generate_audio": false,
  "return_last_frame": true
}
```

### 10.5 多模态参考有声视频

```json
{
  "model": "doubao-seedance-2-0-260128",
  "content": [
    {
      "type": "image_url",
      "image_url": {
        "url": "https://example.com/style-reference.png"
      },
      "role": "reference_image"
    },
    {
      "type": "audio_url",
      "audio_url": {
        "url": "https://example.com/voice-reference.wav"
      },
      "role": "reference_audio"
    },
    {
      "type": "text",
      "text": "参考图片的角色风格，生成一段角色转身介绍自己的短视频，语气自然"
    }
  ],
  "duration": 6,
  "ratio": "9:16",
  "generate_audio": true
}
```

注意：上面这个示例包含音频，因此必须同时包含参考图片或参考视频；不能只传音频。

