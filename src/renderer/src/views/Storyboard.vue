<script setup lang="ts">
import { computed, onActivated, onMounted, onUnmounted, ref } from 'vue'
import {
  ChevronDown,
  GripVertical,
  ImagePlus,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Wand2
} from 'lucide-vue-next'
import { mediaApi, storyboardApi, storeApi } from '../api/media'
import { useDialog } from '../composables/useDialog'
import type { MediaAsset, StoryboardAsset, StoryboardShot } from '../types/media'
import { formatImageGenerationError, formatStoryboardError } from '../utils/errorMessages'

type ShotRow = StoryboardShot & {
  clientId: string
  no: number
  content: string
  lens: string
  move: string
  actor: string
}

const dialog = useDialog()
const ASSET_LIBRARY_CHANGED_EVENT = 'cinecho:asset-library-changed'

const lensOptions = ['远景', '全景', '中景', '近景', '特写', '大特写']
const moveOptions = ['固定', '推镜', '拉镜', '摇镜', '移镜', '跟拍', '环绕', '手持']

const storyboards = ref<StoryboardAsset[]>([])
const assets = ref<MediaAsset[]>([])
const currentStoryboard = ref<StoryboardAsset | null>(null)
const shots = ref<ShotRow[]>([])
const storyboardName = ref('')
const selectedStoryboardId = ref('')
const isLoading = ref(false)
const isSaving = ref(false)
const saveState = ref<'idle' | 'saved' | 'error'>('idle')
const generatingShotIndex = ref<number | null>(null)
const previewImage = ref<string | null>(null)
const draggingClientId = ref('')
let saveTimer: number | undefined

const completedCount = computed(() => shots.value.filter(shot => Boolean(shot.imagePath)).length)
const hasStoryboard = computed(() => Boolean(currentStoryboard.value))
const canGenerateAll = computed(() => hasStoryboard.value && shots.value.some(shot => buildShotPrompt(shot).trim()))
const roleAssets = computed(() => assets.value.filter(asset => asset.type === 'role'))
const costumeAssets = computed(() => assets.value.filter(asset => asset.type === 'costume'))
const sceneAssets = computed(() => assets.value.filter(asset => asset.type === 'scene'))
const statusText = computed(() => {
  if (isSaving.value) return '保存中'
  if (saveState.value === 'saved') return '已保存'
  if (saveState.value === 'error') return '保存失败'
  return '待编辑'
})

const toShotRows = (asset: StoryboardAsset): ShotRow[] => {
  return asset.shots.map((shot, index) => {
    const content = shot.content ?? shot.prompt ?? ''
    return {
      ...shot,
      clientId: `${asset.id}-${shot.index}-${shot.updatedAt || index}`,
      no: index + 1,
      index: index + 1,
      status: shot.status || 'ready',
      prompt: shot.prompt || content,
      content,
      lens: shot.lens || '中景',
      move: shot.move || '固定',
      actor: shot.actor || ''
    }
  })
}

const serializeShots = (): StoryboardShot[] => {
  const cleanPathList = (paths?: string[]) => Array.isArray(paths) ? paths.filter(Boolean).map(String) : undefined

  return shots.value.map((shot, index) => ({
    index: index + 1,
    status: shot.status === 'generating' ? 'generating' : shot.status === 'failed' ? 'failed' : 'ready',
    prompt: String(shot.content || ''),
    content: String(shot.content || ''),
    lens: String(shot.lens || '中景'),
    move: String(shot.move || '固定'),
    actor: String(shot.actor || ''),
    imagePath: shot.imagePath ? String(shot.imagePath) : undefined,
    imageUrl: shot.imageUrl ? String(shot.imageUrl) : undefined,
    sourceImageUrl: shot.sourceImageUrl ? String(shot.sourceImageUrl) : undefined,
    thumbnail: shot.thumbnail ? String(shot.thumbnail) : undefined,
    roleAssetPath: shot.roleAssetPath ? String(shot.roleAssetPath) : undefined,
    costumeAssetPath: shot.costumeAssetPath ? String(shot.costumeAssetPath) : undefined,
    sceneAssetPath: shot.sceneAssetPath ? String(shot.sceneAssetPath) : undefined,
    roleAssetPaths: cleanPathList(shot.roleAssetPaths),
    costumeAssetPaths: cleanPathList(shot.costumeAssetPaths),
    sceneAssetPaths: cleanPathList(shot.sceneAssetPaths),
    updatedAt: typeof shot.updatedAt === 'number' ? shot.updatedAt : undefined,
    error: shot.error ? String(shot.error) : undefined
  }))
}

