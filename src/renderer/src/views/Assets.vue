<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { mediaApi, dialogApi, eventsApi, aiApi, storeApi } from '../api/media'
import { useDialog } from '../composables/useDialog'
import type { MediaAsset, AssetType } from '../types/media'

const dialog = useDialog()

// 鈺愨晲鈺愨晲鈺?State 鈺愨晲鈺愨晲鈺?
const assets = ref<MediaAsset[]>([])
const selectedAsset = ref<MediaAsset | null>(null)
const previewImage = ref<string | null>(null)
const isLoading = ref(false)
const isOptimizing = ref(false)

// 鎻愮ず璇嶈緭鍏ョ姸鎬佺鐞?
type PromptState = {
  userInput: string
  focused: boolean
}

const promptStates = ref<Record<string, PromptState>>({
  role: { userInput: '', focused: false },
  costume: { userInput: '', focused: false },
  scene: { userInput: '', focused: false }
})

// 鍚勭被鍨嬭祫浜х敓鎴愭椂鐨勮嚜瀹氫箟鍚嶇О
const generationNames = ref<Record<string, string>>({
  role: 'Aria Vance',
  costume: 'Obsidian Operative',
  scene: 'Cyberpunk Cityscape'
})

// 鍦烘櫙绫诲瀷閫夐」鍙婂搴旀彁绀鸿瘝鐗囨
const sceneTypeOptions = [
  { value: 'sunny', label: '晴朗 Sunny', prompt: 'clear blue sky, bright sunshine, vivid warm lighting, no clouds, sparkling golden sunlight, cheerful atmosphere' },
  { value: 'rainy_night', label: '雨夜 Rainy Night', prompt: 'rainy night atmosphere, heavy rainfall, wet surfaces reflecting lights, dark moody sky, puddles on ground, stormy weather' },
  { value: 'sunset', label: '黄昏 Sunset', prompt: 'golden hour sunset, warm orange and red tones in sky, long dramatic shadows, fading daylight' },
  { value: 'afternoon', label: '午后 Afternoon', prompt: 'bright afternoon daylight, clear blue sky, strong natural sunlight, warm day' },
  { value: 'morning', label: '清晨 Morning', prompt: 'early morning dawn, soft morning light, fresh sunrise glow, gentle sunbeams, morning mist' }
]
const sceneType = ref('sunny')

// 鏈嶉グ鏉愯川閫夐」鍙婂搴旀彁绀鸿瘝鐗囨
const costumeMaterialOptions = [
  { value: 'carbon_fiber', label: '碳纤维 Carbon Fiber', prompt: 'carbon fiber material, sleek matte texture, futuristic high-tech look, lightweight armor-like appearance' },
  { value: 'silk', label: '丝绸 Silk', prompt: 'silk fabric, smooth flowing texture, elegant lustrous sheen, luxurious draping' },
  { value: 'leather', label: '皮革 Leather', prompt: 'leather material, tough worn texture, rugged durable look, classic craftsmanship' },
  { value: 'wool', label: '羊毛 Wool', prompt: 'wool fabric, warm textured weave, soft natural fibers, cozy premium quality' },
  { value: 'cotton', label: '棉质 Cotton', prompt: 'cotton material, soft breathable fabric, comfortable casual texture, natural fiber look' }
]
const costumeMaterial = ref('carbon_fiber')

const outputDir = ref('')
const searchQuery = ref('')
const activeFilter = ref<AssetType | 'all'>('all')

// Tabs
type TabType = 'library' | 'roles' | 'costumes' | 'scenes'
const activeTab = ref<TabType>('library')

// 褰撳墠缂栬緫闈㈡澘鐨勮祫浜?
const editingAsset = ref<MediaAsset | null>(null)

// 骞撮緞鎷栧姩鐘舵€?
const ageValue = ref(24)
const isDraggingAge = ref(false)
const ageSliderRef = ref<HTMLElement | null>(null)

// 瑙掕壊鐢熸垚鍙傛暟锛堢嫭绔嬬姸鎬侊紝閬垮厤鍥爏electedAsset鍙樺寲瀵艰嚧閲嶇疆锛?
const roleGender = ref('female')
const roleEthnicity = ref('east_asian')

// 澶栬矊鐗瑰緛鐘舵€?
const appearanceFeatures = ref<string[]>(['Cybernetic Eyes', 'Neon Tattoos', 'Short Bob'])
const newFeatureInput = ref('')
const showFeatureInput = ref(false)

// 鍥惧儚鐢熸垚鐘舵€?
const isGenerating = ref(false)
const generatingType = ref<'role' | 'costume' | 'scene' | null>(null)

// 褰撳墠鏍囩瀵瑰簲鐨勬暟閲?
const currentCount = computed(() => {
  if (activeTab.value === 'library') {
    return assets.value.length
  }
  // 灏?Tab 鍚嶇О锛堝鏁帮級鏄犲皠鍒拌祫浜х被鍨嬶紙鍗曟暟锛?
  const typeMap: Record<string, AssetType> = {
    roles: 'role',
    costumes: 'costume',
    scenes: 'scene'
  }
  const tabType = typeMap[activeTab.value] || activeTab.value
  return assets.value.filter(a => a.type === tabType).length
})

// 鍒嗙被缁熻
const stats = computed(() => {
  return {
    roles: assets.value.filter(a => a.type === 'role').length,
    costumes: assets.value.filter(a => a.type === 'costume').length,
    scenes: assets.value.filter(a => a.type === 'scene').length,
    generating: assets.value.filter(a => a.status === 'generating').length
  }
})

