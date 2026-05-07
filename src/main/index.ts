import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron'
import { join, extname, basename, resolve, relative, isAbsolute } from 'path'
import { readdir, stat, unlink, writeFile, mkdir, readFile, rm, rename } from 'fs/promises'
import { pathToFileURL } from 'url'
import https from 'https'
import http from 'http'
import { createReadStream, existsSync } from 'fs'
import ffmpegStatic from 'ffmpeg-static'
import ffmpeg from 'fluent-ffmpeg'

// 存储配置路径
const STORE_PATH = join(app.getPath('userData'), 'storage.json')

// 支持的媒体文件扩展名
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi', '.mkv']

// 资产分类子目录
const ASSET_SUBDIRS = {
  roles: 'roles',
  costumes: 'costumes', 
  scenes: 'scenes',
  videos: 'videos' // 视频输出目录
  , storyboards: 'storyboards'
}

// 默认输出目录（用户文档目录下的Cinecho/Assets）
let outputDir = join(app.getPath('documents'), 'Cinecho', 'Assets')

const DEFAULT_SETTINGS = {
  outputDir,
  apiKeys: {} as Record<string, string>,
  defaultTextProvider: 'ark',
  defaultImageProvider: 'ark',
  defaultVideoProvider: 'ark',
  defaultTextModel: 'doubao-seed-2-0-lite-260215',
  defaultImageModel: 'doubao-seedream-5-0-260128',
  defaultVideoModel: 'doubao-seedance-1-0-pro-fast-251015',
  videoMaxParallel: 3,
  theme: 'light'
}

let runtimeSettings: any = { ...DEFAULT_SETTINGS }

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false
    }
  })

  // Load the remote URL for development or the local html file for production.
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:maximized', true)
  })

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:maximized', false)
  })
}

// ─── IPC Handlers ───

// 存储相关
ipcMain.handle('store:get', async () => {
  try {
    const data = await readFile(STORE_PATH, 'utf-8')
    const parsed = JSON.parse(data)
    const settings = normalizeSettings(parsed.settings || {})
    runtimeSettings = settings
    outputDir = settings.outputDir
    return { ...parsed, settings }
  } catch {
    // 返回默认配置
    return {
      settings: { ...runtimeSettings, outputDir },
      tasks: [],
      editHistory: []
    }
  }
})

ipcMain.handle('store:updateSetting', async (_event, settings) => {
  try {
    let data: any = {}
    try {
      const content = await readFile(STORE_PATH, 'utf-8')
      data = JSON.parse(content)
    } catch {
      // 文件不存在，使用默认配置
    }
    
    data.settings = normalizeSettings({ ...data.settings, ...settings })
    runtimeSettings = data.settings
    outputDir = data.settings.outputDir
    // 更新用户 API Key
    userApiKey = getEffectiveApiKey('ark')
    
    // 原子化写入
    await writeFile(STORE_PATH + '.tmp', JSON.stringify(data, null, 2))
    await rename(STORE_PATH + '.tmp', STORE_PATH)
    
    return true
  } catch (error) {
    console.error('Failed to update settings:', error)
    return false
  }
})

// 验证 API Key 有效性
ipcMain.handle('api:validateKey', async (_event, payload: string | { provider: string; apiKey: string }) => {
  const provider = typeof payload === 'string' ? 'ark' : payload.provider
  const apiKey = typeof payload === 'string' ? payload : payload.apiKey
  if (provider !== 'ark') {
    return validateProviderKey(provider, apiKey)
  }
  console.log('[API] 正在验证 API Key...')
  return new Promise((resolve) => {
    const testData = JSON.stringify({
      model: DOUBAO_LLM_MODEL,
      input: [
        { role: 'system', content: 'Reply with "OK" only.' },
        { role: 'user', content: 'Test' }
      ]
    })

    const options = {
      hostname: DOUBAO_BASE_URL,
      port: 443,
      path: '/api/v3/responses',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ valid: true })
        } else {
          try {
            const parsed = JSON.parse(data)
            resolve({ valid: false, error: parsed.error?.message || `HTTP ${res.statusCode}` })
          } catch {
            resolve({ valid: false, error: `HTTP ${res.statusCode}` })
          }
        }
      })
    })

    req.on('error', (error) => {
      resolve({ valid: false, error: error.message })
    })

    req.setTimeout(10000)
    req.write(testData)
    req.end()
  })
})

// 对话框相关
const validateProviderKey = async (provider: string, apiKey: string): Promise<{ valid: boolean; error?: string }> => {
  if (!apiKey?.trim()) return { valid: false, error: 'API Key 未配置' }
  const probes: Record<string, { url: string; init: RequestInit }> = {
    google: { url: 'https://generativelanguage.googleapis.com/v1beta/models', init: { headers: { 'x-goog-api-key': apiKey } } },
    bailian: { url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/models', init: { headers: { Authorization: `Bearer ${apiKey}` } } },
    openrouter: { url: 'https://openrouter.ai/api/v1/credits', init: { headers: { Authorization: `Bearer ${apiKey}` } } },
    minimax: {
      url: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
      init: { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'MiniMax-M2.5', messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }) }
    },
    vidu: { url: 'https://api.vidu.com/ent/v2/credits', init: { headers: { Authorization: `Token ${apiKey}` } } },
    fal: {
      url: 'https://fal.run/fal-ai/fast-sdxl',
      init: { method: 'POST', headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'ping', image_size: 'square_hd', num_images: 1 }) }
    }
  }
  const probe = probes[provider]
  if (!probe) return { valid: false, error: `Unsupported provider: ${provider}` }
  try {
    const res = await fetch(probe.url, probe.init)
    if (res.ok) return { valid: true }
    const text = await res.text()
    return { valid: false, error: `HTTP ${res.status}: ${text.substring(0, 160)}` }
  } catch (error: any) {
    return { valid: false, error: error?.message || String(error) }
  }
}

ipcMain.handle('dialog:selectDir', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: '选择媒体输出目录'
  })
  
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  
  return result.filePaths[0]
})

ipcMain.handle('dialog:selectFiles', async (_event, filters?: { name: string; extensions: string[] }[]) => {
  const defaultFilters = [
    { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
    { name: 'Videos', extensions: ['mp4', 'webm', 'mov', 'avi'] },
    { name: 'All Media', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'webm', 'mov', 'avi'] }
  ]
  
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    title: '选择媒体文件',
    filters: filters || defaultFilters
  })
  
  if (result.canceled) {
    return null
  }
  
  return result.filePaths
})

// 媒体相关
ipcMain.handle('media:getOutputDirectory', async () => {
  return outputDir
})

ipcMain.handle('media:setOutputDirectory', async (_event, path: string) => {
  try {
    outputDir = path
    // 保存到存储
    await updateStoreSettings({ outputDir: path })
    return true
  } catch (error) {
    console.error('Failed to set output directory:', error)
    return false
  }
})

ipcMain.handle('media:scanDirectory', async (_event, dirPath?: string) => {
  const targetDir = dirPath || outputDir
  const assets: any[] = []
  
  // 确定资产类型
  const getAssetType = (path: string): 'role' | 'costume' | 'scene' | null => {
    const lowerPath = path.toLowerCase()
    if (lowerPath.includes('/roles/') || lowerPath.includes('\\roles\\')) return 'role'
    if (lowerPath.includes('/costumes/') || lowerPath.includes('\\costumes\\')) return 'costume'
    if (lowerPath.includes('/scenes/') || lowerPath.includes('\\scenes\\')) return 'scene'
    return null
  }
  
  try {
    // 首先检查是否有子目录
    let entries = await readdir(targetDir, { withFileTypes: true })
    
    // 扫描各个分类子目录
    for (const subdir of Object.values(ASSET_SUBDIRS)) {
      const subdirPath = join(targetDir, subdir as string)
      try {
        const subdirEntries = await readdir(subdirPath, { withFileTypes: true })
        for (const entry of subdirEntries) {
          if (!entry.isFile()) continue
          
          const ext = extname(entry.name).toLowerCase()
          if (!IMAGE_EXTENSIONS.includes(ext)) continue
          
          const fullPath = join(subdirPath, entry.name)
          const assetType = getAssetType(fullPath)
          if (!assetType) continue
          
          try {
            assets.push(await buildImageAssetRecord(fullPath, assetType, (filePath) => pathToFileURL(filePath).href))
          } catch (err) {
            console.error(`Failed to stat file ${fullPath}:`, err)
          }
        }
      } catch {
        // 子目录不存在，跳过
      }
    }
    
    // 如果没有子目录，直接扫描根目录下的图片
    if (assets.length === 0) {
      for (const entry of entries) {
        if (!entry.isFile()) continue
        
        const ext = extname(entry.name).toLowerCase()
        if (!IMAGE_EXTENSIONS.includes(ext)) continue
        
        const fullPath = join(targetDir, entry.name)
        
        try {
          assets.push(await buildImageAssetRecord(fullPath, 'role', (filePath) => pathToFileURL(filePath).href))
        } catch (err) {
          console.error(`Failed to stat file ${fullPath}:`, err)
        }
      }
    }
  } catch (err) {
    console.error(`Failed to scan directory ${targetDir}:`, err)
  }
  
  // 按修改时间倒序排列（最新的在前）
  return assets.sort((a, b) => b.modifiedAt - a.modifiedAt)
})

ipcMain.handle('media:getAssetStats', async (_event, dirPath?: string) => {
  const targetDir = dirPath || outputDir
  const stats = { totalRoles: 0, totalCostumes: 0, totalScenes: 0 }
  
  for (const [type, subdir] of Object.entries(ASSET_SUBDIRS)) {
    const subdirPath = join(targetDir, subdir)
    try {
      const entries = await readdir(subdirPath, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = extname(entry.name).toLowerCase()
          if (IMAGE_EXTENSIONS.includes(ext)) {
            if (type === 'roles') stats.totalRoles++
            else if (type === 'costumes') stats.totalCostumes++
            else if (type === 'scenes') stats.totalScenes++
          }
        }
      }
    } catch {
      // 目录不存在
    }
  }
  
  return stats
})

const assetTypeFromPath = (filePath: string): 'role' | 'costume' | 'scene' | null => {
  const lowerPath = filePath.toLowerCase()
  if (lowerPath.includes('/roles/') || lowerPath.includes('\\roles\\')) return 'role'
  if (lowerPath.includes('/costumes/') || lowerPath.includes('\\costumes\\')) return 'costume'
  if (lowerPath.includes('/scenes/') || lowerPath.includes('\\scenes\\')) return 'scene'
  return null
}

type ImageAssetType = 'role' | 'costume' | 'scene'

type AssetGenerationMetadata = {
  version?: number
  type?: ImageAssetType | 'storyboard'
  name?: string
  prompt?: string
  corePrompt?: string
  generationPrompt?: string
  fullPrompt?: string
  negativePrompt?: string
  gender?: string
  ethnicity?: string
  age?: number
  features?: string[]
  sceneType?: string
  costumeMaterial?: string
  provider?: string
  model?: string
  imagePath?: string
  fileName?: string
  sourceImageUrl?: string
  generatedAt?: number
  updatedAt?: number
}

