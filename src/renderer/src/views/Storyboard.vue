<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Search, X } from 'lucide-vue-next'
import { mediaApi, storyboardApi } from '../api/media'
import { useDialog } from '../composables/useDialog'
import type { MediaAsset, StoryboardAsset } from '../types/media'

type AssetBucket = 'role' | 'costume' | 'scene'

const dialog = useDialog()
const storyboards = ref<StoryboardAsset[]>([])
const selectedStoryboard = ref<StoryboardAsset | null>(null)
const assets = ref<MediaAsset[]>([])
const outputDir = ref('')
const isLoading = ref(false)
const isCreating = ref(false)
const isGenerating = ref(false)

const newStoryboardName = ref('')
const newShotCount = ref(3)
const storyboardSearchQuery = ref('')
const currentShotIndex = ref(1)
const shotPrompt = ref('')
const selectedRolePaths = ref<string[]>([])
const selectedCostumePaths = ref<string[]>([])
const selectedScenePaths = ref<string[]>([])
const pickerType = ref<AssetBucket | null>(null)

const MAX_REFERENCE_ASSETS = 5

const roleAssets = computed(() => assets.value.filter(asset => asset.type === 'role'))
const costumeAssets = computed(() => assets.value.filter(asset => asset.type === 'costume'))
const sceneAssets = computed(() => assets.value.filter(asset => asset.type === 'scene'))
const currentShot = computed(() => selectedStoryboard.value?.shots.find(shot => shot.index === currentShotIndex.value))
const selectedTotal = computed(() => selectedRolePaths.value.length + selectedCostumePaths.value.length + selectedScenePaths.value.length)
const filteredStoryboards = computed(() => {
  const query = storyboardSearchQuery.value.trim().toLowerCase()
  if (!query) return storyboards.value
  return storyboards.value.filter(storyboard => storyboard.name.toLowerCase().includes(query))
})

