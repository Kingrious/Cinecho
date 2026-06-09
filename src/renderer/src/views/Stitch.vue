<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick, onDeactivated } from 'vue'
import { mediaApi, stitchApi, eventsApi } from '../api/media'
import { useDialog } from '../composables/useDialog'
import type { VideoMeta, StitchClip } from '../types/media'
import { formatExportError } from '../utils/errorMessages'

const dialog = useDialog()

// ─── State ───
const mediaPool = ref<VideoMeta[]>([])
const isLoadingPool = ref(false)
const poolError = ref('')
const scannedDir = ref('')

// ─── Media Bin UI State ───
const binViewMode = ref<'grid' | 'list'>('grid')
const binSearchQuery = ref('')
const selectedMediaPath = ref<string | null>(null)
const draggedMediaPath = ref<string | null>(null)
const isTimelineDragOver = ref(false)

const timelineClips = ref<StitchClip[]>([])
const selectedClipId = ref<number | null>(null)
const timelineZoom = ref(1)
const isPlaying = ref(false)
const playheadPosition = ref(0)
const currentTime = ref('00:00:00')

// ─── Video Player ───
const videoRef = ref<HTMLVideoElement | null>(null)
const videoCurrentTime = ref(0)
const videoDuration = ref(0)
const videoLoading = ref(false)
const videoError = ref(false)

// ─── Thumbnail cache (path -> dataURL) ───
const thumbnailCache = ref<Record<string, string>>({})

// Export
const isExporting = ref(false)
const exportProgress = ref(0)
const lastExportPath = ref('')
const showExportSuccess = ref(false)

// ─── Computed ───
const pxPerSecond = computed(() => 40 * timelineZoom.value)

const totalDuration = computed(() => {
  if (!timelineClips.value.length) return 0
  const last = timelineClips.value[timelineClips.value.length - 1]
  return last.timelineStart + (last.trimEnd - last.trimStart)
})

const rulerTicks = computed(() => {
  const total = Math.max(totalDuration.value, 30)
  const ticks: { pos: number; label: string; major: boolean }[] = []
  for (let i = 0; i <= total; i++) {
    const mm = String(Math.floor(i / 60)).padStart(2, '0')
    const ss = String(i % 60).padStart(2, '0')
    ticks.push({ pos: i * pxPerSecond.value, label: `${mm}:${ss}`, major: i % 5 === 0 })
  }
  return ticks
})

const selectedClip = computed(() => timelineClips.value.find(c => c.id === selectedClipId.value) || null)
const clipDuration = (clip: StitchClip) => clip.trimEnd - clip.trimStart

const formatDuration = (s: number) => {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return m > 0 ? `${m}m${sec}s` : `${sec.toFixed(1)}s`
}

const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '—'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// 已在时间线中使用的视频路径集合
const usedPathsInTimeline = computed(() => new Set(timelineClips.value.map(c => c.sourcePath)))

// 过滤后的素材池
const filteredMediaPool = computed(() => {
  if (!binSearchQuery.value.trim()) return mediaPool.value
  const q = binSearchQuery.value.toLowerCase()
  return mediaPool.value.filter(m => {
    const name = m.path.split(/[\\/]/).pop() || ''
    return name.toLowerCase().includes(q) || `${m.width}x${m.height}`.includes(q)
  })
})

// 从 VideoMeta 解析文件名
const getMediaName = (media: VideoMeta): string => {
  return media.path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') || media.path
}

// ─── Methods ───
const loadMediaPool = async () => {
  isLoadingPool.value = true
  poolError.value = ''
  try {
    const dir = await mediaApi.getOutputDirectory()
    scannedDir.value = dir
    const videos = await stitchApi.scanVideos(dir)
    mediaPool.value = videos
    if (videos.length === 0) {
      poolError.value = `未找到视频（${dir}\\videos）`
    }
  } catch (e: any) {
    console.error('[Stitch] load pool failed:', e)
    poolError.value = e?.message || '加载失败'
  } finally {
    isLoadingPool.value = false
  }
}

const handleImport = async () => {
  const imported = await stitchApi.importVideos()
  if (imported && imported.length > 0) {
    // Merge avoiding duplicates
    for (const v of imported) {
      if (!mediaPool.value.find(m => m.path === v.path)) {
        mediaPool.value.push(v)
      }
    }
    captureMissingMetadata()
  }
}

const recalcTimelineStarts = () => {
  let pos = 0
  for (const clip of timelineClips.value) {
    clip.timelineStart = pos
    pos += clipDuration(clip)
  }
}