const appendUrlVersion = (url: string, version?: number | string) => {
  if (!url || url.startsWith('data:')) return url
  const normalized = Number(version)
  const value = Number.isFinite(normalized) ? Math.floor(normalized) : Date.now()
  return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(String(value))}`
}

const getAssetMetadataPath = (filePath: string) => `${filePath}.json`

const readAssetMetadata = async (filePath: string): Promise<AssetGenerationMetadata | null> => {
  try {
    return JSON.parse(await readFile(getAssetMetadataPath(filePath), 'utf-8'))
  } catch {
    return null
  }
}

const writeAssetMetadata = async (filePath: string, metadata: AssetGenerationMetadata) => {
  await writeFile(getAssetMetadataPath(filePath), JSON.stringify(metadata, null, 2), 'utf-8')
}

const assetUrlWithVersion = (
  filePath: string,
  assetUrlFor: (filePath: string) => string,
  version?: number | string
) => appendUrlVersion(assetUrlFor(filePath), version)

const buildImageAssetRecord = async (
  fullPath: string,
  type: ImageAssetType,
  thumbnailFor: (filePath: string) => string
) => {
  const fileStat = await stat(fullPath)
  const ext = extname(fullPath)
  const metadata = await readAssetMetadata(fullPath)
  const metadataAge = Number(metadata?.age)
  const prompt = metadata?.corePrompt || metadata?.prompt || metadata?.generationPrompt
  const version = metadata?.updatedAt || metadata?.generatedAt || fileStat.mtimeMs

  return {
    id: Buffer.from(fullPath).toString('base64'),
    name: metadata?.name || basename(fullPath, ext),
    path: fullPath,
    type,
    thumbnail: appendUrlVersion(thumbnailFor(fullPath), version),
    size: fileStat.size,
    width: undefined,
    height: undefined,
    createdAt: fileStat.birthtimeMs,
    modifiedAt: fileStat.mtimeMs,
    status: 'ready',
    prompt,
    corePrompt: metadata?.corePrompt || metadata?.prompt,
    generationPrompt: metadata?.generationPrompt,
    fullPrompt: metadata?.fullPrompt,
    gender: metadata?.gender,
    ethnicity: metadata?.ethnicity,
    age: Number.isFinite(metadataAge) ? metadataAge : undefined,
    features: Array.isArray(metadata?.features) ? metadata.features : undefined,
    sceneType: metadata?.sceneType,
    costumeMaterial: metadata?.costumeMaterial,
    generationSettings: metadata || undefined
  }
}

const writeGeneratedImageMetadata = async (
  filePath: string,
  fileName: string,
  options: GenerateImageOptions,
  fullPrompt: string,
  negativePrompt: string,
  sourceImageUrl?: string
) => {
  const now = Date.now()
  const metadata: AssetGenerationMetadata = {
    version: 1,
    type: options.type,
    name: options.name || basename(fileName, extname(fileName)),
    prompt: options.corePrompt || options.prompt,
    corePrompt: options.corePrompt || options.prompt,
    generationPrompt: options.prompt,
    fullPrompt,
    negativePrompt,
    gender: options.gender,
    ethnicity: options.ethnicity,
    age: options.age,
    features: options.features,
    sceneType: options.sceneType,
    costumeMaterial: options.costumeMaterial,
    provider: options.provider || runtimeSettings.defaultImageProvider || 'ark',
    model: options.model || runtimeSettings.defaultImageModel || IMAGE_GENERATE_MODEL,
    imagePath: filePath,
    fileName,
    sourceImageUrl,
    generatedAt: now,
    updatedAt: now
  }
  await writeAssetMetadata(filePath, metadata)
}

const deleteAssetAndMetadata = async (assetPath: string) => {
  await unlink(assetPath)
  await rm(getAssetMetadataPath(assetPath), { force: true })
}

const scanAssetDirectory = async (
  dirPath = outputDir,
  thumbnailFor: (filePath: string) => string = (filePath) => pathToFileURL(filePath).href
) => {
  const assets: any[] = []

  try {
    const rootEntries = await readdir(dirPath, { withFileTypes: true })
    for (const subdir of [ASSET_SUBDIRS.roles, ASSET_SUBDIRS.costumes, ASSET_SUBDIRS.scenes]) {
      const subdirPath = join(dirPath, subdir)
      try {
        const entries = await readdir(subdirPath, { withFileTypes: true })
        for (const entry of entries) {
          if (!entry.isFile()) continue
          const ext = extname(entry.name).toLowerCase()
          if (!IMAGE_EXTENSIONS.includes(ext)) continue
          const fullPath = join(subdirPath, entry.name)
          const type = assetTypeFromPath(fullPath)
          if (!type) continue
          assets.push(await buildImageAssetRecord(fullPath, type, thumbnailFor))
        }
      } catch {
        // Missing category folders are allowed.
      }
    }

    if (assets.length === 0) {
      for (const entry of rootEntries) {
        if (!entry.isFile()) continue
        const ext = extname(entry.name).toLowerCase()
        if (!IMAGE_EXTENSIONS.includes(ext)) continue
        const fullPath = join(dirPath, entry.name)
        assets.push(await buildImageAssetRecord(fullPath, 'role', thumbnailFor))
      }
    }
  } catch (error) {
    console.error(`Failed to scan directory ${dirPath}:`, error)
  }

  return assets.sort((a, b) => b.modifiedAt - a.modifiedAt)
}

const getAssetStatsForDirectory = async (dirPath = outputDir) => {
  const stats = { totalRoles: 0, totalCostumes: 0, totalScenes: 0 }
  for (const [type, subdir] of Object.entries({
    roles: ASSET_SUBDIRS.roles,
    costumes: ASSET_SUBDIRS.costumes,
    scenes: ASSET_SUBDIRS.scenes
  })) {
    try {
      const entries = await readdir(join(dirPath, subdir), { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isFile()) continue
        const ext = extname(entry.name).toLowerCase()
        if (!IMAGE_EXTENSIONS.includes(ext)) continue
        if (type === 'roles') stats.totalRoles++
        if (type === 'costumes') stats.totalCostumes++
        if (type === 'scenes') stats.totalScenes++
      }
    } catch {
      // Missing category folders are allowed.
    }
  }
  return stats
}

ipcMain.handle('media:deleteAsset', async (_event, assetPath: string) => {
  try {
    await deleteAssetAndMetadata(assetPath)
    return true
  } catch (error) {
    console.error('Failed to delete asset:', error)
    return false
  }
})

ipcMain.handle('media:revealInExplorer', async (_event, filePath: string) => {
  shell.showItemInFolder(filePath)
})

ipcMain.handle('media:openAsset', async (_event, filePath: string) => {
  shell.openPath(filePath)
})

ipcMain.handle('system:openDirectory', async (_event, dirPath: string) => {
  shell.openPath(dirPath)
})

ipcMain.handle('window:minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) win.minimize()
})

ipcMain.handle('window:maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win && !win.isMaximized()) win.maximize()
  return !!win?.isMaximized()
})

ipcMain.handle('window:unmaximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win && win.isMaximized()) win.unmaximize()
  return !!win?.isMaximized()
})

ipcMain.handle('window:toggleMaximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return false
  if (win.isMaximized()) {
    win.unmaximize()
  } else {
    win.maximize()
  }
  return win.isMaximized()
})

ipcMain.handle('window:isMaximized', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  return !!win?.isMaximized()
})

ipcMain.handle('window:close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) win.close()
})

// ─── API Configuration (用户可配置) ───
let userApiKey = '' // 用户配置的 API Key

const normalizeSettings = (settings: any = {}) => {
  const apiKeys = { ...(settings.apiKeys || {}) }
  if (settings.apiKey && !apiKeys.ark) apiKeys.ark = settings.apiKey
  const parsedVideoMaxParallel = Number(settings.videoMaxParallel ?? DEFAULT_SETTINGS.videoMaxParallel)
  const videoMaxParallel = Number.isFinite(parsedVideoMaxParallel)
    ? Math.min(10, Math.max(1, Math.round(parsedVideoMaxParallel)))
    : DEFAULT_SETTINGS.videoMaxParallel
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    apiKeys,
    outputDir: settings.outputDir || outputDir,
    videoMaxParallel
  }
}

const readStoreData = async () => {
  try {
    const content = await readFile(STORE_PATH, 'utf-8')
    return JSON.parse(content)
  } catch {
    return { settings: { ...runtimeSettings, outputDir }, tasks: [], editHistory: [] }
  }
}

const updateStoreSettings = async (settings: any) => {
  const data = await readStoreData()
  data.settings = normalizeSettings({ ...(data.settings || {}), ...settings })
  runtimeSettings = data.settings
  outputDir = data.settings.outputDir
  userApiKey = getEffectiveApiKey('ark')
  await writeFile(STORE_PATH + '.tmp', JSON.stringify(data, null, 2), 'utf-8')
  await rename(STORE_PATH + '.tmp', STORE_PATH)
  return true
}

// 获取用户配置的 API Key（不再使用默认值）
const getEffectiveApiKey = (provider = 'ark'): string => {
  const key = runtimeSettings?.apiKeys?.[provider]
  if (key) return key
  return provider === 'ark' ? userApiKey : ''
}

// 检查 API Key 是否已配置
const checkApiKeyConfigured = (provider = 'ark'): { configured: boolean; error?: string } => {
  const key = getEffectiveApiKey(provider)
  if (!key || !key.trim()) {
    return { configured: false, error: 'API Key 未配置，请先在 Settings 页面配置有效的 API Key' }
  }
  return { configured: true }
}

const DOUBAO_BASE_URL = 'ark.cn-beijing.volces.com'
const DOUBAO_LLM_MODEL = 'doubao-seed-2-0-lite-260215'

// 豆包图像生成 API 配置
const IMAGE_GENERATE_MODEL = 'doubao-seedream-5-0-260128'  // 使用用户提供的官方模型

// 豆包视频生成 API 配置
const VIDEO_GENERATE_MODELS = {
  'doubao-seedance-1-0-pro-fast-251015': {
    name: 'Seedance 1.0 Pro Fast',
    maxDuration: 10,
    defaultResolution: '1080p',
    supportedDurations: [5, 10],
    imageMode: 'first_frame',
    maxReferenceFrames: 1
  },
  'doubao-seedance-1-5-pro-251215': {
    name: 'Seedance 1.5 Pro',
    maxDuration: 10,
    defaultResolution: '1080p',
    supportedDurations: [5, 10],
    imageMode: 'first_last_frame',
    maxReferenceFrames: 2
  }
}

// 提示词优化的系统指令（严格格式要求）
const OPTIMIZE_PROMPT_SYSTEM = `你是一个专业的AI图像生成提示词优化助手。你的任务是将用户输入的简短描述优化为详细的图像生成提示词。

重要规则（必须严格遵守）：
1. 直接输出优化后的提示词，不要询问问题，不要解释，不要添加任何前缀
2. 输出格式：只输出优化后的提示词文本，一个字都不要多
3. 禁止输出任何引导语、问题、解释或备注
4. 禁止输出"好的"、"当然"、"以下是"等开头
5. 禁止输出"你想"、"请问"等询问性内容
6. 保持原语言（中文输入中文输出，英文输入英文输出）
7. 示例输入输出：
   - 输入："美女" 输出：一位精致的亚洲女性，柔和的自然光照射，细腻的皮肤纹理，高清摄影风格，背景虚化
   - 输入：" sunset" 输出: A breathtaking sunset scene with vibrant orange and purple hues, golden hour lighting, silhouette of palm trees, cinematic composition, 4K quality
8. 如果输入已经是详细的提示词，可以适当精简但必须直接返回结果`

// 清理优化结果中的不必要前缀
const cleanupOptimizedPrompt = (text: string): string => {
  if (!text) return text
  
  // 移除开头的"[优化后]"、"以下是优化后的提示词："等常见前缀
  let cleaned = text.replace(/^\[优化后\]\s*/gi, '')
  cleaned = cleaned.replace(/^以下是优化后的提示词[：:]?\s*/gi, '')
  cleaned = cleaned.replace(/^优化后[：:]?\s*/gi, '')
  
  // 移除开头的列表标记（1. 2. - * 等）
  cleaned = cleaned.replace(/^[\d]+[\.、]\s*/, '')
  cleaned = cleaned.replace(/^[\-\*\+]\s*/, '')
  
  // 移除首尾引号
  cleaned = cleaned.replace(/^["'']*/,'')
  cleaned = cleaned.replace(/["'']*$/,'')
  
  return cleaned.trim()
}

ipcMain.handle('ai:optimizePrompt', async (_event, originalPrompt: string) => {
  console.log('[AI] Starting prompt optimization:', originalPrompt.substring(0, 50) + '...')

  // 检查 API Key 是否已配置
  const keyCheck = checkApiKeyConfigured('ark')
  if (!keyCheck.configured) {
    console.error('[AI] API Key 未配置')
    throw new Error(keyCheck.error)
  }

  return new Promise((resolve, reject) => {
    // 使用 Responses API 格式，传入 system prompt 和 user input
    const postData = JSON.stringify({
      model: DOUBAO_LLM_MODEL,
      input: [
        {
          role: 'system',
          content: OPTIMIZE_PROMPT_SYSTEM
        },
        {
          role: 'user',
          content: originalPrompt
        }
      ]
    })

    const options = {
      hostname: DOUBAO_BASE_URL,
      port: 443,
      path: '/api/v3/responses',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getEffectiveApiKey()}`
      }
    }

    console.log('[AI] Sending request to Doubao API...')
    console.log('[AI] Model:', DOUBAO_LLM_MODEL)
    console.log('[AI] API Key:', getEffectiveApiKey().substring(0, 10) + '...')

    const req = https.request(options, (res) => {
      console.log('[AI] Response status:', res.statusCode)
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        console.log('[AI] Response data:', data.substring(0, 1000))
        
        // 检查 HTTP 状态码
        if (res.statusCode !== 200) {
          console.error('[AI] HTTP Error:', res.statusCode, res.statusMessage)
        }
        
        try {
          const parsed = JSON.parse(data)
          if (parsed.error) {
            console.error('[AI] API error:', parsed.error)
            reject(new Error(parsed.error.message || `API Error: ${parsed.error.code || 'Unknown'}`))
            return
          }
          
          // Responses API 返回格式解析
          let optimized = ''
          
          // 尝试多种可能的数据结构
          const output = parsed.output
          
          // 方式1: output 是数组
          if (output && Array.isArray(output)) {
            for (const item of output) {
              if (item.type === 'message' && item.content) {
                for (const content of item.content) {
                  if (content.type === 'output_text' && content.text) {
                    optimized = content.text.trim()
                    break
                  }
                }
              }
              if (optimized) break
            }
          }
          
          // 方式2: 直接在 output 中
          if (!optimized && output && output.content) {
            for (const content of output.content) {
              if (content.text) {
                optimized = content.text.trim()
                break
              }
            }
          }
          
          // 方式3: output.text
          if (!optimized && output && output.text) {
            optimized = output.text.trim()
          }
          
          // 方式4: 直接是 text 字段
          if (!optimized && parsed.text) {
            optimized = parsed.text.trim()
          }
          
          console.log('[AI] Parsed optimized text:', optimized ? optimized.substring(0, 100) : 'EMPTY')
          
          if (optimized) {
            resolve(cleanupOptimizedPrompt(optimized))
          } else {
            console.warn('[AI] No optimized content found in response')
            resolve(originalPrompt)
          }
        } catch (e) {
          console.error('[AI] Failed to parse response:', data, e)
          reject(new Error('Failed to parse LLM response'))
        }
      })
    })

    req.on('error', (error) => {
      console.error('[AI] Request failed:', error)
      reject(error)
    })

    req.write(postData)
    req.end()
  })
})