// 鍙充晶杈规爮鏄惁鏄剧ず锛堜粎鍦ㄩ潪 library 鏍囩鏃舵樉绀猴級
const showInspector = computed(() => activeTab.value !== 'library')

// 绛涢€夊悗鐨勮祫浜?
const filteredAssets = computed(() => {
  let result = [...assets.value]
  
  // 鎸?Tab 绛涢€?
  if (activeTab.value === 'roles') {
    result = result.filter(a => a.type === 'role')
  } else if (activeTab.value === 'costumes') {
    result = result.filter(a => a.type === 'costume')
  } else if (activeTab.value === 'scenes') {
    result = result.filter(a => a.type === 'scene')
  }
  // library 鏄剧ず鎵€鏈?
  
  // 鎸夌被鍨嬬瓫閫?
  if (activeFilter.value !== 'all') {
    result = result.filter(a => a.type === activeFilter.value)
  }
  
  // 鎸夋悳绱㈠叧閿瘝杩囨护
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(a => 
      a.name.toLowerCase().includes(query) ||
      a.prompt?.toLowerCase().includes(query)
    )
  }
  
  return result
})

// 鑾峰彇褰撳墠鍒嗙被鐨勮祫浜э紙鐢ㄤ簬鍒嗙被闈㈡澘锛?
const currentCategoryAssets = computed(() => {
  const type = activeTab.value === 'library' ? 'role' : activeTab.value
  return assets.value.filter(a => a.type === type)
})

const assetGridClass = computed(() => {
  return 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
})

const getAssetCardAspect = (_asset: MediaAsset) => {
  return 'aspect-[4/3]'
}

const getAssetImageClass = (_asset: MediaAsset) => {
  return 'w-full h-full object-contain bg-white/95 opacity-95 transition-transform duration-500 group-hover:scale-[1.02] group-hover:opacity-100'
}

const formatGenerationError = (error?: string) => {
  const message = error || '未知错误'
  if (message.includes('OutputImageSensitiveContentDetected')) {
    return '平台判定生成结果可能包含敏感内容。已将角色生成改为成人、全身、完整服装的三视图提示词，请重试；如果仍失败，请减少真人写真、暴露服装或过度性感化描述。'
  }
  return message
}

// 鈺愨晲鈺愨晲鈺?Methods 鈺愨晲鈺愨晲鈺?
const loadAssets = async () => {
  isLoading.value = true
  try {
    const dir = await mediaApi.getOutputDirectory()
    outputDir.value = dir
    assets.value = await mediaApi.scanDirectory(dir)
  } catch (error) {
    console.error('Failed to load assets:', error)
  } finally {
    isLoading.value = false
  }
}

const handleRefresh = async () => {
  await loadAssets()
}

const handleSelectDirectory = async () => {
  const dir = await dialogApi.selectDirectory()
  if (dir) {
    outputDir.value = dir
    await mediaApi.setOutputDirectory(dir)
    await loadAssets()
  }
}

const setPromptStateFromAsset = (type: 'role' | 'costume' | 'scene', asset: MediaAsset) => {
  if (!promptStates.value[type]) {
    promptStates.value[type] = { userInput: '', focused: false }
  }
  promptStates.value[type].userInput = asset.corePrompt || asset.prompt || ''
  promptStates.value[type].focused = false
}

const applyAssetToEditor = (asset: MediaAsset) => {
  const typeKey = asset.type
  if (typeKey && generationNames.value[typeKey] !== undefined) {
    generationNames.value[typeKey] = asset.name
  }

  if (asset.type === 'role') {
    roleGender.value = asset.gender || 'female'
    roleEthnicity.value = asset.ethnicity || 'east_asian'
    ageValue.value = typeof asset.age === 'number' ? asset.age : 24
    appearanceFeatures.value = Array.isArray(asset.features) ? [...asset.features] : []
    setPromptStateFromAsset('role', asset)
  } else if (asset.type === 'costume') {
    costumeMaterial.value = asset.costumeMaterial || 'carbon_fiber'
    setPromptStateFromAsset('costume', asset)
  } else if (asset.type === 'scene') {
    sceneType.value = asset.sceneType || 'sunny'
    setPromptStateFromAsset('scene', asset)
  }
}

const handleAssetClick = (asset: MediaAsset) => {
  if (asset.status === 'generating') return
  selectedAsset.value = asset
  editingAsset.value = { ...asset }
  applyAssetToEditor(asset)
}

const handlePreview = (asset: MediaAsset) => {
  if (asset.status === 'generating') return
  previewImage.value = asset.thumbnail || ''
}

const closePreview = () => {
  previewImage.value = null
}

const handleOpenLocation = async (asset: MediaAsset) => {
  await mediaApi.revealInExplorer(asset.path)
}

