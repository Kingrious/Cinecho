# 🎬 Cinecho 1.0 · 极简本地版

> 把 AI 视频创作，装进一个桌面窗口。

Cinecho 是一款面向 AI 短视频创作的 **本地桌面工作台**。它像一块数字化的“导演板”，让你可以：

- 管理角色、服饰、场景等视觉资产；
- 像写剧本一样编排分镜；
- 调用 Seedance 等视频大模型一键出片；
- 再把生成好的片段拖入时间线，导出 **Final Cut Pro XML（FCPXML）** 序列。

无需打开十几个网页，Cinecho 把“创意 → 素材 → 视频 → 剪辑”整条链路，串在一个本地应用里。

---

## ✨ 它能做什么？

### 🎭 资产库（Library）
扫描并管理本地 `roles / costumes / scenes` 三类图片资产。每张图都自带同名 `.json` 元数据，记录提示词、模型、生成参数，随时回看、复用、迭代。

### 🎬 分镜（Storyboard）
创建多镜头脚本，为每个镜头填写内容、景别、运镜、演员，并基于资产库生成对应的镜头图。灵感落地，从“一句话”变成“一页分镜”。

### 🚀 创作（Creation）
调用 Seedance 视频模型，支持：

- 文生视频
- 首帧 / 首尾帧图生视频
- 多模态参考、编辑、延长
- 运镜、分辨率（480p / 720p / 1080p）、比例、时长、音频生成等参数

任务状态实时推送，队列并行度可在设置里调整。

### 🧵 拼接（Stitch）
把生成好的视频或本地素材拖进时间线，设置入出点，一键导出 **FCPXML**，直接进 Final Cut Pro 做精剪。

### ⚙️ 设置（Settings）
配置输出目录、主题、API Key、默认模型与提供商、视频并行槽位等。所有配置都保存在本地用户目录，原子写入，不怕崩溃丢失。

---

## 🚀 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/your-org/cinecho-local.git
cd cinecho-local

# 2. 安装依赖
npm install

# 3. 启动开发模式
npm run dev
```

首次使用前，请在应用内 **Settings（设置）** 中填入你的 **火山引擎 Ark API Key**，视频生成与提示词优化功能即可正常工作。

> 图像生成默认使用内置的 APIMart 测试 Key，建议在正式使用前替换为你自己的 Key。

---

## 🛠 常用脚本

| 命令 | 作用 |
|------|------|
| `npm run dev` | 启动 Electron + Vite 开发模式 |
| `npm run build` | 类型检查并构建到 `out/` |
| `npm run preview` | 预览构建产物 |
| `npm run lint` | 运行 ESLint 并自动修复 |

---

## 🧱 技术栈

- **桌面壳**：Electron `^41.2.1` + `electron-builder ^26.8.1`
- **构建工具**：`electron-vite ^5.0.0`（基于 Vite `^5.4.21`）
- **前端框架**：Vue `^3.3.4`（Composition API / `<script setup>`）
- **路由**：Vue Router `^4.2.4`
- **语言**：TypeScript `^5.0.2`
- **样式**：Tailwind CSS `^3.3.3`
- **图标**：`lucide-vue-next`
- **本地视频处理**：`fluent-ffmpeg` + `ffmpeg-static`

---

## 📁 项目结构

```
Cinecho-local/
├── package.json                 # 项目入口：out/main/index.js
├── electron.vite.config.ts      # electron-vite 配置
├── tailwind.config.js / postcss.config.js
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # 主进程入口与 IPC 业务核心
│   │   ├── logging.ts           # 日志与事件上报
│   │   └── volcengine/          # Ark / Seedance 适配器
│   ├── preload/                 # contextBridge 暴露安全 API
│   └── renderer/                # Vue3 前端
│       └── src/
│           ├── App.vue          # 无边框窗口 + 底部导航
│           ├── router/
│           ├── views/           # Home / Storyboard / Assets / Creation / Stitch / Settings
│           ├── components/
│           ├── api/media.ts     # IPC 调用 + 浏览器 dev bridge
│           └── types/media.ts   # 类型定义与模型能力表
├── api文档/                      # API 参考文档
├── costumes/、roles/、scenes/    # 示例图片资产
└── scripts/
    └── mock-log-server.py       # 本地日志 mock 服务
```

---

## 📦 资产输出目录

Cinecho 默认会把所有产物整理在你的 **Documents/Cinecho/Assets** 下：

```
~/Documents/Cinecho/Assets/
├── roles/                       # 角色三视图
├── costumes/                    # 服饰设计稿
├── scenes/                      # 场景氛围图
├── storyboards/{id}/            # 分镜脚本与镜头图
└── videos/                      # 生成的 MP4 视频
```

每个图片 / 视频都会附带同名 `.json` 元数据，方便后续追踪和复刻。

---

## 🔌 已接入的 AI 服务

| 类型 | 默认提供商 | 可用模型示例 |
|------|------------|--------------|
| 视频生成 | Ark（火山引擎） | `doubao-seedance-2-0`、`seedance-1-5-pro`、`seedance-1-0-pro` 等 |
| 图像生成 | APIMart / Ark | `doubao-seedream-5-0`、`gpt-image-2`、`gemini-3-pro-image-preview` 等 |
| 提示词优化 | Ark | `doubao-seed-2-0-lite`（Responses API） |

UI 中也预留了 Google、Bailian、OpenRouter、MiniMax、Vidu、FAL 等平台的 Key 配置入口，后续可按需扩展。

---

## 🌙 主题与隐私

- 支持 **Light / Dark / System** 三种主题，在设置中随时切换。
- 默认开启日志上传（用于错误追踪），地址为 `https://cinecho.art/api/logs/upload`。如不需要，可在设置中关闭。

---

## 🤝 参与贡献

1. Fork 本仓库
2. 创建你的特性分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'Add some amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 发起 Pull Request

---

## 📄 许可证

[MIT](LICENSE)

---

<p align="center">
  Made with ❤️ for AI filmmakers.
</p>