// ─── Image Generation (豆包 Seedream) ───
interface GenerateImageOptions {
  prompt: string
  corePrompt?: string
  type: 'role' | 'costume' | 'scene' | 'storyboard'
  name?: string
  gender?: string
  ethnicity?: string
  age?: number
  features?: string[]
  sceneType?: string
  costumeMaterial?: string
  provider?: string
  model?: string
  referenceImagePaths?: string[]
}

interface GenerateImageResult {
  success: boolean
  imageUrl?: string
  filePath?: string
  fileName?: string
  fileSize?: number
  error?: string
}

// ─── 精度增强：提示词工程 ───

// 质量增强前缀词（通用）
const QUALITY_PREFIX = 'masterpiece, best quality, ultra-detailed, photorealistic, sharp focus, professional photography'

// 民族外貌特征描述词库
const ETHNICITY_DESCRIPTORS: Record<string, string> = {
  east_asian: 'East Asian features, almond-shaped eyes, straight dark hair, fair smooth skin, delicate facial structure',
  caucasian: 'Caucasian features, defined bone structure, varied eye color, natural skin tone',
  black: 'Black features, rich deep skin tone, expressive eyes, strong facial structure',
  hispanic: 'Hispanic features, warm olive skin tone, dark expressive eyes, rich dark hair',
  south_asian: 'South Asian features, warm brown skin, dark eyes, dark lustrous hair'
}

// 图像生成负向提示词（通用）
const NEGATIVE_PROMPT_ROLE = 'deformed, disfigured, bad anatomy, extra limbs, missing fingers, blurry, low quality, watermark, text, logo, ugly, duplicate, morbid, mutilated, poorly drawn face, out of frame, child, teenager, underage, nude, naked, lingerie, bikini, underwear, cleavage, revealing clothing, erotic, sexual, seductive pose'
const NEGATIVE_PROMPT_COSTUME = 'deformed clothing, bad texture, blurry, low quality, watermark, text, mannequin deformed, floating fabric'
const NEGATIVE_PROMPT_SCENE = 'blurry, low quality, watermark, text, unrealistic proportions, deformed architecture, floor plan, elevation drawing, blueprint, wireframe, line art, black and white, monochrome, blank panel, empty panel'

// 构建角色提示词（结构化：质量词 + 主体 + 民族 + 性别年龄 + 特征 + 光照）
const buildRolePrompt = (basePrompt: string, gender?: string, age?: number, features?: string[], ethnicity?: string): string => {
  const parts: string[] = [QUALITY_PREFIX]

  // 性别描述
  const genderDesc = gender === 'female' ? 'an adult woman' : gender === 'male' ? 'an adult man' : 'an adult person'

  // 年龄描述
  let ageDesc = ''
  if (age) {
    const safeAge = Math.max(18, age)
    if (safeAge < 30) ageDesc = `${safeAge} years old, young adult,`
    else if (safeAge < 50) ageDesc = `${safeAge} years old,`
    else ageDesc = `${safeAge} years old, mature,`
  }

  // 民族描述
  const ethnicDesc = ethnicity && ETHNICITY_DESCRIPTORS[ethnicity] ? ETHNICITY_DESCRIPTORS[ethnicity] : ''

  // 外貌特征
  const featureDesc = features && features.length > 0 ? features.join(', ') : ''

  // 主体描述组合
  parts.push(`white background character turnaround sheet, horizontal three-view layout in one image: front view, side view, back view, aligned on the same baseline, equal scale, complete head-to-toe body, fully clothed practical costume, neutral standing pose, no cropped limbs, no text labels, ${genderDesc}, ${ageDesc} ${ethnicDesc}`)
  parts.push(basePrompt)
  if (featureDesc) parts.push(featureDesc)
  parts.push('neutral studio lighting, clean orthographic reference sheet, 8k resolution, RAW photo')

  return parts.filter(Boolean).join(', ')
}

// 构建服饰提示词（结构化：质量词 + 服饰主体 + 材质 + 光照）
const buildCostumePrompt = (basePrompt: string): string => {
  return `${QUALITY_PREFIX}, isolated clothing design sheet on pure white background, complete outfit display, front-facing full garment, no model face, no scene background, ${basePrompt}, detailed fabric texture, studio lighting, product photography, high-end fashion photography, 8k resolution`
}

// 构建场景提示词（结构化：质量词 + 场景主体 + 光照 + 氛围）
const buildScenePrompt = (basePrompt: string): string => {
  return `${QUALITY_PREFIX}, white background environment concept sheet, 2x2 grid with four fully colored 3D perspective renders of the same environment: front-left perspective, front-right perspective, rear-left perspective, rear-right perspective, consistent architecture and props across all four views, cinematic lighting, complete color and material rendering in every panel, no flat floor plan, no elevation drawing, no blueprint, no line art, no text labels, ${basePrompt}, professional environment design, 8k resolution`
}

