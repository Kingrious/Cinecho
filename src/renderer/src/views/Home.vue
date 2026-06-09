<script setup lang="ts">
import { computed, onActivated, onMounted, onUnmounted, ref, watch } from 'vue'
import { eventsApi, mediaApi, storeApi, storyboardApi } from '../api/media'
import { useDialog } from '../composables/useDialog'
import type { GenerateVideoOptions, StoryboardAsset, StoryboardShot, VideoAsset, VideoGenerationMode, VideoRatio, VideoResolution } from '../types/media'
import { VIDEO_MODELS } from '../types/media'
import { formatVideoGenerationError } from '../utils/errorMessages'

const dialog = useDialog()

const videos = ref<VideoAsset[]>([])
const storyboards = ref<StoryboardAsset[]>([])
const isLoading = ref(false)
const isGenerating = ref(false)
const generationProgress = ref(0)
const generationStatusText = ref('正在准备视频生成任务')
const generationElapsedSeconds = ref(0)
const outputDir = ref('')
const selectedVideo = ref<VideoAsset | null>(null)
const videoThumbnailCache = ref<Record<string, string>>({})
const expandedPromptShotIndex = ref(-1)

const prompt = ref('')
const videoName = ref('')
const selectedModel = ref('doubao-seedance-1-0-pro-fast-251015')
const selectedVideoProvider = ref('ark')
const selectedStoryboardId = ref('')
const duration = ref(5)
const resolution = ref<VideoResolution>('1080p')
const ratio = ref<VideoRatio>('16:9')
const generationMode = ref<VideoGenerationMode>('image_first')
const watermark = ref(false)
const generateAudio = ref(false)
const returnLastFrame = ref(false)
const cameraFixed = ref(false)
type FrameRole = 'first' | 'last' | 'reference1' | 'reference2' | 'reference3'
interface FrameSlot {
  role: FrameRole
  title: string
  placeholder: string
  code: string
}

const frameShots = ref<Record<FrameRole, StoryboardShot | null>>({
  first: null,
  last: null,
  reference1: null,
  reference2: null,
  reference3: null
})
const draggedShotIndex = ref<number | null>(null)
const dragOverFrameRole = ref<FrameRole | null>(null)
let hasActivatedOnce = false
let unsubscribeTaskProgress: (() => void) | null = null
let generationTimer: number | null = null

const CAMERA_MOTION_OPTIONS = [
  { value: 'slow push in, zoom in gradually', label: '推 Push In' },
  { value: 'pull back slowly, zoom out', label: '拉 Pull Back' },
  { value: 'smooth pan camera across the scene', label: '摇 Pan' },
  { value: 'smooth lateral tracking camera move', label: '移 Truck' },
  { value: 'crane camera rises upward smoothly', label: '升 Crane Up' },
  { value: 'crane camera descends smoothly', label: '降 Crane Down' },
  { value: 'fast whip pan camera movement', label: '甩 Whip Pan' },
  { value: 'follow shot tracking the subject movement', label: '跟 Follow' },
  { value: 'static locked camera, no camera translation', label: '固定 Static' }
]
const cameraMotion = ref(CAMERA_MOTION_OPTIONS[0].value)

const ALL_GENERATION_MODES: Array<{ value: VideoGenerationMode; label: string; short: string }> = [
  { value: 'text_to_video', label: '文生', short: 'TEXT' },
  { value: 'image_first', label: '首帧', short: 'FIRST' },
  { value: 'image_first_last', label: '首尾帧', short: 'FIRST/LAST' },
  { value: 'multimodal', label: '多模态', short: 'MULTI' },
  { value: 'edit', label: '编辑', short: 'EDIT' },
  { value: 'extend', label: '延长', short: 'EXTEND' }
]
const ALL_DURATIONS = Array.from({ length: 14 }, (_, index) => index + 2)
const ALL_RESOLUTIONS: VideoResolution[] = ['480p', '720p', '1080p']
const ALL_RATIOS: VideoRatio[] = ['adaptive', '16:9', '4:3', '1:1', '3:4', '9:16', '21:9']

const selectedModelInfo = computed(() => VIDEO_MODELS.find(m => m.id === selectedModel.value))
const availableDurations = computed(() => selectedModelInfo.value?.durationOptions || [5])
const availableResolutions = computed(() => selectedModelInfo.value?.supportedResolutions || ['720p'])
const availableModes = computed(() => selectedModelInfo.value?.supportsModes || ['text_to_video'])
const modelSupportsFirstLastFrame = computed(() => Boolean(selectedModelInfo.value?.supportsFirstLastFrame))
const modelFirstLastFrameLabel = computed(() => (
  modelSupportsFirstLastFrame.value ? '支持首尾帧' : '不支持首尾帧'
))
const modelSupportsMode = (mode: VideoGenerationMode) => availableModes.value.includes(mode)
const modelSupportsResolution = (value: VideoResolution) => availableResolutions.value.includes(value)
const modelSupportsDuration = (value: number) => availableDurations.value.includes(value)
const selectedStoryboard = computed(() => storyboards.value.find(item => item.id === selectedStoryboardId.value) || null)
const readyShots = computed(() => selectedStoryboard.value?.shots.filter(shot => shot.imagePath) || [])
const activeFrameSlots = computed<FrameSlot[]>(() => (
  generationMode.value === 'image_first_last'
    ? [
        { role: 'first', title: '首帧', placeholder: '拖入开场镜头', code: 'FIRST FRAME' },
        { role: 'last', title: '尾帧', placeholder: '拖入结尾镜头', code: 'LAST FRAME' }
      ]
    : generationMode.value === 'text_to_video'
      ? []
      : generationMode.value === 'image_first'
        ? [
            { role: 'first', title: '首帧', placeholder: '拖入首帧镜头', code: 'FIRST FRAME' }
          ]
        : [
            { role: 'reference1', title: '参考帧 1', placeholder: '拖入参考镜头', code: 'REFERENCE 1' },
            { role: 'reference2', title: '参考帧 2', placeholder: '拖入参考镜头', code: 'REFERENCE 2' },
            { role: 'reference3', title: '参考帧 3', placeholder: '拖入参考镜头', code: 'REFERENCE 3' }
          ]
))
const selectedFrameShots = computed(() => activeFrameSlots.value
  .map(slot => frameShots.value[slot.role])
  .filter(Boolean) as StoryboardShot[])
