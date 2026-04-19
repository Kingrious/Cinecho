<script setup lang="ts">
import { ref, computed } from 'vue'

// ─── Mock Data ───
const mediaPool = ref([
  { id: 1, name: 'Aria slow motion', duration: 4, thumbnail: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=400&auto=format&fit=crop' },
  { id: 2, name: 'Obsidian operative', duration: 8, thumbnail: 'https://images.unsplash.com/photo-1618331835717-801e976710b2?q=80&w=400&auto=format&fit=crop' },
  { id: 3, name: 'Cyberpunk flythrough', duration: 6, thumbnail: 'https://images.unsplash.com/photo-1480796927426-f609979314bd?q=80&w=400&auto=format&fit=crop' },
  { id: 4, name: 'Ocean sunset aerial', duration: 5, thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=400&auto=format&fit=crop' },
  { id: 5, name: 'Forest morning mist', duration: 7, thumbnail: 'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=400&auto=format&fit=crop' },
])

// Timeline clips (mocked as already placed on timeline)
const timelineClips = ref([
  { id: 101, mediaId: 1, name: 'Aria slow motion', start: 0, duration: 4, thumbnail: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=400&auto=format&fit=crop' },
  { id: 102, mediaId: 2, name: 'Obsidian operative', start: 4, duration: 8, thumbnail: 'https://images.unsplash.com/photo-1618331835717-801e976710b2?q=80&w=400&auto=format&fit=crop' },
  { id: 103, mediaId: 3, name: 'Cyberpunk flythrough', start: 12, duration: 6, thumbnail: 'https://images.unsplash.com/photo-1480796927426-f609979314bd?q=80&w=400&auto=format&fit=crop' },
])

const selectedClipId = ref<number | null>(101)
const playheadPosition = ref(2) // seconds
const timelineZoom = ref(1) // 1 = normal
const isPlaying = ref(false)
const currentTime = ref('00:00:02:00')
const totalDuration = computed(() => {
  if (timelineClips.value.length === 0) return 0
  return Math.max(...timelineClips.value.map(c => c.start + c.duration))
})

// Scale: pixels per second
const pxPerSecond = computed(() => 40 * timelineZoom.value)

// Timeline ruler ticks
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

const formatDuration = (s: number) => `${s}s`

// ─── Mock Handlers ───
const handleSelectClip = (id: number) => { selectedClipId.value = id }
const handlePlay = () => { isPlaying.value = !isPlaying.value; console.log('Mock play/pause') }
const handleStop = () => { isPlaying.value = false; playheadPosition.value = 0; console.log('Mock stop') }
const handleZoomIn = () => { timelineZoom.value = Math.min(timelineZoom.value + 0.25, 3) }
const handleZoomOut = () => { timelineZoom.value = Math.max(timelineZoom.value - 0.25, 0.5) }
const handleFitTimeline = () => { timelineZoom.value = 1 }
const handleCut = () => { console.log('Mock cut') }
const handleDelete = () => { console.log('Mock delete') }
const handleMoveLeft = () => {
  const idx = timelineClips.value.findIndex(c => c.id === selectedClipId.value)
  if (idx > 0) {
    const temp = timelineClips.value[idx]
    timelineClips.value[idx] = timelineClips.value[idx - 1]
    timelineClips.value[idx - 1] = temp
    // recalculate positions
    let pos = 0
    timelineClips.value.forEach(c => { c.start = pos; pos += c.duration })
  }
}
const handleMoveRight = () => {
  const idx = timelineClips.value.findIndex(c => c.id === selectedClipId.value)
  if (idx < timelineClips.value.length - 1 && idx >= 0) {
    const temp = timelineClips.value[idx]
    timelineClips.value[idx] = timelineClips.value[idx + 1]
    timelineClips.value[idx + 1] = temp
    let pos = 0
    timelineClips.value.forEach(c => { c.start = pos; pos += c.duration })
  }
}
const handleAddToTimeline = (media: any) => {
  const newStart = totalDuration.value
  timelineClips.value.push({
    id: Date.now(),
    mediaId: media.id,
    name: media.name,
    start: newStart,
    duration: media.duration,
    thumbnail: media.thumbnail,
  })
}
const handleExport = () => { console.log('Mock export') }
</script>

<template>
  <div class="h-full bg-[#111113] text-zinc-300 flex flex-col overflow-hidden font-sans select-none">

    <!-- ═══ Top Toolbar ═══ -->
    <header class="h-[44px] shrink-0 border-b border-[#222225] flex items-center justify-between px-4 bg-[#141417]">
      <div class="flex items-center gap-4">
        <div class="text-xs font-bold tracking-widest text-zinc-400">视频拼接 STITCH EDITOR</div>
        <div class="h-4 w-px bg-[#2a2a30]"></div>
        <!-- Timeline tools -->
        <div class="flex items-center gap-1">
          <button @click="handleMoveLeft" class="tool-btn" title="前移 Move Left">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <button @click="handleMoveRight" class="tool-btn" title="后移 Move Right">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
          <div class="h-4 w-px bg-[#2a2a30] mx-1"></div>
          <button @click="handleCut" class="tool-btn" title="裁剪 Cut">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/></svg>
          </button>
          <button @click="handleDelete" class="tool-btn" title="删除 Delete">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button @click="handleExport" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-md transition-all shadow-[0_0_12px_rgba(37,99,235,0.3)] flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
          导出 Export
        </button>
      </div>
    </header>

    <!-- ═══ Main Body: Media Bin + Preview ═══ -->
    <div class="flex-1 flex overflow-hidden min-h-0">

      <!-- ── Left: Media Bin ── -->
      <aside class="w-[260px] shrink-0 border-r border-[#222225] bg-[#141417] flex flex-col">
        <div class="p-3 border-b border-[#222225] flex items-center justify-between">
          <h3 class="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">素材库 Media Bin</h3>
          <span class="text-[9px] bg-[#1f1f23] border border-[#2e2e33] text-zinc-500 px-1.5 py-0.5 rounded font-medium">{{ mediaPool.length }}</span>
        </div>
        <div class="flex-1 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-1.5">
          <div
            v-for="media in mediaPool"
            :key="media.id"
            @click="handleAddToTimeline(media)"
            class="flex items-center gap-2.5 p-2 rounded-lg hover:bg-[#1f1f23] cursor-pointer transition-all group border border-transparent hover:border-[#2a2a30]"
          >
            <div class="w-16 h-10 rounded-md overflow-hidden bg-[#0c0c0e] shrink-0 relative shadow-sm">
              <img :src="media.thumbnail" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
              <div class="absolute bottom-0.5 right-0.5 bg-black/70 backdrop-blur text-[8px] font-bold px-1 py-px rounded">{{ formatDuration(media.duration) }}</div>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[11px] text-zinc-300 font-medium truncate">{{ media.name }}</p>
              <p class="text-[9px] text-zinc-600 font-mono">{{ formatDuration(media.duration) }}</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-zinc-600 group-hover:text-blue-400 transition-colors shrink-0"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          </div>
        </div>
      </aside>

      <!-- ── Right: Preview Panel ── -->
      <main class="flex-1 flex flex-col bg-[#0c0c0e] min-w-0">
        <!-- Preview viewport -->
        <div class="flex-1 flex items-center justify-center relative overflow-hidden">
          <!-- Cinema-style bars -->
          <div class="absolute inset-x-0 top-0 h-6 bg-black z-10"></div>
          <div class="absolute inset-x-0 bottom-0 h-6 bg-black z-10"></div>
          <!-- Preview content area -->
          <div class="w-full max-w-[640px] aspect-video bg-[#0a0a0c] rounded border border-[#1a1a1d] relative overflow-hidden shadow-2xl">
            <!-- Show selected clip thumbnail or empty state -->
            <template v-if="selectedClipId">
              <img
                :src="timelineClips.find(c => c.id === selectedClipId)?.thumbnail"
                class="w-full h-full object-cover opacity-60"
              />
              <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30"></div>
            </template>
            <div v-else class="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="text-zinc-700"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 8 6 4-6 4Z"/></svg>
              <span class="text-[11px] text-zinc-600 font-medium">选择片段以预览 Select a clip</span>
            </div>
            <!-- Playback overlay -->
            <div class="absolute inset-0 flex items-center justify-center z-20">
              <button @click="handlePlay" class="w-14 h-14 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all hover:scale-105 active:scale-95 shadow-xl">
                <svg v-if="!isPlaying" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="none"><rect x="5" y="4" width="4" height="16" rx="1"/><rect x="15" y="4" width="4" height="16" rx="1"/></svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Playback controls bar -->
        <div class="h-[48px] shrink-0 border-t border-[#222225] bg-[#141417] flex items-center px-4 gap-4">
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
            <span class="font-mono text-xs text-blue-400 bg-[#18181b] border border-[#2a2a30] px-2.5 py-1 rounded shadow-inner tracking-wider">{{ currentTime }}</span>
            <span class="text-[10px] text-zinc-600">/</span>
            <span class="font-mono text-xs text-zinc-500">00:00:{{ String(totalDuration).padStart(2, '0') }}:00</span>
          </div>
          <div class="flex-1"></div>
          <!-- Selected clip info -->
          <div v-if="selectedClipId" class="text-[10px] text-zinc-500 flex items-center gap-2">
            <span class="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 font-bold">SELECTED</span>
            <span>{{ timelineClips.find(c => c.id === selectedClipId)?.name }}</span>
          </div>
        </div>
      </main>
    </div>

    <!-- ═══ Bottom: Timeline Panel ═══ -->
    <div class="h-[220px] shrink-0 border-t border-[#222225] bg-[#141417] flex flex-col">

      <!-- Timeline toolbar -->
      <div class="h-[34px] shrink-0 border-b border-[#1e1e22] flex items-center justify-between px-3 bg-[#18181b]">
        <div class="flex items-center gap-2">
          <span class="text-[9px] font-bold tracking-widest text-zinc-500">TIMELINE</span>
          <div class="h-3 w-px bg-[#2a2a30]"></div>
          <span class="text-[9px] text-zinc-600 font-mono">{{ timelineClips.length }} clips · {{ totalDuration }}s</span>
        </div>
        <div class="flex items-center gap-1">
          <button @click="handleZoomOut" class="tool-btn-sm" title="缩小">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/></svg>
          </button>
          <div class="w-16 h-1 bg-[#222225] rounded-full relative mx-1">
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
          <div class="h-[24px] bg-[#18181b] border-b border-[#1e1e22] relative overflow-hidden">
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
                  class="absolute top-0.5 text-[8px] font-mono text-zinc-600 whitespace-nowrap -translate-x-1/2"
                >{{ tick.label }}</span>
              </div>
            </template>
          </div>

          <!-- ── Track Labels ── -->
          <div class="absolute left-0 top-[24px] bottom-0 w-[60px] bg-[#141417] border-r border-[#222225] z-20 flex flex-col">
            <div class="h-[56px] flex items-center justify-center border-b border-[#1e1e22]">
              <span class="text-[9px] font-bold text-blue-400 tracking-wider">V1</span>
            </div>
            <div class="h-[40px] flex items-center justify-center border-b border-[#1e1e22]">
              <span class="text-[9px] font-bold text-emerald-400 tracking-wider">A1</span>
            </div>
            <div class="flex-1 flex items-center justify-center">
              <span class="text-[9px] font-bold text-zinc-600 tracking-wider">V2</span>
            </div>
          </div>

          <!-- ── Video Track V1 ── -->
          <div class="h-[56px] relative ml-[60px] border-b border-[#1e1e22]">
            <div class="absolute inset-0 bg-[#111113]"></div>
            <div
              v-for="clip in timelineClips"
              :key="clip.id"
              @click="handleSelectClip(clip.id)"
              class="absolute top-[4px] bottom-[4px] rounded-md overflow-hidden cursor-pointer transition-all group"
              :class="[
                selectedClipId === clip.id
                  ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-[#111113] shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                  : 'hover:ring-1 hover:ring-zinc-500'
              ]"
              :style="{
                left: (clip.start * pxPerSecond) + 'px',
                width: (clip.duration * pxPerSecond - 2) + 'px'
              }"
            >
              <!-- Clip background thumbnail -->
              <div class="absolute inset-0">
                <img :src="clip.thumbnail" class="w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity" />
                <div class="absolute inset-0 bg-gradient-to-r from-blue-900/40 via-blue-900/20 to-blue-900/40"></div>
              </div>
              <!-- Clip info overlay -->
              <div class="relative h-full flex items-center px-2 gap-1.5 z-10">
                <div class="w-1 h-full absolute left-0 top-0 bg-blue-500/60 rounded-l"></div>
                <span class="text-[9px] font-bold text-zinc-200 truncate ml-1.5">{{ clip.name }}</span>
                <span class="text-[8px] text-zinc-400 ml-auto font-mono shrink-0">{{ formatDuration(clip.duration) }}</span>
              </div>
              <!-- Resize handles (visual only) -->
              <div class="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-400/50 transition-colors z-20"></div>
              <div class="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-400/50 transition-colors z-20"></div>
            </div>
          </div>

          <!-- ── Audio Track A1 ── -->
          <div class="h-[40px] relative ml-[60px] border-b border-[#1e1e22]">
            <div class="absolute inset-0 bg-[#111113]/80"></div>
            <div
              v-for="clip in timelineClips"
              :key="'a-' + clip.id"
              class="absolute top-[4px] bottom-[4px] rounded-sm overflow-hidden"
              :style="{
                left: (clip.start * pxPerSecond) + 'px',
                width: (clip.duration * pxPerSecond - 2) + 'px'
              }"
            >
              <div class="absolute inset-0 bg-emerald-900/30 border border-emerald-700/30 rounded-sm"></div>
              <!-- Fake waveform -->
              <div class="relative h-full flex items-center px-1 gap-px overflow-hidden">
                <div v-for="n in Math.floor(clip.duration * pxPerSecond / 3)" :key="n"
                  class="w-[2px] bg-emerald-500/40 rounded-full shrink-0"
                  :style="{ height: (12 + Math.random() * 18) + 'px' }"
                ></div>
              </div>
            </div>
          </div>

          <!-- ── Empty Track V2 ── -->
          <div class="flex-1 relative ml-[60px]">
            <div class="absolute inset-0 bg-[#0e0e10]"></div>
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="text-[9px] text-zinc-700 font-medium">拖拽素材到此轨道 Drop clips here</span>
            </div>
          </div>

          <!-- ── Playhead ── -->
          <div
            class="absolute top-0 bottom-0 z-30 pointer-events-none"
            :style="{ left: (playheadPosition * pxPerSecond + 60) + 'px' }"
          >
            <!-- Triangle head -->
            <div class="w-3 h-3 -ml-1.5 bg-blue-500 clip-triangle relative z-10 shadow-lg"></div>
            <!-- Vertical line -->
            <div class="w-px h-full bg-blue-500 mx-auto shadow-[0_0_6px_rgba(59,130,246,0.6)]"></div>
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
  color: #71717a;
  transition: all 0.15s ease;
}
.tool-btn:hover {
  color: #e4e4e7;
  background-color: #222225;
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
  color: #71717a;
  transition: all 0.15s ease;
}
.tool-btn-sm:hover {
  color: #e4e4e7;
  background-color: #222225;
}
.tool-btn-sm:active {
  transform: scale(0.95);
}

.clip-triangle {
  clip-path: polygon(50% 100%, 0 0, 100% 0);
}

.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #2a2a30; border-radius: 6px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3a3a40; }

.custom-scrollbar-h::-webkit-scrollbar { height: 6px; }
.custom-scrollbar-h::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar-h::-webkit-scrollbar-thumb { background: #2a2a30; border-radius: 6px; }
.custom-scrollbar-h::-webkit-scrollbar-thumb:hover { background: #3a3a40; }
</style>