const applyStoryboard = (asset: StoryboardAsset | null) => {
  currentStoryboard.value = asset
  selectedStoryboardId.value = asset?.id || ''
  storyboardName.value = asset?.name || ''
  shots.value = asset ? toShotRows(asset) : []
  saveState.value = asset ? 'saved' : 'idle'
}

const loadStoryboards = async () => {
  isLoading.value = true
  try {
    const items = await storyboardApi.scan()
    storyboards.value = items
    const preferred = selectedStoryboardId.value
      ? items.find(item => item.id === selectedStoryboardId.value)
      : items[0]
    applyStoryboard(preferred || null)
  } catch (error: any) {
    console.error('[Storyboard] load failed:', error)
    await dialog.error(formatStoryboardError(error?.message, '加载'))
  } finally {
    isLoading.value = false
  }
}

const loadAssets = async () => {
  try {
    const dir = await mediaApi.getOutputDirectory()
    assets.value = await mediaApi.scanDirectory(dir)
  } catch (error) {
    console.error('[Storyboard] load assets failed:', error)
    assets.value = []
  }
}

const refreshAll = async () => {
  await Promise.all([
    loadStoryboards(),
    loadAssets()
  ])
}

const handleAssetLibraryChanged = () => {
  void loadAssets()
}

const refreshCurrentStoryboard = async (asset?: StoryboardAsset) => {
  const next = asset || (currentStoryboard.value ? await storyboardApi.get(currentStoryboard.value.id) : null)
  if (!next) {
    await loadStoryboards()
    return
  }
  const listIndex = storyboards.value.findIndex(item => item.id === next.id)
  if (listIndex >= 0) {
    storyboards.value.splice(listIndex, 1, next)
  } else {
    storyboards.value.unshift(next)
  }
  applyStoryboard(next)
}

const saveStoryboardNow = async () => {
  if (!currentStoryboard.value) return
  if (saveTimer) window.clearTimeout(saveTimer)
  isSaving.value = true
  try {
    const updated = await storyboardApi.update({
      storyboardId: currentStoryboard.value.id,
      name: storyboardName.value.trim() || currentStoryboard.value.name,
      shots: serializeShots()
    })
    await refreshCurrentStoryboard(updated)
    saveState.value = 'saved'
  } catch (error: any) {
    console.error('[Storyboard] save failed:', error)
    saveState.value = 'error'
    await dialog.error(formatStoryboardError(error?.message, '保存'))
  } finally {
    isSaving.value = false
  }
}

const scheduleSave = () => {
  if (!currentStoryboard.value) return
  saveState.value = 'idle'
  if (saveTimer) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    void saveStoryboardNow()
  }, 600)
}

const handleDeleteStoryboard = async () => {
  if (!currentStoryboard.value) return
  const ok = await dialog.confirm(
    `确定删除分镜脚本「${currentStoryboard.value.name}」吗？此操作不可撤销。`,
    '删除分镜脚本',
    '删除'
  )
  if (!ok) return
  isLoading.value = true
  try {
    await storyboardApi.delete(currentStoryboard.value.id)
    storyboards.value = storyboards.value.filter(item => item.id !== currentStoryboard.value!.id)
    applyStoryboard(storyboards.value[0] || null)
  } catch (error: any) {
    console.error('[Storyboard] delete failed:', error)
    await dialog.error(formatStoryboardError(error?.message, '删除'))
  } finally {
    isLoading.value = false
  }
}

const handleCreateStoryboard = async () => {
  isLoading.value = true
  try {
    const name = `分镜 ${storyboards.value.length + 1}`
    const created = await storyboardApi.create({ name, shotCount: 4 })
    storyboards.value.unshift(created)
    applyStoryboard(created)
  } catch (error: any) {
    console.error('[Storyboard] create failed:', error)
    await dialog.error(formatStoryboardError(error?.message, '创建'))
  } finally {
    isLoading.value = false
  }
}