const currentModeLabel = computed(() => ALL_GENERATION_MODES.find(mode => mode.value === generationMode.value)?.label || '生成')
const activeModeNeedsImage = computed(() => generationMode.value !== 'text_to_video')
const selectedVideoModelMaxFrames = computed(() => {
  if (generationMode.value === 'text_to_video') return 0
  if (generationMode.value === 'image_first') return 1
  if (generationMode.value === 'image_first_last') return 2
  return Math.min(selectedModelInfo.value?.maxReferenceImages || 1, 3)
})
const sentReferenceFrameCount = computed(() => Math.min(selectedFrameShots.value.length, selectedVideoModelMaxFrames.value))
const selectedFrameRoles = computed(() => activeFrameSlots.value
  .filter(slot => frameShots.value[slot.role])
  .map(slot => slot.role === 'first'
    ? 'first_frame'
    : slot.role === 'last'
      ? 'last_frame'
      : 'reference_image') as Array<'first_frame' | 'reference_image' | 'last_frame'>)
const hasSelectedFrames = computed(() => selectedFrameShots.value.length > 0)
const hasMotionText = computed(() => prompt.value.trim().length > 0)
const hasRequiredFrameSelection = computed(() => {
  if (!activeModeNeedsImage.value) return true
  if (generationMode.value === 'image_first_last') {
    return Boolean(frameShots.value.first && frameShots.value.last)
  }
  return hasSelectedFrames.value
})
const selectedModeAvailable = computed(() => modelSupportsMode(generationMode.value))
const canGenerate = computed(() => Boolean(
  selectedStoryboard.value &&
  selectedModeAvailable.value &&
  hasRequiredFrameSelection.value &&
  (hasSelectedFrames.value || hasMotionText.value)
))
const completedStoryboardCount = computed(() => storyboards.value.filter(item => item.completedCount > 0).length)
const selectedVideoUrl = computed(() => selectedVideo.value ? getPlayableVideoUrl(selectedVideo.value) : '')

const getFrameShot = (role: FrameRole) => frameShots.value[role]
const isImageThumbnail = (thumbnail?: string) => Boolean(thumbnail && (thumbnail.startsWith('data:image/') || /\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(thumbnail)))
const toFileUrl = (filePath: string): string => {
  if (/^(file|https?|app):/i.test(filePath)) return filePath
  const normalized = filePath.replace(/\\/g, '/')
  return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`
}
const getPlayableVideoUrl = (video: VideoAsset): string => video.url || toFileUrl(video.path)
const getVideoCardThumbnail = (video: VideoAsset): string => {
  if (isImageThumbnail(video.thumbnail)) return video.thumbnail
  return videoThumbnailCache.value[video.path] || ''
}

const thumbnailQueue = new Set<string>()
let isCapturingThumbnail = false

const captureVideoThumbnail = (video: VideoAsset): Promise<string> => {
  return new Promise((resolve) => {
    const sourceUrl = getPlayableVideoUrl(video)
    const element = document.createElement('video')
    let settled = false
    let seekRequested = false
    let timeoutId = 0

    const cleanup = () => {
      window.clearTimeout(timeoutId)
      element.removeAttribute('src')
      element.load()
    }
    const finish = (thumbnail: string) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(thumbnail)
    }
    const drawFrame = () => {
      try {
        const width = element.videoWidth || 320
        const height = element.videoHeight || 180
        const canvas = document.createElement('canvas')
        canvas.width = 320
        canvas.height = Math.max(1, Math.round(320 * (height / width)))
        const context = canvas.getContext('2d')
        if (!context) {
          finish('')
          return
        }
        context.drawImage(element, 0, 0, canvas.width, canvas.height)
        finish(canvas.toDataURL('image/jpeg', 0.76))
      } catch (error) {
        console.warn('[Creation] Failed to capture video thumbnail:', error)
        finish('')
      }
    }

    element.muted = true
    element.playsInline = true
    element.preload = 'metadata'
    element.addEventListener('loadedmetadata', () => {
      const duration = Number.isFinite(element.duration) ? element.duration : 0
      const targetTime = Math.min(1, Math.max(0, duration * 0.08))
      if (duration > 0.2 && targetTime > 0) {
        seekRequested = true
        element.currentTime = targetTime
      }
    }, { once: true })
    element.addEventListener('seeked', drawFrame, { once: true })
    element.addEventListener('loadeddata', () => {
      if (!seekRequested) drawFrame()
    }, { once: true })
    element.addEventListener('error', () => finish(''), { once: true })
    timeoutId = window.setTimeout(() => finish(''), 8000)
    element.src = sourceUrl
  })
}

const runThumbnailQueue = async () => {
  if (isCapturingThumbnail) return
  isCapturingThumbnail = true
  try {
    while (thumbnailQueue.size > 0) {
      const videoPath = thumbnailQueue.values().next().value as string
      thumbnailQueue.delete(videoPath)
      const video = videos.value.find(item => item.path === videoPath)
      if (!video || videoThumbnailCache.value[video.path] || isImageThumbnail(video.thumbnail)) continue
      let thumbnail = ''
      try {
        thumbnail = await mediaApi.getVideoThumbnail(video.path)
      } catch (error) {
        console.warn('[Creation] Failed to get video thumbnail from main process:', error)
      }
      if (!thumbnail) {
        thumbnail = await captureVideoThumbnail(video)
      }
      if (thumbnail) {
        videoThumbnailCache.value = {
          ...videoThumbnailCache.value,
          [video.path]: thumbnail
        }
      }
    }
  } finally {
    isCapturingThumbnail = false
  }
}

const scheduleVideoThumbnails = (items: VideoAsset[]) => {
  for (const video of items) {
    if (!isImageThumbnail(video.thumbnail) && !videoThumbnailCache.value[video.path]) {
      thumbnailQueue.add(video.path)
    }
  }
  void runThumbnailQueue()
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const formatGenerationElapsed = computed(() => {
  const totalSeconds = generationElapsedSeconds.value
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`
})

