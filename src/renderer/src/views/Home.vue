<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
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

const prompt = ref('')
const videoName = ref('')
const selectedModel = ref('doubao-seedance-1-0-pro-fast-251015')
const selectedVideoProvider = ref('ark')
const selectedStoryboardId = ref('')
const shotOrder = ref<StoryboardShot[]>([])
const duration = ref(5)
const resolution = ref<'720p' | '1080p'>('1080p')
const cameraFixed = ref(false)
const watermark = ref(true)

const CAMERA_MOTION_OPTIONS = [
  { value: '', label: '默认（自动）' },
  { value: 'slow push in, zoom in gradually', label: '推进 Push In' },
  { value: 'pull back slowly, zoom out', label: '拉远 Pull Back' },
  { value: 'smooth pan left to right', label: '左移镜头 Pan Left to Right' },
  { value: 'smooth pan right to left', label: '右移镜头 Pan Right to Left' },
  { value: 'tilt up slowly', label: '仰拍 Tilt Up' },
  { value: 'tilt down slowly', label: '俯拍 Tilt Down' },
  { value: 'clear orbit camera move: the camera dollies around the subject in a smooth 180-degree arc with visible parallax, keeping the subject centered; not a zoom, not a simple pan', label: '环绕拍摄 Orbit' },
  { value: 'aerial drone shot moving forward', label: '无人机推进 Drone Forward' },
  { value: 'handheld shaky cam', label: '手持 Handheld' },
  { value: 'static locked-off camera', label: '固定机位 Static' }
]
const cameraMotion = ref('')

const ACTION_TYPE_OPTIONS = [
  { value: '', label: '默认（不指定）' },
  { value: 'character standing still, subtle breathing', label: '静止站立' },
  { value: 'character walking forward confidently', label: '向前行走' },
  { value: 'character running fast', label: '快速奔跑' },
  { value: 'cinematic close-up of face, micro expressions', label: '面部特写' },
  { value: 'character turning around slowly', label: '缓慢转身' },
  { value: 'character looking up at sky dramatically', label: '仰望天空' },
  { value: 'action scene with dynamic movement', label: '动作打斗' }
]
const actionType = ref('')

const MODEL_DURATION_OPTIONS: Record<string, number[]> = {
  'doubao-seedance-1-0-pro-fast-251015': [5, 10],
  'doubao-seedance-1-5-pro-251215': [5, 10]
}

const selectedModelInfo = computed(() => VIDEO_MODELS.find(m => m.id === selectedModel.value))
const availableDurations = computed(() => MODEL_DURATION_OPTIONS[selectedModel.value] || [5])
const modelUsesLastFrame = computed(() => selectedModel.value === 'doubao-seedance-1-5-pro-251215')
const frameHint = computed(() => (
  modelUsesLastFrame.value
    ? 'Frame #1 and the last selected frame anchor the opening and ending. Extra selected frames are sent as reference images when the model accepts them.'
    : 'Selected frames are sent as reference images when the model accepts them. Put the clearest face and costume shot first.'
))
const keyFrameOrderHint = computed(() => (
  modelUsesLastFrame.value
    ? 'Key frame order is preserved. If the API has an image limit, frame #1 and the last frame are kept first.'
    : 'Key frame order is preserved. If the API has an image limit, earlier frames are kept first.'
))
const selectedStoryboard = computed(() => storyboards.value.find(item => item.id === selectedStoryboardId.value) || null)
const readyShots = computed(() => selectedStoryboard.value?.shots.filter(shot => shot.imagePath) || [])
const unusedShots = computed(() => readyShots.value.filter(shot => !shotOrder.value.some(item => item.index === shot.index)))
const completedStoryboardCount = computed(() => storyboards.value.filter(item => item.completedCount > 0).length)

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
  const storyboard = storyboards.value.find(item => item.id === storyboardId)
  shotOrder.value = storyboard?.shots.filter(shot => shot.imagePath) || []
}

const syncShotOrderWithStoryboard = () => {
  const storyboard = selectedStoryboard.value
  if (!storyboard) {
    shotOrder.value = []
    return
  }
  const ready = storyboard.shots.filter(shot => shot.imagePath)
  const nextOrder = shotOrder.value
    .map(ordered => ready.find(shot => shot.index === ordered.index))
    .filter(Boolean) as StoryboardShot[]
  const missing = ready.filter(shot => !nextOrder.some(item => item.index === shot.index))
  shotOrder.value = [...nextOrder, ...missing]
}

const moveShot = (index: number, direction: -1 | 1) => {
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= shotOrder.value.length) return
  const next = [...shotOrder.value]
  const current = next[index]
  next[index] = next[targetIndex]
  next[targetIndex] = current
  shotOrder.value = next
}

const removeShotFromOrder = (index: number) => {
  shotOrder.value = shotOrder.value.filter((_, itemIndex) => itemIndex !== index)
}

