<template>
  <div class="flex flex-col h-screen w-full overflow-hidden" :data-theme="currentTheme">
    <header class="app-drag-region w-full h-[52px] border-b backdrop-blur-xl flex items-center justify-between px-4 shadow-sm shrink-0 z-10 relative" :style="{ backgroundColor: 'var(--header-bg)', borderColor: 'var(--border-color)' }">
      <div class="flex items-center gap-3">
        <div class="w-7 h-7 rounded bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/20"></div>
        <h1 class="text-sm font-semibold tracking-wide text-[var(--accent-color)]">Cinecho 1.0</h1>
      </div>
      <div class="window-controls no-drag">
        <button class="win-btn" type="button" aria-label="Minimize" @click="handleMinimize">
          <Minus :size="14" />
        </button>
        <button class="win-btn" type="button" :aria-label="isMaximized ? 'Restore' : 'Maximize'" @click="handleToggleMaximize">
          <Copy v-if="isMaximized" :size="12" />
          <Square v-else :size="12" />
        </button>
        <button class="win-btn win-btn-close" type="button" aria-label="Close" @click="handleClose">
          <X :size="14" />
        </button>
      </div>
    </header>

    <main class="flex-1 relative overflow-hidden z-0" :style="{ backgroundColor: 'var(--bg-primary)' }" tabindex="-1">
      <div class="relative h-full overflow-auto">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <keep-alive>
              <component :is="Component" />
            </keep-alive>
          </transition>
        </router-view>
      </div>
    </main>

    <nav class="w-full border-t backdrop-blur-xl flex items-center justify-around px-2 py-1.5 shadow-sm shrink-0 z-10 relative" :style="{ backgroundColor: 'var(--nav-bg)', borderColor: 'var(--border-color)' }">
      <router-link to="/assets" class="nav-link" active-class="nav-link-active">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 22H4a2 2 0 0 1-2-2V6"/><path d="m22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18"/><circle cx="12" cy="8" r="2"/><rect width="16" height="16" x="6" y="2" rx="2"/></svg>
        <span class="font-medium text-[9px] uppercase tracking-wider">资产库 LIBRARY</span>
      </router-link>
      <router-link to="/storyboard" class="nav-link" active-class="nav-link-active">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h3"/><path d="M14 8h3"/><path d="M7 12h3"/><path d="M14 12h3"/><path d="M7 16h3"/><path d="M14 16h3"/></svg>
        <span class="font-medium text-[9px] uppercase tracking-wider">分镜 STORYBOARD</span>
      </router-link>
      <router-link to="/" class="nav-link" active-class="nav-link-active">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span class="font-medium text-[9px] uppercase tracking-wider">创作 CREATION</span>
      </router-link>
      <router-link to="/stitch" class="nav-link" active-class="nav-link-active">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/></svg>
        <span class="font-medium text-[9px] uppercase tracking-wider">拼接 STITCH</span>
      </router-link>
      <router-link to="/settings" class="nav-link" active-class="nav-link-active">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        <span class="font-medium text-[9px] uppercase tracking-wider">设置 SETTINGS</span>
      </router-link>
    </nav>

    <AppDialogHost />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Copy, Minus, Square, X } from 'lucide-vue-next'
import { storeApi, windowApi } from './api/media'
import AppDialogHost from './components/AppDialogHost.vue'

const currentTheme = ref('dark')
const isMaximized = ref(false)
let removeWindowMaximizedListener: (() => void) | undefined

onMounted(() => {
  loadTheme()
  loadWindowState()
  removeWindowMaximizedListener = windowApi.onMaximizedChange((value) => {
    isMaximized.value = value
  })
  window.addEventListener('theme-change', handleThemeChange as EventListener)
})

onUnmounted(() => {
  removeWindowMaximizedListener?.()
  window.removeEventListener('theme-change', handleThemeChange as EventListener)
})

const handleThemeChange = (event: CustomEvent) => {
  const theme = event.detail as string
  currentTheme.value = theme
  saveTheme(theme)
}

const loadTheme = async () => {
  try {
    const data = await storeApi.get()
    const savedTheme = data.settings?.theme
    if (savedTheme) currentTheme.value = savedTheme
  } catch (error) {
    console.error('Failed to load theme:', error)
  }
}

const saveTheme = async (theme: string) => {
  try {
    await storeApi.updateSetting({ theme })
  } catch (error) {
    console.error('Failed to save theme:', error)
  }
}

const loadWindowState = async () => {
  try {
    isMaximized.value = await windowApi.isMaximized()
  } catch {
    isMaximized.value = false
  }
}

const handleMinimize = async () => {
  try {
    await windowApi.minimize()
  } catch (error) {
    console.error('Failed to minimize window:', error)
  }
}

const handleToggleMaximize = async () => {
  try {
    isMaximized.value = await windowApi.toggleMaximize()
  } catch (error) {
    console.error('Failed to toggle maximize:', error)
  }
}

const handleClose = async () => {
  try {
    await windowApi.close()
  } catch (error) {
    console.error('Failed to close window:', error)
  }
}

defineExpose({
  setTheme: (theme: string) => {
    currentTheme.value = theme
    saveTheme(theme)
  },
  getTheme: () => currentTheme.value
})
</script>

<style scoped>
.app-drag-region {
  -webkit-app-region: drag;
}

.no-drag {
  -webkit-app-region: no-drag;
}

.window-controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.win-btn {
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 0.375rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: background-color 0.15s ease, color 0.15s ease;
}

.win-btn:hover {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
}

.win-btn-close:hover {
  background-color: #ef4444;
  color: #fff;
}

.nav-link {
  @apply flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-200 min-w-[4rem];
  color: var(--text-tertiary);
}

.nav-link:hover {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
}

.nav-link-active {
  color: #60a5fa;
  background-color: rgba(96, 165, 250, 0.1);
  border: 1px solid rgba(96, 165, 250, 0.2);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