const handleDeleteAsset = async (asset: MediaAsset) => {
  if (await dialog.confirm(`确定要删除 "${asset.name}" 吗？\n\n此操作不可恢复，文件将从硬盘中永久删除。`, '删除资产', '删除')) {
    try {
      const success = await mediaApi.deleteAsset(asset.path)
      if (success) {
        assets.value = assets.value.filter(a => a.id !== asset.id)
        if (selectedAsset.value?.id === asset.id) {
          selectedAsset.value = null
          editingAsset.value = null
        }
      } else {
        await dialog.error(`删除失败：无法删除文件 "${asset.name}"。\n\n请检查文件是否存在或是否有权限删除。`)
      }
    } catch (error: any) {
      console.error('Delete asset failed:', error)
      await dialog.error(`删除失败：${error?.message || '未知错误'}\n\n请检查文件是否存在或是否有权限删除。`)
    }
  }
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getCategoryName = (type: AssetType): string => {
  const names: Record<AssetType, string> = {
    role: '角色',
    costume: '服饰',
    scene: '场景',
    video: 'video',
    storyboard: '分镜'
  }
  return names[type] || type
}

const getCategoryLabel = (type: string): string => {
  const labels: Record<string, string> = {
    roles: '角色',
    costumes: '服饰',
    scenes: '场景'
  }
  return labels[type] || type
}

// 鍚勭被鍨嬮粯璁ゆ彁绀鸿瘝
const defaultPrompts: Record<string, string> = {
  role: 'Adult cyberpunk operative character design, silver hair, glowing blue cybernetic eyes, fully clothed sleek matte carbon-fiber armor, neutral standing pose, clean white background.',
  costume: 'matte black textures, integrated blue glowing fiber optics, reinforced shoulder pads...',
  scene: 'urban rainy background, neon lights reflecting on wet streets, flying cars, fog, cinematic lighting, highly detailed cityscape.'
}

// 鑾峰彇鎻愮ず璇嶆樉绀哄€?
const getPromptValue = (type: string): string => {
  const state = promptStates.value[type]
  const defaultValue = defaultPrompts[type] || ''
  if (!state) return defaultValue
  if (state.focused) {
    return state.userInput
  }
  return state.userInput || defaultValue
}

// 澶勭悊鑱氱劍
const handlePromptFocus = (type: string) => {
  if (!promptStates.value[type]) {
    promptStates.value[type] = { userInput: '', focused: false }
  }
  promptStates.value[type].focused = true
}

// 澶勭悊澶辩劍
const handlePromptBlur = (type: string) => {
  if (promptStates.value[type]) {
    promptStates.value[type].focused = false
  }
}

// 澶勭悊杈撳叆
const handlePromptInput = (type: string, value: string) => {
  if (!promptStates.value[type]) {
    promptStates.value[type] = { userInput: '', focused: true }
  }
  promptStates.value[type].userInput = value
}

// 鈺愨晲鈺愨晲鈺?骞撮緞鎷栧姩鍔熻兘 鈺愨晲鈺愨晲鈺?
const updateAgeFromPosition = (clientX: number) => {
  if (!ageSliderRef.value) return
  const rect = ageSliderRef.value.getBoundingClientRect()
  const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  ageValue.value = Math.round(percentage * 100)
}

const handleAgeMouseDown = (e: MouseEvent) => {
  isDraggingAge.value = true
  updateAgeFromPosition(e.clientX)
  document.addEventListener('mousemove', handleAgeMouseMove)
  document.addEventListener('mouseup', handleAgeMouseUp)
}

const handleAgeMouseMove = (e: MouseEvent) => {
  if (isDraggingAge.value) {
    updateAgeFromPosition(e.clientX)
  }
}

const handleAgeMouseUp = () => {
  isDraggingAge.value = false
  document.removeEventListener('mousemove', handleAgeMouseMove)
  document.removeEventListener('mouseup', handleAgeMouseUp)
}

// 璁＄畻骞撮緞婊戝潡鐨勫搴︾櫨鍒嗘瘮
const agePercentage = computed(() => `${ageValue.value}%`)

// 鈺愨晲鈺愨晲鈺?澶栬矊鐗瑰緛鍔熻兘 鈺愨晲鈺愨晲鈺?
const addFeature = () => {
  if (newFeatureInput.value.trim()) {
    appearanceFeatures.value.push(newFeatureInput.value.trim())
    newFeatureInput.value = ''
    showFeatureInput.value = false
  }
}

const removeFeature = (index: number) => {
  appearanceFeatures.value.splice(index, 1)
}

const handleFeatureInputKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    addFeature()
  } else if (e.key === 'Escape') {
    showFeatureInput.value = false
    newFeatureInput.value = ''
  }
}

// Tab 鍒?prompt 绫诲瀷鐨勬槧灏?
const tabToPromptType: Record<string, string> = {
  library: 'role',
  roles: 'role',
  costumes: 'costume',
  scenes: 'scene'
}

// 妫€鏌?API Key 鏄惁宸查厤缃?
const checkApiKey = async (): Promise<boolean> => {
  try {
    const data = await storeApi.get()
    const hasApiKey = Boolean(data.settings?.apiKey?.trim?.() || data.settings?.apiKeyConfigured || data.settings?.apiKeysConfigured?.ark)
    if (!hasApiKey) {
      await dialog.error('API Key 未配置，请先在 Settings 页面配置有效的 API Key。')
      return false
    }
    return true
  } catch (error) {
    console.error('Failed to check API key:', error)
    await dialog.error('无法验证 API Key 状态，请检查设置。')
    return false
  }
}

// 鏄惁鍙互浼樺寲褰撳墠鎻愮ず璇?
const canOptimizePrompt = computed(() => {
  const type = tabToPromptType[activeTab.value] || 'role'
  const currentValue = getPromptValue(type).trim()
  return currentValue.length > 0 && !isOptimizing.value
})

