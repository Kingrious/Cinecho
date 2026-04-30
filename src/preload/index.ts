import { contextBridge, ipcRenderer } from 'electron'

// 资产分类
const ASSET_TYPES = ['roles', 'costumes', 'scenes']

// Custom APIs for renderer
const api = {
  // 存储相关
  store: {
    get: () => ipcRenderer.invoke('store:get'),
    updateSetting: (settings: any) => ipcRenderer.invoke('store:updateSetting', settings)
  },
  
  // 对话框相关
  dialog: {
    selectDirectory: () => ipcRenderer.invoke('dialog:selectDir'),
    selectFiles: (filters?: { name: string; extensions: string[] }[]) => 
      ipcRenderer.invoke('dialog:selectFiles', filters)
  },
  
  // 媒体资产相关
  media: {
    scanDirectory: (path: string) => ipcRenderer.invoke('media:scanDirectory', path),
    getAssetStats: (path: string) => ipcRenderer.invoke('media:getAssetStats', path),
    deleteAsset: (assetPath: string) => ipcRenderer.invoke('media:deleteAsset', assetPath),
    getThumbnail: (assetPath: string) => ipcRenderer.invoke('media:getThumbnail', assetPath),
    openAsset: (assetPath: string) => ipcRenderer.invoke('media:openAsset', assetPath),
    revealInExplorer: (assetPath: string) => ipcRenderer.invoke('media:revealInExplorer', assetPath),
    getOutputDirectory: () => ipcRenderer.invoke('media:getOutputDirectory'),
    setOutputDirectory: (path: string) => ipcRenderer.invoke('media:setOutputDirectory', path),
    generateImage: (options: any) => ipcRenderer.invoke('media:generateImage', options),
    // 视频相关
    scanVideos: (path: string) => ipcRenderer.invoke('media:scanVideos', path),
    generateVideo: (options: any) => ipcRenderer.invoke('media:generateVideo', options)
  },

  storyboard: {
    scan: () => ipcRenderer.invoke('storyboard:scan'),
    create: (options: any) => ipcRenderer.invoke('storyboard:create', options),
    get: (storyboardId: string) => ipcRenderer.invoke('storyboard:get', storyboardId),
    generateShot: (options: any) => ipcRenderer.invoke('storyboard:generateShot', options),
    delete: (storyboardId: string) => ipcRenderer.invoke('storyboard:delete', storyboardId)
  },

  // 系统相关
  system: {
    openDirectory: (dirPath: string) => ipcRenderer.invoke('system:openDirectory', dirPath)
  },
  
  windowControls: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    unmaximize: () => ipcRenderer.invoke('window:unmaximize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    close: () => ipcRenderer.invoke('window:close')
  },
  
  // 任务进度推送监听
  onTaskProgress: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('sync:taskProgress', handler)
    return () => ipcRenderer.removeListener('sync:taskProgress', handler)
  },
  
  // 扫描进度推送监听
  onScanProgress: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('sync:scanProgress', handler)
    return () => ipcRenderer.removeListener('sync:scanProgress', handler)
  },
  
  // AI 相关
  ai: {
    optimizePrompt: (prompt: string) => ipcRenderer.invoke('ai:optimizePrompt', prompt)
  },

  // API 配置相关
  api: {
    validateKey: (payload: any) => ipcRenderer.invoke('api:validateKey', payload)
  },

  // ─── STITCH 拼接模块 ───
  stitch: {
    // 扫描视频素材（含创作区生成的 + 本地导入的）
    scanVideos: (outputDir: string) => ipcRenderer.invoke('stitch:scanVideos', outputDir),
    // 导入本地视频文件（弹出选择框）
    importVideos: () => ipcRenderer.invoke('stitch:importVideos'),
    // 获取视频元数据（时长、分辨率等），并提取首帧缩略图
    getVideoMeta: (filePath: string) => ipcRenderer.invoke('stitch:getVideoMeta', filePath),
    // 导出拼接视频
    exportVideo: (options: any) => ipcRenderer.invoke('stitch:exportVideo', options),
    // 在文件管理器中显示导出的文件
    revealExport: (filePath: string) => ipcRenderer.invoke('media:revealInExplorer', filePath),
  },

  // 拼接导出进度监听
  onStitchProgress: (callback: (data: { percent: number; currentTime: number }) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('stitch:exportProgress', handler)
    return () => ipcRenderer.removeListener('stitch:exportProgress', handler)
  },

  onWindowMaximizedChange: (callback: (isMaximized: boolean) => void) => {
    const handler = (_event: any, isMaximized: boolean) => callback(isMaximized)
    ipcRenderer.on('window:maximized', handler)
    return () => ipcRenderer.removeListener('window:maximized', handler)
  }
}

// 使用 `contextBridge` APIs 暴露 Electron APIs 给渲染进程
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', api)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = api
  // @ts-ignore (define in dts)
  window.api = api
}