// 下载图片到本地
const downloadImage = (url: string, outputPath: string): Promise<{ filePath: string; fileSize: number }> => {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http
    
    protocol.get(url, (response) => {
      // 处理重定向
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location
        if (redirectUrl) {
          downloadImage(redirectUrl, outputPath).then(resolve).catch(reject)
          return
        }
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP Error: ${response.statusCode}`))
        return
      }

      const fileStream = require('fs').createWriteStream(outputPath)
      let totalSize = 0

      response.on('data', (chunk: Buffer) => {
        totalSize += chunk.length
      })

      response.pipe(fileStream)

      fileStream.on('finish', () => {
        resolve({ filePath: outputPath, fileSize: totalSize })
      })

      fileStream.on('error', (err: Error) => {
        reject(err)
      })
    }).on('error', (err: Error) => {
      reject(err)
    })
  })
}

ipcMain.handle('media:generateImage', async (_event, options: GenerateImageOptions): Promise<GenerateImageResult> => {
  const provider = options.provider || runtimeSettings.defaultImageProvider || 'ark'
  if (provider !== 'ark') {
    return { success: false, error: `${provider} image generation is configured but not available in this local adapter yet. Use Ark for image generation.` }
  }
  // 检查 API Key 是否已配置
  const keyCheck = checkApiKeyConfigured(provider)
  if (!keyCheck.configured) {
    console.error('[ImageGen] API Key 未配置')
    return {
      success: false,
      error: keyCheck.error
    }
  }

  console.log('========================================')
  console.log('[ImageGen] ========== 开始图像生成 ==========')
  console.log('[ImageGen] 输入参数:', JSON.stringify({
    type: options.type,
    prompt: options.prompt?.substring(0, 100) + '...',
    gender: options.gender,
    age: options.age,
    features: options.features,
    sceneType: options.sceneType,
    costumeMaterial: options.costumeMaterial
  }))

  try {
    // 构建完整提示词（按类型分别构建）
    let fullPrompt = options.prompt
    let negativePrompt = ''

    if (options.type === 'role') {
      fullPrompt = buildRolePrompt(options.prompt, options.gender, options.age, options.features, options.ethnicity)
      negativePrompt = NEGATIVE_PROMPT_ROLE
      console.log('[ImageGen] 角色提示词已增强:', fullPrompt.substring(0, 100) + '...')
    } else if (options.type === 'costume') {
      fullPrompt = buildCostumePrompt(options.prompt)
      negativePrompt = NEGATIVE_PROMPT_COSTUME
      console.log('[ImageGen] 服饰提示词已增强:', fullPrompt.substring(0, 100) + '...')
    } else if (options.type === 'scene') {
      fullPrompt = buildScenePrompt(options.prompt)
      negativePrompt = NEGATIVE_PROMPT_SCENE
      console.log('[ImageGen] 场景提示词已增强:', fullPrompt.substring(0, 100) + '...')
    }

    // 确保输出目录存在
    const typeDir = options.type === 'role' ? 'roles' : options.type === 'costume' ? 'costumes' : 'scenes'
    const outputPath = join(outputDir, typeDir)
    console.log('[ImageGen] 目标目录:', outputPath)

    try {
      await mkdir(outputPath, { recursive: true })
    } catch {
      // 目录可能已存在，忽略
    }

    // 生成文件名（使用用户自定义名称，处理非法字符和重名）
    const timestamp = Date.now()
    const sanitizeFileName = (name: string): string => {
      // 移除或替换文件系统非法字符
      return name.replace(/[\\/:*?"<>|]/g, '_').trim() || `${typeDir}_${timestamp}`
    }

    const baseName = options.name ? sanitizeFileName(options.name) : `${typeDir}_${timestamp}`
    let fileName = `${baseName}.png`
    let localFilePath = join(outputPath, fileName)

    // 处理重名情况
    const { existsSync } = require('fs')
    let counter = 1
    while (existsSync(localFilePath)) {
      fileName = `${baseName}_${counter}.png`
      localFilePath = join(outputPath, fileName)
      counter++
    }

    console.log('[ImageGen] Full prompt:', fullPrompt.substring(0, 200))
    console.log('[ImageGen] Output path:', localFilePath)

    // 调用豆包图像生成API（完全按照官方文档格式）
    const postData = JSON.stringify({
      model: options.model || runtimeSettings.defaultImageModel || IMAGE_GENERATE_MODEL,
      prompt: fullPrompt,
      ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
      size: '2K',
      sequential_image_generation: 'disabled',
      response_format: 'url',
      stream: false,
      watermark: false
    })

    console.log('[ImageGen] ========== 开始调用豆包API ==========')
    console.log('[ImageGen] API端点:', `https://${DOUBAO_BASE_URL}/api/v3/images/generations`)
    console.log('[ImageGen] 模型:', IMAGE_GENERATE_MODEL)
    console.log('[ImageGen] API Key前缀:', getEffectiveApiKey().substring(0, 15) + '...')
    console.log('[ImageGen] 请求体:', postData)

    const requestOptions = {
      hostname: DOUBAO_BASE_URL,
      port: 443,
      path: '/api/v3/images/generations',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getEffectiveApiKey()}`
      }
    }

    // 使用 resolve 而非 reject，确保永远不抛出不可序列化的 Error 对象
    const result = await new Promise<GenerateImageResult>((resolve) => {
      const req = https.request(requestOptions, (res) => {
        console.log('[ImageGen] Response status:', res.statusCode)
        let data = ''

        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          console.log('[ImageGen] Response data length:', data.length)
          console.log('[ImageGen] Response preview:', data.substring(0, 500))

          if (res.statusCode !== 200) {
            console.error('[ImageGen] HTTP Error:', res.statusCode, res.statusMessage)
            resolve({
              success: false,
              error: `API Error: ${res.statusCode} ${res.statusMessage || 'Unknown'} - ${data.substring(0, 300)}`
            })
            return
          }

          try {
            const parsed = JSON.parse(data)
            console.log('[ImageGen] Parsed response:', JSON.stringify(parsed).substring(0, 500))

            if (parsed.error) {
              console.error('[ImageGen] API error:', parsed.error)
              resolve({
                success: false,
                error: parsed.error.message || JSON.stringify(parsed.error)
              })
              return
            }

            // 解析返回的图像URL
            // 官方API返回格式: { data: [{ url: "..." }] }
            let imageUrl: string | undefined

            if (parsed.data && Array.isArray(parsed.data) && parsed.data.length > 0) {
              const firstItem = parsed.data[0]
              if (typeof firstItem === 'string') {
                imageUrl = firstItem
              } else if (firstItem && typeof firstItem === 'object') {
                imageUrl = (firstItem as any).url || (firstItem as any).b64_json
              }
            }

            if (!imageUrl) {
              console.error('[ImageGen] No image URL in response:', JSON.stringify(parsed).substring(0, 500))
              resolve({
                success: false,
                error: `API返回中未找到图像数据: ${JSON.stringify(parsed).substring(0, 300)}`
              })
              return
            }

            console.log('[ImageGen] Got image URL, downloading...')

            // 检查是否是base64格式
            const isBase64 = imageUrl.startsWith('data:') || parsed.data?.[0]?.b64_json

            if (isBase64 && parsed.data?.[0]?.b64_json) {
              console.log('[ImageGen] 检测到base64图像数据，开始保存...')
              const base64Data = parsed.data[0].b64_json.replace(/^data:image\/\w+;base64,/, '')
              const buffer = Buffer.from(base64Data, 'base64')

              require('fs').writeFileSync(localFilePath, buffer)

              console.log('[ImageGen] ========== Base64图像保存成功 ==========')
              console.log('[ImageGen] 文件路径:', localFilePath)
              console.log('[ImageGen] 文件大小:', buffer.length, 'bytes')

              resolve({
                success: true,
                imageUrl: pathToFileURL(localFilePath).href,
                filePath: localFilePath,
                fileName: fileName,
                fileSize: buffer.length
              })
            } else {
              // 下载URL图片
              console.log('[ImageGen] ========== 开始下载图像 ==========')
              console.log('[ImageGen] 源URL:', imageUrl.substring(0, 100) + '...')
              console.log('[ImageGen] 保存到:', localFilePath)

              downloadImage(imageUrl, localFilePath)
                .then((downloadResult) => {
                  console.log('[ImageGen] ========== 图像下载成功 ==========')
                  console.log('[ImageGen] 文件路径:', downloadResult.filePath)
                  console.log('[ImageGen] 文件大小:', downloadResult.fileSize, 'bytes')
                  resolve({
                    success: true,
                    imageUrl: imageUrl,
                    filePath: downloadResult.filePath,
                    fileName: fileName,
                    fileSize: downloadResult.fileSize
                  })
                })
                .catch((err) => {
                  console.error('[ImageGen] Download failed:', err)
                  // 即使下载失败，也返回生成的URL
                  resolve({
                    success: true,
                    imageUrl: imageUrl,
                    filePath: '',
                    fileName: fileName,
                    error: `图片已生成但下载失败: ${err?.message || String(err)}`
                  })
                })
            }
          } catch (e: any) {
            console.error('[ImageGen] Parse error:', e, data)
            resolve({
              success: false,
              error: `解析响应失败: ${e?.message || String(e)}`
            })
          }
        })
      })

      req.on('error', (error: any) => {
        console.error('[ImageGen] Request failed:', error)
        resolve({
          success: false,
          error: `网络请求失败: ${error?.message || error?.code || String(error)}`
        })
      })

      req.on('timeout', () => {
        console.error('[ImageGen] Request timeout after 120s')
        req.destroy()
        resolve({
          success: false,
          error: '请求超时(120s)，图像生成耗时较长，请重试'
        })
      })

      req.setTimeout(120000)
      req.write(postData)
      req.end()
    })

    console.log('[ImageGen] ========== 生成结果 ==========')
    console.log('[ImageGen] success:', result.success)
    if (!result.success) {
      console.log('[ImageGen] error:', result.error)
    }
    console.log('[ImageGen] =======================================')

    if (result.success && result.filePath) {
      const sourceImageUrl = result.imageUrl
      try {
        await writeGeneratedImageMetadata(result.filePath, fileName, options, fullPrompt, negativePrompt, sourceImageUrl)
      } catch (metadataError) {
        console.warn('[ImageGen] Failed to write asset metadata:', metadataError)
      }
      result.imageUrl = assetUrlWithVersion(result.filePath, (filePath) => pathToFileURL(filePath).href)
    }

    return result
  } catch (error: any) {
    console.error('[ImageGen] ========== 生成失败(外层catch) ==========')
    console.error('[ImageGen] 错误:', error?.message || String(error))
    console.error('[ImageGen] =======================================')
    // 安全地构造错误信息，避免返回不可序列化的对象
    return {
      success: false,
      error: error?.message || (typeof error === 'string' ? error : '图像生成失败')
    }
  }
})

// ─── Video Generation (豆包 Seedance) ───
interface StoryboardShot {
  index: number
  status: 'ready' | 'generating' | 'failed'
  prompt: string
  content?: string
  lens?: string
  move?: string
  actor?: string
  imagePath?: string
  imageUrl?: string
  sourceImageUrl?: string
  thumbnail?: string
  roleAssetPath?: string
  costumeAssetPath?: string
  sceneAssetPath?: string
  roleAssetPaths?: string[]
  costumeAssetPaths?: string[]
  sceneAssetPaths?: string[]
  updatedAt?: number
  error?: string
}

interface StoryboardManifest {
  id: string
  name: string
  path: string
  shotCount: number
  shots: StoryboardShot[]
  createdAt: number
  modifiedAt: number
}

const sanitizeFileName = (name: string, fallback = `asset_${Date.now()}`): string => {
  const sanitized = name.replace(/[\\/:*?"<>|]/g, '_').trim()
  return sanitized || fallback
}

const getStoryboardsDir = () => join(outputDir, ASSET_SUBDIRS.storyboards)
const getStoryboardManifestPath = (storyboardDir: string) => join(storyboardDir, 'manifest.json')

const normalizePathList = (paths?: string[], legacyPath?: string) => {
  const values = Array.isArray(paths) ? paths.filter(Boolean) : []
  if (values.length > 0) return Array.from(new Set(values))
  return legacyPath ? [legacyPath] : []
}

const normalizeStoryboardShot = (shot: StoryboardShot): StoryboardShot => {
  const roleAssetPaths = normalizePathList(shot.roleAssetPaths, shot.roleAssetPath)
  const costumeAssetPaths = normalizePathList(shot.costumeAssetPaths, shot.costumeAssetPath)
  const sceneAssetPaths = normalizePathList(shot.sceneAssetPaths, shot.sceneAssetPath)
  const content = shot.content ?? shot.prompt ?? ''
  return {
    ...shot,
    status: shot.status || 'ready',
    prompt: shot.prompt ?? content,
    content,
    lens: shot.lens || '中景',
    move: shot.move || '固定',
    actor: shot.actor || '',
    roleAssetPaths,
    costumeAssetPaths,
    sceneAssetPaths,
    sourceImageUrl: shot.sourceImageUrl || shot.imageUrl,
    roleAssetPath: roleAssetPaths[0],
    costumeAssetPath: costumeAssetPaths[0],
    sceneAssetPath: sceneAssetPaths[0]
  }
}

const normalizeStoryboardManifest = (manifest: StoryboardManifest): StoryboardManifest => ({
  ...manifest,
  shots: manifest.shots.map(normalizeStoryboardShot)
})

const fileAssetUrl = (filePath: string) => pathToFileURL(filePath).href

const storyboardToAsset = (
  manifest: StoryboardManifest,
  assetUrlFor: (filePath: string) => string = fileAssetUrl
) => {
  manifest = normalizeStoryboardManifest(manifest)
  const firstReady = manifest.shots.find(shot => shot.imagePath)
  const completedCount = manifest.shots.filter(shot => shot.status === 'ready' && shot.imagePath).length
  return {
    ...manifest,
    thumbnail: firstReady?.imagePath ? assetUrlWithVersion(firstReady.imagePath, assetUrlFor, firstReady.updatedAt || manifest.modifiedAt) : '',
    completedCount,
    shots: manifest.shots.map(shot => {
      const localImageUrl = shot.imagePath ? assetUrlWithVersion(shot.imagePath, assetUrlFor, shot.updatedAt || manifest.modifiedAt) : ''
      return {
        ...shot,
        imageUrl: shot.sourceImageUrl || localImageUrl || shot.imageUrl,
        thumbnail: localImageUrl || shot.thumbnail
      }
    })
  }
}

const readStoryboardManifest = async (storyboardDir: string): Promise<StoryboardManifest | null> => {
  try {
    const data = await readFile(getStoryboardManifestPath(storyboardDir), 'utf-8')
    const parsed = JSON.parse(data) as StoryboardManifest
    return normalizeStoryboardManifest({ ...parsed, path: storyboardDir })
  } catch {
    return null
  }
}

const writeStoryboardManifest = async (manifest: StoryboardManifest) => {
  manifest.modifiedAt = Date.now()
  await writeFile(getStoryboardManifestPath(manifest.path), JSON.stringify(manifest, null, 2), 'utf-8')
}

const sanitizeStoryboardShots = (shots: StoryboardShot[] = []) => {
  return shots.map((shot, index) => normalizeStoryboardShot({
    ...shot,
    index: index + 1,
    status: shot.status === 'generating' ? 'generating' : shot.status === 'failed' ? 'failed' : 'ready',
    prompt: shot.prompt ?? shot.content ?? ''
  }))
}

const getStoryboardById = async (storyboardId: string): Promise<StoryboardManifest | null> => {
  const dir = join(getStoryboardsDir(), sanitizeFileName(storyboardId, storyboardId))
  return readStoryboardManifest(dir)
}

const buildStoryboardPrompt = (prompt: string, hasReferenceImages = false): string => {
  const referenceInstruction = hasReferenceImages
    ? ', coherent character costume and scene continuity from reference images'
    : ''
  return `${QUALITY_PREFIX}, cinematic storyboard frame, 16:9 composition${referenceInstruction}, production storyboard still, no text labels, no watermark, ${prompt}`
}

const referenceImageCache = new Map<string, string>()

const getImageMimeType = (filePath: string) => {
  const ext = extname(filePath).toLowerCase()
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.bmp') return 'image/bmp'
  throw new Error(`不支持的参考图格式：${ext || filePath}`)
}

const getReferenceImageDataUrls = async (referenceImagePaths: string[] = []) => {
  const dataUrls: string[] = []
  for (const filePath of Array.from(new Set(referenceImagePaths.filter(Boolean)))) {
    const ext = extname(filePath).toLowerCase()
    if (!IMAGE_EXTENSIONS.includes(ext)) {
      throw new Error(`参考图格式不支持：${basename(filePath)}`)
    }
    const fileStat = await stat(filePath)
    const cacheKey = `${filePath}|${fileStat.mtimeMs}|${fileStat.size}`
    const cached = referenceImageCache.get(cacheKey)
    if (cached) {
      dataUrls.push(cached)
      continue
    }
    const bytes = await readFile(filePath)
    const dataUrl = `data:${getImageMimeType(filePath)};base64,${bytes.toString('base64')}`
    referenceImageCache.set(cacheKey, dataUrl)
    dataUrls.push(dataUrl)
  }
  return dataUrls
}

const generateArkImageToFile = async (
  fullPrompt: string,
  localFilePath: string,
  fileName: string,
  negativePrompt = NEGATIVE_PROMPT_SCENE,
  referenceImagePaths: string[] = []
): Promise<GenerateImageResult> => {
  let referenceImages: string[] = []
  try {
    referenceImages = await getReferenceImageDataUrls(referenceImagePaths)
  } catch (error: any) {
    return { success: false, error: `参考图上传/读取失败：${error?.message || String(error)}` }
  }

  const postData = JSON.stringify({
    model: runtimeSettings.defaultImageModel || IMAGE_GENERATE_MODEL,
    prompt: fullPrompt,
    ...(referenceImages.length === 1 ? { image: referenceImages[0] } : {}),
    ...(referenceImages.length > 1 ? { image: referenceImages } : {}),
    ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
    size: '2K',
    sequential_image_generation: 'disabled',
    response_format: 'url',
    stream: false,
    watermark: false
  })

  return new Promise<GenerateImageResult>((resolve) => {
    const req = https.request({
      hostname: DOUBAO_BASE_URL,
      port: 443,
      path: '/api/v3/images/generations',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getEffectiveApiKey('ark')}`
      }
    }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        if (res.statusCode !== 200) {
          resolve({ success: false, error: `API Error: ${res.statusCode} ${res.statusMessage || ''} - ${data.substring(0, 300)}` })
          return
        }
        try {
          const parsed = JSON.parse(data)
          const firstItem = Array.isArray(parsed.data) ? parsed.data[0] : undefined
          const imageUrl = typeof firstItem === 'string' ? firstItem : firstItem?.url || firstItem?.b64_json
          if (!imageUrl) {
            resolve({ success: false, error: `API返回中未找到图像数据: ${data.substring(0, 300)}` })
            return
          }
          if (firstItem?.b64_json) {
            const base64Data = firstItem.b64_json.replace(/^data:image\/\w+;base64,/, '')
            const buffer = Buffer.from(base64Data, 'base64')
            require('fs').writeFileSync(localFilePath, buffer)
            resolve({ success: true, imageUrl: pathToFileURL(localFilePath).href, filePath: localFilePath, fileName, fileSize: buffer.length })
            return
          }
          downloadImage(imageUrl, localFilePath)
            .then((downloadResult) => resolve({ success: true, imageUrl, filePath: downloadResult.filePath, fileName, fileSize: downloadResult.fileSize }))
            .catch((err) => resolve({ success: true, imageUrl, filePath: '', fileName, error: `图片已生成但下载失败: ${err?.message || String(err)}` }))
        } catch (error: any) {
          resolve({ success: false, error: error?.message || String(error) })
        }
      })
    })
    req.on('error', (error: any) => resolve({ success: false, error: error?.message || String(error) }))
    req.setTimeout(120000)
    req.write(postData)
    req.end()
  })
}

ipcMain.handle('storyboard:scan', async () => {
  const storyboardsDir = getStoryboardsDir()
  await mkdir(storyboardsDir, { recursive: true })
  const entries = await readdir(storyboardsDir, { withFileTypes: true })
  const storyboards = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const manifest = await readStoryboardManifest(join(storyboardsDir, entry.name))
    if (manifest) storyboards.push(storyboardToAsset(manifest))
  }
  return storyboards.sort((a, b) => b.modifiedAt - a.modifiedAt)
})