const handleSelectStoryboard = async (storyboardId: string) => {
  if (!storyboardId) return
  const found = storyboards.value.find(item => item.id === storyboardId)
  if (found) applyStoryboard(found)
  const latest = await storyboardApi.get(storyboardId)
  if (latest) await refreshCurrentStoryboard(latest)
}

const addShot = async () => {
  if (!currentStoryboard.value) {
    await handleCreateStoryboard()
    return
  }
  const nextNo = shots.value.length + 1
  shots.value.push({
    clientId: `local-${Date.now()}`,
    no: nextNo,
    index: nextNo,
    status: 'ready',
    prompt: '',
    content: '',
    lens: '中景',
    move: '固定',
    actor: ''
  })
  await saveStoryboardNow()
}

const removeShot = async (shot: ShotRow) => {
  if (!currentStoryboard.value) return
  if (shots.value.length <= 1) {
    await dialog.error('至少保留一个镜头。')
    return
  }
  const ok = await dialog.confirm(`确定删除镜头 ${shot.no} 吗？`, '删除镜头', '删除')
  if (!ok) return
  shots.value = shots.value
    .filter(item => item.clientId !== shot.clientId)
    .map((item, index) => ({ ...item, no: index + 1, index: index + 1 }))
  await saveStoryboardNow()
}

const updateShotField = (shot: ShotRow, field: 'content' | 'lens' | 'move' | 'actor', value: string) => {
  shot[field] = value
  if (field === 'content') shot.prompt = value
  scheduleSave()
}

const basenameWithoutExt = (filePath?: string) => {
  if (!filePath) return ''
  return (filePath.split(/[\\/]/).pop() || filePath).replace(/\.[^.]+$/, '')
}

const findAssetByPath = (filePath?: string) => {
  if (!filePath) return undefined
  return assets.value.find(asset => asset.path === filePath)
}

const getAssetName = (filePath?: string) => {
  return findAssetByPath(filePath)?.name || basenameWithoutExt(filePath)
}

const updateShotAsset = (shot: ShotRow, type: 'role' | 'costume' | 'scene', value: string) => {
  const asset = findAssetByPath(value)
  if (type === 'role') {
    shot.roleAssetPath = value || undefined
    shot.roleAssetPaths = value ? [value] : []
    shot.actor = asset?.name || ''
  } else if (type === 'costume') {
    shot.costumeAssetPath = value || undefined
    shot.costumeAssetPaths = value ? [value] : []
  } else {
    shot.sceneAssetPath = value || undefined
    shot.sceneAssetPaths = value ? [value] : []
  }
  scheduleSave()
}

const moveShot = async (fromIndex: number, toIndex: number) => {
  if (toIndex < 0 || toIndex >= shots.value.length || fromIndex === toIndex) return
  const next = [...shots.value]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  shots.value = next.map((shot, index) => ({ ...shot, no: index + 1, index: index + 1 }))
  await saveStoryboardNow()
}

