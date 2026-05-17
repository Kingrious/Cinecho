import { createVolcVideoTask } from './client'
import type { VolcImageRole, VolcServiceTier, VolcVideoModelConfig, VolcVideoMode, VolcVideoRatio, VolcVideoResolution } from './videoModels'

export type SeedanceReferenceImage = {
  url: string
  role?: VolcImageRole
}

export type CreateSeedance1VideoTaskOptions = {
  apiKey: string
  model: VolcVideoModelConfig
  mode: VolcVideoMode
  prompt: string
  referenceImages: SeedanceReferenceImage[]
  duration: number
  resolution: VolcVideoResolution
  ratio: VolcVideoRatio
  watermark: boolean
  cameraFixed: boolean
  generateAudio?: boolean
  returnLastFrame?: boolean
  serviceTier?: VolcServiceTier
  label: string
}

const imageRoleForSeedance1 = (mode: VolcVideoMode, index: number, total: number): VolcImageRole => {
  if (mode === 'image_first_last' && total > 1) {
    return index === 0 ? 'first_frame' : 'last_frame'
  }
  return 'first_frame'
}

export const buildSeedance1VideoPayload = (options: Omit<CreateSeedance1VideoTaskOptions, 'apiKey' | 'label'>) => {
  const imageItems = options.referenceImages.map((image, index) => ({
    type: 'image_url' as const,
    role: imageRoleForSeedance1(options.mode, index, options.referenceImages.length),
    image_url: { url: image.url }
  }))

  const payload: any = {
    model: options.model.id,
    content: [
      ...imageItems,
      { type: 'text' as const, text: options.prompt }
    ],
    duration: options.duration,
    resolution: options.resolution,
    ratio: options.ratio,
    watermark: options.watermark
  }

  if (options.model.supportsCameraFixed) payload.camera_fixed = options.cameraFixed
  if (options.model.supportsAudioGeneration && options.generateAudio !== undefined) payload.generate_audio = options.generateAudio
  if (options.model.supportsReturnLastFrame && options.returnLastFrame !== undefined) payload.return_last_frame = options.returnLastFrame
  if (options.model.supportsFlexTier && options.serviceTier) payload.service_tier = options.serviceTier

  return payload
}

export const createSeedance1VideoTask = async (options: CreateSeedance1VideoTaskOptions) => {
  const payload = buildSeedance1VideoPayload(options)
  const taskId = await createVolcVideoTask(options.apiKey, payload, options.label)
  return { taskId, payload }
}
