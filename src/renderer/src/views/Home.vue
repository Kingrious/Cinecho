<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from 'vue'
import { mediaApi, storeApi, storyboardApi } from '../api/media'
import { useDialog } from '../composables/useDialog'
import type { GenerateVideoOptions, StoryboardAsset, StoryboardShot, VideoAsset } from '../types/media'
import { VIDEO_MODELS } from '../types/media'

const dialog = useDialog()

const videos = ref<VideoAsset[]>([])
const storyboards = ref<StoryboardAsset[]>([])
const isLoading = ref(false)
const isGenerating = ref(false)
const outputDir = ref('')
const selectedVideo = ref<VideoAsset | null>(null)
const videoThumbnailCache = ref<Record<string, string>>({})

const prompt = ref('')
const videoName = ref('')
const selectedModel = ref('doubao-seedance-1-0-pro-fast-251015')
const selectedVideoProvider = ref('ark')
const selectedStoryboardId = ref('')
const duration = ref(5)
const resolution = ref<'720p' | '1080p'>('1080p')
const watermark = ref(false)
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

const MODEL_DURATION_OPTIONS: Record<string, number[]> = {
  'doubao-seedance-1-0-pro-fast-251015': [5, 10],
  'doubao-seedance-1-5-pro-251215': [5, 10]
}