const handleAddToTimeline = async (media: VideoMeta, insertIndex?: number) => {
  let duration = media.duration
  if (!duration || duration === 0) {
    duration = await getNativeDuration(media.path, media.url)
    if (duration > 0) {
      media.duration = duration
    } else {
      duration = 5 // fallback
    }
  }

  const id = Date.now() + Math.floor(Math.random() * 1000)
  const clip: StitchClip = {
    id,
    sourceId: media.path,
    sourcePath: media.path,
    sourceUrl: media.url,
    sourceName: getMediaName(media),
    sourceDuration: duration,
    thumbnail: media.thumbnail || '',
    trimStart: 0,
    trimEnd: duration,
    timelineStart: totalDuration.value
  }
  if (typeof insertIndex === 'number') {
    timelineClips.value.splice(Math.max(0, Math.min(insertIndex, timelineClips.value.length)), 0, clip)
    recalcTimelineStarts()
  } else {
    timelineClips.value.push(clip)
  }
  selectedClipId.value = id
}

const handleMediaDragStart = (media: VideoMeta, e: DragEvent) => {
  selectedMediaPath.value = media.path
  draggedMediaPath.value = media.path
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('application/x-cinecho-media-path', media.path)
    e.dataTransfer.setData('text/plain', media.path)
  }
}

const handleMediaDragEnd = () => {
  draggedMediaPath.value = null
  isTimelineDragOver.value = false
}

const getTimelineInsertIndex = (e: DragEvent) => {
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const dropTime = Math.max(0, (e.clientX - rect.left) / pxPerSecond.value)

  for (let i = 0; i < timelineClips.value.length; i++) {
    const clip = timelineClips.value[i]
    const midpoint = clip.timelineStart + clipDuration(clip) / 2
    if (dropTime < midpoint) return i
  }
  return timelineClips.value.length
}

const handleTimelineDragOver = (e: DragEvent) => {
  e.preventDefault()
  isTimelineDragOver.value = true
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

const handleTimelineDrop = async (e: DragEvent) => {
  e.preventDefault()
  const mediaPath = e.dataTransfer?.getData('application/x-cinecho-media-path') || draggedMediaPath.value
  isTimelineDragOver.value = false
  draggedMediaPath.value = null
  if (!mediaPath) return

  const media = mediaPool.value.find(item => item.path === mediaPath)
  if (!media) return
  await handleAddToTimeline(media, getTimelineInsertIndex(e))
}

const handleSelectClip = (id: number) => { selectedClipId.value = id }

const handleDelete = () => {
  if (!selectedClipId.value) return
  timelineClips.value = timelineClips.value.filter(c => c.id !== selectedClipId.value)
  recalcTimelineStarts()
  selectedClipId.value = timelineClips.value[0]?.id || null
}

const handleMoveLeft = () => {
  const idx = timelineClips.value.findIndex(c => c.id === selectedClipId.value)
  if (idx > 0) {
    ;[timelineClips.value[idx], timelineClips.value[idx - 1]] = [timelineClips.value[idx - 1], timelineClips.value[idx]]
    recalcTimelineStarts()
  }
}

const handleMoveRight = () => {
  const idx = timelineClips.value.findIndex(c => c.id === selectedClipId.value)
  if (idx >= 0 && idx < timelineClips.value.length - 1) {
    ;[timelineClips.value[idx], timelineClips.value[idx + 1]] = [timelineClips.value[idx + 1], timelineClips.value[idx]]
    recalcTimelineStarts()
  }
}

// ─── Thumbnail capture via canvas ───
const captureThumbnailFromVideo = (media: VideoMeta): Promise<string> => {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.src = toPlayableUrl(media.path, media.url)
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.preload = 'metadata'
    const cleanup = () => { try { video.src = '' } catch {} }
    video.addEventListener('loadeddata', () => {
      video.currentTime = Math.min(1, video.duration * 0.1 || 0)
    })
    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 320
        canvas.height = 180
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0, 320, 180)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
          cleanup()
          resolve(dataUrl)
        } else { cleanup(); resolve('') }
      } catch { cleanup(); resolve('') }
    })
    video.addEventListener('error', () => { cleanup(); resolve('') })
    setTimeout(() => { cleanup(); resolve('') }, 8000)
  })
}