ipcMain.handle('storyboard:create', async (_event, options: { name: string; shotCount: number }) => {
  const shotCount = Math.min(9, Math.max(3, Number(options.shotCount) || 3))
  const id = `${Date.now()}_${sanitizeFileName(options.name || 'storyboard')}`
  const storyboardDir = join(getStoryboardsDir(), id)
  await mkdir(storyboardDir, { recursive: true })
  const now = Date.now()
  const manifest: StoryboardManifest = {
    id,
    name: options.name?.trim() || 'Untitled Storyboard',
    path: storyboardDir,
    shotCount,
    createdAt: now,
    modifiedAt: now,
    shots: Array.from({ length: shotCount }, (_, i) => ({
      index: i + 1,
      status: 'ready',
      prompt: '',
      content: '',
      lens: '中景',
      move: '固定',
      actor: ''
    }))
  }
  await writeStoryboardManifest(manifest)
  return storyboardToAsset(manifest)
})

ipcMain.handle('storyboard:get', async (_event, storyboardId: string) => {
  const manifest = await getStoryboardById(storyboardId)
  return manifest ? storyboardToAsset(manifest) : null
})

ipcMain.handle('storyboard:update', async (_event, options: { storyboardId: string; name?: string; shots: StoryboardShot[] }) => {
  const manifest = await getStoryboardById(options.storyboardId)
  if (!manifest) throw new Error('Storyboard not found')
  manifest.name = options.name?.trim() || manifest.name
  manifest.shots = sanitizeStoryboardShots(options.shots)
  manifest.shotCount = manifest.shots.length
  await writeStoryboardManifest(manifest)
  return storyboardToAsset(manifest)
})

ipcMain.handle('storyboard:generateShot', async (_event, options: {
  storyboardId: string
  shotIndex: number
  prompt: string
  roleAssetPath?: string
  costumeAssetPath?: string
  sceneAssetPath?: string
  roleAssetPaths?: string[]
  costumeAssetPaths?: string[]
  sceneAssetPaths?: string[]
}) => {
  const keyCheck = checkApiKeyConfigured('ark')
  if (!keyCheck.configured) throw new Error(keyCheck.error)
  const manifest = await getStoryboardById(options.storyboardId)
  if (!manifest) throw new Error('Storyboard not found')
  const shot = manifest.shots.find(item => item.index === options.shotIndex)
  if (!shot) throw new Error('Storyboard shot not found')

  shot.status = 'generating'
  shot.prompt = options.prompt
  shot.content = shot.content || options.prompt
  shot.roleAssetPaths = normalizePathList(options.roleAssetPaths, options.roleAssetPath)
  shot.costumeAssetPaths = normalizePathList(options.costumeAssetPaths, options.costumeAssetPath)
  shot.sceneAssetPaths = normalizePathList(options.sceneAssetPaths, options.sceneAssetPath)
  shot.roleAssetPath = shot.roleAssetPaths[0]
  shot.costumeAssetPath = shot.costumeAssetPaths[0]
  shot.sceneAssetPath = shot.sceneAssetPaths[0]
  await writeStoryboardManifest(manifest)

  const fileName = `shot_${String(options.shotIndex).padStart(2, '0')}.png`
  const localFilePath = join(manifest.path, fileName)
  const refs = [
    ...(shot.roleAssetPaths || []),
    ...(shot.costumeAssetPaths || []),
    ...(shot.sceneAssetPaths || [])
  ]
  const result = await generateArkImageToFile(buildStoryboardPrompt(options.prompt, refs.length > 0), localFilePath, fileName, NEGATIVE_PROMPT_SCENE, refs)

  if (result.success && result.filePath) {
    shot.status = 'ready'
    shot.imagePath = result.filePath
    shot.sourceImageUrl = result.imageUrl
    shot.imageUrl = result.imageUrl
    shot.thumbnail = pathToFileURL(result.filePath).href
    shot.error = undefined
  } else {
    shot.status = 'failed'
    shot.error = result.error || 'Generation failed'
  }
  shot.updatedAt = Date.now()
  await writeStoryboardManifest(manifest)
  return storyboardToAsset(manifest)
})

ipcMain.handle('storyboard:delete', async (_event, storyboardId: string) => {
  const manifest = await getStoryboardById(storyboardId)
  if (!manifest) return false
  await rm(manifest.path, { recursive: true, force: true })
  return true
})

const scanStoryboardsData = async (assetUrlFor: (filePath: string) => string = fileAssetUrl) => {
  const storyboardsDir = getStoryboardsDir()
  await mkdir(storyboardsDir, { recursive: true })
  const entries = await readdir(storyboardsDir, { withFileTypes: true })
  const storyboards = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const manifest = await readStoryboardManifest(join(storyboardsDir, entry.name))
    if (manifest) storyboards.push(storyboardToAsset(manifest, assetUrlFor))
  }
  return storyboards.sort((a, b) => b.modifiedAt - a.modifiedAt)
}

const createStoryboardData = async (
  options: { name: string; shotCount: number },
  assetUrlFor: (filePath: string) => string = fileAssetUrl
) => {
  const shotCount = Math.min(9, Math.max(3, Number(options.shotCount) || 3))
  const id = `${Date.now()}_${sanitizeFileName(options.name || 'storyboard')}`
  const storyboardDir = join(getStoryboardsDir(), id)
  await mkdir(storyboardDir, { recursive: true })
  const now = Date.now()
  const manifest: StoryboardManifest = {
    id,
    name: options.name?.trim() || 'Untitled Storyboard',
    path: storyboardDir,
    shotCount,
    createdAt: now,
    modifiedAt: now,
    shots: Array.from({ length: shotCount }, (_, i) => ({
      index: i + 1,
      status: 'ready',
      prompt: '',
      content: '',
      lens: '中景',
      move: '固定',
      actor: ''
    }))
  }
  await writeStoryboardManifest(manifest)
  return storyboardToAsset(manifest, assetUrlFor)
}

const getStoryboardAssetData = async (
  storyboardId: string,
  assetUrlFor: (filePath: string) => string = fileAssetUrl
) => {
  const manifest = await getStoryboardById(storyboardId)
  return manifest ? storyboardToAsset(manifest, assetUrlFor) : null
}

const updateStoryboardData = async (
  options: { storyboardId: string; name?: string; shots: StoryboardShot[] },
  assetUrlFor: (filePath: string) => string = fileAssetUrl
) => {
  const manifest = await getStoryboardById(options.storyboardId)
  if (!manifest) throw new Error('Storyboard not found')
  manifest.name = options.name?.trim() || manifest.name
  manifest.shots = sanitizeStoryboardShots(options.shots)
  manifest.shotCount = manifest.shots.length
  await writeStoryboardManifest(manifest)
  return storyboardToAsset(manifest, assetUrlFor)
}

const generateStoryboardShotData = async (options: {
  storyboardId: string
  shotIndex: number
  prompt: string
  roleAssetPath?: string
  costumeAssetPath?: string
  sceneAssetPath?: string
  roleAssetPaths?: string[]
  costumeAssetPaths?: string[]
  sceneAssetPaths?: string[]
}, assetUrlFor: (filePath: string) => string = fileAssetUrl) => {
  const keyCheck = checkApiKeyConfigured('ark')
  if (!keyCheck.configured) throw new Error(keyCheck.error)
  const manifest = await getStoryboardById(options.storyboardId)
  if (!manifest) throw new Error('Storyboard not found')
  const shot = manifest.shots.find(item => item.index === options.shotIndex)
  if (!shot) throw new Error('Storyboard shot not found')

  shot.status = 'generating'
  shot.prompt = options.prompt
  shot.content = shot.content || options.prompt
  shot.roleAssetPaths = normalizePathList(options.roleAssetPaths, options.roleAssetPath)
  shot.costumeAssetPaths = normalizePathList(options.costumeAssetPaths, options.costumeAssetPath)
  shot.sceneAssetPaths = normalizePathList(options.sceneAssetPaths, options.sceneAssetPath)
  shot.roleAssetPath = shot.roleAssetPaths[0]
  shot.costumeAssetPath = shot.costumeAssetPaths[0]
  shot.sceneAssetPath = shot.sceneAssetPaths[0]
  await writeStoryboardManifest(manifest)

  const fileName = `shot_${String(options.shotIndex).padStart(2, '0')}.png`
  const localFilePath = join(manifest.path, fileName)
  const refs = [
    ...(shot.roleAssetPaths || []),
    ...(shot.costumeAssetPaths || []),
    ...(shot.sceneAssetPaths || [])
  ]
  const result = await generateArkImageToFile(buildStoryboardPrompt(options.prompt, refs.length > 0), localFilePath, fileName, NEGATIVE_PROMPT_SCENE, refs)

  if (result.success && result.filePath) {
    shot.status = 'ready'
    shot.imagePath = result.filePath
    shot.sourceImageUrl = result.imageUrl
    shot.imageUrl = result.imageUrl
    shot.thumbnail = pathToFileURL(result.filePath).href
    shot.error = undefined
  } else {
    shot.status = 'failed'
    shot.error = result.error || 'Generation failed'
  }
  shot.updatedAt = Date.now()
  await writeStoryboardManifest(manifest)
  return storyboardToAsset(manifest, assetUrlFor)
}

const deleteStoryboardData = async (storyboardId: string) => {
  const manifest = await getStoryboardById(storyboardId)
  if (!manifest) return false
  await rm(manifest.path, { recursive: true, force: true })
  return true
}

interface GenerateVideoOptions {
  prompt: string
  model: string
  provider?: string
  videoName?: string
  duration?: number
  resolution?: '720p' | '1080p'
  cameraFixed?: boolean
  watermark?: boolean
  referenceImagePaths?: string[]
  referenceFrameRoles?: Array<'first_frame' | 'reference_frame' | 'last_frame'>
  cameraMotion?: string
  storyboardId?: string
  storyboardName?: string
  storyboardShotOrder?: number[]
}

interface GenerateVideoResult {
  success: boolean
  videoUrl?: string
  filePath?: string
  fileName?: string
  fileSize?: number
  duration?: number
  error?: string
}

type VideoContentItem =
  | { type: 'text'; text: string }
  | { type: 'image_url'; role?: 'first_frame' | 'reference_frame' | 'last_frame'; image_url: { url: string } }

const isRemoteHttpUrl = (value?: string) => Boolean(value && /^https?:\/\//i.test(value))

type VideoReferenceFrame = {
  url: string
  source: 'local_data_url' | 'remote_url'
  localPath?: string
  remoteUrl?: string
  role?: 'first_frame' | 'reference_frame' | 'last_frame'
}

type VideoReferenceFrameInput = {
  localPath?: string
  remoteUrl?: string
  role?: 'first_frame' | 'reference_frame' | 'last_frame'
}

const resolveStoryboardFrameUrls = async (options: GenerateVideoOptions) => {
  if (!options.storyboardId || !options.storyboardShotOrder?.length) return []
  const manifest = await getStoryboardById(options.storyboardId)
  if (!manifest) return []
  return options.storyboardShotOrder
    .map(index => manifest.shots.find(shot => shot.index === index))
    .filter(Boolean)
    .map(shot => shot!.sourceImageUrl || shot!.imageUrl)
    .filter((url): url is string => isRemoteHttpUrl(url))
}

const resolveVideoReferenceFrame = async (
  localPath?: string,
  remoteUrl?: string,
  role?: 'first_frame' | 'reference_frame' | 'last_frame'
): Promise<VideoReferenceFrame | null> => {
  if (localPath) {
    try {
      const [dataUrl] = await getReferenceImageDataUrls([localPath])
      if (dataUrl) {
        return {
          url: dataUrl,
          source: 'local_data_url',
          localPath,
          remoteUrl,
          role
        }
      }
    } catch (error: any) {
      console.warn('[VideoGen] Failed to read local reference frame, fallback to remote URL:', localPath, error?.message || String(error))
    }
  }

  if (isRemoteHttpUrl(remoteUrl)) {
    return {
      url: remoteUrl!,
      source: 'remote_url',
      localPath,
      remoteUrl,
      role
    }
  }

  return null
}

const pickVideoReferenceFrameInputs = (
  referenceImagePaths: string[],
  referenceFrameUrls: string[],
  maxReferenceFrames: number,
  referenceFrameRoles: Array<'first_frame' | 'reference_frame' | 'last_frame'> = []
): VideoReferenceFrameInput[] => {
  const count = Math.max(referenceImagePaths.length, referenceFrameUrls.length)
  const inputs = Array.from({ length: count }, (_, index) => ({
    localPath: referenceImagePaths[index],
    remoteUrl: referenceFrameUrls[index],
    role: referenceFrameRoles[index]
  })).filter(item => item.localPath || item.remoteUrl)

  if (inputs.length <= maxReferenceFrames) return inputs
  if (maxReferenceFrames <= 1) return inputs.slice(0, 1)

  const middleSlots = Math.max(maxReferenceFrames - 2, 0)
  const first = inputs[0]
  const last = inputs[inputs.length - 1]
  const middle = inputs.slice(1, -1).slice(0, middleSlots)
  return [first, ...middle, last]
}

const scanGeneratedVideoAssets = async (
  dirPath = outputDir,
  assetUrlFor: (filePath: string) => string = fileAssetUrl
) => {
  const videosPath = join(dirPath, ASSET_SUBDIRS.videos)
  const videos: any[] = []

  try {
    await stat(videosPath)
  } catch {
    return []
  }

  try {
    const entries = await readdir(videosPath, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isFile()) continue

      const ext = extname(entry.name).toLowerCase()
      if (!VIDEO_EXTENSIONS.includes(ext)) continue

      const fullPath = join(videosPath, entry.name)

      try {
        const fileStat = await stat(fullPath)
        const name = basename(entry.name, ext)
        const url = assetUrlFor(fullPath)

        videos.push({
          id: Buffer.from(fullPath).toString('base64'),
          name,
          path: fullPath,
          url,
          type: 'video',
          thumbnail: url,
          size: fileStat.size,
          duration: 0,
          width: undefined,
          height: undefined,
          createdAt: fileStat.birthtimeMs,
          modifiedAt: fileStat.mtimeMs,
          status: 'ready'
        })
      } catch (err) {
        console.error(`Failed to stat video ${fullPath}:`, err)
      }
    }
  } catch (err) {
    console.error(`Failed to scan videos directory ${videosPath}:`, err)
  }

  return videos.sort((a, b) => b.modifiedAt - a.modifiedAt)
}