const startGenerationTimer = () => {
  if (generationTimer !== null) window.clearInterval(generationTimer)
  generationElapsedSeconds.value = 0
  generationTimer = window.setInterval(() => {
    generationElapsedSeconds.value += 1
  }, 1000)
}

const stopGenerationTimer = () => {
  if (generationTimer !== null) {
    window.clearInterval(generationTimer)
    generationTimer = null
  }
}

const handleCancelGeneration = async () => {
  if (!isGenerating.value) return

  try {
    const result = await mediaApi.cancelVideoGeneration()
    isGenerating.value = false
    stopGenerationTimer()
    generationProgress.value = 100
    generationStatusText.value = result.error || '已停止等待当前视频生成任务'

    if (result.error) {
      await dialog.notify(result.error, '已停止')
    }
  } catch (error: any) {
    console.error('[Creation] Cancel video generation failed:', error)
    await dialog.error(formatVideoGenerationError(error?.message))
  }
}

const loadVideos = async () => {
  isLoading.value = true
  try {
    const dir = await mediaApi.getOutputDirectory()
    outputDir.value = dir
    const [data, videoList, storyboardList] = await Promise.all([
      storeApi.get(),
      mediaApi.scanVideos(dir),
      storyboardApi.scan()
    ])
    selectedVideoProvider.value = data.settings?.defaultVideoProvider || 'ark'
    selectedModel.value = data.settings?.defaultVideoModel || selectedModel.value
    videos.value = videoList
    scheduleVideoThumbnails(videoList)
    storyboards.value = storyboardList
    if (!selectedStoryboardId.value && storyboardList.length > 0) {
      const firstReady = storyboardList.find(item => item.completedCount > 0) || storyboardList[0]
      selectStoryboard(firstReady.id)
    } else if (selectedStoryboardId.value) {
      syncShotOrderWithStoryboard()
    }
  } catch (error) {
    console.error('[Creation] Failed to load videos/storyboards:', error)
  } finally {
    isLoading.value = false
  }
}

const selectStoryboard = (storyboardId: string) => {
  selectedStoryboardId.value = storyboardId
  for (const role of Object.keys(frameShots.value) as FrameRole[]) {
    frameShots.value[role] = null
  }
}

const syncShotOrderWithStoryboard = () => {
  const storyboard = selectedStoryboard.value
  if (!storyboard) {
    for (const role of Object.keys(frameShots.value) as FrameRole[]) {
      frameShots.value[role] = null
    }
    return
  }
  const ready = storyboard.shots.filter(shot => shot.imagePath)
  for (const role of Object.keys(frameShots.value) as FrameRole[]) {
    const current = frameShots.value[role]
    frameShots.value[role] = current
      ? ready.find(shot => shot.index === current.index) || null
      : null
  }
}

const setFrameShot = (role: FrameRole, shot: StoryboardShot) => {
  for (const slotRole of Object.keys(frameShots.value) as FrameRole[]) {
    if (slotRole !== role && frameShots.value[slotRole]?.index === shot.index) {
      frameShots.value[slotRole] = null
    }
  }
  frameShots.value[role] = shot
}

const clearFrameShot = (role: FrameRole) => {
  frameShots.value[role] = null
}

const handleShotDragStart = (shot: StoryboardShot, event: DragEvent) => {
  draggedShotIndex.value = shot.index
  event.dataTransfer?.setData('application/x-cinecho-storyboard-shot-index', String(shot.index))
  event.dataTransfer?.setData('text/plain', String(shot.index))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
}

const handleShotDragEnd = () => {
  draggedShotIndex.value = null
  dragOverFrameRole.value = null
}

const handleFrameDragOver = (role: FrameRole, event: DragEvent) => {
  event.preventDefault()
  dragOverFrameRole.value = role
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}

const handleFrameDrop = (role: FrameRole, event: DragEvent) => {
  event.preventDefault()
  const shotIndex = Number(
    event.dataTransfer?.getData('application/x-cinecho-storyboard-shot-index') ||
    event.dataTransfer?.getData('text/plain') ||
    draggedShotIndex.value
  )
  const shot = readyShots.value.find(item => item.index === shotIndex)
  if (shot) setFrameShot(role, shot)
  handleShotDragEnd()
}

const addShotToNextFrame = (shot: StoryboardShot) => {
  if (selectedFrameShots.value.some(item => item.index === shot.index)) return
  const emptySlot = activeFrameSlots.value.find(slot => !frameShots.value[slot.role])
  if (emptySlot) {
    setFrameShot(emptySlot.role, shot)
  }
}

const buildStoryboardVideoPrompt = () => {
  const frameDescriptions = selectedFrameShots.value
    .map((shot, index) => {
      const slot = activeFrameSlots.value.find(item => frameShots.value[item.role]?.index === shot.index)
      const frameLabel = slot?.role === 'first'
        ? 'Opening image'
        : slot?.role === 'last'
          ? 'Ending image'
          : `Reference image ${index + 1}`
      const shotNote = shot.prompt?.trim()
      return shotNote ? `${frameLabel}: ${shotNote}` : frameLabel
    })
    .join('\n')
  const defaultMotion = generationMode.value === 'image_first_last'
    ? 'Animate a natural transition from the opening image to the ending image.'
    : 'Add natural motion that fits the image and scene.'
  const motionScript = prompt.value.trim() || defaultMotion
  const referenceInstruction = !hasSelectedFrames.value
    ? 'Text-to-video: follow the motion instruction directly.'
    : generationMode.value === 'image_first_last'
      ? 'Image order: image 1 is the opening frame; image 2 is the ending frame.'
      : generationMode.value === 'image_first'
        ? 'Image order: image 1 is the opening frame. Continue from that visual state.'
        : 'Use the provided images as visual anchors in their given order.'
  return [
    `Create a cinematic ${currentModeLabel.value} video.`,
    referenceInstruction,
    frameDescriptions ? `Image notes:\n${frameDescriptions}` : '',
    `Motion: ${motionScript}`
  ].filter(Boolean).join('\n')
}