const toFileUrl = (filePath: string): string => {
  // Convert Windows path to file:// URL
  const normalized = filePath.replace(/\\/g, '/')
  return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`
}

const toPlayableUrl = (filePath: string, sourceUrl?: string): string => sourceUrl || toFileUrl(filePath)

const getOrCaptureThumbnail = async (media: VideoMeta): Promise<string> => {
  if (thumbnailCache.value[media.path]) return thumbnailCache.value[media.path]
  if (media.thumbnail) { thumbnailCache.value[media.path] = media.thumbnail; return media.thumbnail }
  const captured = await captureThumbnailFromVideo(media)
  thumbnailCache.value[media.path] = captured
  media.thumbnail = captured
  return captured
}

const getNativeDuration = (filePath: string, sourceUrl?: string): Promise<number> => {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.src = toPlayableUrl(filePath, sourceUrl)
    video.preload = 'metadata'
    const cleanup = () => { try { video.src = '' } catch {} }
    video.addEventListener('loadedmetadata', () => {
      const dur = video.duration
      cleanup()
      resolve(isFinite(dur) ? dur : 0)
    })
    video.addEventListener('error', () => { cleanup(); resolve(0) })
    setTimeout(() => { cleanup(); resolve(0) }, 5000)
  })
}

// Trigger metadata capture for all pool items with missing info
const captureMissingMetadata = async () => {
  for (const media of mediaPool.value) {
    if (!media.thumbnail && !thumbnailCache.value[media.path]) {
      getOrCaptureThumbnail(media)
    }
    if (!media.duration || media.duration === 0) {
      getNativeDuration(media.path, media.url).then(dur => {
        if (dur > 0) media.duration = dur
      })
    }
  }
}

// ─── Real Video Player ───
const handlePlay = () => {
  const v = videoRef.value
  if (!v || !selectedClip.value) return
  if (v.paused) { v.play(); isPlaying.value = true }
  else { v.pause(); isPlaying.value = false }
}
const handleStop = () => {
  const v = videoRef.value
  if (v) { v.pause(); v.currentTime = 0 }
  isPlaying.value = false
  pendingAutoPlay = false
  videoCurrentTime.value = 0
  if (timelineClips.value.length > 0) {
    selectedClipId.value = timelineClips.value[0].id
    pendingSeekTime = 0
  }
}
const handleVideoTimeUpdate = () => {
  const v = videoRef.value
  if (!v || !selectedClip.value) return
  videoCurrentTime.value = v.currentTime
  const globalPos = selectedClip.value.timelineStart + v.currentTime
  playheadPosition.value = globalPos
  const m = Math.floor(globalPos / 60)
  const s = Math.floor(globalPos % 60)
  const ms = Math.floor((globalPos % 1) * 100)
  currentTime.value = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}:${String(ms).padStart(2,'0')}`
}
const handleVideoEnded = () => {
  const currentIdx = timelineClips.value.findIndex(c => c.id === selectedClipId.value)
  if (currentIdx !== -1 && currentIdx < timelineClips.value.length - 1) {
    const nextClip = timelineClips.value[currentIdx + 1]
    pendingSeekTime = 0
    pendingAutoPlay = true
    selectedClipId.value = nextClip.id
  } else {
    isPlaying.value = false
  }
}
const handleVideoError = () => { videoError.value = true; videoLoading.value = false }

let pendingSeekTime: number | null = null
let pendingAutoPlay = false

const handleVideoLoaded = () => {
  const v = videoRef.value
  if (v) {
    videoDuration.value = v.duration
    if (pendingSeekTime !== null) {
      v.currentTime = pendingSeekTime
      pendingSeekTime = null
    }
    if (pendingAutoPlay) {
      pendingAutoPlay = false
      v.play()
      isPlaying.value = true
    }
  }
  videoLoading.value = false
  videoError.value = false
}

const handleSeekBar = (e: Event) => {
  const v = videoRef.value
  if (!v) return
  const input = e.target as HTMLInputElement
  v.currentTime = parseFloat(input.value)
}

const handleRulerClick = (e: MouseEvent) => {
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const clickX = e.clientX - rect.left - 60
  if (clickX < 0) return
  
  const time = Math.max(0, clickX / pxPerSecond.value)
  
  let foundClip = null
  for (const clip of timelineClips.value) {
    if (time >= clip.timelineStart && time <= clip.timelineStart + clipDuration(clip)) {
      foundClip = clip
      break
    }
  }
  
  if (foundClip) {
    const targetTime = time - foundClip.timelineStart
    if (selectedClipId.value !== foundClip.id) {
      pendingSeekTime = targetTime
      selectedClipId.value = foundClip.id
    } else if (videoRef.value) {
      videoRef.value.currentTime = targetTime
    }
  } else {
    playheadPosition.value = time
  }
}

// Load video when selected clip changes
watch(selectedClip, async (clip) => {
  const wasPlaying = isPlaying.value || pendingAutoPlay
  isPlaying.value = false
  videoError.value = false
  videoCurrentTime.value = 0
  if (!clip) return
  videoLoading.value = true
  await nextTick()
  const v = videoRef.value
  if (v) {
    v.src = toPlayableUrl(clip.sourcePath, clip.sourceUrl)
    v.load()
    if (wasPlaying || pendingAutoPlay) {
      pendingAutoPlay = true
    }
  }
})

