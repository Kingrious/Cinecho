<script setup lang="ts">
import { ref } from 'vue'

const tabs = ['资源库', '服饰', '角色', '场景']
const selectedImage = ref<string | null>(null)
const activeTab = ref('角色')

const features = ['Cybernetic Eyes', 'Neon Tattoos', 'Short Bob']

// Mocking generated items
// The prompt says "最新生成的或正在生成在第一位" (newest/generating first)
const generatedItems = [
  { id: 1, status: 'generating', type: '角色', prompt: 'A high-detail cinematic portrait of a cyberpunk female operative...', progress: 65, image: null },
  { id: 2, status: 'done', type: '角色', prompt: 'Aria Vance, frontal high quality, silver hair', image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=400&auto=format&fit=crop' },
  { id: 3, status: 'done', type: '角色', prompt: 'Kaelen Thorne, combat gear, neon lighting', image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=400&auto=format&fit=crop' },
  { id: 4, status: 'done', type: '角色', prompt: 'Elias Thorne portrait realistic cinematic', image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=400&auto=format&fit=crop' }
]

const allResources = [
  ...generatedItems.filter(i => i.status === 'done'),
  { id: 101, status: 'done', type: '服饰', prompt: 'Obsidian Operative Suit', image: 'https://images.unsplash.com/photo-1618331835717-801e976710b2?q=80&w=400&auto=format&fit=crop' },
  { id: 102, status: 'done', type: '场景', prompt: 'Cyberpunk rainy city street', image: 'https://images.unsplash.com/photo-1480796927426-f609979314bd?q=80&w=400&auto=format&fit=crop' }
]
</script>

<template>
  <div class="h-full bg-[#111113] text-zinc-300 flex flex-col overflow-hidden font-sans">
    <!-- Top Menu -->
    <header class="h-[52px] shrink-0 border-b border-[#222225] flex justify-center items-center px-6 gap-8 bg-[#141417]">
      <button 
        v-for="tab in tabs" 
        :key="tab"
        @click="activeTab = tab"
        :class="['text-xs font-bold tracking-widest px-2 py-4 border-b-[3px] transition-colors', 
                 activeTab === tab ? 'border-blue-500 text-blue-400' : 'border-transparent text-zinc-500 hover:text-zinc-300']"
      >
        {{ tab }}
      </button>
    </header>

    <div class="flex-1 flex overflow-hidden">
      <!-- Middle: Main Generated Media View -->
      <main class="flex-1 flex flex-col border-r border-[#222225] bg-[#0c0c0e] min-w-0">
        
        <!-- 资源库视图 (All Resources) -->
        <div v-if="activeTab === '资源库'" class="flex-1 overflow-y-auto p-6 flex flex-col gap-6 w-full">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold tracking-widest text-zinc-300">所有库资源 ALL RESOURCES</h2>
            <div class="flex gap-2">
              <span class="text-[10px] bg-[#1f1f23] border border-[#2e2e33] text-zinc-500 px-2 py-1 rounded font-medium">角色 {{ allResources.filter(r => r.type==='角色').length }}</span>
              <span class="text-[10px] bg-[#1f1f23] border border-[#2e2e33] text-zinc-500 px-2 py-1 rounded font-medium">服饰 {{ allResources.filter(r => r.type==='服饰').length }}</span>
              <span class="text-[10px] bg-[#1f1f23] border border-[#2e2e33] text-zinc-500 px-2 py-1 rounded font-medium">场景 {{ allResources.filter(r => r.type==='场景').length }}</span>
            </div>
          </div>
          <div class="grid grid-cols-6 md:grid-cols-8 xl:grid-cols-12 gap-3">
            <div v-for="res in allResources" :key="res.id" @click="selectedImage = res.image" class="aspect-[3/4] bg-[#1a1a1d] rounded-lg border border-[#222225] overflow-hidden relative group cursor-pointer hover:border-blue-500/50 transition-colors shadow-sm hover:shadow-[0_0_15px_rgba(59,130,246,0.15)]">
              <img :src="res.image" class="w-full h-full object-cover object-center opacity-90 transition-opacity group-hover:opacity-100" />
              <div class="absolute top-2 left-2 bg-[#111]/70 backdrop-blur text-[9px] text-zinc-300 font-bold px-1.5 py-0.5 rounded shadow">{{ res.type }}</div>
            </div>
          </div>
        </div>

        <!-- 当前界面已生成的图片 (Generated Items for specific panel) -->
        <div v-else class="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          <h2 class="text-sm font-bold tracking-widest text-zinc-400">已生成资产 GENERATED ASSETS</h2>
          
          <div class="grid grid-cols-4 lg:grid-cols-8 xl:grid-cols-10 gap-3">
            
            <div v-for="item in generatedItems" :key="item.id" 
                 @click="item.status === 'done' ? selectedImage = item.image : null"
                 class="aspect-[3/4] bg-[#1a1a1d] rounded-lg border overflow-hidden relative group shadow-sm transition-all"
                 :class="item.status === 'generating' ? 'border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'border-[#222225] hover:border-blue-500/50 cursor-pointer hover:shadow-[0_0_15px_rgba(59,130,246,0.15)]'">
              
              <template v-if="item.status === 'generating'">
                 <div class="absolute inset-0 flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[#161619] to-[#0c0c0e]">
                    <div class="w-8 h-8 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin mb-3"></div>
                    <span class="text-[10px] text-blue-400 font-bold tracking-widest">GENERATING</span>
                    <div class="w-2/3 h-1 bg-[#222225] rounded-full mt-3 overflow-hidden shadow-inner">
                      <div class="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" :style="{ width: item.progress + '%' }"></div>
                    </div>
                 </div>
              </template>
              
              <template v-else>
                 <img :src="item.image" class="w-full h-full object-cover object-center opacity-90 transition-transform duration-500 group-hover:scale-[1.02] group-hover:opacity-100" />
                 <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4 pointer-events-none">
                   <span class="text-[9px] font-bold text-blue-400 tracking-wider mb-1">PROMPT</span>
                   <p class="text-[10px] text-zinc-300 line-clamp-3 leading-relaxed">{{ item.prompt }}</p>
                 </div>
                 <div class="absolute top-2 right-2 flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                   <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" class="text-white" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                 </div>
              </template>
              
            </div>

          </div>
        </div>
      </main>

      <!-- Right Sidebar: Inspector (HIDDEN ON RESOURCES TAB) -->
      <aside v-if="activeTab !== '资源库'" class="w-[340px] flex flex-col relative bg-[#141417] border-l border-[#222225] z-10 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
        
        <!-- 角色面板 -->
        <div v-if="activeTab === '角色'" class="p-6 flex-1 flex flex-col gap-6 w-full relative overflow-y-auto pb-32">
          <div class="flex items-center justify-between pb-3 border-b border-[#222225]">
            <h2 class="text-xs font-bold tracking-wider text-zinc-300">角色编辑器 INSPECTOR</h2>
            <div class="flex items-center gap-1.5 text-[9px] font-bold text-green-500 tracking-widest">
              <span class="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.8)]"></span>
              SYNCED
            </div>
          </div>

          <!-- Name -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-zinc-500">角色名称 NAME</label>
            <input type="text" value="Aria Vance" class="w-full bg-[#18181b] border border-[#2a2a30] rounded-md px-3 py-2.5 text-sm font-semibold text-zinc-200 focus:outline-none focus:border-blue-500/50 shadow-inner transition-colors" />
          </div>

          <!-- Bio Selects -->
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <label class="text-[10px] font-bold text-zinc-500">性别 GENDER</label>
              <div class="relative">
                <select class="w-full bg-[#18181b] border border-[#2a2a30] rounded-md px-3 py-2 text-sm text-zinc-300 outline-none appearance-none cursor-pointer focus:border-blue-500/50 transition-colors shadow-inner">
                  <option>女性 Female</option>
                  <option>男性 Male</option>
                </select>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[10px] font-bold text-zinc-500">民族 ETHNICITY</label>
              <div class="relative">
                <select class="w-full bg-[#18181b] border border-[#2a2a30] rounded-md px-3 py-2 text-sm text-zinc-300 outline-none appearance-none cursor-pointer focus:border-blue-500/50 transition-colors shadow-inner">
                  <option>东亚 East Asian</option>
                  <option>白人 Caucasian</option>
                  <option>黑人 Black</option>
                </select>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
          </div>

          <!-- Sliders -->
          <div class="flex flex-col gap-6 pt-2">
            <div class="flex flex-col gap-2.5">
              <div class="flex justify-between items-end">
                <label class="text-[10px] font-bold text-zinc-500">年龄估计 AGE ESTIMATION</label>
                <span class="text-xs font-bold text-blue-400">24</span>
              </div>
              <div class="relative w-full h-[3px] bg-[#2a2a30] rounded-full">
                <div class="absolute left-0 top-0 h-full bg-blue-500 rounded-full w-[25%] shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
                <div class="absolute top-1/2 left-[25%] w-3 h-3 bg-blue-400 border-[2.5px] border-[#18181b] rounded-full -translate-x-1/2 -translate-y-1/2 shadow-md cursor-pointer hover:scale-125 transition-transform"></div>
              </div>
            </div>

            <div class="flex flex-col gap-2.5">
              <div class="flex justify-between items-end">
                <label class="text-[10px] font-bold text-zinc-500">体型指数 BUILD MASS</label>
                <span class="text-xs font-bold text-blue-400">Athletic (70)</span>
              </div>
              <div class="relative w-full h-[3px] bg-[#2a2a30] rounded-full">
                <div class="absolute left-0 top-0 h-full bg-blue-500 rounded-full w-[70%] shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
                <div class="absolute top-1/2 left-[70%] w-3 h-3 bg-blue-400 border-[2.5px] border-[#18181b] rounded-full -translate-x-1/2 -translate-y-1/2 shadow-md cursor-pointer hover:scale-125 transition-transform"></div>
              </div>
            </div>
          </div>

          <div class="w-full h-px bg-[#222225] my-1"></div>

          <!-- Features -->
          <div class="flex flex-col gap-3">
            <label class="text-[10px] font-bold text-zinc-500">外貌特征 FEATURES</label>
            <div class="flex flex-wrap gap-2">
              <span v-for="feat in features" :key="feat" class="bg-[#1f1f23] border border-[#2a2a30] text-zinc-300 text-[11px] px-2.5 py-1.5 rounded shadow-sm flex items-center gap-2 group cursor-pointer hover:border-[#3a3a40] transition-colors">
                {{ feat }}
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" class="text-zinc-500 group-hover:text-zinc-300 transition-colors" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </span>
              <button class="bg-[#18181b] border border-dashed border-[#3a3a40] hover:border-blue-500/50 text-blue-500 hover:text-blue-400 text-[11px] px-2.5 py-1.5 rounded flex items-center gap-1 transition-colors">
                <span class="text-xs leading-none">+</span> 添加特征
              </button>
            </div>
          </div>

          <!-- Core Prompt -->
          <div class="flex flex-col gap-2 flex-1 relative z-0">
            <div class="flex justify-between items-center">
              <label class="text-[10px] font-bold text-zinc-500">核心提示词 CORE PROMPT</label>
              <button class="text-blue-400 hover:text-blue-300 p-1 bg-blue-500/10 rounded transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
              </button>
            </div>
            <div class="relative flex-1 min-h-[160px]">
              <textarea class="absolute inset-0 w-full h-full bg-[#18181b] border border-[#2a2a30] rounded-md p-4 text-xs leading-relaxed text-zinc-400 resize-none focus:outline-none focus:border-blue-500/50 shadow-inner font-mono transition-colors" spellcheck="false">A high-detail cinematic portrait of a cyberpunk female operative, silver hair, glowing blue cybernetic eyes, wearing a sleek matte carbon-fiber armor, urban rainy background, cinematic lighting, 8k resolution.</textarea>
            </div>
          </div>
        </div>

        <!-- 服饰面板 -->
        <div v-if="activeTab === '服饰'" class="p-6 flex-1 flex flex-col gap-6 w-full relative overflow-y-auto pb-32">
          <div class="flex items-center justify-between pb-3 border-b border-[#222225]">
            <h2 class="text-xs font-bold tracking-wider text-zinc-300">服饰编辑器 COSTUME INSPECTOR</h2>
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-zinc-500">服饰名称 OUTFIT NAME</label>
            <input type="text" value="Obsidian Operative" class="w-full bg-[#18181b] border border-[#2a2a30] rounded-md px-3 py-2.5 text-sm font-semibold text-zinc-200 focus:outline-none focus:border-blue-500/50 shadow-inner transition-colors" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-zinc-500">主材质 MATERIAL</label>
            <div class="relative">
              <select class="w-full bg-[#18181b] border border-[#2a2a30] rounded-md px-3 py-2 text-sm text-zinc-300 outline-none appearance-none cursor-pointer focus:border-blue-500/50 transition-colors shadow-inner">
                <option>碳纤维 Carbon Fiber</option>
                <option>丝绸 Silk</option>
                <option>皮革 Leather</option>
              </select>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>
          <div class="flex flex-col gap-1.5 flex-1 relative z-0">
            <label class="text-[10px] font-bold text-zinc-500">细节特征 DETAILS PROMPT</label>
            <div class="relative flex-1 min-h-[160px]">
              <textarea class="absolute inset-0 w-full h-full bg-[#18181b] border border-[#2a2a30] rounded-md p-4 text-xs leading-relaxed text-zinc-400 resize-none focus:outline-none focus:border-blue-500/50 shadow-inner font-mono transition-colors" spellcheck="false">matte black textures, integrated blue glowing fiber optics, reinforced shoulder pads...</textarea>
            </div>
          </div>
        </div>

        <!-- 场景面板 -->
        <div v-if="activeTab === '场景'" class="p-6 flex-1 flex flex-col gap-6 w-full relative overflow-y-auto pb-32">
          <div class="flex items-center justify-between pb-3 border-b border-[#222225]">
            <h2 class="text-xs font-bold tracking-wider text-zinc-300">场景编辑器 SCENE INSPECTOR</h2>
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-zinc-500">场景名称 SCENE NAME</label>
            <input type="text" value="Cyberpunk Cityscape" class="w-full bg-[#18181b] border border-[#2a2a30] rounded-md px-3 py-2.5 text-sm font-semibold text-zinc-200 focus:outline-none focus:border-blue-500/50 shadow-inner transition-colors" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-zinc-500">时间与天气 TIME & WEATHER</label>
            <div class="relative">
              <select class="w-full bg-[#18181b] border border-[#2a2a30] rounded-md px-3 py-2 text-sm text-zinc-300 outline-none appearance-none cursor-pointer focus:border-blue-500/50 transition-colors shadow-inner">
                <option>雨夜 Rainy Night</option>
                <option>黄昏 Sunset</option>
                <option>午后 Afternoon</option>
              </select>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>
          <div class="flex flex-col gap-1.5 flex-1 relative z-0">
            <label class="text-[10px] font-bold text-zinc-500">场景环境提示词 ENVIRONMENT PROMPT</label>
            <div class="relative flex-1 min-h-[160px]">
              <textarea class="absolute inset-0 w-full h-full bg-[#18181b] border border-[#2a2a30] rounded-md p-4 text-xs leading-relaxed text-zinc-400 resize-none focus:outline-none focus:border-blue-500/50 shadow-inner font-mono transition-colors" spellcheck="false">urban rainy background, neon lights reflecting on wet streets, flying cars, fog, cinematic lighting, highly detailed cityscape.</textarea>
            </div>
          </div>
        </div>

        <!-- Action Buttons Fixed Bottom Right -->
        <div class="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#141417] via-[#141417] to-transparent pointer-events-none">
          <div class="p-1 border-2 border-dashed border-[#2b3a5e] rounded-xl pointer-events-auto bg-[#141417]/80 backdrop-blur">
            <div class="flex gap-2 w-full">
              <button class="flex-1 bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] font-bold text-sm py-3 rounded-lg transition-all active:scale-[0.98]">现在生成</button>
              <button class="w-[88px] shrink-0 bg-transparent border border-[#3a3a40] text-zinc-300 hover:bg-[#1f1f23] font-medium text-sm py-3 rounded-lg transition-colors active:scale-[0.98]">取消</button>
            </div>
          </div>
        </div>
      </aside>

    </div>

    <!-- Image Lightbox Modal -->
    <transition name="fade">
      <div v-if="selectedImage" class="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/90 backdrop-blur-md cursor-zoom-out" @click="selectedImage = null">
        <!-- Close Button -->
        <button class="absolute top-6 right-6 text-white/50 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
        <img :src="selectedImage" @click.stop="selectedImage = null" class="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl ring-1 ring-white/10" />
      </div>
    </transition>
  </div>
</template>