const handleDragStart = (shot: ShotRow, event: DragEvent) => {
  draggingClientId.value = shot.clientId
  event.dataTransfer?.setData('text/plain', shot.clientId)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

const handleDrop = async (target: ShotRow) => {
  const fromIndex = shots.value.findIndex(shot => shot.clientId === draggingClientId.value)
  const toIndex = shots.value.findIndex(shot => shot.clientId === target.clientId)
  draggingClientId.value = ''
  await moveShot(fromIndex, toIndex)
}

const checkApiKey = async () => {
  const data = await storeApi.get()
  const configured = Boolean(data.settings?.apiKey?.trim?.() || data.settings?.apiKeyConfigured || data.settings?.apiKeysConfigured?.ark)
  if (!configured) {
    await dialog.error('API Key 未配置，请先在 Settings 页面配置有效的 API Key。')
    return false
  }
  return true
}

const buildShotPrompt = (shot: ShotRow) => {
  const hasCreativeInput = Boolean(shot.content.trim())

  const details = [
    shot.content.trim(),
    hasCreativeInput && shot.lens ? `shot size: ${shot.lens}` : '',
    hasCreativeInput && shot.move ? `camera movement: ${shot.move}` : ''
  ].filter(Boolean)
  return details.join(', ')
}

const handleGenerateShot = async (shot: ShotRow) => {
  if (!currentStoryboard.value) return
  const prompt = buildShotPrompt(shot)
  if (!prompt.trim()) {
    await dialog.error('请先填写镜头内容，再生成画面。')
    return
  }
  if (!await checkApiKey()) return

  generatingShotIndex.value = shot.no
  shot.status = 'generating'
  try {
    await saveStoryboardNow()
    const updated = await storyboardApi.generateShot({
      storyboardId: currentStoryboard.value.id,
      shotIndex: shot.no,
      prompt,
      roleAssetPath: shot.roleAssetPath,
      costumeAssetPath: shot.costumeAssetPath,
      sceneAssetPath: shot.sceneAssetPath,
      roleAssetPaths: shot.roleAssetPath ? [shot.roleAssetPath] : [],
      costumeAssetPaths: shot.costumeAssetPath ? [shot.costumeAssetPath] : [],
      sceneAssetPaths: shot.sceneAssetPath ? [shot.sceneAssetPath] : []
    })
    await refreshCurrentStoryboard(updated)
  } catch (error: any) {
    console.error('[Storyboard] generate shot failed:', error)
    await dialog.error(formatImageGenerationError(error?.message))
    await refreshCurrentStoryboard()
  } finally {
    generatingShotIndex.value = null
  }
}

const generateAllShots = async () => {
  if (!canGenerateAll.value) return
  for (const shot of shots.value) {
    if (!buildShotPrompt(shot).trim()) continue
    await handleGenerateShot(shot)
  }
}

const openPreview = (shot: ShotRow) => {
  const image = shot.thumbnail || shot.imageUrl || ''
  if (image) previewImage.value = image
}

const closePreview = () => {
  previewImage.value = null
}

const shotStatusLabel = (shot: ShotRow) => {
  if (generatingShotIndex.value === shot.no || shot.status === 'generating') return '生成中'
  if (shot.status === 'failed') return '失败'
  if (shot.imagePath) return '已生成'
  return '待生成'
}

let hasActivatedOnce = false

onMounted(() => {
  window.addEventListener(ASSET_LIBRARY_CHANGED_EVENT, handleAssetLibraryChanged)
  void loadStoryboards()
  void loadAssets()
})

onActivated(() => {
  if (hasActivatedOnce) {
    void loadAssets()
  }
  hasActivatedOnce = true
})

onUnmounted(() => {
  window.removeEventListener(ASSET_LIBRARY_CHANGED_EVENT, handleAssetLibraryChanged)
})
</script>

<template>
  <div class="h-full overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)]">
    <main class="flex h-full flex-col overflow-hidden">
      <section class="shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] px-6 py-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--text-tertiary)]">
              Storyboard Console
            </p>
            <h2 class="mt-2 text-lg font-bold tracking-wider text-[var(--text-secondary)]">
              制作分镜 STORYBOARD EDITOR
            </h2>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <div class="select-wrap w-64">
              <select
                v-model="selectedStoryboardId"
                class="native-select"
                :disabled="isLoading || storyboards.length === 0"
                @change="handleSelectStoryboard(selectedStoryboardId)"
              >
                <option value="" disabled>{{ storyboards.length ? '选择分镜' : '暂无分镜' }}</option>
                <option v-for="item in storyboards" :key="item.id" :value="item.id">
                  {{ item.name }} · {{ item.completedCount }}/{{ item.shotCount }}
                </option>
              </select>
              <ChevronDown class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
            </div>

            <button
              class="toolbar-button danger-button"
              type="button"
              title="删除当前分镜脚本"
              :disabled="isLoading || !hasStoryboard"
              @click="handleDeleteStoryboard"
            >
              <Trash2 class="h-4 w-4" />
              <span>删除脚本</span>
            </button>

            <button class="toolbar-button" type="button" title="刷新" :disabled="isLoading" @click="refreshAll">
              <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isLoading }" />
              <span>刷新</span>
            </button>

            <button class="primary-button" type="button" title="新建分镜" :disabled="isLoading" @click="handleCreateStoryboard">
              <Plus class="h-4 w-4" />
              <span>新建</span>
            </button>
          </div>
        </div>
      </section>

      <section class="min-h-0 flex-1 overflow-hidden px-6 py-5">
        <div class="panel-shell h-full overflow-hidden rounded-xl border border-[var(--border-color)]">
          <div class="panel-topbar">
            <div class="min-w-0 flex flex-wrap items-center gap-3">
              <div>
                <p class="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--text-tertiary)]">
                  Shot Table
                </p>
              </div>
              <input
                v-if="hasStoryboard"
                class="name-input"
                type="text"
                :value="storyboardName"
                aria-label="分镜名称"
                @input="event => { storyboardName = (event.target as HTMLInputElement).value; scheduleSave() }"
              />
            </div>
            <div class="flex flex-wrap items-center gap-2 text-[10px] text-[var(--text-tertiary)]">
              <span class="metric-pill">{{ shots.length }} shots</span>
              <span class="metric-pill">{{ completedCount }} images</span>
              <span class="metric-pill">{{ statusText }}</span>
              <button class="toolbar-button h-8" type="button" :disabled="!hasStoryboard || isSaving" @click="saveStoryboardNow">
                <Save class="h-4 w-4" />
                <span>保存</span>
              </button>
              <button class="toolbar-button h-8" type="button" :disabled="!hasStoryboard" @click="addShot">
                <Plus class="h-4 w-4" />
                <span>添加镜头</span>
              </button>
              <button class="primary-button h-8" type="button" :disabled="!canGenerateAll || generatingShotIndex !== null" @click="generateAllShots">
                <Wand2 class="h-4 w-4" />
                <span>生成全部</span>
              </button>
            </div>
          </div>

          <div v-if="!hasStoryboard" class="grid h-[calc(100%-72px)] place-items-center px-6 text-center">
            <div class="max-w-sm">
              <p class="text-sm font-bold text-[var(--text-secondary)]">还没有分镜</p>
              <p class="mt-2 text-xs leading-6 text-[var(--text-tertiary)]">
                点击右上角新建分镜后，就可以在表格里填写镜头、选择景别和运动，并逐格生成画面。
              </p>
              <button class="primary-button mx-auto mt-5" type="button" @click="handleCreateStoryboard">
                <Plus class="h-4 w-4" />
                <span>新建分镜</span>
              </button>
            </div>
          </div>

          <div v-else class="shot-table-scroll h-[calc(100%-72px)] overflow-auto custom-scrollbar">
            <table class="storyboard-shot-table border-collapse text-left">
              <colgroup>
                <col class="shot-col-sort" />
                <col class="shot-col-no" />
                <col class="shot-col-image" />
                <col class="shot-col-content" />
                <col class="shot-col-lens" />
                <col class="shot-col-move" />
                <col class="shot-col-asset" />
                <col class="shot-col-asset" />
                <col class="shot-col-asset" />
                <col class="shot-col-action" />
              </colgroup>
              <thead class="sticky top-0 z-10 bg-[var(--bg-secondary)]">
                <tr class="border-b border-[var(--border-color)] text-[11px] font-bold tracking-wide text-[var(--text-tertiary)]">
                  <th class="table-head">排序</th>
                  <th class="table-head">镜号</th>
                  <th class="table-head">画面</th>
                  <th class="table-head">内容</th>
                  <th class="table-head">景别</th>
                  <th class="table-head">运动</th>
                  <th class="table-head">演员</th>
                  <th class="table-head">服饰</th>
                  <th class="table-head">场景</th>
                  <th class="table-head">操作</th>
                </tr>
              </thead>

              <tbody>
                <tr
                  v-for="(shot, rowIndex) in shots"
                  :key="shot.clientId"
                  class="border-b border-[var(--border-color)] last:border-b-0 hover:bg-white/[0.03]"
                  :class="{ 'opacity-60': draggingClientId === shot.clientId }"
                  @dragover.prevent
                  @drop.prevent="handleDrop(shot)"
                >
                  <td class="table-cell">
                    <button
                      class="drag-button"
                      type="button"
                      title="拖动排序"
                      draggable="true"
                      @dragstart="event => handleDragStart(shot, event)"
                      @dragend="draggingClientId = ''"
                      @click="moveShot(rowIndex, rowIndex - 1)"
                    >
                      <GripVertical class="h-4 w-4" />
                    </button>
                  </td>

                  <td class="table-cell">
                    <div class="number-badge">
                      {{ shot.no }}
                    </div>
                  </td>

                  <td class="table-cell">
                    <div class="image-frame group/image">
                      <button
                        v-if="shot.thumbnail || shot.imageUrl"
                        class="image-button"
                        type="button"
                        title="预览画面"
                        @click="openPreview(shot)"
                      >
                        <img :src="shot.thumbnail || shot.imageUrl" :alt="`镜头 ${shot.no}`" />
                      </button>
                      <button
                        v-else
                        class="image-placeholder"
                        type="button"
                        title="生成画面"
                        :disabled="generatingShotIndex !== null"
                        @click="handleGenerateShot(shot)"
                      >
                        <Loader2 v-if="generatingShotIndex === shot.no" class="h-6 w-6 animate-spin text-blue-300" />
                        <ImagePlus v-else class="h-6 w-6 text-[var(--text-tertiary)]" />
                        <span>{{ generatingShotIndex === shot.no ? '生成中' : '生成画面' }}</span>
                      </button>
                      <div class="mt-2 flex items-center justify-between gap-2">
                        <span class="shot-state">{{ shotStatusLabel(shot) }}</span>
                        <button
                          class="tiny-action"
                          type="button"
                          :disabled="generatingShotIndex !== null"
                          @click="handleGenerateShot(shot)"
                        >
                          {{ shot.imagePath ? '重生成' : '生成' }}
                        </button>
                      </div>
                    </div>
                  </td>

                  <td class="table-cell">
                    <textarea
                      class="plain-input min-h-[5.5rem] resize-none leading-6"
                      :value="shot.content"
                      placeholder="填写镜头内容、动作、构图或情绪"
                      aria-label="镜头内容"
                      @input="event => updateShotField(shot, 'content', (event.target as HTMLTextAreaElement).value)"
                    />
                    <div class="prompt-preview">
                      <div class="prompt-preview-title">自动提示词</div>
                      <p>{{ buildShotPrompt(shot) || '填写内容后显示' }}</p>
                    </div>
                  </td>

                  <td class="table-cell">
                    <div class="select-shell">
                      <select
                        :value="shot.lens"
                        aria-label="景别"
                        @change="event => updateShotField(shot, 'lens', (event.target as HTMLSelectElement).value)"
                      >
                        <option v-for="option in lensOptions" :key="option" :value="option">{{ option }}</option>
                      </select>
                      <ChevronDown class="h-4 w-4 text-[var(--text-tertiary)]" />
                    </div>
                  </td>

                  <td class="table-cell">
                    <div class="select-shell">
                      <select
                        :value="shot.move"
                        aria-label="运动"
                        @change="event => updateShotField(shot, 'move', (event.target as HTMLSelectElement).value)"
                      >
                        <option v-for="option in moveOptions" :key="option" :value="option">{{ option }}</option>
                      </select>
                      <ChevronDown class="h-4 w-4 text-[var(--text-tertiary)]" />
                    </div>
                  </td>

                  <td class="table-cell">
                    <div class="select-shell asset-select-shell">
                      <select
                        :value="shot.roleAssetPath || ''"
                        aria-label="演员"
                        @change="event => updateShotAsset(shot, 'role', (event.target as HTMLSelectElement).value)"
                      >
                        <option value="">未选择演员</option>
                        <option v-if="shot.roleAssetPath && !findAssetByPath(shot.roleAssetPath)" :value="shot.roleAssetPath">
                          {{ getAssetName(shot.roleAssetPath) }}
                        </option>
                        <option v-for="asset in roleAssets" :key="asset.id" :value="asset.path">{{ asset.name }}</option>
                      </select>
                      <ChevronDown class="h-4 w-4 text-[var(--text-tertiary)]" />
                    </div>
                    <div v-if="shot.roleAssetPath" class="asset-hint">{{ getAssetName(shot.roleAssetPath) }}</div>
                  </td>

                  <td class="table-cell">
                    <div class="select-shell asset-select-shell">
                      <select
                        :value="shot.costumeAssetPath || ''"
                        aria-label="服饰"
                        @change="event => updateShotAsset(shot, 'costume', (event.target as HTMLSelectElement).value)"
                      >
                        <option value="">未选择服饰</option>
                        <option v-if="shot.costumeAssetPath && !findAssetByPath(shot.costumeAssetPath)" :value="shot.costumeAssetPath">
                          {{ getAssetName(shot.costumeAssetPath) }}
                        </option>
                        <option v-for="asset in costumeAssets" :key="asset.id" :value="asset.path">{{ asset.name }}</option>
                      </select>
                      <ChevronDown class="h-4 w-4 text-[var(--text-tertiary)]" />
                    </div>
                    <div v-if="shot.costumeAssetPath" class="asset-hint">{{ getAssetName(shot.costumeAssetPath) }}</div>
                  </td>

                  <td class="table-cell">
                    <div class="select-shell asset-select-shell">
                      <select
                        :value="shot.sceneAssetPath || ''"
                        aria-label="场景"
                        @change="event => updateShotAsset(shot, 'scene', (event.target as HTMLSelectElement).value)"
                      >
                        <option value="">未选择场景</option>
                        <option v-if="shot.sceneAssetPath && !findAssetByPath(shot.sceneAssetPath)" :value="shot.sceneAssetPath">
                          {{ getAssetName(shot.sceneAssetPath) }}
                        </option>
                        <option v-for="asset in sceneAssets" :key="asset.id" :value="asset.path">{{ asset.name }}</option>
                      </select>
                      <ChevronDown class="h-4 w-4 text-[var(--text-tertiary)]" />
                    </div>
                    <div v-if="shot.sceneAssetPath" class="asset-hint">{{ getAssetName(shot.sceneAssetPath) }}</div>
                  </td>

                  <td class="table-cell">
                    <div class="flex items-center gap-3 text-[var(--text-secondary)]">
                      <button class="icon-button" type="button" title="删除" @click="removeShot(shot)">
                        <Trash2 class="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="flex shrink-0 flex-wrap gap-2 px-6 pb-5 text-xs text-[var(--text-tertiary)]">
        <span class="status-pill">镜头总数 {{ shots.length }}</span>
        <span class="status-pill">已生成画面 {{ completedCount }}</span>
      </section>
    </main>

    <transition name="fade">
      <div v-if="previewImage" class="fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-black/90 p-8 backdrop-blur-md" @click="closePreview">
        <img :src="previewImage" class="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl ring-1 ring-white/10" alt="分镜画面预览" />
      </div>
    </transition>
  </div>