const selectedModelInfo = computed(() => VIDEO_MODELS.find(m => m.id === selectedModel.value))
const availableDurations = computed(() => MODEL_DURATION_OPTIONS[selectedModel.value] || [5])
const modelSupportsFirstLastFrame = computed(() => Boolean(selectedModelInfo.value?.supportsFirstLastFrame))
const modelFirstLastFrameLabel = computed(() => (
  modelSupportsFirstLastFrame.value ? '支持首尾帧' : '不支持首尾帧'
))
const selectedStoryboard = computed(() => storyboards.value.find(item => item.id === selectedStoryboardId.value) || null)
const readyShots = computed(() => selectedStoryboard.value?.shots.filter(shot => shot.imagePath) || [])
const activeFrameSlots = computed<FrameSlot[]>(() => (
  modelSupportsFirstLastFrame.value
    ? [
        { role: 'first', title: '首帧', placeholder: '拖入开场镜头', code: 'FIRST FRAME' },
        { role: 'last', title: '尾帧', placeholder: '拖入结尾镜头', code: 'LAST FRAME' },
        { role: 'reference1', title: '参考帧', placeholder: '拖入参考镜头', code: 'REFERENCE FRAME' }
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
const selectedFrameRoles = computed(() => activeFrameSlots.value
  .filter(slot => frameShots.value[slot.role])
  .map(slot => slot.role === 'first'
    ? 'first_frame'
    : slot.role === 'last'
      ? 'last_frame'
      : 'reference_frame') as Array<'first_frame' | 'reference_frame' | 'last_frame'>)
const hasSelectedFrames = computed(() => selectedFrameShots.value.length > 0)
const hasMotionText = computed(() => prompt.value.trim().length > 0)
const canGenerate = computed(() => Boolean(selectedStoryboard.value && (hasSelectedFrames.value || hasMotionText.value)))
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
  const storyboard = selectedStoryboard.value
  const frameDescriptions = selectedFrameShots.value
    .map((shot, index) => {
      const slot = activeFrameSlots.value.find(item => frameShots.value[item.role]?.index === shot.index)
      const frameLabel = slot?.role === 'first'
        ? 'First frame'
        : slot?.role === 'last'
          ? 'Last frame'
          : `Reference frame ${index + 1}`
      return `${frameLabel}: storyboard shot #${shot.index}. ${shot.prompt || 'Continue the visual story.'}`
    })
    .join('\n')
  const motionScript = prompt.value.trim() || 'Create a coherent cinematic shot sequence with natural transitions between the selected storyboard frames.'
  const referenceInstruction = !hasSelectedFrames.value
    ? 'No image reference frames were selected. Generate the video from the motion script only.'
    : modelSupportsFirstLastFrame.value
      ? 'Use the first frame as the opening image reference, the last frame as the ending image reference, and the reference frame as visual continuity guidance when present.'
      : 'Use the selected reference frames as visual guidance. Preserve character identity, costume, environment, and visual style from the references.'
  return [
    `Create a cinematic video from the selected storyboard "${storyboard?.name || ''}".`,
    referenceInstruction,
    'Preserve character identity, costume color, environment continuity, framing intent, and visual style across the whole video.',
    frameDescriptions,
    `Motion script: ${motionScript}`
  ].filter(Boolean).join('\n')
}

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
  if (!hasSelectedFrames.value && !hasMotionText.value) {
    await dialog.error('未输入图片时，必须填写文本描述。')
    return
  }
  const hasApiKey = await checkApiKey()
  if (!hasApiKey) return

  isGenerating.value = true
  try {
    const frameShots = selectedFrameShots.value
    const options: GenerateVideoOptions = {
      prompt: buildStoryboardVideoPrompt(),
      model: selectedModel.value,
      provider: selectedVideoProvider.value,
      videoName: videoName.value.trim() || undefined,
      duration: duration.value,
      resolution: resolution.value,
      watermark: watermark.value,
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
    } else {
      await dialog.error(`生成失败: ${result.error || '未知错误'}`)
    }
  } catch (error: any) {
    console.error('[Creation] Video generation failed:', error)
    await dialog.error(`视频生成失败: ${error?.message || '请重试'}`)
  } finally {
    isGenerating.value = false
  }
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

onMounted(loadVideos)

onActivated(() => {
  if (hasActivatedOnce) {
    void loadVideos()
  }
  hasActivatedOnce = true
})

watch(selectedModel, () => {
  if (!availableDurations.value.includes(duration.value)) {
    duration.value = availableDurations.value[0]
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
                  <p class="mt-1 text-[10px] text-[var(--text-tertiary)]">生成完成后会自动显示在这里</p>
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

          <div class="flex flex-col gap-3">
            <div class="flex justify-between items-center">
              <label class="text-[10px] font-bold text-[var(--text-tertiary)]">首尾 / 参考帧 FIRST / LAST / REFERENCE</label>
              <span class="text-[9px] text-[var(--text-tertiary)] font-mono">{{ selectedFrameShots.length }}/{{ activeFrameSlots.length }}</span>
            </div>

            <div class="grid grid-cols-3 gap-2">
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

            <div v-if="readyShots.length" class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold text-[var(--text-tertiary)]">分镜镜头 SHOTS</span>
                <span class="text-[9px] text-[var(--text-tertiary)]">拖拽到上方槽位</span>
              </div>
              <div class="grid grid-cols-4 gap-2">
                <button
                  v-for="shot in readyShots"
                  :key="shot.index"
                  :class="[
                    'group overflow-hidden rounded-md border bg-[var(--bg-card)] text-left transition-all hover:border-blue-400/70 hover:bg-[var(--bg-tertiary)]',
                    selectedFrameShots.some(item => item.index === shot.index) ? 'border-blue-400/80 opacity-70' : 'border-[var(--border-color)]'
                  ]"
                  type="button"
                  draggable="true"
                  :title="`拖动镜头 #${shot.index}`"
                  @click="addShotToNextFrame(shot)"
                  @dragstart="event => handleShotDragStart(shot, event)"
                  @dragend="handleShotDragEnd"
                >
                  <div class="aspect-video bg-black/20">
                    <img :src="shot.thumbnail || shot.imageUrl" class="h-full w-full object-cover transition-transform group-hover:scale-[1.04]" />
                  </div>
                  <div class="bg-black/40 px-1.5 py-1 text-center text-[9px] font-bold text-white">
                    #{{ shot.index }}
                  </div>
                </button>
              </div>
            </div>
            <div v-else class="rounded-md border border-dashed border-[var(--border-color)] px-3 py-4 text-xs text-[var(--text-tertiary)]">
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
              <div class="flex bg-[var(--bg-card)] rounded-md p-1 border border-[var(--border-color)] shadow-inner">
                <button v-for="d in availableDurations" :key="d" @click="duration = d" :class="['flex-1 py-1 text-xs font-bold rounded transition-colors', duration === d ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]']">{{ d }}</button>
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[10px] font-bold text-[var(--text-tertiary)]">分辨率</label>
              <div class="flex bg-[var(--bg-card)] rounded-md p-1 border border-[var(--border-color)] shadow-inner">
                <button @click="resolution = '720p'" :class="['flex-1 py-1 text-xs font-bold rounded transition-colors', resolution === '720p' ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]']">720p</button>
                <button @click="resolution = '1080p'" :class="['flex-1 py-1 text-xs font-bold rounded transition-colors', resolution === '1080p' ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]']">1080p</button>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <label class="text-[10px] font-bold text-[var(--text-tertiary)]">添加水印 WATERMARK</label>
              <input v-model="watermark" type="checkbox" class="w-4 h-4 rounded border-[var(--border-color)] bg-[var(--bg-card)] text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer" />
            </div>
          </div>

        </div>

        <div class="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[var(--bg-secondary)] via-[var(--bg-secondary)] to-transparent pointer-events-none">
          <div class="p-1 border-2 border-dashed border-[#2b3a5e] rounded-xl pointer-events-auto bg-[var(--bg-secondary)]/80 backdrop-blur">
            <button @click="handleGenerate" :disabled="isGenerating || !canGenerate" class="w-full bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] font-bold text-sm py-3 rounded-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              <svg v-if="isGenerating" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              <span>{{ isGenerating ? '生成中...' : '生成分镜视频' }}</span>
            </button>
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
</style>
