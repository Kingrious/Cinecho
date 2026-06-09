import { createVolcVideoTask } from './client'
import type { VolcImageRole, VolcServiceTier, VolcVideoModelConfig, VolcVideoMode, VolcVideoRatio, VolcVideoResolution } from './videoModels'

export type Seedance2ReferenceImage = {
  url: string
  role?: VolcImageRole
}

export type CreateSeedance2VideoTaskOptions = {
  apiKey: string
  model: VolcVideoModelConfig
  mode: VolcVideoMode
  prompt: string
  referenceImages: Seedance2ReferenceImage[]
  duration: number
  resolution: VolcVideoResolution
  ratio: VolcVideoRatio
  watermark: boolean
  generateAudio: boolean
  returnLastFrame: boolean
  serviceTier?: VolcServiceTier
  label: string
}

const imageRoleForSeedance2 = (mode: VolcVideoMode, index: number, total: number): VolcImageRole => {
  if (mode === 'image_first') return 'first_frame'
  if (mode === 'image_first_last' && total > 1) return index === 0 ? 'first_frame' : 'last_frame'
  return 'reference_image'
}

export const buildSeedance2VideoPayload = (options: Omit<CreateSeedance2VideoTaskOptions, 'apiKey' | 'label'>) => {
  const imageItems = options.referenceImages.map((image, index) => ({
    type: 'image_url' as const,
    role: imageRoleForSeedance2(options.mode, index, options.referenceImages.length),
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
    generate_audio: options.generateAudio,
    watermark: options.watermark,
    return_last_frame: options.returnLastFrame
  }

  if (options.model.supportsFlexTier && options.serviceTier) {
    payload.service_tier = options.serviceTier
  }

  return payload
}

export const createSeedance2VideoTask = async (options: CreateSeedance2VideoTaskOptions) => {
  const payload = buildSeedance2VideoPayload(options)
  const taskId = await createVolcVideoTask(options.apiKey, payload, options.label)
  return { taskId, payload }
}