// 浼樺寲褰撳墠鎻愮ず璇?
const optimizeCurrentPrompt = async () => {
  const type = tabToPromptType[activeTab.value] || 'role'
  const currentValue = getPromptValue(type)

  if (!currentValue.trim()) return

  // 妫€鏌?API Key 鏄惁宸查厤缃?
  const hasApiKey = await checkApiKey()
  if (!hasApiKey) return

  isOptimizing.value = true
  try {
    const optimized = await aiApi.optimizePrompt(currentValue)
    if (!promptStates.value[type]) {
      promptStates.value[type] = { userInput: '', focused: false }
    }
    promptStates.value[type].userInput = optimized
  } catch (error: any) {
    console.error('Prompt optimization failed:', error)
    await dialog.error(`提示词优化失败：${error?.message || '请检查 API Key 是否有效'}`)
  } finally {
    isOptimizing.value = false
  }
}

// 鈺愨晲鈺愨晲鈺?鎻愮ず璇嶈瀺鍚堟瀯寤?鈺愨晲鈺愨晲鈺?
const buildFusedPrompt = (type: 'role' | 'costume' | 'scene', basePrompt: string): string => {
  if (type === 'scene') {
    const sceneOpt = sceneTypeOptions.find(o => o.value === sceneType.value)
    const sceneDesc = sceneOpt ? sceneOpt.prompt : ''
    return `A detailed cinematic scene of ${basePrompt}, set in ${sceneDesc}, highly detailed environment, professional cinematic photography, 8k resolution.`
  }
  if (type === 'costume') {
    const materialOpt = costumeMaterialOptions.find(o => o.value === costumeMaterial.value)
    const materialDesc = materialOpt ? materialOpt.prompt : ''
    return `${basePrompt}, ${materialDesc}, detailed clothing design, professional fashion photography, studio lighting, 8k resolution.`
  }
  return basePrompt
}

// 鈺愨晲鈺愨晲鈺?鍥惧儚鐢熸垚鍔熻兘 鈺愨晲鈺愨晲鈺?
const handleStartGeneration = async () => {
  const type = tabToPromptType[activeTab.value] as 'role' | 'costume' | 'scene'
  const basePrompt = getPromptValue(type)

  if (!basePrompt.trim()) {
    await dialog.error('请输入提示词')
    return
  }

  // 妫€鏌?API Key 鏄惁宸查厤缃?
  const hasApiKey = await checkApiKey()
  if (!hasApiKey) return

  // 铻嶅悎鐢ㄦ埛閫夋嫨涓庢弿杩?
  const fusedPrompt = buildFusedPrompt(type, basePrompt)

  console.log('[Assets] 寮€濮嬬敓鎴愬浘鍍? type:', type, 'basePrompt:', basePrompt.substring(0, 50) + '...')
  console.log('[Assets] 铻嶅悎鍚庢彁绀鸿瘝:', fusedPrompt.substring(0, 100) + '...')
  isGenerating.value = true
  generatingType.value = type

  try {
    // 鍒涘缓鐢熸垚涓殑璧勪骇鍗犱綅
    const tempId = `temp-${Date.now()}`
    const generatingAsset: MediaAsset = {
      id: tempId,
      name: '姝ｅ湪鐢熸垚...',
      path: '',
      type,
      thumbnail: '',
      size: 0,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      status: 'generating',
      progress: 0,
      prompt: basePrompt,
      corePrompt: basePrompt,
      generationPrompt: fusedPrompt,
      gender: type === 'role' ? roleGender.value : undefined,
      age: type === 'role' ? ageValue.value : undefined,
      features: type === 'role' ? [...appearanceFeatures.value] : undefined,
      ethnicity: type === 'role' ? roleEthnicity.value : undefined,
      sceneType: type === 'scene' ? sceneType.value : undefined,
      costumeMaterial: type === 'costume' ? costumeMaterial.value : undefined
    }
    assets.value.unshift(generatingAsset)

    // 璋冪敤鍥惧儚鐢熸垚API
    console.log('[Assets] 璋冪敤 mediaApi.generateImage...')
    const customName = generationNames.value[type]
    const result = await mediaApi.generateImage({
      prompt: fusedPrompt,
      corePrompt: basePrompt,
      type,
      name: customName,
      gender: type === 'role' ? roleGender.value : undefined,
      age: type === 'role' ? ageValue.value : undefined,
      features: type === 'role' ? [...appearanceFeatures.value] : undefined,
      ethnicity: type === 'role' ? roleEthnicity.value : undefined,
      sceneType: type === 'scene' ? sceneType.value : undefined,
      costumeMaterial: type === 'costume' ? costumeMaterial.value : undefined
    })
    console.log('[Assets] mediaApi.generateImage 杩斿洖:', result)

    // 绉婚櫎涓存椂璧勪骇
    assets.value = assets.value.filter(a => a.id !== tempId)

    if (result.success && result.imageUrl) {
      const scannedAssets = await mediaApi.scanDirectory(outputDir.value)
      assets.value = scannedAssets
      const generatedAsset = result.filePath
        ? scannedAssets.find(asset => asset.path === result.filePath)
        : null

      if (generatedAsset) {
        handleAssetClick(generatedAsset)
      } else {
        const newAsset: MediaAsset = {
          id: `generated-${Date.now()}`,
          name: customName || result.fileName || `Generated ${type}`,
          path: result.filePath || '',
          type,
          thumbnail: result.imageUrl,
          size: result.fileSize || 0,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          status: 'ready',
          prompt: basePrompt,
          corePrompt: basePrompt,
          generationPrompt: fusedPrompt,
          gender: type === 'role' ? roleGender.value : undefined,
          age: type === 'role' ? ageValue.value : undefined,
          features: type === 'role' ? [...appearanceFeatures.value] : undefined,
          ethnicity: type === 'role' ? roleEthnicity.value : undefined,
          sceneType: type === 'scene' ? sceneType.value : undefined,
          costumeMaterial: type === 'costume' ? costumeMaterial.value : undefined
        }
        assets.value.unshift(newAsset)
        handleAssetClick(newAsset)
      }
      console.log('[Assets] 鍥惧儚鐢熸垚鎴愬姛, 宸叉坊鍔犲埌鍒楄〃')
    } else {
      console.error('[Assets] 鍥惧儚鐢熸垚澶辫触:', result.error)
      await dialog.error(`生成失败：${formatGenerationError(result.error)}`)
    }
  } catch (error: any) {
    console.error('[Assets] Image generation failed:', error)
    await dialog.error(`图像生成失败：${formatGenerationError(error?.message)}`)
  } finally {
    isGenerating.value = false
    generatingType.value = null
  }
}