const addShotToOrder = (shot: StoryboardShot) => {
  if (!shotOrder.value.some(item => item.index === shot.index)) {
    shotOrder.value = [...shotOrder.value, shot]
  }
}

const buildStoryboardVideoPrompt = () => {
  const storyboard = selectedStoryboard.value
  const orderedDescriptions = shotOrder.value
    .map((shot, index) => `Key frame ${index + 1}: storyboard shot #${shot.index}. ${shot.prompt || 'Continue the visual story.'}`)
    .join('\n')
  const motionScript = prompt.value.trim() || 'Create a coherent cinematic shot sequence with natural transitions between the selected storyboard frames.'
  const referenceInstruction = modelUsesLastFrame.value
    ? 'Use frame 1 as the opening image reference and the last selected frame as the ending image reference. Treat all intermediate storyboard frames as continuity instructions.'
    : 'Use frame 1 as the character identity and opening image reference. Treat all later storyboard frames as continuity instructions without changing the same character, gender, face, or costume.'
  return [
    `Create a cinematic video from the selected storyboard "${storyboard?.name || ''}".`,
    referenceInstruction,
    'Preserve character identity, costume color, environment continuity, framing intent, and visual style across the whole video.',
    orderedDescriptions,
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
  if (shotOrder.value.length === 0) {
    await dialog.error('当前分镜头还没有可用于生成视频的图片。')
    return
  }
  const hasApiKey = await checkApiKey()
  if (!hasApiKey) return

  isGenerating.value = true
  try {
    const options: GenerateVideoOptions = {
      prompt: buildStoryboardVideoPrompt(),
      model: selectedModel.value,
      provider: selectedVideoProvider.value,
      videoName: videoName.value.trim() || undefined,
      duration: duration.value,
      resolution: resolution.value,
      cameraFixed: cameraFixed.value,
      watermark: watermark.value,
      referenceImagePaths: shotOrder.value.map(shot => shot.imagePath!).filter(Boolean),
      cameraMotion: cameraMotion.value || undefined,
      actionType: actionType.value || undefined,
      storyboardId: selectedStoryboard.value.id,
      storyboardName: selectedStoryboard.value.name,
      storyboardShotOrder: shotOrder.value.map(shot => shot.index)
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
  await loadVideos()
}

const openVideoLocation = async (video: VideoAsset) => {
  await mediaApi.revealInExplorer(video.path)
}

const playVideo = async (video: VideoAsset) => {
  await mediaApi.openAsset(video.path)
}

onMounted(loadVideos)

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
              <h2 class="text-sm font-bold tracking-widest text-[var(--text-secondary)]">分镜生成视频 STORYBOARD VIDEOS</h2>
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

          <div v-else-if="videos.length === 0" class="flex items-center justify-center h-64">
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
              v-for="video in videos"
              :key="video.id"
              class="aspect-video bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-color)] overflow-hidden relative group cursor-pointer hover:border-blue-500/50 hover:shadow-[0_0_15px_rgba(59,130,246,0.15)] transition-all shadow-sm"
              @click="playVideo(video)"
            >
              <video :src="video.url || video.path" class="w-full h-full object-cover opacity-80 transition-opacity group-hover:opacity-100" preload="metadata" />
              <div class="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-colors flex items-center justify-center">
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
            <label class="text-[10px] font-bold text-[var(--text-tertiary)]">分镜头 STORYBOARD</label>
            <div class="relative">
              <select v-model="selectedStoryboardId" class="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-blue-500/50 transition-colors shadow-inner" @change="selectStoryboard(selectedStoryboardId)">
                <option disabled value="">选择一个分镜头</option>
                <option v-for="storyboard in storyboards" :key="storyboard.id" :value="storyboard.id">
                  {{ storyboard.name }} - {{ storyboard.completedCount }}/{{ storyboard.shotCount }} 张
                </option>
              </select>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>

          <div class="flex flex-col gap-3">
            <div class="flex justify-between items-center">
              <label class="text-[10px] font-bold text-[var(--text-tertiary)]">出镜顺序 KEY FRAME ORDER</label>
              <span class="text-[9px] text-[var(--text-tertiary)] font-mono">{{ shotOrder.length }}/{{ readyShots.length }}</span>
            </div>
            <div v-if="shotOrder.length" class="flex flex-col gap-2">
              <div v-for="(shot, index) in shotOrder" :key="shot.index" class="grid grid-cols-[64px_1fr_auto] gap-2 items-center rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
                <div class="aspect-video rounded overflow-hidden bg-black/20">
                  <img :src="shot.thumbnail || shot.imageUrl" class="w-full h-full object-cover" />
                </div>
                <div class="min-w-0">
                  <div class="text-xs font-bold text-[var(--text-primary)]">第 {{ index + 1 }} 帧 · 分镜 #{{ shot.index }}</div>
                  <p class="text-[10px] text-[var(--text-tertiary)] truncate mt-0.5">{{ shot.prompt || '无提示词' }}</p>
                </div>
                <div class="flex gap-1">
                  <button class="h-7 w-7 rounded border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] disabled:opacity-30" :disabled="index === 0" title="上移" @click="moveShot(index, -1)">↑</button>
                  <button class="h-7 w-7 rounded border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] disabled:opacity-30" :disabled="index === shotOrder.length - 1" title="下移" @click="moveShot(index, 1)">↓</button>
                  <button class="h-7 w-7 rounded border border-[var(--border-color)] text-red-300 hover:bg-red-500/10" title="移除" @click="removeShotFromOrder(index)">×</button>
                </div>
              </div>
            </div>
            <div v-else class="rounded-md border border-dashed border-[var(--border-color)] px-3 py-4 text-xs text-[var(--text-tertiary)]">
              当前分镜头没有已生成图片，或图片都被移出了顺序列表。
            </div>

            <div v-if="unusedShots.length" class="flex flex-wrap gap-2">
              <button v-for="shot in unusedShots" :key="shot.index" class="h-8 rounded border border-[var(--border-color)] px-2 text-xs hover:bg-[var(--bg-tertiary)]" @click="addShotToOrder(shot)">
                添加 #{{ shot.index }}
              </button>
            </div>
            <p class="text-[10px] text-[var(--text-tertiary)]">{{ keyFrameOrderHint }}</p>
            <p class="text-[10px] text-[var(--text-tertiary)]">{{ frameHint }}</p>
          </div>

          <div class="w-full h-px bg-[var(--bg-tertiary)]"></div>

          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-[var(--text-tertiary)]">视频名称 VIDEO NAME</label>
            <input v-model="videoName" type="text" placeholder="自定义视频文件名（可选）" class="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-blue-500/50 transition-colors shadow-inner" />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-[var(--text-tertiary)]">生成模型 MODEL</label>
            <div class="relative">
              <select v-model="selectedModel" class="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-blue-500/50 transition-colors shadow-inner">
                <option v-for="model in VIDEO_MODELS" :key="model.id" :value="model.id">{{ model.name }}</option>
              </select>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"><path d="m6 9 6 6 6-6"/></svg>
            </div>
            <p class="text-[9px] text-[var(--text-tertiary)] mt-1">{{ selectedModelInfo?.description }}</p>
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
              <label class="text-[10px] font-bold text-[var(--text-tertiary)]">固定相机 CAMERA FIXED</label>
              <input v-model="cameraFixed" type="checkbox" class="w-4 h-4 rounded border-[var(--border-color)] bg-[var(--bg-card)] text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer" />
            </div>
            <div class="flex items-center justify-between">
              <label class="text-[10px] font-bold text-[var(--text-tertiary)]">添加水印 WATERMARK</label>
              <input v-model="watermark" type="checkbox" class="w-4 h-4 rounded border-[var(--border-color)] bg-[var(--bg-card)] text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer" />
            </div>
          </div>

          <div class="w-full h-px bg-[var(--bg-tertiary)]"></div>

          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-[var(--text-tertiary)]">运镜方式 CAMERA MOTION</label>
            <div class="relative">
              <select v-model="cameraMotion" class="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md px-3 py-2 text-xs text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-blue-500/50 transition-colors shadow-inner">
                <option v-for="opt in CAMERA_MOTION_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-[var(--text-tertiary)]">角色动作 ACTION TYPE</label>
            <div class="relative">
              <select v-model="actionType" class="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md px-3 py-2 text-xs text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-blue-500/50 transition-colors shadow-inner">
                <option v-for="opt in ACTION_TYPE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-[10px] font-bold text-[var(--text-tertiary)]">文本描述 MOTION SCRIPT</label>
            <textarea v-model="prompt" class="min-h-[132px] w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md p-4 text-xs leading-relaxed text-[var(--text-secondary)] resize-none focus:outline-none focus:border-blue-500/50 shadow-inner font-mono transition-colors" spellcheck="false" placeholder="补充这一段视频的动作、节奏、转场和情绪。分镜图片和每张图提示词会自动一起发送。" />
          </div>
        </div>

        <div class="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[var(--bg-secondary)] via-[var(--bg-secondary)] to-transparent pointer-events-none">
          <div class="p-1 border-2 border-dashed border-[#2b3a5e] rounded-xl pointer-events-auto bg-[var(--bg-secondary)]/80 backdrop-blur">
            <button @click="handleGenerate" :disabled="isGenerating || !selectedStoryboard || shotOrder.length === 0" class="w-full bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] font-bold text-sm py-3 rounded-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              <svg v-if="isGenerating" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              <span>{{ isGenerating ? '生成中...' : '生成分镜视频' }}</span>
            </button>
          </div>
        </div>
      </aside>
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