// 扫描视频目录
ipcMain.handle('media:scanVideos', async (_event, dirPath?: string) => {
  return scanGeneratedVideoAssets(dirPath || outputDir)
})

let activeVideoGenerationCount = 0
const pendingVideoGenerationResolvers: Array<() => void> = []

const getVideoMaxParallel = () => {
  const value = Number(runtimeSettings.videoMaxParallel ?? DEFAULT_SETTINGS.videoMaxParallel)
  return Number.isFinite(value) ? Math.min(10, Math.max(1, Math.round(value))) : DEFAULT_SETTINGS.videoMaxParallel
}

const acquireVideoGenerationSlot = async () => {
  await new Promise<void>((resolve) => {
    const tryAcquire = () => {
      if (activeVideoGenerationCount < getVideoMaxParallel()) {
        activeVideoGenerationCount += 1
        resolve()
        return
      }
      pendingVideoGenerationResolvers.push(tryAcquire)
    }
    tryAcquire()
  })

  return () => {
    activeVideoGenerationCount = Math.max(0, activeVideoGenerationCount - 1)
    const next = pendingVideoGenerationResolvers.shift()
    if (next) queueMicrotask(next)
  }
}

// 视频生成处理器
ipcMain.handle('media:generateVideo', async (_event, options: GenerateVideoOptions): Promise<GenerateVideoResult> => {
  const provider = options.provider || runtimeSettings.defaultVideoProvider || 'ark'
  if (provider !== 'ark') {
    return { success: false, error: `${provider} video generation is configured but not available in this local adapter yet. Use Ark for video generation.` }
  }
  // 检查 API Key 是否已配置
  const keyCheck = checkApiKeyConfigured(provider)
  if (!keyCheck.configured) {
    console.error('[VideoGen] API Key 未配置')
    return {
      success: false,
      error: keyCheck.error
    }
  }

  // 验证模型
  const modelConfig = VIDEO_GENERATE_MODELS[options.model as keyof typeof VIDEO_GENERATE_MODELS]
  if (!modelConfig) {
    return {
      success: false,
      error: `不支持的视频模型: ${options.model}`
    }
  }

  console.log('========================================')
  console.log('[VideoGen] ========== 开始视频生成 ==========')
  console.log('[VideoGen] 模型:', options.model)
  console.log('[VideoGen] 视频名称:', options.videoName || '(未设置，使用默认)')
  console.log('[VideoGen] 提示词:', options.prompt?.substring(0, 100) + '...')

  const releaseVideoGenerationSlot = await acquireVideoGenerationSlot()
  console.log('[VideoGen] 并行槽位:', `${activeVideoGenerationCount}/${getVideoMaxParallel()}`)

  try {
    // 确保输出目录存在
    const videosOutputPath = join(outputDir, 'videos')
    try {
      await mkdir(videosOutputPath, { recursive: true })
    } catch {
      // 目录可能已存在
    }

    const referenceImagePaths = options.referenceImagePaths?.filter(Boolean) || []
    const referenceFrameUrls = await resolveStoryboardFrameUrls(options)
    const maxReferenceFrames = Math.max(1, modelConfig.maxReferenceFrames || (modelConfig.imageMode === 'first_last_frame' ? 2 : 1))
    const referenceFrameInputs = pickVideoReferenceFrameInputs(referenceImagePaths, referenceFrameUrls, maxReferenceFrames, options.referenceFrameRoles)
    const referenceFrames = (await Promise.all(
      referenceFrameInputs.map(input => resolveVideoReferenceFrame(input.localPath, input.remoteUrl, input.role))
    )).filter((frame): frame is VideoReferenceFrame => Boolean(frame))
    const isImageToVideo = referenceFrames.length > 0

    // 构建提示词（按照官方文档格式 + 运镖参数）
    let fullPrompt = options.prompt
    const supportedDurations = modelConfig.supportedDurations || [5]
    const requestedDuration = options.duration || supportedDurations[0]
    const duration = supportedDurations.includes(requestedDuration) ? requestedDuration : supportedDurations[0]
    const resolution = options.resolution || '1080p'
    const cameraFixed = options.cameraFixed !== undefined ? options.cameraFixed : false
    const watermark = options.watermark !== undefined ? options.watermark : false

    // 注入运镖语言（如果用户选择了运镖方式）
    if (options.cameraMotion) {
      fullPrompt = `${fullPrompt}, ${options.cameraMotion}`
    }

    if (cameraFixed && !options.cameraMotion) {
      fullPrompt = `${fullPrompt}, static locked camera, no camera translation`
    }

    // 图生视频模式：在提示词前加入角色忠实度锁定指令
    // 这是防止模型自行添加新角色的关键描述
    if (isImageToVideo) {
      const imgCount = referenceFrames.length
      const fidelityPrefix = `Strictly use ONLY the character(s) shown in the reference image${imgCount > 1 ? 's' : ''}. ` +
        `Do NOT add, replace or invent any new characters not present in the reference. ` +
        `Preserve the exact appearance, gender, face, clothing, and style of the person${imgCount > 1 ? 's' : ''} in the reference image${imgCount > 1 ? 's' : ''}. `
      fullPrompt = `${fidelityPrefix}${fullPrompt}`
      console.log('[VideoGen] 图生视频：角色忠实度指令已加入')
    }

    if (requestedDuration !== duration) {
      console.warn('[VideoGen] 请求时长不受当前模型支持，已自动回退:', requestedDuration, '=>', duration, '| model:', options.model)
    }

    console.log('[VideoGen] 完整提示词:', fullPrompt)
    console.log('[VideoGen] 图生视频模式:', isImageToVideo)

    // 构建请求内容
    const buildVideoRequestData = (frames: VideoReferenceFrame[]) => {
      const imageItems: VideoContentItem[] = frames.map((frame, index) => {
        const fallbackRole = index === 0
          ? 'first_frame'
          : index === frames.length - 1
            ? 'last_frame'
            : 'reference_frame'
        const explicitRole = frame.role || fallbackRole
        const role = modelConfig.imageMode === 'first_frame' && index === 0
          ? 'first_frame'
          : explicitRole
        return {
          type: 'image_url',
          role,
          image_url: { url: frame.url }
        }
      })
      const content: VideoContentItem[] = [
        ...imageItems,
        { type: 'text', text: fullPrompt }
      ]
      return {
        requestData: {
          model: options.model,
          content,
          duration,
          resolution,
          watermark
        },
        imageCount: imageItems.length
      }
    }

    let requestBundle = buildVideoRequestData(referenceFrames)
    if (requestBundle.imageCount) {
      console.log('[VideoGen] reference frame mode:', modelConfig.imageMode)
      console.log('[VideoGen] reference frames sent:', requestBundle.imageCount, '/', referenceImagePaths.length || referenceFrameUrls.length)
    }
    if (options.referenceImagePaths?.length && !isImageToVideo) {
      console.warn('[VideoGen] 当前分镜图没有可用远端 URL，无法进入图生视频模式。')
    }

    const requestOptions = {
      hostname: DOUBAO_BASE_URL,
      port: 443,
      path: '/api/v3/contents/generations/tasks',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getEffectiveApiKey()}`
      }
    }

    const createVideoTask = async (payload: any, label: string) => {
      const postData = JSON.stringify(payload)
      console.log('[VideoGen] create task payload:', label, '| content items:', payload.content?.length || 0)
      return new Promise<string>((resolve, reject) => {
        const req = https.request(requestOptions, (res) => {
          let data = ''
          res.on('data', (chunk) => { data += chunk })
          res.on('end', () => {
            console.log('[VideoGen] task create response:', data.substring(0, 500))

            if (res.statusCode !== 200) {
              reject(new Error(`API Error: ${res.statusCode} - ${data.substring(0, 300)}`))
              return
            }

            try {
              const parsed = JSON.parse(data)
              if (parsed.error) {
                reject(new Error(parsed.error.message || JSON.stringify(parsed.error)))
                return
              }

              if (parsed.id) {
                resolve(parsed.id)
              } else {
                reject(new Error('No task id returned: ' + data.substring(0, 300)))
              }
            } catch (e: any) {
              reject(new Error(`Failed to parse task response: ${e?.message || String(e)}`))
            }
          })
        })

        req.on('error', (error: any) => {
          reject(new Error(`Network request failed: ${error?.message || String(error)}`))
        })

        req.setTimeout(30000)
        req.write(postData)
        req.end()
      })
    }

    let taskId: string
    try {
      taskId = await createVideoTask(requestBundle.requestData, 'all-reference-frames')
    } catch (error) {
      if (referenceFrames.length <= 2) throw error
      const fallbackFrames = [referenceFrames[0], referenceFrames[referenceFrames.length - 1]]
        .filter((frame): frame is VideoReferenceFrame => Boolean(frame))
      requestBundle = buildVideoRequestData(fallbackFrames)
      console.warn('[VideoGen] Multi-reference request failed; retrying with first/last frames only:', error instanceof Error ? error.message : String(error))
      taskId = await createVideoTask(requestBundle.requestData, 'first-last-fallback')
    }

    console.log('[VideoGen] 任务已创建, Task ID:', taskId)

    // 轮询任务状态
    const videoUrl = await new Promise<string>((resolve, reject) => {
      const pollInterval = setInterval(() => {
        const statusOptions = {
          hostname: DOUBAO_BASE_URL,
          port: 443,
          path: `/api/v3/contents/generations/tasks/${taskId}`,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${getEffectiveApiKey()}`
          }
        }

        const statusReq = https.request(statusOptions, (res) => {
          let data = ''
          res.on('data', (chunk) => { data += chunk })
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data)
              console.log('[VideoGen] 任务状态:', parsed.status || 'unknown')

              if (parsed.status === 'succeeded') {
                clearInterval(pollInterval)
                console.log('[VideoGen] 任务成功，完整响应:', JSON.stringify(parsed).substring(0, 1000))

                // 获取视频URL - 支持多种响应格式
                let videoUrl = ''

                // 方式1: content.video_url（Seedance 视频生成标准格式）
                if (parsed.content && parsed.content.video_url) {
                  videoUrl = parsed.content.video_url
                }

                // 方式2: content.data[0].url（兼容旧格式）
                if (!videoUrl && parsed.content && parsed.content.data && parsed.content.data.length > 0) {
                  videoUrl = parsed.content.data[0].url
                }

                // 方式3: output.video_url
                if (!videoUrl && parsed.output && parsed.output.video_url) {
                  videoUrl = parsed.output.video_url
                }

                // 方式4: output.data[0].url
                if (!videoUrl && parsed.output && parsed.output.data && parsed.output.data.length > 0) {
                  videoUrl = parsed.output.data[0].url
                }

                if (videoUrl) {
                  resolve(videoUrl)
                } else {
                  console.error('[VideoGen] 无法从响应中提取视频URL，响应结构:', Object.keys(parsed))
                  if (parsed.content) {
                    console.error('[VideoGen] content 结构:', JSON.stringify(parsed.content).substring(0, 500))
                  }
                  reject(new Error('响应中未找到视频URL'))
                }
              } else if (parsed.status === 'failed') {
                clearInterval(pollInterval)
                reject(new Error(parsed.error?.message || '视频生成失败'))
              }
              // 其他状态（pending, running）继续轮询
            } catch (e) {
              console.error('[VideoGen] 解析状态失败:', e)
            }
          })
        })

        statusReq.on('error', (error) => {
          console.error('[VideoGen] 状态查询失败:', error)
        })

        statusReq.end()
      }, 3000) // 每3秒轮询一次

      // 5分钟超时
      setTimeout(() => {
        clearInterval(pollInterval)
        reject(new Error('视频生成超时(5分钟)'))
      }, 300000)
    })

    console.log('[VideoGen] 视频生成成功, URL:', videoUrl.substring(0, 100) + '...')

    // 下载视频到本地（使用用户自定义文件名）
    const timestamp = Date.now()
    const sanitizeFileName = (name: string | undefined): string => {
      if (!name) return `video_${timestamp}`
      // 移除或替换文件系统非法字符
      const sanitized = name.replace(/[\\/:*?"<>|]/g, '_').trim()
      return sanitized.length > 0 ? sanitized : `video_${timestamp}`
    }
    
    // 【关键日志】检查 videoName 传递情况
    console.log('[VideoGen] >>> 文件命名 debug <<<')
    console.log('[VideoGen] options.videoName =', JSON.stringify(options.videoName))
    console.log('[VideoGen] options.videoName 布尔值 =', Boolean(options.videoName))
    console.log('[VideoGen] 是否使用自定义名称 =', Boolean(options.videoName))
    
    // 使用 sanitizeFileName 确保安全处理
    const baseName = sanitizeFileName(options.videoName)
    console.log('[VideoGen] sanitizeFileName 处理后 baseName =', baseName)
    console.log('[VideoGen] 最终使用的 baseName =', baseName)
    const fileName = `${baseName}.mp4`
    let localFilePath = join(videosOutputPath, fileName)

    // 处理重名情况
    const { existsSync } = require('fs')
    let counter = 1
    while (existsSync(localFilePath)) {
      const dedupedName = `${baseName}_${counter}.mp4`
      localFilePath = join(videosOutputPath, dedupedName)
      counter++
    }

    console.log('[VideoGen] 开始下载视频到:', localFilePath)

    try {
      const downloadResult = await downloadImage(videoUrl, localFilePath)
      console.log('[VideoGen] 视频下载成功')

      return {
        success: true,
        videoUrl: videoUrl,
        filePath: downloadResult.filePath,
        fileName: fileName,
        fileSize: downloadResult.fileSize,
        duration: duration
      }
    } catch (downloadError: any) {
      console.error('[VideoGen] 视频下载失败:', downloadError)
      // 即使下载失败，也返回URL
      return {
        success: true,
        videoUrl: videoUrl,
        filePath: '',
        fileName: fileName,
        error: `视频已生成但下载失败: ${downloadError?.message || String(downloadError)}`
      }
    }
  } catch (error: any) {
    console.error('[VideoGen] ========== 生成失败 ===========')
    console.error('[VideoGen] 错误:', error?.message || String(error))
    return {
      success: false,
      error: error?.message || (typeof error === 'string' ? error : '视频生成失败')
    }
  } finally {
    releaseVideoGenerationSlot()
  }
})