const formatDate = (timestamp: number) => new Date(timestamp).toLocaleString('zh-CN', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

const assetNameFromPath = (assetPath: string) => assetPath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') || assetPath

const assetListFor = (type: AssetBucket) => {
  if (type === 'role') return roleAssets.value
  if (type === 'costume') return costumeAssets.value
  return sceneAssets.value
}

const selectedPathsFor = (type: AssetBucket) => {
  if (type === 'role') return selectedRolePaths.value
  if (type === 'costume') return selectedCostumePaths.value
  return selectedScenePaths.value
}

const setSelectedPathsFor = (type: AssetBucket, value: string[]) => {
  if (type === 'role') selectedRolePaths.value = value
  else if (type === 'costume') selectedCostumePaths.value = value
  else selectedScenePaths.value = value
}

const selectedAssetsFor = (type: AssetBucket) => {
  const source = assetListFor(type)
  return selectedPathsFor(type).map(assetPath => {
    const asset = source.find(item => item.path === assetPath)
    return asset || {
      id: assetPath,
      name: assetNameFromPath(assetPath),
      path: assetPath,
      type,
      thumbnail: '',
      size: 0,
      createdAt: 0,
      modifiedAt: 0,
      status: 'ready' as const
    }
  })
}

const pickerAssets = computed(() => pickerType.value ? assetListFor(pickerType.value) : [])
const pickerTitle = computed(() => {
  if (pickerType.value === 'role') return '选择角色资产'
  if (pickerType.value === 'costume') return '选择服饰资产'
  if (pickerType.value === 'scene') return '选择场景资产'
  return '选择资产'
})

const loadAll = async () => {
  isLoading.value = true
  try {
    outputDir.value = await mediaApi.getOutputDirectory()
    const [assetList, storyboardList] = await Promise.all([
      mediaApi.scanDirectory(outputDir.value),
      storyboardApi.scan()
    ])
    assets.value = assetList.filter(asset => asset.type === 'role' || asset.type === 'costume' || asset.type === 'scene')
    storyboards.value = storyboardList
    if (selectedStoryboard.value) {
      const refreshed = storyboardList.find(item => item.id === selectedStoryboard.value?.id)
      selectedStoryboard.value = refreshed || null
    }
  } finally {
    isLoading.value = false
  }
}

const createStoryboard = async () => {
  if (!newStoryboardName.value.trim()) {
    await dialog.error('请输入分镜头名称。')
    return
  }
  isCreating.value = true
  try {
    const storyboard = await storyboardApi.create({
      name: newStoryboardName.value.trim(),
      shotCount: newShotCount.value
    })
    storyboards.value.unshift(storyboard)
    selectedStoryboard.value = storyboard
    currentShotIndex.value = 1
    shotPrompt.value = ''
    selectedRolePaths.value = []
    selectedCostumePaths.value = []
    selectedScenePaths.value = []
    newStoryboardName.value = ''
  } finally {
    isCreating.value = false
  }
}

const openStoryboard = async (storyboard: StoryboardAsset) => {
  const fresh = await storyboardApi.get(storyboard.id)
  selectedStoryboard.value = fresh || storyboard
  currentShotIndex.value = 1
  loadShotForm()
}

const backToList = async () => {
  selectedStoryboard.value = null
  await loadAll()
}

const normalizeShotPaths = (paths?: string[], legacyPath?: string) => {
  const list = Array.isArray(paths) ? paths.filter(Boolean) : []
  return list.length ? Array.from(new Set(list)) : legacyPath ? [legacyPath] : []
}

const loadShotForm = () => {
  const shot = currentShot.value
  shotPrompt.value = shot?.prompt || ''
  selectedRolePaths.value = normalizeShotPaths(shot?.roleAssetPaths, shot?.roleAssetPath)
  selectedCostumePaths.value = normalizeShotPaths(shot?.costumeAssetPaths, shot?.costumeAssetPath)
  selectedScenePaths.value = normalizeShotPaths(shot?.sceneAssetPaths, shot?.sceneAssetPath)
}

const selectShot = (index: number) => {
  currentShotIndex.value = index
  loadShotForm()
}

const handleShotIndexChange = () => {
  loadShotForm()
}

const openAssetPicker = (type: AssetBucket) => {
  pickerType.value = type
}

const closeAssetPicker = () => {
  pickerType.value = null
}

const isSelected = (type: AssetBucket | null, assetPath: string) => type ? selectedPathsFor(type).includes(assetPath) : false

const toggleAsset = async (asset: MediaAsset) => {
  if (!pickerType.value) return
  const type = pickerType.value
  const paths = selectedPathsFor(type)
  if (paths.includes(asset.path)) {
    setSelectedPathsFor(type, paths.filter(item => item !== asset.path))
    return
  }
  if (selectedTotal.value >= MAX_REFERENCE_ASSETS) {
    await dialog.notify(`每张分镜图最多选择 ${MAX_REFERENCE_ASSETS} 张参考资产。`)
    return
  }
  setSelectedPathsFor(type, [...paths, asset.path])
}

const removeSelectedAsset = (type: AssetBucket, assetPath: string) => {
  setSelectedPathsFor(type, selectedPathsFor(type).filter(item => item !== assetPath))
}

const generateCurrentShot = async () => {
  if (!selectedStoryboard.value) return
  if (!shotPrompt.value.trim()) {
    await dialog.error('请输入当前图片的提示词。')
    return
  }
  isGenerating.value = true
  try {
    const updated = await storyboardApi.generateShot({
      storyboardId: selectedStoryboard.value.id,
      shotIndex: currentShotIndex.value,
      prompt: shotPrompt.value.trim(),
      roleAssetPaths: [...selectedRolePaths.value],
      costumeAssetPaths: [...selectedCostumePaths.value],
      sceneAssetPaths: [...selectedScenePaths.value]
    })
    selectedStoryboard.value = updated
    const index = storyboards.value.findIndex(item => item.id === updated.id)
    if (index >= 0) storyboards.value[index] = updated
    loadShotForm()
  } catch (error: any) {
    await dialog.error(error?.message || '生成分镜图片失败。')
  } finally {
    isGenerating.value = false
  }
}

const deleteStoryboard = async (storyboard: StoryboardAsset) => {
  const ok = await dialog.confirm(`删除分镜头「${storyboard.name}」？`, '删除分镜头', '删除')
  if (!ok) return
  await storyboardApi.delete(storyboard.id)
  if (selectedStoryboard.value?.id === storyboard.id) selectedStoryboard.value = null
  await loadAll()
}

onMounted(loadAll)
</script>

<template>
  <div class="h-full overflow-hidden flex flex-col" style="background-color: var(--bg-primary); color: var(--text-primary);">
    <header class="h-16 shrink-0 border-b flex items-center justify-between px-8" style="border-color: var(--border-color);">
      <div>
        <h2 class="text-xl font-bold">分镜 Storyboard</h2>
        <p class="text-xs" style="color: var(--text-tertiary);">使用资产库里的角色、服饰、场景生成连续分镜图片</p>
      </div>
      <button v-if="selectedStoryboard" class="px-4 py-2 rounded-lg border text-sm" style="border-color: var(--border-color);" @click="backToList">返回列表</button>
      <button v-else class="px-4 py-2 rounded-lg border text-sm" style="border-color: var(--border-color);" @click="loadAll">刷新</button>
    </header>

    <main v-if="!selectedStoryboard" class="flex-1 overflow-auto p-8 space-y-6">
      <section class="rounded-lg p-4 grid grid-cols-1 md:grid-cols-[1fr_160px_auto] gap-3 items-end" style="background-color: var(--bg-card); border: 1px solid var(--border-color);">
        <div>
          <label class="block text-xs font-bold mb-1" style="color: var(--text-tertiary);">分镜头名称</label>
          <input v-model="newStoryboardName" class="w-full rounded-lg px-3 py-2" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);" placeholder="例如：第一场 夜雨追逐" />
        </div>
        <div>
          <label class="block text-xs font-bold mb-1" style="color: var(--text-tertiary);">图片数量</label>
          <select v-model.number="newShotCount" class="w-full rounded-lg px-3 py-2" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);">
            <option v-for="count in [3,4,5,6,7,8,9]" :key="count" :value="count">{{ count }} 张</option>
          </select>
        </div>
        <button class="px-5 py-2 rounded-lg text-white disabled:opacity-60" style="background-color: var(--accent-color);" :disabled="isCreating" @click="createStoryboard">
          {{ isCreating ? '创建中...' : '新建分镜' }}
        </button>
      </section>

      <section class="flex items-center gap-3">
        <div class="relative flex-1">
          <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none" style="color: var(--text-tertiary);" />
          <input v-model="storyboardSearchQuery" class="w-full rounded-lg pl-9 pr-9 py-2 text-sm" style="background-color: var(--bg-card); border: 1px solid var(--border-color);" placeholder="搜索分镜头名称..." />
          <button v-if="storyboardSearchQuery" class="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 rounded-md flex items-center justify-center" style="color: var(--text-tertiary);" title="清空搜索" @click="storyboardSearchQuery = ''">
            <X class="h-4 w-4" />
          </button>
        </div>
        <span class="rounded-md border px-3 py-2 text-xs whitespace-nowrap" style="border-color: var(--border-color); color: var(--text-tertiary);">
          {{ filteredStoryboards.length }}/{{ storyboards.length }}
        </span>
      </section>

      <section v-if="filteredStoryboards.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <article v-for="storyboard in filteredStoryboards" :key="storyboard.id" class="rounded-lg overflow-hidden group" style="background-color: var(--bg-card); border: 1px solid var(--border-color);">
          <button class="block w-full text-left" @click="openStoryboard(storyboard)">
            <div class="aspect-video bg-black/20 flex items-center justify-center overflow-hidden">
              <img v-if="storyboard.thumbnail" :src="storyboard.thumbnail" class="w-full h-full object-cover" />
              <span v-else class="text-xs" style="color: var(--text-tertiary);">暂无图片</span>
            </div>
            <div class="p-3">
              <div class="font-semibold truncate">{{ storyboard.name }}</div>
              <div class="mt-1 flex justify-between text-xs" style="color: var(--text-tertiary);">
                <span>{{ storyboard.completedCount }}/{{ storyboard.shotCount }} 张</span>
                <span>{{ formatDate(storyboard.createdAt) }}</span>
              </div>
            </div>
          </button>
          <button class="mx-3 mb-3 text-xs text-red-400 hover:text-red-300" @click="deleteStoryboard(storyboard)">删除</button>
        </article>
      </section>

      <div v-else class="h-64 rounded-lg flex items-center justify-center text-sm" style="background-color: var(--bg-card); border: 1px dashed var(--border-color); color: var(--text-tertiary);">
        {{ isLoading ? '加载中...' : storyboards.length ? '未找到匹配分镜头' : '暂无分镜头资产' }}
      </div>
    </main>

    <main v-else class="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_420px]">
      <section class="overflow-auto p-6">
        <div class="mb-4">
          <h3 class="text-lg font-bold">{{ selectedStoryboard.name }}</h3>
          <p class="text-xs" style="color: var(--text-tertiary);">{{ selectedStoryboard.completedCount }}/{{ selectedStoryboard.shotCount }} 张已完成</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <button
            v-for="shot in selectedStoryboard.shots"
            :key="shot.index"
            class="aspect-video rounded-lg overflow-hidden border text-left relative"
            :style="shot.index === currentShotIndex ? 'border-color: var(--accent-color);' : 'border-color: var(--border-color);'"
            @click="selectShot(shot.index)"
          >
            <img v-if="shot.thumbnail" :src="shot.thumbnail" class="w-full h-full object-cover" />
            <div v-else class="w-full h-full flex items-center justify-center" style="background-color: var(--bg-card); color: var(--text-tertiary);">
              {{ shot.status === 'failed' ? '生成失败' : '等待生成' }}
            </div>
            <div class="absolute left-2 top-2 px-2 py-1 rounded bg-black/70 text-white text-xs font-bold">#{{ shot.index }}</div>
          </button>
        </div>
      </section>

      <aside class="border-l p-5 overflow-auto space-y-5" style="background-color: var(--bg-secondary); border-color: var(--border-color);">
        <div>
          <label class="block text-xs font-bold mb-1" style="color: var(--text-tertiary);">当前图片序号</label>
          <select v-model.number="currentShotIndex" class="w-full rounded-lg px-3 py-2" style="background-color: var(--bg-card); border: 1px solid var(--border-color);" @change="handleShotIndexChange">
            <option v-for="shot in selectedStoryboard.shots" :key="shot.index" :value="shot.index">第 {{ shot.index }} 张</option>
          </select>
        </div>

        <div class="space-y-4">
          <section v-for="type in (['role', 'costume', 'scene'] as AssetBucket[])" :key="type" class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold" style="color: var(--text-tertiary);">
                {{ type === 'role' ? '角色' : type === 'costume' ? '服饰' : '场景' }}
                <span class="ml-1 font-mono">{{ selectedPathsFor(type).length }}</span>
              </label>
              <button class="rounded-md border px-2 py-1 text-xs" style="border-color: var(--border-color);" @click="openAssetPicker(type)">
                添加
              </button>
            </div>
            <div v-if="selectedAssetsFor(type).length" class="grid grid-cols-2 gap-2">
              <div v-for="asset in selectedAssetsFor(type)" :key="asset.path" class="rounded-md overflow-hidden border relative group" style="border-color: var(--border-color); background-color: var(--bg-card);">
                <div class="aspect-[4/3] bg-white/95">
                  <img v-if="asset.thumbnail" :src="asset.thumbnail" class="w-full h-full object-contain" />
                </div>
                <div class="px-1.5 py-1 text-[10px] truncate" :title="asset.name">{{ asset.name }}</div>
                <button class="absolute right-1 top-1 h-5 w-5 rounded bg-black/70 text-white opacity-0 group-hover:opacity-100" @click="removeSelectedAsset(type, asset.path)">x</button>
              </div>
            </div>
            <div v-else class="rounded-md border border-dashed px-3 py-3 text-xs" style="border-color: var(--border-color); color: var(--text-tertiary);">
              未选择{{ type === 'role' ? '角色' : type === 'costume' ? '服饰' : '场景' }}
            </div>
          </section>
          <p class="text-[10px]" style="color: var(--text-tertiary);">参考资产总数 {{ selectedTotal }}/{{ MAX_REFERENCE_ASSETS }}</p>
        </div>

        <div>
          <label class="block text-xs font-bold mb-1" style="color: var(--text-tertiary);">提示词</label>
          <textarea v-model="shotPrompt" rows="7" class="w-full rounded-lg px-3 py-2 resize-none" style="background-color: var(--bg-card); border: 1px solid var(--border-color);" placeholder="描述这一张分镜图的镜头、动作、氛围、构图..." />
        </div>

        <button class="w-full rounded-lg py-3 text-white font-semibold disabled:opacity-60" style="background-color: var(--accent-color);" :disabled="isGenerating" @click="generateCurrentShot">
          {{ isGenerating ? '生成中...' : `生成第 ${currentShotIndex} 张` }}
        </button>
      </aside>
    </main>

    <Teleport to="body">
      <div v-if="pickerType" class="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex flex-col" @click.self="closeAssetPicker">
        <div class="h-20 shrink-0 border-b flex items-center justify-between px-8" style="background-color: var(--bg-secondary); border-color: var(--border-color); color: var(--text-primary);">
          <div>
            <h3 class="text-lg font-bold">{{ pickerTitle }}</h3>
            <p class="text-xs" style="color: var(--text-tertiary);">已选 {{ selectedTotal }}/{{ MAX_REFERENCE_ASSETS }} 张，点击图片添加或取消</p>
          </div>
          <button class="h-10 w-10 rounded-md text-xl" style="background-color: var(--bg-card);" @click="closeAssetPicker">×</button>
        </div>
        <div class="flex-1 overflow-auto p-8" style="background-color: var(--bg-primary);">
          <div v-if="pickerAssets.length" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-7 gap-5">
            <button
              v-for="asset in pickerAssets"
              :key="asset.path"
              class="aspect-[4/3] rounded-lg overflow-hidden border-2 relative text-left group bg-white/95"
              :class="isSelected(pickerType, asset.path) ? 'border-blue-500' : 'border-transparent hover:border-blue-500/70'"
              :disabled="selectedTotal >= MAX_REFERENCE_ASSETS && !isSelected(pickerType, asset.path)"
              @click="toggleAsset(asset)"
            >
              <img :src="asset.thumbnail" class="h-full w-full object-contain" :class="selectedTotal >= MAX_REFERENCE_ASSETS && !isSelected(pickerType, asset.path) ? 'opacity-40' : 'opacity-90 group-hover:opacity-100'" />
              <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2 pt-8">
                <p class="truncate text-xs font-bold text-white">{{ asset.name }}</p>
              </div>
              <div v-if="isSelected(pickerType, asset.path)" class="absolute right-2 top-2 h-6 w-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm">✓</div>
            </button>
          </div>
          <div v-else class="h-64 flex items-center justify-center text-sm" style="color: var(--text-tertiary);">
            当前分类暂无可选资产
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