const buildFinalVideoPrompt = (basePrompt: string) => {
  let fullPrompt = basePrompt
  if (cameraMotion.value) {
    fullPrompt = `${fullPrompt}, ${cameraMotion.value}`
  }
  if (sentReferenceFrameCount.value > 0) {
    const imgCount = sentReferenceFrameCount.value
    const fidelityPrefix = `Use the provided reference image${imgCount > 1 ? 's' : ''} as visual anchor${imgCount > 1 ? 's' : ''}. ` +
      'Keep the same main subject, outfit, environment, and visual style. ' +
      'Do not introduce new main characters unless requested. '
    fullPrompt = `${fidelityPrefix}${fullPrompt}`
  }
  return fullPrompt
}

const storyboardPromptPreview = computed(() => buildStoryboardVideoPrompt())
const fullPromptPreview = computed(() => buildFinalVideoPrompt(storyboardPromptPreview.value))

const checkApiKey = async (): Promise<boolean> => {
  try {
    const data = await storeApi.get()
    const hasApiKey = Boolean(data.settings?.apiKey?.trim?.() || data.settings?.apiKeyConfigured || data.settings?.apiKeysConfigured?.ark)
    if (!hasApiKey) {
      await dialog.error('API Key 未配置！请先前往 Settings 页面配置。')
      return false
    }
    return true
  } catch (error) {
    console.error('Failed to check API key:', error)
    await dialog.error('无法验证 API Key 状态，请检查设置。')
    return false
  }
}

const handleGenerate = async () => {
  if (!selectedStoryboard.value) {
    await dialog.error('请先选择一个分镜头。')
    return
  }
  if (!selectedModeAvailable.value) {
    await dialog.error(`${selectedModelInfo.value?.name || '当前模型'} 不支持 ${currentModeLabel.value} 模式。`)
    return
  }
  if (!hasRequiredFrameSelection.value) {
    await dialog.error(`${currentModeLabel.value} 模式需要先选择对应的参考帧。`)
    return
  }
  if (!hasSelectedFrames.value && !hasMotionText.value) {
    await dialog.error('未输入图片时，必须填写文本描述。')
    return
  }
  const hasApiKey = await checkApiKey()
  if (!hasApiKey) return

  isGenerating.value = true
  generationProgress.value = 2
  generationStatusText.value = '正在提交视频生成任务'
  startGenerationTimer()
  try {
    const frameShots = selectedFrameShots.value
    const options: GenerateVideoOptions = {
      prompt: storyboardPromptPreview.value,
      model: selectedModel.value,
      provider: selectedVideoProvider.value,
      videoName: videoName.value.trim() || undefined,
      duration: duration.value,
      resolution: resolution.value,
      ratio: ratio.value,
      generationMode: generationMode.value,
      watermark: watermark.value,
      generateAudio: generateAudio.value,
      returnLastFrame: returnLastFrame.value,
      cameraFixed: cameraFixed.value,
      referenceImagePaths: frameShots.map(shot => shot.imagePath!).filter(Boolean),
      referenceFrameRoles: selectedFrameRoles.value,
      cameraMotion: cameraMotion.value || undefined,
      storyboardId: selectedStoryboard.value.id,
      storyboardName: selectedStoryboard.value.name,
      storyboardShotOrder: frameShots.map(shot => shot.index)
    }

    const result = await mediaApi.generateVideo(options)
    if (result.success) {
      await dialog.notify('视频生成成功！')
      await loadVideos()
      prompt.value = ''
    } else if ((result.error || '').includes('已停止等待当前视频生成任务')) {
      // User intentionally stopped waiting; no error dialog needed.
    } else {
      await dialog.error(formatVideoGenerationError(result.error))
    }
  } catch (error: any) {
    console.error('[Creation] Video generation failed:', error)
    if ((error?.message || '').includes('已停止等待当前视频生成任务')) {
      return
    }
    await dialog.error(formatVideoGenerationError(error?.message))
  } finally {
    isGenerating.value = false
    stopGenerationTimer()
  }
}

const loadVideoParams = (video: VideoAsset) => {
  if (video.prompt) prompt.value = video.prompt
  if (video.model) selectedModel.value = video.model
  if (video.generationMode) generationMode.value = video.generationMode
  if (video.duration) duration.value = video.duration
  if (video.resolution) resolution.value = video.resolution
  if (video.ratio) ratio.value = video.ratio
  if (video.generateAudio !== undefined) generateAudio.value = video.generateAudio
}

const deleteVideo = async (video: VideoAsset) => {
  if (!await dialog.confirm(`确认删除「${video.name}」?`, '删除视频', '删除')) return
  await mediaApi.deleteAsset(video.path)
  if (selectedVideo.value?.path === video.path) {
    selectedVideo.value = null
  }
  await loadVideos()
}

const openVideoLocation = async (video: VideoAsset) => {
  await mediaApi.revealInExplorer(video.path)
}

const playVideo = (video: VideoAsset) => {
  selectedVideo.value = video
}

const closeVideoPlayer = () => {
  selectedVideo.value = null
}