// ─── STITCH 拼接模块 (ffmpeg) ───

// 获取 ffmpeg/ffprobe 二进制路径（开发模式 + 打包后均兼容）
const getFFmpegPath = (): string => {
  // ffmpeg-static 返回二进制路径
  const staticPath = ffmpegStatic as string | null
  if (staticPath && existsSync(staticPath)) return staticPath
  // 备选：如果打包后路径发生变化，尝试在 resources 目录下寻找
  const resourcesPath = join(process.resourcesPath || '', 'ffmpeg.exe')
  if (existsSync(resourcesPath)) return resourcesPath
  return 'ffmpeg' // fallback 到系统 PATH
}

const getFFprobePath = (): string => {
  // ffprobe 通常与 ffmpeg 在同一目录
  const staticPath = ffmpegStatic as string | null
  if (staticPath) {
    const dir = staticPath.replace(/ffmpeg(\.exe)?$/, '')
    const probePath = join(dir, process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe')
    if (existsSync(probePath)) return probePath
  }
  return 'ffprobe'
}

// 设置 ffmpeg 和 ffprobe 路径
ffmpeg.setFfmpegPath(getFFmpegPath())
ffmpeg.setFfprobePath(getFFprobePath())

console.log('[FFmpeg] binary path:', getFFmpegPath())

// 获取视频元数据（时长、分辨率、fps）
const probeVideo = (filePath: string): Promise<{
  duration: number; width: number; height: number; fps: number; size: number
}> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) { reject(err); return }
      const videoStream = metadata.streams.find(s => s.codec_type === 'video')
      const duration = metadata.format.duration || 0
      const width = videoStream?.width || 1920
      const height = videoStream?.height || 1080
      const size = metadata.format.size || 0
      // 解析 fps，如 "24/1" 或 "30000/1001"
      let fps = 24
      const fpsStr = videoStream?.r_frame_rate || videoStream?.avg_frame_rate || '24/1'
      const [num, den] = fpsStr.split('/').map(Number)
      if (num && den) fps = Math.round(num / den)
      resolve({ duration, width, height, fps, size })
    })
  })
}

// 提取视频首帧作为 base64缩略图
const extractThumbnail = (filePath: string): Promise<string> => {
  return new Promise((resolve) => {
    const tmpDir = app.getPath('temp')
    const tmpName = `cinecho_thumb_${Date.now()}.jpg`
    const tmpPath = join(tmpDir, tmpName)
    ffmpeg(filePath)
      .screenshots({ timestamps: ['00:00:01'], folder: tmpDir, filename: tmpName, size: '320x180' })
      .on('end', () => {
        try {
          const data = require('fs').readFileSync(tmpPath)
          const b64 = 'data:image/jpeg;base64,' + data.toString('base64')
          require('fs').unlinkSync(tmpPath)
          resolve(b64)
        } catch { resolve('') }
      })
      .on('error', (err: Error) => {
        console.warn('[Stitch] extractThumbnail error:', err?.message)
        resolve('')
      })
  })
}

ipcMain.handle('media:getVideoThumbnail', async (_event, filePath: string) => {
  if (!filePath || !isPathInside(filePath, outputDir)) return ''
  return extractThumbnail(filePath)
})

const scanStitchVideoData = async (
  targetOutputDir = outputDir,
  assetUrlFor: (filePath: string) => string = fileAssetUrl
) => {
  const videosPath = join(targetOutputDir, ASSET_SUBDIRS.videos)
  const results: any[] = []

  try { await stat(videosPath) } catch { return [] }

  const entries = await readdir(videosPath, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const ext = extname(entry.name).toLowerCase()
    if (!VIDEO_EXTENSIONS.includes(ext)) continue
    const fullPath = join(videosPath, entry.name)
    try {
      const fileStat = await stat(fullPath)
      let meta = { duration: 0, width: 1920, height: 1080, fps: 24, size: fileStat.size }
      let thumbnail = ''
      try {
        meta = await probeVideo(fullPath)
      } catch (probeErr) {
        console.warn('[Stitch] probeVideo failed (degrading):', fullPath, (probeErr as any)?.message || probeErr)
      }
      try {
        thumbnail = await extractThumbnail(fullPath)
      } catch (thumbErr) {
        console.warn('[Stitch] extractThumbnail failed (degrading):', fullPath, (thumbErr as any)?.message || thumbErr)
      }
      results.push({
        path: fullPath,
        url: assetUrlFor(fullPath),
        ...meta,
        thumbnail,
        name: basename(entry.name, ext),
        modifiedAt: fileStat.mtimeMs
      })
    } catch (e) {
      console.error('[Stitch] stat failed, skipping:', fullPath, e)
    }
  }
  return results.sort((a, b) => b.modifiedAt - a.modifiedAt)
}

// 扫描视频目录（创作区生成的 + 外部导入的）
ipcMain.handle('stitch:scanVideos', async (_event, outputDir: string) => {
  return scanStitchVideoData(outputDir)
})

// 导入本地视频文件
ipcMain.handle('stitch:importVideos', async (_event) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    title: '选择视频文件',
    filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'webm', 'mkv'] }]
  })
  if (result.canceled || result.filePaths.length === 0) return null

  const results: any[] = []
  for (const filePath of result.filePaths) {
    try {
      const fileStat = await stat(filePath)
      const ext = extname(filePath).toLowerCase()
      let meta = { duration: 0, width: 1920, height: 1080, fps: 24, size: fileStat.size }
      let thumbnail = ''
      try {
        meta = await probeVideo(filePath)
      } catch (probeErr) {
        console.warn('[Stitch] importVideos probeVideo failed (degrading):', filePath, (probeErr as any)?.message || probeErr)
      }
      try {
        thumbnail = await extractThumbnail(filePath)
      } catch (thumbErr) {
        console.warn('[Stitch] importVideos extractThumbnail failed (degrading):', filePath, (thumbErr as any)?.message || thumbErr)
      }
      results.push({
        path: filePath,
        ...meta,
        thumbnail,
        name: basename(filePath, ext)
      })
    } catch (e) {
      console.error('[Stitch] import stat failed, skipping:', filePath, e)
    }
  }
  return results
})

// 获取单个视频元数据
ipcMain.handle('stitch:getVideoMeta', async (_event, filePath: string) => {
  const meta = await probeVideo(filePath)
  const thumbnail = await extractThumbnail(filePath)
  return { path: filePath, ...meta, thumbnail, name: basename(filePath, extname(filePath)) }
})

