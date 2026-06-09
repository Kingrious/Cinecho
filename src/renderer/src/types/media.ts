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
  generationMode?: VideoGenerationMode
  resolution?: VideoResolution
  ratio?: VideoRatio
  generateAudio?: boolean
}

export interface GenerateVideoOptions {
  prompt: string
  model: string
  provider?: string
  videoName?: string
  duration?: number
  resolution?: VideoResolution
  ratio?: VideoRatio
  generationMode?: VideoGenerationMode
  cameraFixed?: boolean
  watermark?: boolean
  generateAudio?: boolean
  returnLastFrame?: boolean
  serviceTier?: 'default' | 'flex'
  referenceImagePaths?: string[]
  referenceFrameRoles?: Array<'first_frame' | 'reference_image' | 'last_frame'>
  cameraMotion?: string
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
  supportsFirstLastFrame: boolean
  supportsModes: VideoGenerationMode[]
  supportedResolutions: VideoResolution[]
  durationRange: [number, number]
  durationOptions: number[]
  defaultDuration: number
  defaultResolution: VideoResolution
  defaultRatio: VideoRatio
  supportsFlexTier: boolean
  supportsAudioGeneration: boolean
  supportsReturnLastFrame: boolean
  supportsCameraFixed: boolean
  maxReferenceImages: number
}

export type VideoGenerationMode = 'text_to_video' | 'image_first' | 'image_first_last' | 'multimodal' | 'edit' | 'extend'
export type VideoResolution = '480p' | '720p' | '1080p'
export type VideoRatio = '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '21:9' | 'adaptive'

const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, index) => start + index)

export const VIDEO_MODELS: VideoModel[] = [
  {
    id: 'doubao-seedance-2-0-260128',
    name: 'Seedance 2.0',
    description: '音画同生，支持文生、首帧、首尾帧、多模态、编辑和延长视频',
    maxDuration: 15,
    supportsImageInput: true,
    supportsFirstLastFrame: true,
    supportsModes: ['text_to_video', 'image_first', 'image_first_last', 'multimodal', 'edit', 'extend'],
    supportedResolutions: ['480p', '720p', '1080p'],
    durationRange: [4, 15],
    durationOptions: range(4, 15),
    defaultDuration: 5,
    defaultResolution: '720p',
    defaultRatio: 'adaptive',
    supportsFlexTier: false,
    supportsAudioGeneration: true,
    supportsReturnLastFrame: true,
    supportsCameraFixed: false,
    maxReferenceImages: 9
  },
  {
    id: 'doubao-seedance-2-0-fast-260128',
    name: 'Seedance 2.0 Fast',
    description: '音画同生快速模型，支持多模态能力，最高 720p',
    maxDuration: 15,
    supportsImageInput: true,
    supportsFirstLastFrame: true,
    supportsModes: ['text_to_video', 'image_first', 'image_first_last', 'multimodal', 'edit', 'extend'],
    supportedResolutions: ['480p', '720p'],
    durationRange: [4, 15],
    durationOptions: range(4, 15),
    defaultDuration: 5,
    defaultResolution: '720p',
    defaultRatio: 'adaptive',
    supportsFlexTier: false,
    supportsAudioGeneration: true,
    supportsReturnLastFrame: true,
    supportsCameraFixed: false,
    maxReferenceImages: 9
  },
  {
    id: 'doubao-seedance-1-5-pro-251215',
    name: 'Seedance 1.5 Pro',
    description: '高质量音画同生模型，支持图生视频',
    maxDuration: 12,
    supportsImageInput: true,
    supportsFirstLastFrame: true,
    supportsModes: ['text_to_video', 'image_first', 'image_first_last'],
    supportedResolutions: ['480p', '720p', '1080p'],
    durationRange: [4, 12],
    durationOptions: range(4, 12),
    defaultDuration: 5,
    defaultResolution: '720p',
    defaultRatio: 'adaptive',
    supportsFlexTier: true,
    supportsAudioGeneration: true,
    supportsReturnLastFrame: true,
    supportsCameraFixed: true,
    maxReferenceImages: 2
  },
  {
    id: 'doubao-seedance-1-0-pro-250528',
    name: 'Seedance 1.0 Pro',
    description: 'Seedance 1.0 高质量模型，支持首尾帧图生视频',
    maxDuration: 12,
    supportsImageInput: true,
    supportsFirstLastFrame: true,
    supportsModes: ['text_to_video', 'image_first', 'image_first_last'],
    supportedResolutions: ['480p', '720p', '1080p'],
    durationRange: [2, 12],
    durationOptions: range(2, 12),
    defaultDuration: 5,
    defaultResolution: '1080p',
    defaultRatio: 'adaptive',
    supportsFlexTier: true,
    supportsAudioGeneration: false,
    supportsReturnLastFrame: false,
    supportsCameraFixed: true,
    maxReferenceImages: 2
  },
  {
    id: 'doubao-seedance-1-0-pro-fast-251015',
    name: 'Seedance 1.0 Pro Fast',
    description: '快速视频生成模型，支持 1080p 高质量输出',
    maxDuration: 12,
    supportsImageInput: true,
    supportsFirstLastFrame: false,
    supportsModes: ['text_to_video', 'image_first'],
    supportedResolutions: ['480p', '720p', '1080p'],
    durationRange: [2, 12],
    durationOptions: range(2, 12),
    defaultDuration: 5,
    defaultResolution: '1080p',
    defaultRatio: '16:9',
    supportsFlexTier: true,
    supportsAudioGeneration: false,
    supportsReturnLastFrame: false,
    supportsCameraFixed: true,
    maxReferenceImages: 1
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