onMounted(async () => {
  await loadVideos()
  unsubscribeTaskProgress = eventsApi.onTaskProgress((data) => {
    if (data.taskType !== 'video') return
    generationProgress.value = typeof data.progress === 'number' ? data.progress : generationProgress.value
    generationStatusText.value = data.message || generationStatusText.value
  })
})

onUnmounted(() => {
  stopGenerationTimer()
  if (unsubscribeTaskProgress) unsubscribeTaskProgress()
})

onActivated(() => {
  if (hasActivatedOnce) {
    void loadVideos()
  }
  hasActivatedOnce = true
})

watch(selectedModel, () => {
  const config = selectedModelInfo.value
  if (!config) return
  if (!availableModes.value.includes(generationMode.value)) generationMode.value = config.supportsModes[0] || 'text_to_video'
  if (!availableDurations.value.includes(duration.value)) duration.value = config.defaultDuration
  if (!availableResolutions.value.includes(resolution.value)) resolution.value = config.defaultResolution
  ratio.value = config.defaultRatio
  if (!config.supportsAudioGeneration) generateAudio.value = false
  if (!config.supportsReturnLastFrame) returnLastFrame.value = false
  if (!config.supportsCameraFixed) cameraFixed.value = false
})

watch(generationMode, () => {
  for (const role of Object.keys(frameShots.value) as FrameRole[]) {
    if (!activeFrameSlots.value.some(slot => slot.role === role)) {
      frameShots.value[role] = null
    }
  }
})
</script>

