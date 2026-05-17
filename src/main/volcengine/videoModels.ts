export type VolcVideoModelFamily = 'seedance1' | 'seedance2'
export type VolcVideoMode = 'text_to_video' | 'image_first' | 'image_first_last' | 'multimodal' | 'edit' | 'extend'
export type VolcVideoResolution = '480p' | '720p' | '1080p'
export type VolcVideoRatio = '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '21:9' | 'adaptive'
export type VolcServiceTier = 'default' | 'flex'
export type VolcImageRole = 'first_frame' | 'last_frame' | 'reference_image'

export interface VolcVideoModelConfig {
  id: string
  name: string
  description: string
  family: VolcVideoModelFamily
  supportsModes: VolcVideoMode[]
  supportedResolutions: VolcVideoResolution[]
  durationRange: [number, number]
  durationOptions: number[]
  defaultDuration: number
  defaultResolution: VolcVideoResolution
  defaultRatio: VolcVideoRatio
  supportsFlexTier: boolean
  supportsAudioGeneration: boolean
  supportsReturnLastFrame: boolean
  supportsCameraFixed: boolean
  maxReferenceImages: number
  defaultRateLimitProfile: 'enterprise_personal_split' | 'shared_default'
}

const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, index) => start + index)

export const VOLC_VIDEO_MODELS: Record<string, VolcVideoModelConfig> = {
  'doubao-seedance-2-0-260128': {
    id: 'doubao-seedance-2-0-260128',
    name: 'Seedance 2.0',
    description: '音画同生，支持文生、首帧、首尾帧、多模态、编辑和延长视频',
    family: 'seedance2',
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
    maxReferenceImages: 9,
    defaultRateLimitProfile: 'enterprise_personal_split'
  },
  'doubao-seedance-2-0-fast-260128': {
    id: 'doubao-seedance-2-0-fast-260128',
    name: 'Seedance 2.0 Fast',
    description: '音画同生快速模型，支持多模态能力，最高 720p',
    family: 'seedance2',
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
    maxReferenceImages: 9,
    defaultRateLimitProfile: 'enterprise_personal_split'
  },
  'doubao-seedance-1-5-pro-251215': {
    id: 'doubao-seedance-1-5-pro-251215',
    name: 'Seedance 1.5 Pro',
    description: '高质量音画同生模型，支持文生、首帧和首尾帧图生视频',
    family: 'seedance1',
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
    maxReferenceImages: 2,
    defaultRateLimitProfile: 'shared_default'
  },
  'doubao-seedance-1-0-pro-250528': {
    id: 'doubao-seedance-1-0-pro-250528',
    name: 'Seedance 1.0 Pro',
    description: 'Seedance 1.0 高质量模型，支持文生、首帧和首尾帧图生视频',
    family: 'seedance1',
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
    maxReferenceImages: 2,
    defaultRateLimitProfile: 'shared_default'
  },
  'doubao-seedance-1-0-pro-fast-251015': {
    id: 'doubao-seedance-1-0-pro-fast-251015',
    name: 'Seedance 1.0 Pro Fast',
    description: 'Seedance 1.0 快速模型，支持文生和首帧图生视频',
    family: 'seedance1',
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
    maxReferenceImages: 1,
    defaultRateLimitProfile: 'shared_default'
  }
}

export const VOLC_VIDEO_MODEL_LIST = Object.values(VOLC_VIDEO_MODELS)

export const getVolcVideoModelConfig = (modelId: string) => VOLC_VIDEO_MODELS[modelId]