// 导出拼接视频
ipcMain.handle('stitch:exportVideo', async (event, options: {
  clips: Array<{ sourcePath: string; trimStart: number; trimEnd: number; sourceDuration?: number; sourceName?: string }>
  outputDir: string
  outputName: string
  resolution?: string
  fps?: number
}): Promise<{ success: boolean; filePath?: string; fileSize?: number; duration?: number; error?: string; canceled?: boolean }> => {
  if (!options.clips || options.clips.length === 0) {
    return { success: false, error: '没有可以导出的视频片段' }
  }

  try {
    // Show save dialog to let user choose where to save the FCPXML file
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '导出到剪辑软件 (FCPXML)',
      defaultPath: join(options.outputDir, 'cinecho_sequence.xml'),
      filters: [
        { name: 'Final Cut Pro XML', extensions: ['xml'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (canceled || !filePath) {
      return { success: false, canceled: true }
    }

    event.sender.send('stitch:exportProgress', { percent: 10, currentTime: 0 })

    const timebase = options.fps || 24
    
    let trackContent = ''
    let currentStart = 0
    let totalDurationFrames = 0

    for (let i = 0; i < options.clips.length; i++) {
      const clip = options.clips[i]
      const inFrame = Math.round(clip.trimStart * timebase)
      const outFrame = Math.round(clip.trimEnd * timebase)
      const durationFrames = outFrame - inFrame
      const endFrame = currentStart + durationFrames
      // If sourceDuration is not provided, fallback to trimEnd
      const sourceDur = clip.sourceDuration || clip.trimEnd
      const fileDurationFrames = Math.round(sourceDur * timebase) || durationFrames
      
      // Normalize path to file URL
      let fileUrl = clip.sourcePath.replace(/\\/g, '/')
      if (!fileUrl.startsWith('/')) {
        fileUrl = '/' + fileUrl
      }
      fileUrl = 'file://localhost' + fileUrl
      
      const clipName = clip.sourceName || `Clip ${i + 1}`

      trackContent += `
              <clipitem id="clipitem-${i}">
                <name>${clipName}</name>
                <duration>${fileDurationFrames}</duration>
                <rate><timebase>${timebase}</timebase><ntsc>FALSE</ntsc></rate>
                <start>${currentStart}</start>
                <end>${endFrame}</end>
                <in>${inFrame}</in>
                <out>${outFrame}</out>
                <file id="file-${i}">
                  <name>${clipName}.mp4</name>
                  <pathurl>${fileUrl}</pathurl>
                  <rate><timebase>${timebase}</timebase><ntsc>FALSE</ntsc></rate>
                  <duration>${fileDurationFrames}</duration>
                  <media>
                    <video>
                      <samplecharacteristics>
                        <rate><timebase>${timebase}</timebase><ntsc>FALSE</ntsc></rate>
                        <width>1920</width>
                        <height>1080</height>
                      </samplecharacteristics>
                    </video>
                  </media>
                </file>
              </clipitem>`
                
      currentStart = endFrame
    }
    
    totalDurationFrames = currentStart

    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <project>
    <name>Cinecho Export</name>
    <children>
      <sequence id="sequence-1">
        <name>Cinecho Sequence</name>
        <duration>${totalDurationFrames}</duration>
        <rate>
          <timebase>${timebase}</timebase>
          <ntsc>FALSE</ntsc>
        </rate>
        <media>
          <video>
            <format>
              <samplecharacteristics>
                <rate>
                  <timebase>${timebase}</timebase>
                  <ntsc>FALSE</ntsc>
                </rate>
                <width>1920</width>
                <height>1080</height>
                <pixelaspectratio>square</pixelaspectratio>
              </samplecharacteristics>
            </format>
            <track>
${trackContent}
            </track>
          </video>
        </media>
      </sequence>
    </children>
  </project>
</xmeml>`

    await writeFile(filePath, xmlContent, 'utf-8')

    event.sender.send('stitch:exportProgress', { percent: 100, currentTime: totalDurationFrames })

    const s = await stat(filePath)

    return { success: true, filePath: filePath, fileSize: s.size, duration: totalDurationFrames / timebase }

  } catch (err: any) {
    console.error('[Stitch] export FCPXML error:', err)
    return { success: false, error: err.message || '导出失败' }
  }
})

const DEV_BRIDGE_PORT = 5174
const BRIDGE_ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173'
])

const isPathInside = (childPath: string, parentPath: string) => {
  const parent = resolve(parentPath)
  const child = resolve(childPath)
  const rel = relative(parent, child)
  return rel === '' || (!!rel && !rel.startsWith('..') && !isAbsolute(rel))
}

const isBridgeFileAllowed = (filePath: string) => {
  const ext = extname(filePath).toLowerCase()
  return isPathInside(filePath, outputDir) && [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS].includes(ext)
}

const bridgePathToken = (filePath: string) =>
  Buffer.from(filePath, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')

const decodeBridgePathToken = (token: string) => {
  const padded = token.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(token.length / 4) * 4, '=')
  return Buffer.from(padded, 'base64').toString('utf-8')
}

const bridgeAssetUrl = (filePath: string) => `http://127.0.0.1:${DEV_BRIDGE_PORT}/asset?path=${encodeURIComponent(bridgePathToken(filePath))}`

const getBridgeMimeType = (filePath: string) => {
  const ext = extname(filePath).toLowerCase()
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.bmp') return 'image/bmp'
  if (ext === '.mp4') return 'video/mp4'
  if (ext === '.webm') return 'video/webm'
  if (ext === '.mov') return 'video/quicktime'
  return 'application/octet-stream'
}

const sanitizeStoreForBridge = (data: any) => {
  const settings = normalizeSettings(data.settings || {})
  const apiKeysConfigured = Object.fromEntries(
    Object.entries(settings.apiKeys || {}).map(([provider, value]) => [provider, Boolean(String(value || '').trim())])
  )
  return {
    ...data,
    settings: {
      ...settings,
      apiKey: '',
      apiKeys: {},
      apiKeyConfigured: Boolean((apiKeysConfigured as any).ark),
      apiKeysConfigured
    }
  }
}

const readJsonBody = (req: http.IncomingMessage) => new Promise<any>((resolve) => {
  let raw = ''
  req.on('data', chunk => { raw += chunk })
  req.on('end', () => {
    if (!raw.trim()) {
      resolve({})
      return
    }
    try {
      resolve(JSON.parse(raw))
    } catch {
      resolve({})
    }
  })
})

const sendBridgeJson = (res: http.ServerResponse, statusCode: number, data: any, origin?: string) => {
  if (origin && BRIDGE_ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.statusCode = statusCode
  res.end(JSON.stringify(statusCode >= 400 ? { ok: false, error: data } : { ok: true, data }))
}

const createImageFromBridgeOptions = async (options: GenerateImageOptions): Promise<GenerateImageResult> => {
  const keyCheck = checkApiKeyConfigured('ark')
  if (!keyCheck.configured) return { success: false, error: keyCheck.error }
  const subdir = options.type === 'costume' ? ASSET_SUBDIRS.costumes : options.type === 'scene' ? ASSET_SUBDIRS.scenes : ASSET_SUBDIRS.roles
  const targetDir = join(outputDir, subdir)
  await mkdir(targetDir, { recursive: true })
  const baseName = sanitizeFileName(options.name || options.prompt.slice(0, 20) || `${options.type}_${Date.now()}`)
  let fileName = `${baseName}.png`
  let localFilePath = join(targetDir, fileName)
  let counter = 1
  while (existsSync(localFilePath)) {
    fileName = `${baseName}_${counter}.png`
    localFilePath = join(targetDir, fileName)
    counter++
  }
  const fullPrompt = options.type === 'role'
    ? buildRolePrompt(options.prompt, options.gender, options.age, options.features, options.ethnicity)
    : options.type === 'costume'
      ? buildCostumePrompt(options.prompt)
      : options.type === 'scene'
        ? buildScenePrompt(options.prompt)
        : options.prompt
  const negativePrompt = options.type === 'scene'
    ? NEGATIVE_PROMPT_SCENE
    : options.type === 'costume'
      ? NEGATIVE_PROMPT_COSTUME
      : NEGATIVE_PROMPT_ROLE
  const result = await generateArkImageToFile(fullPrompt, localFilePath, fileName, negativePrompt, options.referenceImagePaths || [])
  if (result.success && result.filePath) {
    const sourceImageUrl = result.imageUrl
    await writeGeneratedImageMetadata(result.filePath, fileName, options, fullPrompt, negativePrompt, sourceImageUrl)
    result.imageUrl = assetUrlWithVersion(result.filePath, bridgeAssetUrl)
  }
  return result
}

const startDevBridgeServer = () => {
  if (app.isPackaged) return

  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin
    if (origin && !BRIDGE_ALLOWED_ORIGINS.has(origin)) {
      sendBridgeJson(res, 403, 'Origin not allowed')
      return
    }

    if (origin && BRIDGE_ALLOWED_ORIGINS.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
      res.setHeader('Vary', 'Origin')
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }

    try {
      const url = new URL(req.url || '/', `http://127.0.0.1:${DEV_BRIDGE_PORT}`)

      if (url.pathname === '/asset') {
        const filePath = decodeBridgePathToken(url.searchParams.get('path') || '')
        if (!isBridgeFileAllowed(filePath)) {
          res.statusCode = 403
          res.end('Forbidden')
          return
        }
        const fileStat = await stat(filePath)
        const range = req.headers.range
        res.setHeader('Content-Type', getBridgeMimeType(filePath))
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('Accept-Ranges', 'bytes')
        if (range) {
          const match = /^bytes=(\d*)-(\d*)$/.exec(range)
          if (match) {
            const start = match[1] ? Number(match[1]) : 0
            const end = match[2] ? Number(match[2]) : fileStat.size - 1
            const safeStart = Math.max(0, Math.min(start, fileStat.size - 1))
            const safeEnd = Math.max(safeStart, Math.min(end, fileStat.size - 1))
            res.statusCode = 206
            res.setHeader('Content-Range', `bytes ${safeStart}-${safeEnd}/${fileStat.size}`)
            res.setHeader('Content-Length', String(safeEnd - safeStart + 1))
            createReadStream(filePath, { start: safeStart, end: safeEnd }).pipe(res)
            return
          }
        }
        const bytes = await readFile(filePath)
        res.setHeader('Content-Length', String(fileStat.size))
        res.end(bytes)
        return
      }

      if (!url.pathname.startsWith('/api/')) {
        sendBridgeJson(res, 404, 'Not found', origin)
        return
      }

      const body = req.method === 'POST' ? await readJsonBody(req) : {}
      const route = url.pathname.replace(/^\/api/, '')

      switch (route) {
        case '/health':
          sendBridgeJson(res, 200, { ok: true }, origin)
          return
        case '/store/get':
          sendBridgeJson(res, 200, sanitizeStoreForBridge(await readStoreData()), origin)
          return
        case '/store/updateSetting':
          sendBridgeJson(res, 200, await updateStoreSettings(body), origin)
          return
        case '/dialog/selectDirectory': {
          const result = await dialog.showOpenDialog({ properties: ['openDirectory'], title: '选择资产目录' })
          sendBridgeJson(res, 200, result.canceled ? null : result.filePaths[0], origin)
          return
        }
        case '/dialog/selectFiles': {
          const result = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], filters: body.filters })
          sendBridgeJson(res, 200, result.canceled ? null : result.filePaths, origin)
          return
        }
        case '/media/getOutputDirectory':
          sendBridgeJson(res, 200, outputDir, origin)
          return
        case '/media/setOutputDirectory':
          sendBridgeJson(res, 200, await updateStoreSettings({ outputDir: body.path }), origin)
          return
        case '/media/scanDirectory':
          sendBridgeJson(res, 200, await scanAssetDirectory(body.path || outputDir, bridgeAssetUrl), origin)
          return
        case '/media/getAssetStats':
          sendBridgeJson(res, 200, await getAssetStatsForDirectory(body.path || outputDir), origin)
          return
        case '/media/deleteAsset':
          if (!isBridgeFileAllowed(body.assetPath)) throw new Error('文件不在资产目录内，拒绝删除')
          await deleteAssetAndMetadata(body.assetPath)
          sendBridgeJson(res, 200, true, origin)
          return
        case '/media/getThumbnail':
          if (!isBridgeFileAllowed(body.assetPath)) throw new Error('文件不在资产目录内')
          sendBridgeJson(res, 200, bridgeAssetUrl(body.assetPath), origin)
          return
        case '/media/getVideoThumbnail':
          if (!isBridgeFileAllowed(body.assetPath)) throw new Error('文件不在资产目录内')
          sendBridgeJson(res, 200, await extractThumbnail(body.assetPath), origin)
          return
        case '/media/openAsset':
          if (!isBridgeFileAllowed(body.assetPath)) throw new Error('文件不在资产目录内')
          await shell.openPath(body.assetPath)
          sendBridgeJson(res, 200, true, origin)
          return
        case '/media/revealInExplorer':
          if (!isBridgeFileAllowed(body.assetPath)) throw new Error('文件不在资产目录内')
          shell.showItemInFolder(body.assetPath)
          sendBridgeJson(res, 200, true, origin)
          return
        case '/media/generateImage':
          sendBridgeJson(res, 200, await createImageFromBridgeOptions(body), origin)
          return
        case '/media/scanVideos':
          sendBridgeJson(res, 200, await scanGeneratedVideoAssets(body.path || outputDir, bridgeAssetUrl), origin)
          return
        case '/media/generateVideo':
          sendBridgeJson(res, 200, { success: false, error: '普通浏览器开发页暂不支持视频生成，请在 Electron 应用中操作。' }, origin)
          return
        case '/api/validateKey':
          sendBridgeJson(res, 200, await validateProviderKey(body.payload?.provider || 'ark', body.payload?.apiKey || body.payload || ''), origin)
          return
        case '/ai/optimizePrompt':
          sendBridgeJson(res, 200, body.prompt || '', origin)
          return
        case '/system/openDirectory':
          if (!isPathInside(body.dirPath, outputDir)) throw new Error('目录不在资产目录内')
          await shell.openPath(body.dirPath)
          sendBridgeJson(res, 200, true, origin)
          return
        case '/storyboard/scan':
          sendBridgeJson(res, 200, await scanStoryboardsData(bridgeAssetUrl), origin)
          return
        case '/storyboard/create':
          sendBridgeJson(res, 200, await createStoryboardData(body, bridgeAssetUrl), origin)
          return
        case '/storyboard/get':
          sendBridgeJson(res, 200, await getStoryboardAssetData(body.storyboardId, bridgeAssetUrl), origin)
          return
        case '/storyboard/update':
          sendBridgeJson(res, 200, await updateStoryboardData(body, bridgeAssetUrl), origin)
          return
        case '/storyboard/generateShot':
          sendBridgeJson(res, 200, await generateStoryboardShotData(body, bridgeAssetUrl), origin)
          return
        case '/storyboard/delete':
          sendBridgeJson(res, 200, await deleteStoryboardData(body.storyboardId), origin)
          return
        case '/stitch/scanVideos':
          sendBridgeJson(res, 200, await scanStitchVideoData(body.outputDir || outputDir, bridgeAssetUrl), origin)
          return
        case '/stitch/getVideoMeta':
          if (!isBridgeFileAllowed(body.filePath)) throw new Error('文件不在资产目录内')
          sendBridgeJson(res, 200, {
            path: body.filePath,
            url: bridgeAssetUrl(body.filePath),
            ...(await probeVideo(body.filePath)),
            thumbnail: await extractThumbnail(body.filePath),
            name: basename(body.filePath, extname(body.filePath))
          }, origin)
          return
        case '/stitch/exportVideo':
          sendBridgeJson(res, 200, { success: false, error: '普通浏览器开发页暂不支持拼接导出，请在 Electron 应用中操作。' }, origin)
          return
        case '/stitch/revealExport':
          await shell.openPath(body.filePath)
          sendBridgeJson(res, 200, true, origin)
          return
        default:
          sendBridgeJson(res, 404, 'Unknown bridge route', origin)
      }
    } catch (error: any) {
      sendBridgeJson(res, 500, error?.message || String(error), origin)
    }
  })

  server.listen(DEV_BRIDGE_PORT, '127.0.0.1', () => {
    console.log(`[Bridge] Dev bridge listening on http://127.0.0.1:${DEV_BRIDGE_PORT}`)
  })
  server.on('error', (error: any) => {
    console.warn('[Bridge] Failed to start dev bridge:', error?.message || String(error))
  })
}

// ─── App Lifecycle ───

// 初始化目录结构
async function initializeDirectories() {
  console.log('[Init] 正在初始化资产库目录...')
  console.log('[Init] 输出目录:', outputDir)
  
  // 创建主目录
  try {
    await mkdir(outputDir, { recursive: true })
  } catch {
    // 目录可能已存在
  }
  
  // 创建子目录（包括 videos）
  for (const subdir of Object.values(ASSET_SUBDIRS)) {
    const subdirPath = join(outputDir, subdir as string)
    try {
      await mkdir(subdirPath, { recursive: true })
      console.log(`[Init] 创建子目录: ${subdirPath}`)
    } catch {
      // 子目录可能已存在
    }
  }
  
  console.log('[Init] 目录初始化完成')
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)

  // 先从 storage 加载用户保存的输出目录设置和 API Key
  try {
    const content = await readFile(STORE_PATH, 'utf-8')
    const data = JSON.parse(content)
    runtimeSettings = normalizeSettings(data.settings || {})
    outputDir = runtimeSettings.outputDir
    userApiKey = getEffectiveApiKey('ark')
    if (runtimeSettings.outputDir) {
      console.log('[Init] 已从设置加载输出目录:', outputDir)
    }
    if (userApiKey) {
      console.log('[Init] 已从设置加载 API Key:', userApiKey.substring(0, 10) + '...')
    }
  } catch {
    // storage 文件不存在，使用默认目录
  }

  // 初始化目录
  await initializeDirectories()

  startDevBridgeServer()

  // 创建窗口
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
