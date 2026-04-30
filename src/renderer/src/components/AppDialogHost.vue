<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import { useDialog } from '../composables/useDialog'

const dialog = useDialog()
const activeDialog = computed(() => dialog.state.stack[dialog.state.stack.length - 1])

watch(activeDialog, async (request) => {
  if (!request) return
  await nextTick()
  const button = document.querySelector(`[data-dialog-primary="${request.id}"]`) as HTMLButtonElement | null
  button?.focus()
})

const close = (value: boolean) => {
  if (!activeDialog.value) return
  dialog.closeDialog(activeDialog.value.id, value)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="activeDialog"
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      role="presentation"
      @mousedown.self="activeDialog.kind === 'confirm' ? undefined : close(true)"
    >
      <section
        class="w-full max-w-md rounded-lg border p-5 shadow-2xl"
        style="background-color: var(--bg-card); border-color: var(--border-color); color: var(--text-primary);"
        role="dialog"
        aria-modal="true"
      >
        <div class="flex items-start gap-3">
          <div
            class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"
            :class="activeDialog.kind === 'error' ? 'text-red-300' : 'text-blue-300'"
            style="background-color: var(--bg-secondary); border-color: var(--border-color);"
          >
            <span v-if="activeDialog.kind === 'error'" class="text-lg leading-none">!</span>
            <span v-else-if="activeDialog.kind === 'confirm'" class="text-lg leading-none">?</span>
            <span v-else class="text-lg leading-none">i</span>
          </div>
          <div class="min-w-0 flex-1">
            <h2 class="text-base font-bold">{{ activeDialog.title }}</h2>
            <p class="mt-2 whitespace-pre-wrap text-sm leading-6" style="color: var(--text-secondary);">
              {{ activeDialog.message }}
            </p>
          </div>
        </div>
        <div class="mt-5 flex justify-end gap-2">
          <button
            v-if="activeDialog.kind === 'confirm'"
            class="rounded-md border px-4 py-2 text-sm"
            style="border-color: var(--border-color); color: var(--text-secondary);"
            @click="close(false)"
          >
            {{ activeDialog.cancelText }}
          </button>
          <button
            class="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
            :data-dialog-primary="activeDialog.id"
            @click="close(true)"
          >
            {{ activeDialog.confirmText }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
