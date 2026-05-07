<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { configApi, dialogApi, storeApi, systemApi } from '../api/media'
import { useDialog } from '../composables/useDialog'

type ProviderId = 'ark' | 'google' | 'bailian' | 'openrouter' | 'minimax' | 'vidu' | 'fal'

const PROVIDERS: Array<{
  id: ProviderId
  name: string
  text: boolean
  image: boolean
  video: boolean
  models: { text?: string[]; image?: string[]; video?: string[] }
}> = [
  { id: 'ark', name: 'VolcEngine Ark', text: true, image: true, video: true, models: { text: ['doubao-seed-2-0-lite-260215'], image: ['doubao-seedream-5-0-260128'], video: ['doubao-seedance-1-0-pro-fast-251015', 'doubao-seedance-1-5-pro-251215'] } },
  { id: 'google', name: 'Google AI Studio', text: true, image: true, video: true, models: { text: ['gemini-3-pro-preview'], image: ['gemini-3-pro-image-preview'], video: ['veo-3.1-generate-preview'] } },
  { id: 'bailian', name: 'Alibaba Bailian', text: true, image: false, video: true, models: { text: ['qwen-plus'], video: ['wan2.5-i2v-preview'] } },
  { id: 'openrouter', name: 'OpenRouter', text: true, image: false, video: false, models: { text: ['openai/gpt-5.1'] } },
  { id: 'minimax', name: 'MiniMax', text: true, image: false, video: true, models: { text: ['MiniMax-M2.5'], video: ['minimax/hailuo-02'] } },
  { id: 'vidu', name: 'Vidu', text: false, image: false, video: true, models: { video: ['vidu-2.0'] } },
  { id: 'fal', name: 'FAL', text: false, image: true, video: true, models: { image: ['fal-ai/nano-banana-pro'], video: ['fal-ai/veo3'] } }
]

const outputDir = ref('')
const dialog = useDialog()
const isLoading = ref(true)
const isSaving = ref(false)
const hasChanges = ref(false)
const currentTheme = ref('light')

const selectedKeyProvider = ref<ProviderId>('ark')
const apiKeys = ref<Record<string, string>>({})
const showApiKey = ref(false)
const isValidating = ref(false)
const validationResult = ref<{ valid: boolean; error?: string } | null>(null)

const defaultTextProvider = ref<ProviderId>('ark')
const defaultImageProvider = ref<ProviderId>('ark')
const defaultVideoProvider = ref<ProviderId>('ark')
const defaultTextModel = ref('doubao-seed-2-0-lite-260215')
const defaultImageModel = ref('doubao-seedream-5-0-260128')
const defaultVideoModel = ref('doubao-seedance-1-0-pro-fast-251015')
const videoMaxParallel = ref(3)

const selectedProvider = computed(() => PROVIDERS.find(provider => provider.id === selectedKeyProvider.value) || PROVIDERS[0])
const textProviders = computed(() => PROVIDERS.filter(provider => provider.text))
const imageProviders = computed(() => PROVIDERS.filter(provider => provider.image))
const videoProviders = computed(() => PROVIDERS.filter(provider => provider.video))
const textModels = computed(() => PROVIDERS.find(provider => provider.id === defaultTextProvider.value)?.models.text || [])
const imageModels = computed(() => PROVIDERS.find(provider => provider.id === defaultImageProvider.value)?.models.image || [])
const videoModels = computed(() => PROVIDERS.find(provider => provider.id === defaultVideoProvider.value)?.models.video || [])

const activeApiKey = computed({
  get: () => apiKeys.value[selectedKeyProvider.value] || '',
  set: (value: string) => {
    apiKeys.value = { ...apiKeys.value, [selectedKeyProvider.value]: value }
    validationResult.value = null
    hasChanges.value = true
  }
})

const getDefaultOutputDir = () => 'C:\\Users\\Public\\Documents\\Cinecho\\Assets'

const ensureModelForProvider = () => {
  if (!textModels.value.includes(defaultTextModel.value)) defaultTextModel.value = textModels.value[0] || ''
  if (!imageModels.value.includes(defaultImageModel.value)) defaultImageModel.value = imageModels.value[0] || ''
  if (!videoModels.value.includes(defaultVideoModel.value)) defaultVideoModel.value = videoModels.value[0] || ''
}

const normalizeVideoMaxParallel = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 3
  return Math.min(10, Math.max(1, Math.round(parsed)))
}