</template>

<style scoped>
.toolbar-button {
  display: inline-flex;
  height: 2.5rem;
  align-items: center;
  gap: 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  padding: 0 0.875rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-secondary);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease, opacity 0.15s ease;
}

.toolbar-button:hover:not(:disabled) {
  border-color: rgba(96, 165, 250, 0.35);
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.toolbar-button.danger-button:hover:not(:disabled) {
  border-color: rgba(239, 68, 68, 0.45);
  background: rgba(239, 68, 68, 0.08);
  color: rgb(239, 68, 68);
}

.toolbar-button:disabled,
.primary-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.primary-button {
  display: inline-flex;
  height: 2.5rem;
  align-items: center;
  gap: 0.5rem;
  border-radius: 0.5rem;
  background: rgb(37 99 235);
  padding: 0 1rem;
  font-size: 0.75rem;
  font-weight: 800;
  color: #fff;
  box-shadow: 0 0 20px rgba(37, 99, 235, 0.3);
  transition: background-color 0.15s ease, transform 0.15s ease;
}

.primary-button:hover:not(:disabled) {
  background: rgb(59 130 246);
}

.primary-button:active:not(:disabled) {
  transform: translateY(1px);
}

.panel-shell {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0)),
    var(--bg-primary);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
}

.panel-topbar {
  display: flex;
  min-height: 4.5rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.01);
  padding: 0.875rem 1rem;
}

