<script setup lang="ts">
import { ref } from 'vue'

// Prompt and Configs
const prompt = ref('')
const modelVariant = ref('Veo 3.1 - Fast')
const sizeType = ref<'Frames' | 'Ingredients'>('Frames')
const multiplier = ref<1|2|3|4>(1)

// Asset Picking State
const pickingFor = ref<'start' | 'end' | null>(null)
const startAssetId = ref<number | null>(null)
const endAssetId = ref<number | null>(null)

// Mocked generated videos in the center gallery
const generatedVideos = [
  { id: 2, status: 'done', prompt: 'Aria Vance walking slow motion', thumbnail: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=400&auto=format&fit=crop', duration: '4s' },
  { id: 101, status: 'done', prompt: 'Obsidian operative firing weapon', thumbnail: 'https://images.unsplash.com/photo-1618331835717-801e976710b2?q=80&w=400&auto=format&fit=crop', duration: '8s' },
]

// Mock assets for the reference picker overlay
const availableAssets = [
  { id: 1, image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=400&auto=format&fit=crop' },
  { id: 2, image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=400&auto=format&fit=crop' },
  { id: 3, image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=400&auto=format&fit=crop' },
  { id: 101, image: 'https://images.unsplash.com/photo-1618331835717-801e976710b2?q=80&w=400&auto=format&fit=crop' },
  { id: 102, image: 'https://images.unsplash.com/photo-1480796927426-f609979314bd?q=80&w=400&auto=format&fit=crop' }
]

const openPicker = (type: 'start' | 'end') => {
  pickingFor.value = type
}

const selectAsset = (id: number) => {
  if (pickingFor.value === 'start') startAssetId.value = id
  if (pickingFor.value === 'end') endAssetId.value = id
  pickingFor.value = null
}

const getAssetImg = (id: number | null) => {
  return availableAssets.find(a => a.id === id)?.image || null
}

const handleGenerate = () => {
    alert(`Generating ${sizeType.value} (${modelVariant.value}) \nPrompt: ${prompt.value}`)
}
</script>

<template>
  <div class="h-full bg-[#111113] text-zinc-300 flex flex-col overflow-hidden font-sans">
    
    <!-- Top Menu -->
    <header class="h-[52px] shrink-0 border-b border-[#222225] flex justify-center items-center px-6 gap-8 bg-[#141417]">
      <div class="text-xs font-bold tracking-widest text-zinc-400">
        创作引擎控制台 VIDEO ENGINE
      </div>
    </header>

    <div class="flex-1 flex overflow-hidden">
      <!-- Middle: Main Media View -->
      <main class="flex-1 flex flex-col border-r border-[#222225] bg-[#0c0c0e] min-w-0">
        <div class="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold tracking-widest text-zinc-400">已生成视频 GENERATED VIDEOS</h2>
            <div class="flex gap-2">
              <span class="text-[10px] bg-[#1f1f23] border border-[#2e2e33] text-zinc-500 px-2 py-1 rounded font-medium">{{ generatedVideos.length }} items</span>
            </div>
          </div>
          
          <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            <div v-for="video in generatedVideos" :key="video.id" class="aspect-video bg-[#1a1a1d] rounded-xl border border-[#222225] overflow-hidden relative group cursor-pointer hover:border-blue-500/50 hover:shadow-[0_0_15px_rgba(59,130,246,0.15)] transition-all shadow-sm">
              <img :src="video.thumbnail!" class="w-full h-full object-cover opacity-80 transition-opacity group-hover:opacity-100" />
              <div class="absolute inset-0 bg-black/40 group-hover:bg-black/60 transition-colors flex items-center justify-center">
                 <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="white" class="opacity-80 group-hover:opacity-100 transform group-hover:scale-110 transition-all drop-shadow-md" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </div>
              <div class="absolute bottom-2 right-2 bg-black/70 backdrop-blur rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider">{{ video.duration }}</div>
              <div class="absolute top-2 left-2 right-2">
                <p class="text-[9px] text-zinc-300 font-bold bg-black/60 backdrop-blur rounded px-2 py-1 truncate shadow">{{ video.prompt }}</p>
              </div>
            </div>
          </div>
          
        </div>
      </main>

      <!-- Right Sidebar: Inspector -->
      <aside class="w-[340px] flex flex-col relative bg-[#141417] border-l border-[#222225] z-10 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
        
        <div class="p-6 flex-1 flex flex-col gap-6 w-full relative overflow-y-auto pb-32 custom-scrollbar">
          
          <div class="flex items-center justify-between pb-3 border-b border-[#222225]">
            <h2 class="text-xs font-bold tracking-wider text-zinc-300">控制面板 INSPECTOR</h2>
          </div>

          <!-- Model -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-zinc-500">生成模型 MODEL</label>
            <div class="relative">
              <select v-model="modelVariant" class="w-full bg-[#18181b] border border-[#2a2a30] rounded-md px-3 py-2 text-sm text-zinc-300 outline-none appearance-none cursor-pointer focus:border-blue-500/50 transition-colors shadow-inner">
                <option>Veo 3.1 - Fast</option>
                <option>Veo 3.0 - Quality</option>
                <option>doubao-seedream-4.5</option>
              </select>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>

          <!-- Settings Grid -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-zinc-500">生成模式 MODE</label>
            <div class="flex bg-[#18181b] rounded-md p-1 border border-[#2a2a30] shadow-inner">
               <button @click="sizeType = 'Frames'" :class="['flex-1 rounded py-1.5 flex flex-col items-center gap-0.5 transition-colors', sizeType === 'Frames' ? 'bg-[#2a2a30] text-zinc-200 shadow-sm border border-[#3a3a40]' : 'text-zinc-500 hover:text-zinc-300']">
                 <span class="text-[9px] font-bold">Frames (文本)</span>
               </button>
               <button @click="sizeType = 'Ingredients'" :class="['flex-1 rounded py-1.5 flex flex-col items-center gap-0.5 transition-colors', sizeType === 'Ingredients' ? 'bg-[#2a2a30] text-zinc-200 shadow-sm border border-[#3a3a40]' : 'text-zinc-500 hover:text-zinc-300']">
                 <span class="text-[9px] font-bold">Ingredients (图文)</span>
               </button>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <div class="flex justify-between">
              <label class="text-[10px] font-bold text-zinc-500">预测时长 DURATION</label>
              <span class="text-[10px] font-bold text-blue-400 font-mono">{{ multiplier * 4 }}s</span>
            </div>
            <div class="flex bg-[#18181b] rounded-md p-1 border border-[#2a2a30] shadow-inner">
              <button v-for="num in [1,2,3,4]" :key="num" @click="multiplier = num as any" :class="['flex-1 py-1 text-xs font-bold rounded transition-colors', multiplier === num ? 'bg-[#2a2a30] text-zinc-200 shadow-sm border border-[#3a3a40]' : 'text-zinc-500 hover:text-zinc-300']">x{{ num }}</button>
            </div>
          </div>

          <div class="w-full h-px bg-[#222225] my-1"></div>

          <!-- Extra Input for 图生视频: Frame Picker -->
          <div v-if="sizeType === 'Ingredients'" class="flex flex-col gap-3">
             <label class="text-[10px] font-bold text-zinc-500">首尾参考帧 REFERENCE FRAMES</label>
             <div class="flex gap-4">
                <button @click="openPicker('start')" class="w-20 h-20 rounded-lg border border-dashed border-[#44444c] flex flex-col items-center justify-center gap-1 hover:border-zinc-400 hover:bg-[#222225] transition-all overflow-hidden shrink-0 group shadow-inner">
                  <img v-if="startAssetId" :src="getAssetImg(startAssetId)!" class="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  <template v-else>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" class="text-zinc-500 group-hover:text-zinc-300 transition-colors" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    <span class="text-[9px] font-bold text-zinc-500 group-hover:text-zinc-300 transition-colors">Start</span>
                  </template>
                </button>
                <div class="flex flex-col justify-center text-zinc-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </div>
                <button @click="openPicker('end')" class="w-20 h-20 rounded-lg border border-dashed border-[#44444c] flex flex-col items-center justify-center gap-1 hover:border-zinc-400 hover:bg-[#222225] transition-all overflow-hidden shrink-0 group shadow-inner">
                  <img v-if="endAssetId" :src="getAssetImg(endAssetId)!" class="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  <template v-else>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" class="text-zinc-500 group-hover:text-zinc-300 transition-colors" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    <span class="text-[9px] font-bold text-zinc-500 group-hover:text-zinc-300 transition-colors">End</span>
                  </template>
                </button>
             </div>
          </div>

          <!-- Prompt Input -->
          <div class="flex flex-col gap-2 flex-1 relative z-0">
            <div class="flex justify-between items-center">
              <label class="text-[10px] font-bold text-zinc-500">动态运镜提示词 MOTION SCRIPT</label>
              <button class="text-blue-400 hover:text-blue-300 p-1 bg-blue-500/10 rounded transition-colors flex items-center gap-1 hover:bg-blue-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
                <span class="text-[9px] font-bold">优化</span>
              </button>
            </div>
            <div class="relative flex-1 min-h-[160px]">
              <textarea 
                v-model="prompt"
                class="absolute inset-0 w-full h-full bg-[#18181b] border border-[#2a2a30] rounded-md p-4 text-xs leading-relaxed text-zinc-400 resize-none focus:outline-none focus:border-blue-500/50 shadow-inner font-mono transition-colors" 
                spellcheck="false"
                placeholder="Describe movement, scene changes, lightning..."
              ></textarea>
            </div>
          </div>

        </div>

        <!-- Action Buttons Fixed Bottom Right -->
        <div class="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#141417] via-[#141417] to-transparent pointer-events-none">
          <div class="p-1 border border-[#2b3a5e] rounded-xl pointer-events-auto bg-[#141417]/80 backdrop-blur">
            <div class="flex gap-2 w-full">
              <button @click="handleGenerate" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] font-bold text-sm py-3 rounded-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                <span>生成视频</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </button>
              <button class="w-[72px] shrink-0 bg-transparent border border-[#3a3a40] text-zinc-300 hover:bg-[#1f1f23] font-medium text-sm py-3 rounded-lg transition-colors active:scale-[0.98]">排队</button>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <!-- Asset Picker Modal -->
    <transition name="fade">
      <div v-if="pickingFor" class="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-8 cursor-pointer" @click.self="pickingFor = null">
        <div class="bg-[#18181b] border border-[#2a2a30] rounded-xl w-full max-w-4xl shadow-2xl flex flex-col overflow-hidden max-h-[80vh] relative cursor-default">
           <!-- Header -->
           <div class="p-4 border-b border-[#222225] flex justify-between items-center bg-[#111113]">
             <div>
               <h3 class="text-sm font-bold text-zinc-200 tracking-wider">选择引用资产 SELECT {{ pickingFor.toUpperCase() }} ASSET</h3>
             </div>
             <button @click="pickingFor = null" class="w-8 h-8 flex items-center justify-center rounded bg-[#222225] hover:bg-[#2a2a30] transition-colors text-zinc-400">
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
             </button>
           </div>

           <!-- Content -->
           <div class="p-6 overflow-y-auto w-full custom-scrollbar flex-1 bg-[#161619]">
             <div class="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                <button @click="selectAsset(null as any)" class="aspect-[3/4] rounded-lg border-2 border-dashed border-[#3a3a40] hover:border-zinc-400 flex flex-col items-center justify-center group hover:bg-[#222225] transition-all">
                  <span class="text-[10px] font-bold text-zinc-500 group-hover:text-zinc-300">CLEAR</span>
                </button>
                <div v-for="asset in availableAssets" :key="asset.id" 
                     @click="selectAsset(asset.id)"
                     class="aspect-[3/4] rounded-lg overflow-hidden cursor-pointer border-2 border-transparent hover:border-blue-500 transition-all relative group shadow-sm bg-[#111]">
                  <img :src="asset.image" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                </div>
             </div>
           </div>
        </div>
      </div>
    </transition>

  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #2a2a30;
  border-radius: 6px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #3a3a40;
}
</style>