const loadSettings = async () => {
  isLoading.value = true
  try {
    const data = await storeApi.get()
    const settings = data.settings || {}
    outputDir.value = settings.outputDir || getDefaultOutputDir()
    apiKeys.value = { ...(settings.apiKeys || {}) }
    if (settings.apiKey && !apiKeys.value.ark) apiKeys.value.ark = settings.apiKey
    defaultTextProvider.value = settings.defaultTextProvider || 'ark'
    defaultImageProvider.value = settings.defaultImageProvider || 'ark'
    defaultVideoProvider.value = settings.defaultVideoProvider || 'ark'
    defaultTextModel.value = settings.defaultTextModel || 'doubao-seed-2-0-lite-260215'
    defaultImageModel.value = settings.defaultImageModel || 'doubao-seedream-5-0-260128'
    defaultVideoModel.value = settings.defaultVideoModel || 'doubao-seedance-1-0-pro-fast-251015'
    videoMaxParallel.value = normalizeVideoMaxParallel(settings.videoMaxParallel ?? 3)
    currentTheme.value = settings.theme || 'light'
    ensureModelForProvider()
    hasChanges.value = false
  } finally {
    isLoading.value = false
  }
}

const handleSelectDirectory = async () => {
  const dir = await dialogApi.selectDirectory()
  if (dir) {
    outputDir.value = dir
    hasChanges.value = true
    await handleSave(false)
  }
}

const handleOpenDirectory = async () => {
  if (outputDir.value) await systemApi.openDirectory(outputDir.value)
}

const handleThemeChange = (theme: string) => {
  currentTheme.value = theme
  hasChanges.value = true
  window.dispatchEvent(new CustomEvent('theme-change', { detail: theme }))
  void handleSave(false)
}

const handleProviderChange = () => {
  ensureModelForProvider()
  hasChanges.value = true
  void handleSave(false)
}

const handleVideoMaxParallelInput = (value: string) => {
  videoMaxParallel.value = normalizeVideoMaxParallel(value)
  hasChanges.value = true
  void handleSave(false)
}

const handlePasteApiKey = async () => {
  const text = await navigator.clipboard.readText()
  if (text) activeApiKey.value = text.trim()
}

const validateApiKey = async () => {
  if (!activeApiKey.value.trim()) {
    validationResult.value = { valid: false, error: '请输入 API Key' }
    return
  }
  isValidating.value = true
  validationResult.value = null
  try {
    const result = await configApi.validateKey({ provider: selectedKeyProvider.value, apiKey: activeApiKey.value.trim() })
    validationResult.value = result
    if (result.valid) await handleSave(false)
  } finally {
    isValidating.value = false
  }
}

const handleSave = async (showAlert = true) => {
  isSaving.value = true
  try {
    ensureModelForProvider()
    const plainApiKeys = Object.fromEntries(
      Object.entries(apiKeys.value).map(([provider, apiKey]) => [provider, apiKey || ''])
    )

    const settingsPayload = {
      outputDir: outputDir.value,
      theme: currentTheme.value,
      apiKeys: plainApiKeys,
      apiKey: plainApiKeys.ark || '',
      defaultTextProvider: defaultTextProvider.value,
      defaultImageProvider: defaultImageProvider.value,
      defaultVideoProvider: defaultVideoProvider.value,
      defaultTextModel: defaultTextModel.value,
      defaultImageModel: defaultImageModel.value,
      defaultVideoModel: defaultVideoModel.value,
      videoMaxParallel: normalizeVideoMaxParallel(videoMaxParallel.value)
    }

    await storeApi.updateSetting(settingsPayload)
    hasChanges.value = false
  } catch (error) {
    console.error('Failed to save settings:', error)
    if (showAlert) await dialog.error('保存设置失败')
  } finally {
    isSaving.value = false
  }
}

onMounted(loadSettings)
</script>