.metric-pill {
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  padding: 0.35rem 0.6rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.name-input {
  min-width: 14rem;
  border-radius: 0.5rem;
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  padding: 0.55rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text-primary);
  outline: none;
}

.name-input:focus {
  border-color: rgba(96, 165, 250, 0.5);
}

.select-wrap {
  position: relative;
}

.native-select {
  height: 2.5rem;
  width: 100%;
  appearance: none;
  border-radius: 0.5rem;
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  padding: 0 2.25rem 0 0.75rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-secondary);
  outline: none;
}

.shot-table-scroll {
  container-type: inline-size;
}

.storyboard-shot-table {
  width: max(100%, 75rem);
  table-layout: fixed;
}

.shot-col-sort {
  width: 4%;
}

.shot-col-no {
  width: 5%;
}

.shot-col-image {
  width: 12%;
}

.shot-col-content {
  width: 25%;
}

.shot-col-lens,
.shot-col-move,
.shot-col-action {
  width: 8%;
}

.shot-col-asset {
  width: 10%;
}

.table-head {
  height: 2.75rem;
  padding: 0 clamp(0.5rem, 0.9cqi, 0.875rem);
  white-space: nowrap;
}

.table-cell {
  height: auto;
  min-height: 8.125rem;
  padding: clamp(0.5rem, 0.9cqi, 0.875rem);
  vertical-align: top;
}