const handleZoomIn = () => { timelineZoom.value = Math.min(timelineZoom.value + 0.25, 4) }
const handleZoomOut = () => { timelineZoom.value = Math.max(timelineZoom.value - 0.25, 0.25) }
const handleFitTimeline = () => { timelineZoom.value = 1 }

const handleExport = async () => {
  if (!timelineClips.value.length) {
    await dialog.error('请先将视频片段添加到时间线')
    return
  }
  isExporting.value = true
  exportProgress.value = 0
  showExportSuccess.value = false
  try {
    const dir = await mediaApi.getOutputDirectory()
    const result = await stitchApi.exportVideo({
      clips: JSON.parse(JSON.stringify(timelineClips.value)),
      outputDir: dir,
      outputName: 'cinecho_sequence'
    })
    
    if (result.success && result.filePath) {
      lastExportPath.value = result.filePath
      showExportSuccess.value = true
    } else if (result.canceled) {
      // User canceled the save dialog, do nothing
      showExportSuccess.value = false
    } else {
      await dialog.error(formatExportError(result.error))
    }
  } catch (e: any) {
    await dialog.error(formatExportError(e?.message || e))
  } finally {
    isExporting.value = false
    exportProgress.value = 100
  }
}

const handleRevealExport = () => {
  if (lastExportPath.value) stitchApi.revealExport(lastExportPath.value)
}

// ─── Lifecycle ───
let unsubProgress: (() => void) | null = null
onMounted(async () => {
  await loadMediaPool()
  await captureMissingMetadata()
  unsubProgress = eventsApi.onStitchProgress((data) => {
    exportProgress.value = Math.round(data.percent || 0)
  })
})
onUnmounted(() => { unsubProgress?.() })

onDeactivated(() => {
  if (videoRef.value && !videoRef.value.paused) {
    videoRef.value.pause()
    isPlaying.value = false
  }
})
</script>

