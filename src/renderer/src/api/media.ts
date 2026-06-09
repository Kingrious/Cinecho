import type {
  AssetStats,
  CreateStoryboardOptions,
  GenerateStoryboardShotOptions,
  GenerateVideoOptions,
  GenerateVideoResult,
  MediaAsset,
  ScanProgress,
  StitchExportOptions,
  StitchExportResult,
  StoryboardAsset,
  UpdateStoryboardOptions,
  VideoAsset,
  VideoMeta
} from '../types/media'

type JsonObject = Record<string, any>

export interface GenerateImageOptions {
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

export interface GenerateImageResult {
  success: boolean
  imageUrl?: string
  filePath?: string
  fileName?: string
  fileSize?: number
  error?: string
}

export interface ElectronAPI {
  store: {
    get: () => Promise<JsonObject>
    updateSetting: (settings: JsonObject) => Promise<boolean>
  }
  dialog: {
    selectDirectory: () => Promise<string | null>
    selectFiles: (filters?: { name: string; extensions: string[] }[]) => Promise<string[] | null>
  }
  media: {
    scanDirectory: (path?: string) => Promise<MediaAsset[]>
    getAssetStats: (path?: string) => Promise<AssetStats>
    deleteAsset: (assetPath: string) => Promise<boolean>
    getThumbnail: (assetPath: string) => Promise<string>
    getVideoThumbnail: (assetPath: string) => Promise<string>
    openAsset: (assetPath: string) => Promise<void>
    revealInExplorer: (assetPath: string) => Promise<void>
    getOutputDirectory: () => Promise<string>
    setOutputDirectory: (path: string) => Promise<boolean>
    generateImage: (options: GenerateImageOptions) => Promise<GenerateImageResult>
    scanVideos: (path?: string) => Promise<VideoAsset[]>
    generateVideo: (options: GenerateVideoOptions) => Promise<GenerateVideoResult>
    cancelVideoGeneration: () => Promise<{ success: boolean; canceled?: boolean; error?: string }>
    cancelImageGeneration: () => Promise<{ success: boolean; canceled?: boolean; error?: string }>
  }
  api: {
    validateKey: (payload: string | { provider: string; apiKey: string }) => Promise<{ valid: boolean; error?: string }>
  }
  storyboard: {
    scan: () => Promise<StoryboardAsset[]>
    create: (options: CreateStoryboardOptions) => Promise<StoryboardAsset>
    get: (storyboardId: string) => Promise<StoryboardAsset | null>
    update: (options: UpdateStoryboardOptions) => Promise<StoryboardAsset>
    generateShot: (options: GenerateStoryboardShotOptions) => Promise<StoryboardAsset>
    delete: (storyboardId: string) => Promise<boolean>
  }
  onTaskProgress: (callback: (data: { id: string; status: string; progress: number; message?: string; taskType?: string }) => void) => () => void
  onScanProgress: (callback: (data: ScanProgress) => void) => () => void
  ai: {
    optimizePrompt: (prompt: string) => Promise<string>
  }
  system: {
    openDirectory: (dirPath: string) => Promise<void>
  }
  windowControls: {
    minimize: () => Promise<void>
    maximize: () => Promise<boolean>
    unmaximize: () => Promise<boolean>
    toggleMaximize: () => Promise<boolean>
    isMaximized: () => Promise<boolean>
    close: () => Promise<void>
  }
  stitch: {
    scanVideos: (outputDir?: string) => Promise<VideoMeta[]>
    importVideos: () => Promise<VideoMeta[] | null>
    getVideoMeta: (filePath: string) => Promise<VideoMeta>
    exportVideo: (options: StitchExportOptions) => Promise<StitchExportResult>
    revealExport: (filePath: string) => Promise<void>
  }
  onStitchProgress: (callback: (data: { percent: number; currentTime: number }) => void) => () => void
  onWindowMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void
}

declare global {
  interface Window {
    electron?: ElectronAPI
    api?: ElectronAPI
  }
}

const BRIDGE_BASE_URL = 'http://127.0.0.1:5174'

const bridgeRequest = async <T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> => {
  const response = await fetch(`${BRIDGE_BASE_URL}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  })

  let payload: any = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `本地桥接请求失败：HTTP ${response.status}`)
  }

  return (payload?.data ?? payload) as T
}

const unsupported = async <T>(name: string): Promise<T> => {
  throw new Error(`${name} 在普通浏览器开发页不可用，请在 Electron 应用中操作。`)
}

const bridgeApi: ElectronAPI = {
  store: {
    get: () => bridgeRequest<JsonObject>('/store/get'),
    updateSetting: (settings) => bridgeRequest<boolean>('/store/updateSetting', settings)
  },
  dialog: {
    selectDirectory: () => bridgeRequest<string | null>('/dialog/selectDirectory', {}),
    selectFiles: (filters) => bridgeRequest<string[] | null>('/dialog/selectFiles', { filters })
  },
  media: {
    scanDirectory: (path) => bridgeRequest<MediaAsset[]>('/media/scanDirectory', { path }),
    getAssetStats: (path) => bridgeRequest<AssetStats>('/media/getAssetStats', { path }),
    deleteAsset: (assetPath) => bridgeRequest<boolean>('/media/deleteAsset', { assetPath }),
    getThumbnail: (assetPath) => bridgeRequest<string>('/media/getThumbnail', { assetPath }),
    getVideoThumbnail: (assetPath) => bridgeRequest<string>('/media/getVideoThumbnail', { assetPath }),
    openAsset: (assetPath) => bridgeRequest<void>('/media/openAsset', { assetPath }),
    revealInExplorer: (assetPath) => bridgeRequest<void>('/media/revealInExplorer', { assetPath }),
    getOutputDirectory: () => bridgeRequest<string>('/media/getOutputDirectory'),
    setOutputDirectory: (path) => bridgeRequest<boolean>('/media/setOutputDirectory', { path }),
    generateImage: (options) => bridgeRequest<GenerateImageResult>('/media/generateImage', options),
    scanVideos: (path) => bridgeRequest<VideoAsset[]>('/media/scanVideos', { path }),
    generateVideo: (options) => bridgeRequest<GenerateVideoResult>('/media/generateVideo', options),
    cancelVideoGeneration: () => bridgeRequest<{ success: boolean; canceled?: boolean; error?: string }>('/media/cancelVideoGeneration', {}),
    cancelImageGeneration: () => bridgeRequest<{ success: boolean; canceled?: boolean; error?: string }>('/media/cancelImageGeneration', {})
  },
  api: {
    validateKey: (payload) => bridgeRequest<{ valid: boolean; error?: string }>('/api/validateKey', { payload })
  },
  storyboard: {
    scan: () => bridgeRequest<StoryboardAsset[]>('/storyboard/scan'),
    create: (options) => bridgeRequest<StoryboardAsset>('/storyboard/create', options),
    get: (storyboardId) => bridgeRequest<StoryboardAsset | null>('/storyboard/get', { storyboardId }),
    update: (options) => bridgeRequest<StoryboardAsset>('/storyboard/update', options),
    generateShot: (options) => bridgeRequest<StoryboardAsset>('/storyboard/generateShot', options),
    delete: (storyboardId) => bridgeRequest<boolean>('/storyboard/delete', { storyboardId })
  },
  onTaskProgress: () => () => {},
  onScanProgress: () => () => {},
  ai: {
    optimizePrompt: (prompt) => bridgeRequest<string>('/ai/optimizePrompt', { prompt })
  },
  system: {
    openDirectory: (dirPath) => bridgeRequest<void>('/system/openDirectory', { dirPath })
  },
  windowControls: {
    minimize: () => unsupported<void>('窗口最小化'),
    maximize: () => unsupported<boolean>('窗口最大化'),
    unmaximize: () => unsupported<boolean>('窗口还原'),
    toggleMaximize: () => unsupported<boolean>('窗口最大化切换'),
    isMaximized: () => Promise.resolve(false),
    close: () => unsupported<void>('关闭窗口')
  },
  stitch: {
    scanVideos: (outputDir) => bridgeRequest<VideoMeta[]>('/stitch/scanVideos', { outputDir }),
    importVideos: () => unsupported<VideoMeta[] | null>('导入本地视频'),
    getVideoMeta: (filePath) => bridgeRequest<VideoMeta>('/stitch/getVideoMeta', { filePath }),
    exportVideo: (options) => bridgeRequest<StitchExportResult>('/stitch/exportVideo', options),
    revealExport: (filePath) => bridgeRequest<void>('/stitch/revealExport', { filePath })
  },
  onStitchProgress: () => () => {},
  onWindowMaximizedChange: () => () => {}
}

export function getApi(): ElectronAPI {
  return window.electron || window.api || bridgeApi
}

export const storeApi = {
  get: () => getApi().store.get(),
  updateSetting: (settings: JsonObject) => getApi().store.updateSetting(settings)
}

export const dialogApi = {
  selectDirectory: () => getApi().dialog.selectDirectory(),
  selectFiles: (filters?: { name: string; extensions: string[] }[]) => getApi().dialog.selectFiles(filters)
}

export const mediaApi = {
  scanDirectory: (path?: string): Promise<MediaAsset[]> => getApi().media.scanDirectory(path),
  getAssetStats: (path?: string): Promise<AssetStats> => getApi().media.getAssetStats(path),
  deleteAsset: (assetPath: string): Promise<boolean> => getApi().media.deleteAsset(assetPath),
  getThumbnail: (assetPath: string): Promise<string> => getApi().media.getThumbnail(assetPath),
  getVideoThumbnail: (assetPath: string): Promise<string> => getApi().media.getVideoThumbnail(assetPath),
  openAsset: (assetPath: string): Promise<void> => getApi().media.openAsset(assetPath),
  revealInExplorer: (assetPath: string): Promise<void> => getApi().media.revealInExplorer(assetPath),
  getOutputDirectory: (): Promise<string> => getApi().media.getOutputDirectory(),
  setOutputDirectory: (path: string): Promise<boolean> => getApi().media.setOutputDirectory(path),
  generateImage: (options: GenerateImageOptions): Promise<GenerateImageResult> => getApi().media.generateImage(options),
  scanVideos: (path?: string): Promise<VideoAsset[]> => getApi().media.scanVideos(path),
  generateVideo: (options: GenerateVideoOptions): Promise<GenerateVideoResult> => getApi().media.generateVideo(options),
  cancelVideoGeneration: (): Promise<{ success: boolean; canceled?: boolean; error?: string }> => getApi().media.cancelVideoGeneration(),
  cancelImageGeneration: (): Promise<{ success: boolean; canceled?: boolean; error?: string }> => getApi().media.cancelImageGeneration()
}

export const eventsApi = {
  onTaskProgress: (callback: (data: { id: string; status: string; progress: number; message?: string; taskType?: string }) => void) => getApi().onTaskProgress(callback),
  onScanProgress: (callback: (data: ScanProgress) => void) => getApi().onScanProgress(callback),
  onStitchProgress: (callback: (data: { percent: number; currentTime: number }) => void) => getApi().onStitchProgress(callback)
}

export const aiApi = {
  optimizePrompt: (prompt: string): Promise<string> => getApi().ai.optimizePrompt(prompt)
}

export const configApi = {
  validateKey: (payload: string | { provider: string; apiKey: string }): Promise<{ valid: boolean; error?: string }> =>
    getApi().api.validateKey(payload)
}

export const systemApi = {
  openDirectory: (dirPath: string): Promise<void> => getApi().system.openDirectory(dirPath)
}

export const windowApi = {
  minimize: (): Promise<void> => getApi().windowControls.minimize(),
  maximize: (): Promise<boolean> => getApi().windowControls.maximize(),
  unmaximize: (): Promise<boolean> => getApi().windowControls.unmaximize(),
  toggleMaximize: (): Promise<boolean> => getApi().windowControls.toggleMaximize(),
  isMaximized: (): Promise<boolean> => getApi().windowControls.isMaximized(),
  close: (): Promise<void> => getApi().windowControls.close(),
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => getApi().onWindowMaximizedChange(callback)
}

export const storyboardApi = {
  scan: (): Promise<StoryboardAsset[]> => getApi().storyboard.scan(),
  create: (options: CreateStoryboardOptions): Promise<StoryboardAsset> => getApi().storyboard.create(options),
  get: (storyboardId: string): Promise<StoryboardAsset | null> => getApi().storyboard.get(storyboardId),
  update: (options: UpdateStoryboardOptions): Promise<StoryboardAsset> => getApi().storyboard.update(options),
  generateShot: (options: GenerateStoryboardShotOptions): Promise<StoryboardAsset> => getApi().storyboard.generateShot(options),
  delete: (storyboardId: string): Promise<boolean> => getApi().storyboard.delete(storyboardId)
}

export const stitchApi = {
  scanVideos: (outputDir?: string): Promise<VideoMeta[]> => getApi().stitch.scanVideos(outputDir),
  importVideos: (): Promise<VideoMeta[] | null> => getApi().stitch.importVideos(),
  getVideoMeta: (filePath: string): Promise<VideoMeta> => getApi().stitch.getVideoMeta(filePath),
  exportVideo: (options: StitchExportOptions): Promise<StitchExportResult> => getApi().stitch.exportVideo(options),
  revealExport: (filePath: string): Promise<void> => getApi().stitch.revealExport(filePath)
}