.drag-button {
  display: grid;
  height: clamp(2rem, 3cqi, 2.5rem);
  width: clamp(2rem, 3cqi, 2.5rem);
  place-items: center;
  border-radius: 0.5rem;
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  color: var(--text-tertiary);
  transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}

.drag-button:hover {
  border-color: rgba(96, 165, 250, 0.35);
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.number-badge {
  display: grid;
  height: 2.5rem;
  width: min(100%, 4.375rem);
  place-items: center;
  border-radius: 0.625rem;
  border: 1px solid var(--border-color);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0));
  font-size: 1rem;
  font-weight: 800;
  color: var(--text-primary);
}

.image-frame {
  width: 100%;
  max-width: 11.5rem;
}

.image-placeholder,
.image-button {
  display: grid;
  aspect-ratio: 16 / 9;
  width: 100%;
  place-items: center;
  gap: 0.45rem;
  overflow: hidden;
  border-radius: 0.5rem;
  border: 1px dashed rgba(113, 113, 122, 0.9);
  background: rgba(255, 255, 255, 0.02);
  color: var(--text-secondary);
  font-size: 0.8125rem;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.image-button {
  border-style: solid;
}

.image-button img {
  height: 100%;
  width: 100%;
  object-fit: cover;
}

.image-placeholder:hover:not(:disabled),
.image-button:hover {
  border-color: rgba(96, 165, 250, 0.45);
  background: rgba(59, 130, 246, 0.08);
}

.shot-state {
  min-width: 3.5rem;
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--text-tertiary);
}

