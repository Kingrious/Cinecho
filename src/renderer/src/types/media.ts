export type AssetType = 'role' | 'costume' | 'scene' | 'video' | 'storyboard'
export type AssetStatus = 'ready' | 'generating' | 'failed'

export interface MediaAsset {
  id: string
  name: string
  path: string
  type: AssetType
  thumbnail: string
  size: number
  duration?: number
  width?: number
  height?: number
  createdAt: number
  modifiedAt: number
  status: AssetStatus
  progress?: number
  prompt?: string
  corePrompt?: string
  generationPrompt?: string
  fullPrompt?: string
  gender?: string
  ethnicity?: string
  age?: number
  features?: string[]
  sceneType?: string
  costumeMaterial?: string
  generationSettings?: Record<string, any>
}

export interface VideoAsset {
  id: string
  name: string
  path: string
  url?: string
  type: 'video'
  thumbnail: string
  size: number
  duration: number
  width?: number
  height?: number
  createdAt: number
  modifiedAt: number
  status: AssetStatus
  progress?: number
  prompt?: string
  model?: string
}

export interface GenerateVideoOptions {
  prompt: string
  model: string
  provider?: string
  videoName?: string
  duration?: number
  resolution?: '720p' | '1080p'
  cameraFixed?: boolean
  watermark?: boolean
  referenceImagePaths?: string[]
  cameraMotion?: string
  actionType?: string
  storyboardId?: string
  storyboardName?: string
  storyboardShotOrder?: number[]
}

export interface GenerateVideoResult {
  success: boolean
  videoUrl?: string
  filePath?: string
  fileName?: string
  fileSize?: number
  duration?: number
  error?: string
}

export interface VideoModel {
  id: string
  name: string
  description: string
  maxDuration: number
  supportsImageInput: boolean
}

export const VIDEO_MODELS: VideoModel[] = [
  {
    id: 'doubao-seedance-1-0-pro-fast-251015',
    name: 'Seedance 1.0 Pro Fast',
    description: '快速视频生成模型，支持 1080p 高质量输出',
    maxDuration: 10,
    supportsImageInput: true
  },
  {
    id: 'doubao-seedance-1-5-pro-251215',
    name: 'Seedance 1.5 Pro',
    description: '高质量视频生成模型，支持图生视频',
    maxDuration: 10,
    supportsImageInput: true
  }
]

export interface AssetCategory {
  id: string
  name: string
  icon: string
  count: number
  assets: MediaAsset[]
}

export interface DirectoryInfo {
  path: string
  assetCount: number
  lastScanned: number
}

export interface ScanProgress {
  current: number
  total: number
  currentFile: string
}

export interface AssetFilter {
  type: AssetType | 'all'
  searchQuery: string
  sortBy: 'name' | 'date' | 'size'
  sortOrder: 'asc' | 'desc'
}

export interface AssetStats {
  totalRoles: number
  totalCostumes: number
  totalScenes: number
  totalStoryboards?: number
}

export interface StoryboardShot {
  index: number
  status: AssetStatus
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

export interface StoryboardAsset {
  id: string
  name: string
  path: string
  thumbnail: string
  shotCount: number
  completedCount: number
  createdAt: number
  modifiedAt: number
  shots: StoryboardShot[]
}

export interface CreateStoryboardOptions {
  name: string
  shotCount: number
}

export interface GenerateStoryboardShotOptions {
  storyboardId: string
  shotIndex: number
  prompt: string
  roleAssetPath?: string
  costumeAssetPath?: string
  sceneAssetPath?: string
  roleAssetPaths?: string[]
  costumeAssetPaths?: string[]
  sceneAssetPaths?: string[]
}

export interface UpdateStoryboardOptions {
  storyboardId: string
  name?: string
  shots: StoryboardShot[]
}

export interface StitchClip {
  id: number
  sourceId: string
  sourcePath: string
  sourceUrl?: string
  sourceName: string
  sourceDuration: number
  thumbnail: string
  trimStart: number
  trimEnd: number
  timelineStart: number
}

export interface StitchExportOptions {
  clips: StitchClip[]
  outputDir: string
  outputName: string
  resolution?: '720p' | '1080p' | 'source'
  fps?: number
}

export interface StitchExportResult {
  success: boolean
  filePath?: string
  fileSize?: number
  duration?: number
  error?: string
  canceled?: boolean
}

export interface VideoMeta {
  path: string
  url?: string
  name?: string
  duration: number
  width: number
  height: number
  fps: number
  size: number
  thumbnail?: string
}