<template>
  <div class="h-full overflow-auto p-8" style="background-color: var(--bg-primary); color: var(--text-primary);">
    <div class="mx-auto max-w-5xl space-y-6">
      <header>
        <h2 class="text-3xl font-bold">Settings</h2>
        <p class="mt-2 text-sm" style="color: var(--text-secondary);">Configure storage, providers, and generation defaults.</p>
      </header>

      <section class="rounded-xl p-5 space-y-4" style="background-color: var(--bg-card); border: 1px solid var(--border-color);">
        <h3 class="text-lg font-semibold">Storage</h3>
        <div class="flex gap-2">
          <input :value="outputDir" readonly class="flex-1 rounded-lg px-3 py-2 font-mono text-sm" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);" />
          <button class="px-4 py-2 rounded-lg border" style="border-color: var(--border-color);" @click="handleSelectDirectory">Browse</button>
          <button class="px-4 py-2 rounded-lg border" style="border-color: var(--border-color);" @click="handleOpenDirectory">Open</button>
        </div>
        <div class="grid grid-cols-5 gap-2 text-xs font-mono">
          <div v-for="name in ['roles', 'costumes', 'scenes', 'storyboards', 'videos']" :key="name" class="rounded-md px-3 py-2" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);">{{ name }}</div>
        </div>
      </section>

      <section class="rounded-xl p-5 space-y-4" style="background-color: var(--bg-card); border: 1px solid var(--border-color);">
        <h3 class="text-lg font-semibold">API Credentials</h3>
        <div class="grid grid-cols-1 md:grid-cols-[220px_1fr_auto] gap-3">
          <select v-model="selectedKeyProvider" class="rounded-lg px-3 py-2" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);">
            <option v-for="provider in PROVIDERS" :key="provider.id" :value="provider.id">{{ provider.name }}</option>
          </select>
          <div class="relative">
            <input v-model="activeApiKey" :type="showApiKey ? 'text' : 'password'" class="w-full rounded-lg px-3 py-2 pr-20 font-mono text-sm" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);" :placeholder="`${selectedProvider.name} API Key`" />
            <div class="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
              <button class="px-2 py-1 text-xs rounded" @click="handlePasteApiKey">Paste</button>
              <button class="px-2 py-1 text-xs rounded" @click="showApiKey = !showApiKey">{{ showApiKey ? 'Hide' : 'Show' }}</button>
            </div>
          </div>
          <button class="px-4 py-2 rounded-lg text-white" style="background-color: var(--accent-color);" :disabled="isValidating" @click="validateApiKey">
            {{ isValidating ? 'Testing...' : 'Test & Save' }}
          </button>
        </div>
        <p v-if="validationResult" class="text-sm" :style="{ color: validationResult.valid ? '#22c55e' : '#ef4444' }">
          {{ validationResult.valid ? 'API Key 验证成功' : validationResult.error }}
        </p>
      </section>

      <section class="rounded-xl p-5 space-y-4" style="background-color: var(--bg-card); border: 1px solid var(--border-color);">
        <h3 class="text-lg font-semibold">Default Providers</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="space-y-2">
            <label class="text-xs font-bold" style="color: var(--text-tertiary);">Text Optimization</label>
            <select v-model="defaultTextProvider" class="w-full rounded-lg px-3 py-2" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);" @change="handleProviderChange">
              <option v-for="provider in textProviders" :key="provider.id" :value="provider.id">{{ provider.name }}</option>
            </select>
            <select v-model="defaultTextModel" class="w-full rounded-lg px-3 py-2" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);" @change="handleSave(false)">
              <option v-for="model in textModels" :key="model" :value="model">{{ model }}</option>
            </select>
          </div>
          <div class="space-y-2">
            <label class="text-xs font-bold" style="color: var(--text-tertiary);">Image / Storyboard</label>
            <select v-model="defaultImageProvider" class="w-full rounded-lg px-3 py-2" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);" @change="handleProviderChange">
              <option v-for="provider in imageProviders" :key="provider.id" :value="provider.id">{{ provider.name }}</option>
            </select>
            <select v-model="defaultImageModel" class="w-full rounded-lg px-3 py-2" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);" @change="handleSave(false)">
              <option v-for="model in imageModels" :key="model" :value="model">{{ model }}</option>
            </select>
          </div>
          <div class="space-y-2">
            <label class="text-xs font-bold" style="color: var(--text-tertiary);">Video Generation</label>
            <select v-model="defaultVideoProvider" class="w-full rounded-lg px-3 py-2" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);" @change="handleProviderChange">
              <option v-for="provider in videoProviders" :key="provider.id" :value="provider.id">{{ provider.name }}</option>
            </select>
            <select v-model="defaultVideoModel" class="w-full rounded-lg px-3 py-2" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);" @change="handleSave(false)">
              <option v-for="model in videoModels" :key="model" :value="model">{{ model }}</option>
            </select>
            <div class="space-y-1">
              <label class="text-xs font-bold" style="color: var(--text-tertiary);">最高并行数</label>
              <input
                :value="videoMaxParallel"
                type="number"
                min="1"
                max="10"
                step="1"
                class="w-full rounded-lg px-3 py-2"
                style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
                @input="event => handleVideoMaxParallelInput((event.target as HTMLInputElement).value)"
              />
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-xl p-5 space-y-4" style="background-color: var(--bg-card); border: 1px solid var(--border-color);">
        <h3 class="text-lg font-semibold">Appearance</h3>
        <div class="flex gap-2">
          <button class="flex-1 rounded-lg border py-2" :style="currentTheme === 'dark' ? 'background-color: rgba(96,165,250,.14); border-color: var(--accent-color);' : 'border-color: var(--border-color);'" @click="handleThemeChange('dark')">Dark</button>
          <button class="flex-1 rounded-lg border py-2" :style="currentTheme === 'light' ? 'background-color: rgba(96,165,250,.14); border-color: var(--accent-color);' : 'border-color: var(--border-color);'" @click="handleThemeChange('light')">Light</button>
        </div>
      </section>
    </div>
  </div>
</template>