<template>
  <div class="h-full bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col overflow-hidden font-sans select-none">

    <!-- ═══ Top Toolbar ═══ -->
    <header class="h-[44px] shrink-0 border-b border-[var(--border-color)] flex items-center justify-between px-4 bg-[var(--bg-secondary)]">
      <div class="flex items-center gap-4">
        <div class="text-xs font-bold tracking-widest text-[var(--text-secondary)]">视频拼接 STITCH EDITOR</div>
        <div class="h-4 w-px bg-[var(--border-color)]"></div>
        <div class="flex items-center gap-1">
          <button @click="handleMoveLeft" class="tool-btn" title="前移"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
          <button @click="handleMoveRight" class="tool-btn" title="后移"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
          <div class="h-4 w-px bg-[var(--border-color)] mx-1"></div>
          <button @click="handleDelete" :disabled="!selectedClipId" class="tool-btn disabled:opacity-40" title="删除片段"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <!-- Export progress -->
        <div v-if="isExporting" class="flex items-center gap-2">
          <div class="w-24 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
            <div class="h-full bg-blue-500 transition-all" :style="{width: exportProgress + '%'}"></div>
          </div>
          <span class="text-[10px] text-blue-400 font-mono">{{ exportProgress }}%</span>
        </div>
        <!-- Success badge -->
        <button v-if="showExportSuccess" @click="handleRevealExport" class="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded hover:bg-emerald-500/20 transition-colors">✓ 打开文件</button>
        <button @click="handleExport" :disabled="isExporting || !timelineClips.length" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[11px] font-bold rounded-md transition-all shadow-[0_0_12px_rgba(37,99,235,0.3)] flex items-center gap-1.5">
          <svg v-if="isExporting" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
          {{ isExporting ? '导出中...' : '导出 Export' }}
        </button>
      </div>
    </header>

    <!-- ═══ Main Body: Media Bin + Preview ═══ -->
    <div class="flex-1 flex overflow-hidden min-h-0">

      <!-- ── Left: Media Bin ── -->
      <aside class="w-[300px] shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-secondary)] flex flex-col">
        <!-- Header -->
        <div class="px-3 pt-3 pb-2 border-b border-[var(--border-color)] flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <h3 class="text-[10px] font-bold tracking-widest text-[var(--text-tertiary)] uppercase">素材库</h3>
              <span class="text-[9px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-bold">{{ filteredMediaPool.length }}</span>
            </div>
            <div class="flex items-center gap-1">
              <!-- View mode toggle -->
              <button
                @click="binViewMode = 'grid'"
                :class="['w-6 h-6 flex items-center justify-center rounded transition-colors', binViewMode === 'grid' ? 'bg-blue-500/20 text-blue-400' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]']"
                title="网格视图"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              </button>
              <button
                @click="binViewMode = 'list'"
                :class="['w-6 h-6 flex items-center justify-center rounded transition-colors', binViewMode === 'list' ? 'bg-blue-500/20 text-blue-400' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]']"
                title="列表视图"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              </button>
              <div class="w-px h-3 bg-[var(--border-color)] mx-0.5"></div>
              <button @click="loadMediaPool" :disabled="isLoadingPool" class="w-6 h-6 flex items-center justify-center rounded text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-40" title="刷新">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" :class="isLoadingPool ? 'animate-spin' : ''"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
              </button>
              <button @click="handleImport" class="w-6 h-6 flex items-center justify-center rounded text-blue-400 hover:bg-blue-500/10 transition-colors" title="导入视频">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
              </button>
            </div>
          </div>
          <!-- Search -->
          <div class="relative">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>
            <input
              v-model="binSearchQuery"
              type="text"
              placeholder="搜索素材..."
              class="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded pl-7 pr-3 py-1.5 text-[11px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-blue-500/40 transition-colors"
            />
          </div>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto custom-scrollbar">
          <!-- Loading -->
          <div v-if="isLoadingPool" class="flex items-center justify-center h-40">
            <div class="flex flex-col items-center gap-3">
              <div class="w-6 h-6 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin"></div>
              <span class="text-[10px] text-[var(--text-tertiary)]">扫描视频...</span>
            </div>
          </div>

          <!-- Empty state -->
          <div v-else-if="!mediaPool.length" class="flex flex-col items-center justify-center h-52 gap-3 px-5">
            <div class="w-14 h-14 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="text-[var(--text-tertiary)]"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 8 6 4-6 4Z"/></svg>
            </div>
            <div class="text-center">
              <p class="text-[11px] font-semibold text-[var(--text-secondary)]">{{ poolError || '暂无视频素材' }}</p>
              <p v-if="scannedDir" class="text-[9px] text-[var(--text-tertiary)] font-mono mt-1 opacity-60 break-all">{{ scannedDir }}\\videos</p>
            </div>
            <button @click="handleImport" class="text-[10px] font-bold text-blue-400 border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 rounded-lg hover:bg-blue-500/20 transition-colors flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
              手动导入视频
            </button>
          </div>

          <!-- No search results -->
          <div v-else-if="filteredMediaPool.length === 0" class="flex flex-col items-center justify-center h-40 gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-[var(--text-tertiary)]"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>
            <p class="text-[10px] text-[var(--text-tertiary)]">未找到匹配素材</p>
          </div>

          <!-- ── GRID VIEW ── -->
          <div v-else-if="binViewMode === 'grid'" class="p-2 grid grid-cols-2 gap-2">
            <div
              v-for="media in filteredMediaPool"
              :key="media.path"
              @click="selectedMediaPath = media.path"
              @dblclick="handleAddToTimeline(media)"
              :draggable="true"
              @dragstart="handleMediaDragStart(media, $event)"
              @dragend="handleMediaDragEnd"
              class="relative rounded-lg overflow-hidden cursor-pointer transition-all group border-2"
              :class="[
                selectedMediaPath === media.path
                  ? 'border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                  : 'border-transparent hover:border-[var(--border-color)]'
              ]"
            >
              <!-- Thumbnail -->
              <div class="aspect-video bg-[var(--bg-primary)] relative">
                <img v-if="media.thumbnail" :src="media.thumbnail" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="text-[var(--text-tertiary)]"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 8 6 4-6 4Z"/></svg>
                </div>
                <!-- Duration badge -->
                <div class="absolute bottom-1 right-1 bg-black/75 backdrop-blur text-[8px] font-bold px-1.5 py-px rounded text-white tracking-wide">{{ formatDuration(media.duration) }}</div>
                <!-- Used indicator -->
                <div v-if="usedPathsInTimeline.has(media.path)" class="absolute top-1 left-1 bg-blue-500/90 text-[7px] font-bold px-1 py-px rounded text-white">已使用</div>
                <!-- Resolution badge -->
                <div class="absolute top-1 right-1 bg-black/60 text-[7px] text-white/70 px-1 py-px rounded font-mono">{{ media.width }}×{{ media.height }}</div>
                <!-- Hover overlay with add button -->
                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    @click.stop="handleAddToTimeline(media)"
                    class="w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-400 flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95"
                    title="添加到时间线"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                  </button>
                </div>
              </div>
              <!-- Info -->
              <div class="bg-[var(--bg-card)] px-2 py-1.5">
                <p class="text-[10px] font-semibold text-[var(--text-primary)] truncate leading-tight" :title="getMediaName(media)">{{ getMediaName(media) }}</p>
                <p class="text-[8px] text-[var(--text-tertiary)] font-mono mt-0.5">{{ formatFileSize(media.size) }}</p>
              </div>
            </div>
          </div>

          <!-- ── LIST VIEW ── -->
          <div v-else class="p-2 flex flex-col gap-1">
            <div
              v-for="media in filteredMediaPool"
              :key="media.path"
              @click="selectedMediaPath = media.path"
              @dblclick="handleAddToTimeline(media)"
              :draggable="true"
              @dragstart="handleMediaDragStart(media, $event)"
              @dragend="handleMediaDragEnd"
              class="flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-all group border"
              :class="[
                selectedMediaPath === media.path
                  ? 'bg-blue-500/10 border-blue-500/40'
                  : 'border-transparent hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-color)]'
              ]"
            >
              <!-- Thumbnail -->
              <div class="w-[60px] h-[38px] rounded-md overflow-hidden bg-[var(--bg-primary)] shrink-0 relative">
                <img v-if="media.thumbnail" :src="media.thumbnail" class="w-full h-full object-cover" />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="text-[var(--text-tertiary)]"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 8 6 4-6 4Z"/></svg>
                </div>
                <div class="absolute bottom-0.5 right-0.5 bg-black/75 text-[7px] font-bold px-0.5 rounded text-white">{{ formatDuration(media.duration) }}</div>
              </div>
              <!-- Info -->
              <div class="flex-1 min-w-0">
                <p class="text-[11px] font-semibold text-[var(--text-primary)] truncate" :title="getMediaName(media)">{{ getMediaName(media) }}</p>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="text-[9px] text-[var(--text-tertiary)] font-mono">{{ media.width }}×{{ media.height }}</span>
                  <span class="text-[9px] text-[var(--text-tertiary)]">·</span>
                  <span class="text-[9px] text-[var(--text-tertiary)]">{{ formatFileSize(media.size) }}</span>
                  <span v-if="usedPathsInTimeline.has(media.path)" class="text-[7px] font-bold text-blue-400 bg-blue-500/10 px-1 py-px rounded">已使用</span>
                </div>
              </div>
              <!-- Add button -->
              <button
                @click.stop="handleAddToTimeline(media)"
                class="w-6 h-6 rounded flex items-center justify-center text-[var(--text-tertiary)] group-hover:text-blue-400 hover:bg-blue-500/10 transition-colors shrink-0"
                title="添加到时间线"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Footer stats -->
        <div class="px-3 py-2 border-t border-[var(--border-color)] flex items-center justify-between">
          <span class="text-[9px] text-[var(--text-tertiary)] font-mono">{{ mediaPool.length }} 个视频</span>
          <span class="text-[9px] text-[var(--text-tertiary)] font-mono">{{ timelineClips.length }} 个已加入</span>
        </div>
      </aside>

      <!-- ── Right: Preview Panel ── -->
      <main class="flex-1 flex flex-col bg-[var(--bg-primary)] min-w-0">
        <!-- Preview viewport -->
        <div class="flex-1 flex items-center justify-center relative overflow-hidden bg-[var(--bg-primary)]">
          <!-- Preview content area -->
          <div class="w-full max-w-[640px] aspect-video bg-[var(--bg-primary)] rounded border border-[var(--border-color)] relative overflow-hidden shadow-2xl">
            <!-- Show selected clip thumbnail or empty state -->
            <template v-if="selectedClip">
              <video
                ref="videoRef"
                class="w-full h-full object-contain bg-black cursor-pointer"
                @timeupdate="handleVideoTimeUpdate"
                @ended="handleVideoEnded"
                @loadedmetadata="handleVideoLoaded"
                @error="handleVideoError"
                @click="handlePlay"
              ></video>
              <div v-show="!isPlaying" class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none">
                <div class="absolute bottom-3 left-3 right-3">
                  <p class="text-xs font-bold text-white truncate">{{ selectedClip.sourceName }}</p>
                  <p class="text-[10px] text-white/60 font-mono mt-0.5">{{ formatDuration(clipDuration(selectedClip)) }}</p>
                </div>
              </div>
            </template>
            <div v-else class="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="text-[var(--text-tertiary)]"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 8 6 4-6 4Z"/></svg>
              <span class="text-[11px] text-[var(--text-tertiary)] font-medium">选择片段以预览 Select a clip</span>
            </div>
            <!-- Playback overlay -->
            <div v-show="!isPlaying && selectedClip" class="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <button @click="handlePlay" class="w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-black/60 transition-all hover:scale-105 active:scale-95 shadow-xl pointer-events-auto">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="6 3 20 12 6 21 6 3"/></svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Playback controls bar -->
        <div class="h-[48px] shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] flex items-center px-4 gap-4">
          <div class="flex items-center gap-2">
            <button @click="handleStop" class="tool-btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
            </button>
            <button @click="handlePlay" class="tool-btn">
              <svg v-if="!isPlaying" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6 3 20 12 6 21 6 3"/></svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="5" y="4" width="4" height="16" rx="1"/><rect x="15" y="4" width="4" height="16" rx="1"/></svg>
            </button>
          </div>
          <!-- Timecode display -->
          <div class="flex items-center gap-3">
            <span class="font-mono text-xs text-blue-400 bg-[var(--bg-card)] border border-[var(--border-color)] px-2.5 py-1 rounded shadow-inner tracking-wider">{{ currentTime }}</span>
            <span class="text-[10px] text-[var(--text-tertiary)]">/</span>
            <span class="font-mono text-xs text-[var(--text-tertiary)]">00:00:{{ String(totalDuration).padStart(2, '0') }}:00</span>
          </div>
          <div class="flex-1"></div>
          <!-- Selected clip info -->
          <div v-if="selectedClipId" class="text-[10px] text-[var(--text-tertiary)] flex items-center gap-2">
            <span class="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 font-bold">SELECTED</span>
            <span>{{ timelineClips.find(c => c.id === selectedClipId)?.sourceName }}</span>
          </div>
        </div>
      </main>
    </div>

    <!-- ═══ Bottom: Timeline Panel ═══ -->
    <div class="h-[160px] shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] flex flex-col">

      <!-- Timeline toolbar -->
      <div class="h-[34px] shrink-0 border-b border-[var(--border-color)] flex items-center justify-between px-3 bg-[var(--bg-card)]">
        <div class="flex items-center gap-2">
          <span class="text-[9px] font-bold tracking-widest text-[var(--text-tertiary)]">TIMELINE</span>
          <div class="h-3 w-px bg-[var(--border-color)]"></div>
          <span class="text-[9px] text-[var(--text-tertiary)] font-mono">{{ timelineClips.length }} clips · {{ totalDuration }}s</span>
        </div>
        <div class="flex items-center gap-1">
          <button @click="handleZoomOut" class="tool-btn-sm" title="缩小">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/></svg>
          </button>
          <div class="w-16 h-1 bg-[var(--bg-tertiary)] rounded-full relative mx-1">
            <div class="absolute inset-y-0 left-0 bg-blue-500/50 rounded-full" :style="{ width: ((timelineZoom - 0.5) / 2.5 * 100) + '%' }"></div>
          </div>
          <button @click="handleZoomIn" class="tool-btn-sm" title="放大">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>
          </button>
          <button @click="handleFitTimeline" class="tool-btn-sm ml-1" title="适配">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/></svg>
          </button>
        </div>
      </div>

      <!-- Timeline content (scrollable horizontally) -->
      <div class="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar-h relative">
        <div class="min-w-full h-full relative" :style="{ width: Math.max(totalDuration * pxPerSecond + 200, 800) + 'px' }">

          <!-- ── Ruler ── -->
          <div @click="handleRulerClick" class="h-[24px] bg-[var(--bg-card)] border-b border-[var(--border-color)] relative overflow-hidden cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors">
            <template v-for="tick in rulerTicks" :key="tick.pos">
              <div
                class="absolute top-0 h-full flex flex-col items-center"
                :style="{ left: (tick.pos + 60) + 'px' }"
              >
                <div
                  :class="['w-px', tick.major ? 'h-full bg-[#333338]' : 'h-2 bg-[#2a2a2f] mt-auto']"
                ></div>
                <span
                  v-if="tick.major"
                  class="absolute top-0.5 text-[8px] font-mono text-[var(--text-tertiary)] whitespace-nowrap -translate-x-1/2"
                >{{ tick.label }}</span>
              </div>
            </template>
          </div>

          <!-- ── Track Labels ── -->
          <div class="absolute left-0 top-[24px] bottom-0 w-[60px] bg-[var(--bg-secondary)] border-r border-[var(--border-color)] z-20 flex flex-col">
            <div class="h-[56px] flex items-center justify-center border-b border-[var(--border-color)]">
              <span class="text-[9px] font-bold text-blue-400 tracking-wider">V1</span>
            </div>
            <div class="h-[40px] flex items-center justify-center">
              <span class="text-[9px] font-bold text-emerald-400 tracking-wider">A1</span>
            </div>
          </div>

          <!-- ── Video Track V1 ── -->
          <div
            class="h-[56px] relative ml-[60px] border-b border-[var(--border-color)]"
            @dragover="handleTimelineDragOver"
            @dragleave="isTimelineDragOver = false"
            @drop="handleTimelineDrop"
          >
            <div class="absolute inset-0 bg-[var(--bg-primary)]"></div>
            <div
              v-if="isTimelineDragOver"
              class="absolute inset-0 border border-dashed border-blue-400/70 bg-blue-500/10 pointer-events-none z-10"
            ></div>
            <div v-if="!timelineClips.length" class="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span class="text-[9px] text-[var(--text-tertiary)] font-medium">拖拽素材到时间线 Drop clips here</span>
            </div>
            <div
              v-for="clip in timelineClips"
              :key="clip.id"
              @click="handleSelectClip(clip.id)"
              class="absolute top-[4px] bottom-[4px] rounded-md overflow-hidden cursor-pointer transition-all group"
              :class="[
                selectedClipId === clip.id
                  ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-[var(--bg-primary)] shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                  : 'hover:ring-1 hover:ring-zinc-500'
              ]"
              :style="{
                left: (clip.timelineStart * pxPerSecond) + 'px',
                width: (clipDuration(clip) * pxPerSecond - 2) + 'px'
              }"
            >
              <!-- Clip background thumbnail -->
              <div class="absolute inset-0">
                <img v-if="clip.thumbnail" :src="clip.thumbnail" class="w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity" />
                <div class="absolute inset-0 bg-gradient-to-r from-blue-900/40 via-blue-900/20 to-blue-900/40"></div>
              </div>
              <!-- Clip info overlay -->
              <div class="relative h-full flex items-center px-2 gap-1.5 z-10">
                <div class="w-1 h-full absolute left-0 top-0 bg-blue-500/60 rounded-l"></div>
                <span class="text-[9px] font-bold text-[var(--text-primary)] truncate ml-1.5">{{ clip.sourceName }}</span>
                <span class="text-[8px] text-[var(--text-secondary)] ml-auto font-mono shrink-0">{{ formatDuration(clipDuration(clip)) }}</span>
              </div>
              <!-- Resize handles (visual only) -->
              <div class="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-400/50 transition-colors z-20"></div>
              <div class="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-400/50 transition-colors z-20"></div>
            </div>
          </div>

          <!-- ── Audio Track A1 ── -->
          <div
            class="h-[40px] relative ml-[60px]"
            @dragover="handleTimelineDragOver"
            @dragleave="isTimelineDragOver = false"
            @drop="handleTimelineDrop"
          >
            <div class="absolute inset-0 bg-[var(--bg-primary)]/80"></div>
            <div
              v-if="isTimelineDragOver"
              class="absolute inset-0 border border-dashed border-blue-400/70 bg-blue-500/10 pointer-events-none z-10"
            ></div>
            <div
              v-for="clip in timelineClips"
              :key="'a-' + clip.id"
              class="absolute top-[4px] bottom-[4px] rounded-sm overflow-hidden"
              :style="{
                left: (clip.timelineStart * pxPerSecond) + 'px',
                width: (clipDuration(clip) * pxPerSecond - 2) + 'px'
              }"
            >
              <div class="absolute inset-0 bg-emerald-900/30 border border-emerald-700/30 rounded-sm"></div>
              <!-- Fake waveform -->
              <div class="relative h-full flex items-center px-1 gap-px overflow-hidden">
                <div v-for="n in Math.max(1, Math.floor(clipDuration(clip) * pxPerSecond / 3))" :key="n"
                  class="w-[2px] bg-emerald-500/40 rounded-full shrink-0"
                  :style="{ height: (12 + Math.random() * 18) + 'px' }"
                ></div>
              </div>
            </div>
          </div>

          <!-- ── Playhead ── -->
          <div
            class="absolute top-0 bottom-0 z-30 pointer-events-none flex flex-col items-center -translate-x-1/2"
            :style="{ left: (playheadPosition * pxPerSecond + 60) + 'px' }"
          >
            <!-- Triangle head -->
            <div class="w-3 h-3 bg-blue-500 clip-triangle relative z-10 shadow-lg shrink-0"></div>
            <!-- Vertical line -->
            <div class="w-px flex-1 bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.6)]"></div>
          </div>

        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.tool-btn {
  width: 1.75rem;
  height: 1.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.25rem;
  color: var(--text-tertiary);
  transition: all 0.15s ease;
}
.tool-btn:hover {
  color: var(--text-primary);
  background-color: var(--bg-tertiary);
}
.tool-btn:active {
  transform: scale(0.95);
}
.tool-btn-sm {
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.25rem;
  color: var(--text-tertiary);
  transition: all 0.15s ease;
}
.tool-btn-sm:hover {
  color: var(--text-primary);
  background-color: var(--bg-tertiary);
}
.tool-btn-sm:active {
  transform: scale(0.95);
}

.clip-triangle {
  clip-path: polygon(50% 100%, 0 0, 100% 0);
}

.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 6px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--text-tertiary); }

.custom-scrollbar-h::-webkit-scrollbar { height: 6px; }
.custom-scrollbar-h::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar-h::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 6px; }
.custom-scrollbar-h::-webkit-scrollbar-thumb:hover { background: var(--text-tertiary); }
</style>