// 鈺愨晲鈺愨晲鈺?Lifecycle 鈺愨晲鈺愨晲鈺?
let unsubscribeProgress: (() => void) | null = null

onMounted(async () => {
  await loadAssets()
  
  unsubscribeProgress = eventsApi.onTaskProgress((data) => {
    const asset = assets.value.find(a => a.id === data.id)
    if (asset) {
      asset.status = data.status as any
      asset.progress = data.progress
    }
  })
})

onUnmounted(() => {
  if (unsubscribeProgress) {
    unsubscribeProgress()
  }
})

// 褰撳垏鎹?Tab 鏃堕噸缃被鍨嬬瓫閫夊櫒
// 闈?library 鏍囩椤甸€氳繃 activeTab 鏈韩瀹屾垚绛涢€夛紝鏃犻渶 activeFilter 浜屾绛涢€?
watch(activeTab, () => {
  activeFilter.value = 'all'
})
</script>

<template>
  <div class="h-full bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col overflow-hidden font-sans">
    <!-- Top Header -->
    <header class="h-[52px] shrink-0 border-b border-[var(--border-color)] flex justify-center items-center px-6 gap-8 bg-[var(--bg-secondary)]">
      <button 
        v-for="tab in [
          { key: 'library', label: '资产库' },
          { key: 'roles', label: '角色' },
          { key: 'costumes', label: '服饰' },
          { key: 'scenes', label: '场景' }
        ]" 
        :key="tab.key"
        @click="activeTab = tab.key as TabType"
        :class="['text-xs font-bold tracking-widest px-2 py-4 border-b-[3px] transition-colors', 
                 activeTab === tab.key 
                   ? 'border-blue-500 text-blue-400' 
                   : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]']"
      >
        {{ tab.label }}
      </button>
    </header>

    <div class="flex-1 flex overflow-hidden">
      <!-- Main Content -->
      <main class="flex-1 flex flex-col border-r border-[var(--border-color)] bg-[var(--bg-primary)] min-w-0">
        
        <!-- Toolbar -->
        <div class="shrink-0 px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between gap-4 bg-[var(--bg-primary)]">
          <div class="flex items-center gap-3">
            <h2 class="text-sm font-bold tracking-widest text-[var(--text-secondary)]">
              {{ activeTab === 'library' ? '所有资产' : '所有' + getCategoryLabel(activeTab) }}
              <span class="text-[var(--text-tertiary)] ml-2">{{ currentCount }}</span>
            </h2>
            <div v-if="stats.generating > 0" class="flex gap-2">
              <span class="text-[10px] bg-blue-500/10 border border-blue-500/30 text-blue-400 px-2 py-1 rounded font-medium">
                生成中 {{ stats.generating }}
              </span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <!-- 閫夋嫨鐩綍 -->
            <button
              @click="handleSelectDirectory"
              class="px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M12 10v6"/><path d="M9 13h6"/></svg>
              选择目录
            </button>

            <!-- Search -->
            <div class="relative">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="搜索资产..."
                class="w-48 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg pl-9 pr-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-blue-500/50 transition-colors shadow-inner"
              />
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>
            </div>

            <!-- Filter -->
            <div v-if="activeTab === 'library'" class="flex bg-[var(--bg-card)] rounded-lg p-1 border border-[var(--border-color)] shadow-inner">
              <button
                v-for="filter in [
                  { key: 'all', label: '全部' },
                  { key: 'role', label: '角色' },
                  { key: 'costume', label: '服饰' },
                  { key: 'scene', label: '场景' }
                ]"
                :key="filter.key"
                @click="activeFilter = filter.key as AssetType | 'all'"
                :class="['px-3 py-1 text-[10px] font-bold rounded transition-colors',
                         activeFilter === filter.key ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]']"
              >
                {{ filter.label }}
              </button>
            </div>

            <!-- Refresh -->
            <button
              @click="handleRefresh"
              :disabled="isLoading"
              class="p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="isLoading ? 'animate-spin' : ''"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
            </button>
          </div>
        </div>

        <!-- Asset Grid -->
        <div class="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div v-if="isLoading" class="flex items-center justify-center h-full">
            <div class="flex flex-col items-center gap-4">
              <div class="w-10 h-10 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin"></div>
              <span class="text-sm text-[var(--text-tertiary)]">加载资产中...</span>
            </div>
          </div>
          
          <div v-else-if="filteredAssets.length === 0 && activeTab === 'library'" class="flex items-center justify-center h-full">
            <div class="flex flex-col items-center gap-4 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="text-[var(--text-tertiary)]"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
              <div>
                <p class="text-[var(--text-secondary)] font-medium">暂无资产</p>
                <p class="text-[var(--text-tertiary)] text-sm mt-1">从设置中选择资产目录或添加新资产</p>
              </div>
            </div>
          </div>
          
          <div v-else class="grid gap-3" :class="assetGridClass">
            <div 
              v-for="asset in filteredAssets" 
              :key="asset.id"
              @click="handleAssetClick(asset)"
              class="bg-[var(--bg-tertiary)] rounded-lg border overflow-hidden relative group cursor-pointer transition-all"
              :class="[
                getAssetCardAspect(asset),
                asset.status === 'generating' 
                  ? 'border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                  : selectedAsset?.id === asset.id
                    ? 'border-blue-500 ring-2 ring-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                    : 'border-[var(--border-color)] hover:border-blue-500/50 cursor-pointer hover:shadow-[0_0_15px_rgba(59,130,246,0.15)]'
              ]"
            >
              <!-- Generating State -->
              <template v-if="asset.status === 'generating'">
                <div class="absolute inset-0 flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-primary)]">
                  <div class="w-8 h-8 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin mb-3"></div>
                  <span class="text-[10px] text-blue-400 font-bold tracking-widest">GENERATING</span>
                  <div class="w-2/3 h-1 bg-[var(--bg-tertiary)] rounded-full mt-3 overflow-hidden shadow-inner">
                    <div class="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" :style="{ width: (asset.progress || 0) + '%' }"></div>
                  </div>
                </div>
              </template>
              
              <!-- Ready State -->
              <template v-else>
                <img 
                  v-if="asset.thumbnail" 
                  :src="asset.thumbnail" 
                  :class="getAssetImageClass(asset)"
                />
                <div v-else class="w-full h-full flex items-center justify-center bg-[var(--bg-tertiary)]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="text-[var(--text-tertiary)]"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                </div>
                
                <!-- Type Badge -->
                <div class="absolute top-2 left-2 bg-[#111]/70 backdrop-blur text-[9px] text-[var(--text-primary)] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-1">
                  <span>{{ getCategoryName(asset.type) }}</span>
                </div>
                
                <!-- Hover Overlay -->
                <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 pointer-events-none">
                  <p class="text-[10px] text-[var(--text-primary)] font-medium truncate">{{ asset.name }}</p>
                  <p class="text-[9px] text-[var(--text-secondary)] mt-0.5">{{ formatDate(asset.createdAt) }}</p>
                </div>
                
                <!-- Action Icons -->
                <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    @click.stop="handleDeleteAsset(asset)"
                    class="w-6 h-6 rounded bg-black/70 backdrop-blur flex items-center justify-center hover:bg-red-500/80 transition-colors"
                    title="鍒犻櫎"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                  </button>
                  <button 
                    @click.stop="handlePreview(asset)"
                    class="w-6 h-6 rounded bg-black/70 backdrop-blur flex items-center justify-center hover:bg-black/90 transition-colors"
                    title="棰勮"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                  <button 
                    @click.stop="handleOpenLocation(asset)"
                    class="w-6 h-6 rounded bg-black/70 backdrop-blur flex items-center justify-center hover:bg-black/90 transition-colors"
                    title="鎵撳紑浣嶇疆"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  </button>
                </div>
              </template>
            </div>
          </div>
        </div>
      </main>

      <!-- Right Sidebar: Inspector (浠呭湪闈?library 鏍囩鏃舵樉绀? -->
      <aside v-if="showInspector" class="w-[340px] flex flex-col relative bg-[var(--bg-secondary)] border-l border-[var(--border-color)] z-10 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
        
        <!-- 瑙掕壊闈㈡澘 -->
        <div v-if="activeTab === 'roles'" class="p-6 flex-1 flex flex-col gap-6 w-full relative overflow-y-auto pb-32 custom-scrollbar">
          <div class="pb-3 border-b border-[var(--border-color)]">
            <h2 class="text-xs font-bold tracking-wider text-[var(--text-primary)]">角色编辑器 INSPECTOR</h2>
          </div>

          <!-- Name -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-[var(--text-tertiary)]">角色名称 NAME</label>
            <input type="text" v-model="generationNames.role" class="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md px-3 py-2.5 text-sm font-semibold text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 shadow-inner transition-colors" />
          </div>

          <!-- Bio Selects -->
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <label class="text-[10px] font-bold text-[var(--text-tertiary)]">性别 GENDER</label>
              <div class="relative">
                <select v-model="roleGender" class="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-blue-500/50 transition-colors shadow-inner">
                  <option value="female">女性 Female</option>
                  <option value="male">男性 Male</option>
                </select>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[10px] font-bold text-[var(--text-tertiary)]">族裔 ETHNICITY</label>
              <div class="relative">
                <select v-model="roleEthnicity" class="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-blue-500/50 transition-colors shadow-inner">
                  <option value="east_asian">东亚 East Asian</option>
                  <option value="caucasian">白人 Caucasian</option>
                  <option value="black">黑人 Black</option>
                </select>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
          </div>

          <!-- Bio Settings: 骞撮緞涓庡璨屽悎骞?-->
          <div class="flex flex-col gap-4">
            <!-- Age Slider -->
            <div class="flex flex-col gap-2.5">
              <div class="flex justify-between items-end">
                <label class="text-[10px] font-bold text-[var(--text-tertiary)]">年龄估算 AGE ESTIMATION</label>
                <span class="text-xs font-bold text-blue-400">{{ ageValue }}</span>
              </div>
              <!-- 婊戝潡瀹瑰櫒锛氬鍔犳暣浣撳彲鐐瑰嚮鍖哄煙 -->
              <div
                ref="ageSliderRef"
                class="relative w-full h-6 flex items-center cursor-pointer group"
                @mousedown="handleAgeMouseDown"
              >
                <!-- 瑙嗚杞ㄩ亾锛氫繚鎸佺粏绾块鏍?-->
                <div class="absolute w-full h-[3px] bg-[var(--bg-tertiary)] rounded-full pointer-events-none"></div>
                <!-- 宸插～鍏呰建閬?-->
                <div
                  class="absolute left-0 h-[3px] bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)] transition-all pointer-events-none"
                  :style="{ width: agePercentage }"
                ></div>
                <!-- 鎵嬫焺锛?0x20 鍙偣鍑诲尯鍩燂紝瑙嗚淇濇寔 12x12 鍦嗙偣 -->
                <div
                  class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center cursor-grab active:cursor-grabbing transition-transform hover:scale-110 active:scale-95"
                  :style="{ left: agePercentage }"
                >
                  <!-- 瑙嗚鍦嗙偣 -->
                  <div class="w-3 h-3 bg-blue-400 border-[2.5px] border-[var(--bg-secondary)] rounded-full shadow-md transition-transform group-hover:scale-125"></div>
                </div>
              </div>
            </div>

            <div class="w-full h-px bg-[var(--bg-tertiary)]"></div>

            <!-- Appearance Features -->
            <div class="flex flex-col gap-3">
              <label class="text-[10px] font-bold text-[var(--text-tertiary)]">外貌特征 APPEARANCE</label>
            <div class="flex flex-wrap gap-2">
              <span 
                v-for="(feat, index) in appearanceFeatures" 
                :key="index"
                class="bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] text-[11px] px-2.5 py-1.5 rounded shadow-sm flex items-center gap-2 group cursor-pointer hover:border-[var(--border-color)] transition-colors"
              >
                {{ feat }}
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="12" 
                  height="12" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  class="text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  stroke="currentColor" 
                  stroke-width="2" 
                  stroke-linecap="round" 
                  stroke-linejoin="round"
                  @click.stop="removeFeature(index)"
                ><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </span>
              
              <!-- 娣诲姞鐗瑰緛杈撳叆妗?-->
              <template v-if="showFeatureInput">
                <input
                  v-model="newFeatureInput"
                  type="text"
                  placeholder="输入特征..."
                  class="bg-[var(--bg-card)] border border-blue-500/50 text-[var(--text-primary)] text-[11px] px-2.5 py-1.5 rounded shadow-sm w-28 focus:outline-none focus:border-blue-500"
                  @keydown="handleFeatureInputKeydown"
                  @blur="showFeatureInput = false"
                  autofocus
                />
              </template>
              <template v-else>
                <button 
                  class="bg-[var(--bg-card)] border border-dashed border-[var(--border-color)] hover:border-blue-500/50 text-blue-500 hover:text-blue-400 text-[11px] px-2.5 py-1.5 rounded flex items-center gap-1 transition-colors"
                  @click="showFeatureInput = true"
                >
                  <span class="text-xs leading-none">+</span> 添加特征
                </button>
              </template>
            </div>
          </div>
          </div>

          <!-- Core Prompt -->
          <div class="flex flex-col gap-2 flex-1 relative z-0">
            <div class="flex justify-between items-center">
              <label class="text-[10px] font-bold text-[var(--text-tertiary)]">核心提示词 CORE PROMPT</label>
              <button 
                class="text-blue-400 hover:text-blue-300 p-1 bg-blue-500/10 rounded transition-colors flex items-center gap-1 hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="isOptimizing"
                @click="optimizeCurrentPrompt"
              >
                <svg v-if="isOptimizing" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                  <path d="M5 3v4"/>
                  <path d="M19 17v4"/>
                  <path d="M3 5h4"/>
                  <path d="M17 19h4"/>
                </svg>
                <span class="text-[9px] font-bold">{{ isOptimizing ? '优化中' : '优化' }}</span>
              </button>
            </div>
            <div class="relative flex-1 min-h-[160px]">
              <textarea 
                :value="getPromptValue('role')"
                @focus="handlePromptFocus('role')"
                @blur="handlePromptBlur('role')"
                @input="e => handlePromptInput('role', (e.target as HTMLTextAreaElement).value)"
                class="absolute inset-0 w-full h-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md p-4 text-xs leading-relaxed text-[var(--text-secondary)] resize-none focus:outline-none focus:border-blue-500/50 shadow-inner font-mono transition-colors" 
                spellcheck="false"
              ></textarea>
            </div>
          </div>
        </div>

        <!-- 鏈嶉グ闈㈡澘 -->
        <div v-if="activeTab === 'costumes'" class="p-6 flex-1 flex flex-col gap-6 w-full relative overflow-y-auto pb-32 custom-scrollbar">
          <div class="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
            <h2 class="text-xs font-bold tracking-wider text-[var(--text-primary)]">服饰编辑器 COSTUME INSPECTOR</h2>
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-[var(--text-tertiary)]">服饰名称 OUTFIT NAME</label>
            <input type="text" v-model="generationNames.costume" class="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md px-3 py-2.5 text-sm font-semibold text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 shadow-inner transition-colors" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-[var(--text-tertiary)]">主要材质 MATERIAL</label>
            <div class="relative">
              <select v-model="costumeMaterial" class="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-blue-500/50 transition-colors shadow-inner">
                <option v-for="opt in costumeMaterialOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>
          <div class="flex flex-col gap-1.5 flex-1 relative z-0">
            <div class="flex justify-between items-center">
              <label class="text-[10px] font-bold text-[var(--text-tertiary)]">细节特征 DETAILS PROMPT</label>
              <button 
                class="text-blue-400 hover:text-blue-300 p-1 bg-blue-500/10 rounded transition-colors flex items-center gap-1 hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="isOptimizing"
                @click="optimizeCurrentPrompt"
              >
                <svg v-if="isOptimizing" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                  <path d="M5 3v4"/>
                  <path d="M19 17v4"/>
                  <path d="M3 5h4"/>
                  <path d="M17 19h4"/>
                </svg>
                <span class="text-[9px] font-bold">{{ isOptimizing ? '优化中' : '优化' }}</span>
              </button>
            </div>
            <div class="relative flex-1 min-h-[160px]">
              <textarea 
                :value="getPromptValue('costume')"
                @focus="handlePromptFocus('costume')"
                @blur="handlePromptBlur('costume')"
                @input="e => handlePromptInput('costume', (e.target as HTMLTextAreaElement).value)"
                class="absolute inset-0 w-full h-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md p-4 text-xs leading-relaxed text-[var(--text-secondary)] resize-none focus:outline-none focus:border-blue-500/50 shadow-inner font-mono transition-colors" 
                spellcheck="false"
              ></textarea>
            </div>
          </div>
        </div>

        <!-- 鍦烘櫙闈㈡澘 -->
        <div v-if="activeTab === 'scenes'" class="p-6 flex-1 flex flex-col gap-6 w-full relative overflow-y-auto pb-32 custom-scrollbar">
          <div class="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
            <h2 class="text-xs font-bold tracking-wider text-[var(--text-primary)]">场景编辑器 SCENE INSPECTOR</h2>
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-[var(--text-tertiary)]">场景名称 SCENE NAME</label>
            <input type="text" v-model="generationNames.scene" class="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md px-3 py-2.5 text-sm font-semibold text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 shadow-inner transition-colors" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-[var(--text-tertiary)]">时间与天气 TIME & WEATHER</label>
            <div class="relative">
              <select v-model="sceneType" class="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-blue-500/50 transition-colors shadow-inner">
                <option v-for="opt in sceneTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>
          <div class="flex flex-col gap-1.5 flex-1 relative z-0">
            <div class="flex justify-between items-center">
              <label class="text-[10px] font-bold text-[var(--text-tertiary)]">场景环境提示词 ENVIRONMENT PROMPT</label>
              <button 
                class="text-blue-400 hover:text-blue-300 p-1 bg-blue-500/10 rounded transition-colors flex items-center gap-1 hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="isOptimizing"
                @click="optimizeCurrentPrompt"
              >
                <svg v-if="isOptimizing" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                  <path d="M5 3v4"/>
                  <path d="M19 17v4"/>
                  <path d="M3 5h4"/>
                  <path d="M17 19h4"/>
                </svg>
                <span class="text-[9px] font-bold">{{ isOptimizing ? '优化中' : '优化' }}</span>
              </button>
            </div>
            <div class="relative flex-1 min-h-[160px]">
              <textarea 
                :value="getPromptValue('scene')"
                @focus="handlePromptFocus('scene')"
                @blur="handlePromptBlur('scene')"
                @input="e => handlePromptInput('scene', (e.target as HTMLTextAreaElement).value)"
                class="absolute inset-0 w-full h-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md p-4 text-xs leading-relaxed text-[var(--text-secondary)] resize-none focus:outline-none focus:border-blue-500/50 shadow-inner font-mono transition-colors" 
                spellcheck="false"
              ></textarea>
            </div>
          </div>
        </div>

        <!-- Action Buttons Fixed Bottom -->
        <div class="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[var(--bg-secondary)] via-[var(--bg-secondary)] to-transparent pointer-events-none">
          <div class="p-1 border-2 border-dashed border-[#2b3a5e] rounded-xl pointer-events-auto bg-[var(--bg-secondary)]/80 backdrop-blur">
            <div class="flex gap-2 w-full">
              <button 
                class="flex-1 bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] font-bold text-sm py-3 rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                :disabled="isGenerating"
                @click="handleStartGeneration"
              >
                <svg v-if="isGenerating" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                <span>{{ isGenerating ? '生成中...' : '现在开始生成' }}</span>
              </button>
              <button class="w-[88px] shrink-0 bg-transparent border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] font-medium text-sm py-3 rounded-lg transition-colors active:scale-[0.98]">取消</button>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <!-- Image Preview Modal -->
    <transition name="fade">
      <div v-if="previewImage" class="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/90 backdrop-blur-md cursor-zoom-out" @click="closePreview">
        <button class="absolute top-6 right-6 text-white/50 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-all" @click="closePreview">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
        <img :src="previewImage" @click.stop="closePreview" class="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl ring-1 ring-white/10" />
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
  background: var(--border-color);
  border-radius: 6px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}
</style>