<template>
  <div class="h-full bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col overflow-hidden font-sans">
    <header class="h-[52px] shrink-0 border-b border-[var(--border-color)] flex justify-center items-center px-6 gap-8 bg-[var(--bg-secondary)]">
      <div class="text-xs font-bold tracking-widest text-[var(--text-secondary)]">创作引擎控制台 VIDEO ENGINE</div>
    </header>

    <div class="flex-1 flex overflow-hidden">
      <main class="flex-1 flex flex-col border-r border-[var(--border-color)] bg-[var(--bg-primary)] min-w-0">
        <div class="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-sm font-bold tracking-widest text-[var(--text-secondary)]">创作面板</h2>
              <p class="text-[10px] mt-1 text-[var(--text-tertiary)]">保留并展示当前视频目录中的所有已生成视频</p>
            </div>
            <div class="flex gap-2">
              <span class="text-[10px] bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-tertiary)] px-2 py-1 rounded font-medium">
                {{ videos.length }} videos
              </span>
              <span class="text-[10px] bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-tertiary)] px-2 py-1 rounded font-medium">
                {{ completedStoryboardCount }} storyboards
              </span>
            </div>
          </div>

          <div v-if="isLoading" class="flex items-center justify-center h-64">
            <div class="flex flex-col items-center gap-4">
              <div class="w-10 h-10 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin"></div>
              <span class="text-sm text-[var(--text-tertiary)]">加载视频中...</span>
            </div>
          </div>

          <div v-else-if="!isGenerating && videos.length === 0" class="flex items-center justify-center h-64">
            <div class="flex flex-col items-center gap-4 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="text-[var(--text-tertiary)]">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              <div>
                <p class="text-[var(--text-secondary)] font-medium">暂无视频</p>
                <p class="text-[var(--text-tertiary)] text-sm mt-1">选择右侧分镜头图片顺序后生成视频</p>
              </div>
            </div>
          </div>

          <div v-else class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            <div
              v-if="isGenerating"
              class="aspect-video bg-[var(--bg-tertiary)] rounded-xl border border-blue-500/40 overflow-hidden relative shadow-[0_0_20px_rgba(59,130,246,0.16)]"
            >
              <div class="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-slate-950/30"></div>
              <div class="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div class="w-10 h-10 rounded-full border-2 border-blue-500/20 border-t-blue-400 animate-spin"></div>
                <div class="text-center">
                  <p class="text-xs font-bold tracking-wider text-[var(--text-primary)]">视频生成中</p>
                  <p class="mt-1 text-[10px] text-[var(--text-tertiary)]">{{ generationStatusText }}</p>
                  <p class="mt-1 text-[10px] text-blue-300/80">已等待 {{ formatGenerationElapsed }} · {{ generationProgress }}%</p>
                </div>
              </div>
            </div>
            <div
              v-for="video in videos"
              :key="video.id"
              class="aspect-video bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-color)] overflow-hidden relative group cursor-pointer hover:border-blue-500/50 hover:shadow-[0_0_15px_rgba(59,130,246,0.15)] transition-all shadow-sm"
              @click="playVideo(video)"
            >
              <img v-if="getVideoCardThumbnail(video)" :src="getVideoCardThumbnail(video)" class="w-full h-full object-cover opacity-80 transition-opacity group-hover:opacity-100" loading="lazy" />
              <div v-else class="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.18),transparent_35%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(2,6,23,0.96))]"></div>
              <div v-if="!getVideoCardThumbnail(video)" class="absolute inset-x-3 top-3">
                <p class="truncate text-[10px] font-bold tracking-wider text-white/80">{{ video.name }}</p>
              </div>
              <div class="absolute inset-0 bg-black/25 group-hover:bg-black/45 transition-colors flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="white" class="opacity-70 group-hover:opacity-100 transform group-hover:scale-110 transition-all drop-shadow-md" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              </div>
              <div class="absolute bottom-2 left-2 bg-black/70 backdrop-blur rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-white">
                {{ formatFileSize(video.size) }}
              </div>
              <div class="absolute bottom-2 right-2 left-12 opacity-0 group-hover:opacity-100 transition-opacity">
                <p class="text-[9px] text-white font-bold bg-black/70 backdrop-blur rounded px-2 py-1 truncate shadow text-right">{{ video.name }}</p>
              </div>
              <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0">
                <button
                  v-if="video.prompt"
                  @click.stop="loadVideoParams(video)"
                  class="w-6 h-6 rounded bg-black/70 backdrop-blur flex items-center justify-center hover:bg-amber-500/80 transition-colors"
                  title="使用此参数重新生成"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                </button>
                <button @click.stop="playVideo(video)" class="w-6 h-6 rounded bg-black/70 backdrop-blur flex items-center justify-center hover:bg-blue-500/80 transition-colors" title="播放视频">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </button>
                <button @click.stop="openVideoLocation(video)" class="w-6 h-6 rounded bg-black/70 backdrop-blur flex items-center justify-center hover:bg-emerald-500/80 transition-colors" title="在文件夹中显示">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                </button>
                <button @click.stop="deleteVideo(video)" class="w-6 h-6 rounded bg-black/70 backdrop-blur flex items-center justify-center hover:bg-red-500/80 transition-colors" title="删除">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <aside class="w-[380px] flex flex-col relative bg-[var(--bg-secondary)] border-l border-[var(--border-color)] z-10 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
        <div class="p-6 flex-1 flex flex-col gap-5 w-full relative overflow-y-auto pb-32 custom-scrollbar">
          <div class="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
            <h2 class="text-xs font-bold tracking-wider text-[var(--text-primary)]">分镜视频生成 STORYBOARD VIDEO</h2>
            <button class="text-[10px] px-2 py-1 rounded border border-[var(--border-color)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]" @click="loadVideos">刷新</button>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-[var(--text-tertiary)]">分镜脚本 STORYBOARD SCRIPT</label>
            <div class="relative">
              <select v-model="selectedStoryboardId" class="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-blue-500/50 transition-colors shadow-inner" @change="selectStoryboard(selectedStoryboardId)">
                <option disabled value="">选择一个分镜脚本</option>
                <option v-for="storyboard in storyboards" :key="storyboard.id" :value="storyboard.id">
                  {{ storyboard.name }} - {{ storyboard.completedCount }}/{{ storyboard.shotCount }} 张
                </option>
              </select>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-[var(--text-tertiary)]">生成模型 MODEL</label>
            <div class="relative">
              <select v-model="selectedModel" class="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-blue-500/50 transition-colors shadow-inner">
                <option v-for="model in VIDEO_MODELS" :key="model.id" :value="model.id">{{ model.name }} · {{ model.supportsFirstLastFrame ? '支持首尾帧' : '不支持首尾帧' }}</option>
              </select>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"><path d="m6 9 6 6 6-6"/></svg>
            </div>
            <p class="text-[9px] text-[var(--text-tertiary)] mt-1">{{ selectedModelInfo?.description }} · {{ modelFirstLastFrameLabel }}</p>
          </div>

          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <label class="text-[10px] font-bold text-[var(--text-tertiary)]">生成模式 MODE</label>
              <span class="text-[9px] text-[var(--text-tertiary)]">{{ currentModeLabel }}</span>
            </div>
            <div class="grid grid-cols-3 gap-1.5">
              <button
                v-for="mode in ALL_GENERATION_MODES"
                :key="mode.value"
                type="button"
                :disabled="!modelSupportsMode(mode.value)"
                :title="mode.label"
                @click="generationMode = mode.value"
                :class="[
                  'min-h-[40px] rounded-md border px-2 py-1.5 text-center transition-colors',
                  generationMode === mode.value ? 'border-blue-400 bg-blue-600 text-white shadow-[0_0_14px_rgba(37,99,235,0.32)]' : 'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-blue-400/50',
                  !modelSupportsMode(mode.value) ? 'opacity-35 cursor-not-allowed hover:border-[var(--border-color)]' : ''
                ]"
              >
                <div class="text-[10px] font-bold leading-none">{{ mode.label }}</div>
                <div :class="['mt-1 text-[8px] font-mono', generationMode === mode.value ? 'text-blue-100/85' : 'text-[var(--text-tertiary)]']">{{ mode.short }}</div>
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-3">
            <div class="flex justify-between items-center">
              <label class="text-[10px] font-bold text-[var(--text-tertiary)]">首尾 / 参考帧 FIRST / LAST / REFERENCE</label>
              <span class="text-[9px] text-[var(--text-tertiary)] font-mono">{{ selectedFrameShots.length }}/{{ activeFrameSlots.length }}</span>
            </div>

            <div v-if="activeFrameSlots.length" class="grid grid-cols-3 gap-2">
              <div
                v-for="slot in activeFrameSlots"
                :key="slot.role"
                :class="[
                  'min-h-[128px] rounded-lg border-2 border-dashed p-2 transition-all',
                  dragOverFrameRole === slot.role ? 'border-blue-400 bg-blue-500/10' : 'border-[var(--border-color)] bg-[var(--bg-card)]/60'
                ]"
                @dragover="event => handleFrameDragOver(slot.role, event)"
                @dragleave="dragOverFrameRole = null"
                @drop="event => handleFrameDrop(slot.role, event)"
              >
                <div class="mb-2 flex items-center justify-between gap-2">
                  <span class="truncate text-[10px] font-bold tracking-wider text-[var(--text-primary)]">{{ slot.title }}</span>
                  <button
                    v-if="getFrameShot(slot.role)"
                    class="h-5 w-5 rounded border border-[var(--border-color)] text-[10px] text-red-300 hover:bg-red-500/10"
                    type="button"
                    :title="`移除${slot.title}`"
                    @click="clearFrameShot(slot.role)"
                  >
                    ×
                  </button>
                </div>
                <div v-if="getFrameShot(slot.role)" class="overflow-hidden rounded-md border border-[var(--border-color)] bg-black/20">
                  <div class="aspect-video">
                    <img :src="getFrameShot(slot.role)?.thumbnail || getFrameShot(slot.role)?.imageUrl" class="h-full w-full object-cover" />
                  </div>
                  <div class="flex items-center justify-between gap-2 bg-black/40 px-2 py-1">
                    <span class="truncate text-[10px] font-bold text-white">#{{ getFrameShot(slot.role)?.index }}</span>
                  </div>
                </div>
                <div v-else class="flex min-h-[82px] flex-col items-center justify-center rounded-md border border-dashed border-[var(--border-color)] px-1 text-center">
                  <div class="text-[10px] font-bold text-[var(--text-secondary)]">{{ slot.placeholder }}</div>
                  <div class="mt-1 text-[8px] text-[var(--text-tertiary)]">{{ slot.code }}</div>
                </div>
              </div>
            </div>
            <div v-else class="rounded-md border border-dashed border-[var(--border-color)] bg-[var(--bg-card)]/60 px-3 py-5 text-center text-[11px] text-[var(--text-tertiary)]">
              文生模式不需要参考帧
            </div>

            <div v-if="readyShots.length && activeFrameSlots.length" class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold text-[var(--text-tertiary)]">分镜镜头 SHOTS</span>
                <span class="text-[9px] text-[var(--text-tertiary)]">拖拽到上方槽位</span>
              </div>
              <div class="grid grid-cols-4 gap-2">
                <button
                  v-for="shot in readyShots"
                  :key="shot.index"
                  :class="[
                    'group/shot rounded-md border bg-[var(--bg-card)] text-left transition-all hover:border-blue-400/70 hover:bg-[var(--bg-tertiary)] relative',
                    selectedFrameShots.some(item => item.index === shot.index) ? 'border-blue-400/80 opacity-70' : 'border-[var(--border-color)]'
                  ]"
                  type="button"
                  draggable="true"
                  :title="`拖动镜头 #${shot.index}`"
                  @click="addShotToNextFrame(shot)"
                  @dragstart="event => handleShotDragStart(shot, event)"
                  @dragend="handleShotDragEnd"
                >
                  <div class="aspect-video bg-black/20 rounded-t-md overflow-hidden">
                    <img :src="shot.thumbnail || shot.imageUrl" class="h-full w-full object-cover transition-transform group-hover/shot:scale-[1.04]" />
                    <button
                      v-if="shot.prompt"
                      class="shot-prompt-badge"
                      type="button"
                      :title="expandedPromptShotIndex === shot.index ? '点击收起' : '点击查看提示词'"
                      @click.stop="expandedPromptShotIndex = expandedPromptShotIndex === shot.index ? -1 : shot.index"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      <span>词</span>
                    </button>
                  </div>
                  <div
                    v-if="expandedPromptShotIndex === shot.index"
                    class="shot-prompt-tooltip"
                    @click.stop
                  >
                    <div class="flex items-center justify-between gap-1 mb-1">
                      <span class="text-[8px] font-bold text-blue-300">#{{ shot.index }} 提示词</span>
                      <button
                        class="text-[var(--text-tertiary)] hover:text-white text-[10px] leading-none"
                        type="button"
                        @click.stop="expandedPromptShotIndex = -1"
                      >✕</button>
                    </div>
                    <p class="text-[11px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">{{ shot.prompt }}</p>
                  </div>
                  <div class="bg-black/40 px-1.5 py-1 text-center text-[9px] font-bold text-white">
                    #{{ shot.index }}
                  </div>
                </button>
              </div>
            </div>
            <div v-else-if="activeFrameSlots.length" class="rounded-md border border-dashed border-[var(--border-color)] px-3 py-4 text-xs text-[var(--text-tertiary)]">
              当前分镜脚本还没有已生成图片。
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[10px] font-bold text-[var(--text-tertiary)]">运镜方式 CAMERA MOTION</label>
              <div class="relative">
                <select v-model="cameraMotion" class="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md px-3 py-2 text-xs text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-blue-500/50 transition-colors shadow-inner">
                  <option v-for="opt in CAMERA_MOTION_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-[10px] font-bold text-[var(--text-tertiary)]">文本描述 MOTION SCRIPT</label>
              <textarea v-model="prompt" class="min-h-[132px] w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md p-4 text-xs leading-relaxed text-[var(--text-secondary)] resize-none focus:outline-none focus:border-blue-500/50 shadow-inner font-mono transition-colors" spellcheck="false" placeholder="补充这一段视频的动作、节奏、转场和情绪。分镜图片和每张图提示词会自动一起发送。" />
            </div>

            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <label class="text-[10px] font-bold text-[var(--text-tertiary)]">完整提示词预览 FULL PROMPT</label>
                <span class="text-[10px] text-[var(--text-tertiary)]">{{ fullPromptPreview.length }} chars</span>
              </div>
              <div class="max-h-44 overflow-y-auto rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] p-3 text-[11px] leading-relaxed text-[var(--text-secondary)] font-mono whitespace-pre-wrap shadow-inner custom-scrollbar">
                {{ fullPromptPreview }}
              </div>
            </div>
          </div>

          <div class="w-full h-px bg-[var(--bg-tertiary)]"></div>

          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-[var(--text-tertiary)]">视频名称 VIDEO NAME</label>
            <input v-model="videoName" type="text" placeholder="自定义视频文件名（可选）" class="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-blue-500/50 transition-colors shadow-inner" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <div class="flex justify-between">
                <label class="text-[10px] font-bold text-[var(--text-tertiary)]">时长</label>
                <span class="text-[10px] font-bold text-blue-400 font-mono">{{ duration }}s</span>
              </div>
              <div class="grid grid-cols-4 gap-1 bg-[var(--bg-card)] rounded-md p-1 border border-[var(--border-color)] shadow-inner">
                <button
                  v-for="d in ALL_DURATIONS"
                  :key="d"
                  type="button"
                  :disabled="!modelSupportsDuration(d)"
                  @click="duration = d"
                  :class="[
                    'border border-transparent py-1 text-xs font-bold rounded transition-colors',
                    duration === d ? 'border-blue-400 bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.28)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
                    !modelSupportsDuration(d) ? 'opacity-30 cursor-not-allowed hover:text-[var(--text-tertiary)]' : ''
                  ]"
                >{{ d }}</button>
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[10px] font-bold text-[var(--text-tertiary)]">分辨率</label>
              <div class="grid grid-cols-3 gap-1 bg-[var(--bg-card)] rounded-md p-1 border border-[var(--border-color)] shadow-inner">
                <button
                  v-for="item in ALL_RESOLUTIONS"
                  :key="item"
                  type="button"
                  :disabled="!modelSupportsResolution(item)"
                  @click="resolution = item"
                  :class="[
                    'border border-transparent py-1 text-xs font-bold rounded transition-colors',
                    resolution === item ? 'border-blue-400 bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.28)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
                    !modelSupportsResolution(item) ? 'opacity-30 cursor-not-allowed hover:text-[var(--text-tertiary)]' : ''
                  ]"
                >{{ item }}</button>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-[var(--text-tertiary)]">画幅 RATIO</label>
            <div class="grid grid-cols-4 gap-1 bg-[var(--bg-card)] rounded-md p-1 border border-[var(--border-color)] shadow-inner">
              <button
                v-for="item in ALL_RATIOS"
                :key="item"
                type="button"
                @click="ratio = item"
                :class="[
                  'border border-transparent py-1 text-[10px] font-bold rounded transition-colors',
                  ratio === item ? 'border-blue-400 bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.28)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                ]"
              >{{ item }}</button>
            </div>
          </div>

          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <label class="text-[10px] font-bold text-[var(--text-tertiary)]">添加水印 WATERMARK</label>
              <input v-model="watermark" type="checkbox" class="w-4 h-4 rounded border-[var(--border-color)] bg-[var(--bg-card)] text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer" />
            </div>
            <div class="flex items-center justify-between">
              <label class="text-[10px] font-bold text-[var(--text-tertiary)]">输出声音 AUDIO</label>
              <input v-model="generateAudio" :disabled="!selectedModelInfo?.supportsAudioGeneration" type="checkbox" class="w-4 h-4 rounded border-[var(--border-color)] bg-[var(--bg-card)] text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed" />
            </div>
            <div class="flex items-center justify-between">
              <label class="text-[10px] font-bold text-[var(--text-tertiary)]">返回尾帧 LAST FRAME</label>
              <input v-model="returnLastFrame" :disabled="!selectedModelInfo?.supportsReturnLastFrame" type="checkbox" class="w-4 h-4 rounded border-[var(--border-color)] bg-[var(--bg-card)] text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed" />
            </div>
            <div class="flex items-center justify-between">
              <label class="text-[10px] font-bold text-[var(--text-tertiary)]">固定镜头 CAMERA FIXED</label>
              <input v-model="cameraFixed" :disabled="!selectedModelInfo?.supportsCameraFixed" type="checkbox" class="w-4 h-4 rounded border-[var(--border-color)] bg-[var(--bg-card)] text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed" />
            </div>
          </div>

        </div>

        <div class="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[var(--bg-secondary)] via-[var(--bg-secondary)] to-transparent pointer-events-none">
          <div class="p-1 border-2 border-dashed border-[#2b3a5e] rounded-xl pointer-events-auto bg-[var(--bg-secondary)]/80 backdrop-blur">
            <div class="flex gap-2">
              <button @click="handleGenerate" :disabled="isGenerating || !canGenerate" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] font-bold text-sm py-3 rounded-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                <svg v-if="isGenerating" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                <span>{{ isGenerating ? '生成中...' : '生成分镜视频' }}</span>
              </button>
              <button
                v-if="isGenerating"
                @click="handleCancelGeneration"
                class="w-[110px] shrink-0 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-3 text-sm font-bold text-red-200 transition-colors hover:bg-red-500/20"
              >
                停止生成
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <div
      v-if="selectedVideo"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-6 backdrop-blur-md"
      @click.self="closeVideoPlayer"
    >
      <div class="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#05070d] shadow-2xl">
        <div class="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div class="min-w-0">
            <p class="truncate text-sm font-bold text-white">{{ selectedVideo.name }}</p>
            <p class="mt-0.5 text-[10px] text-white/45">{{ formatFileSize(selectedVideo.size) }}</p>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="h-8 rounded-md border border-white/10 px-3 text-xs font-bold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              type="button"
              @click="openVideoLocation(selectedVideo)"
            >
              文件夹
            </button>
            <button
              class="h-8 w-8 rounded-md border border-white/10 text-lg leading-none text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              type="button"
              title="关闭"
              @click="closeVideoPlayer"
            >
              ×
            </button>
          </div>
        </div>
        <div class="bg-black">
          <video
            :key="selectedVideo.path"
            :src="selectedVideoUrl"
            class="max-h-[72vh] w-full bg-black"
            controls
            autoplay
            playsinline
            preload="metadata"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 6px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}

.shot-prompt-badge {
  position: absolute;
  top: 0.2rem;
  left: 0.2rem;
  display: flex;
  align-items: center;
  gap: 0.15rem;
  padding: 0.1rem 0.3rem;
  border-radius: 0.2rem;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(96, 165, 250, 0.3);
  color: rgba(147, 197, 253, 0.85);
  font-size: 0.5rem;
  font-weight: 700;
  opacity: 0;
  transition: opacity 0.12s;
  z-index: 5;
}

.group\/shot:hover .shot-prompt-badge {
  opacity: 1;
}

.shot-prompt-badge:hover {
  background: rgba(30, 58, 138, 0.85);
  border-color: rgba(96, 165, 250, 0.7);
}

.shot-prompt-tooltip {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  margin-bottom: 0.2rem;
  padding: 0.5rem 0.6rem;
  border-radius: 0.3rem;
  background: rgba(15, 23, 42, 0.97);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(96, 165, 250, 0.4);
  box-shadow: 0 -6px 20px rgba(0, 0, 0, 0.5);
  z-index: 50;
  max-height: 16rem;
  overflow-y: auto;
}
</style>