.tiny-action {
  border-radius: 0.375rem;
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  padding: 0.25rem 0.45rem;
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.tiny-action:hover:not(:disabled) {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.plain-input {
  width: 100%;
  border: 0;
  background: transparent;
  padding: 0.5rem 0;
  font-size: 0.9375rem;
  color: var(--text-tertiary);
  outline: none;
}

.plain-input:focus {
  color: var(--text-primary);
}

.plain-input::placeholder {
  color: var(--text-tertiary);
  opacity: 0.75;
}

.strong-input {
  font-weight: 600;
  color: var(--text-secondary);
}

.prompt-preview {
  margin-top: 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.025);
  padding: 0.625rem 0.75rem;
}

.prompt-preview-title {
  margin-bottom: 0.25rem;
  font-size: 0.625rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
}

.prompt-preview p {
  display: -webkit-box;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 0.75rem;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.select-shell {
  position: relative;
  display: flex;
  height: 2.25rem;
  width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  padding: 0 0.75rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
}

.select-shell select {
  position: absolute;
  inset: 0;
  width: 100%;
  appearance: none;
  border: 0;
  background: transparent;
  padding: 0 2rem 0 0.75rem;
  color: var(--text-primary);
  outline: none;
}

.select-shell option {
  background: var(--bg-card);
  color: var(--text-primary);
}

.select-shell svg {
  margin-left: auto;
}

.asset-select-shell {
  width: 100%;
}

.asset-hint {
  margin-top: 0.45rem;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--text-tertiary);
}

.icon-button {
  display: inline-grid;
  height: 1.75rem;
  width: 1.75rem;
  place-items: center;
  border-radius: 0.375rem;
  color: var(--text-tertiary);
  transition: background-color 0.15s ease, color 0.15s ease;
}

.icon-button:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.status-pill {
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  padding: 0.45rem 0.625rem;
  font-weight: 600;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 999px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
