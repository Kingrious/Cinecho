<script setup lang="ts">
import {
  ChevronDown,
  GripVertical,
  ImagePlus,
  Plus,
  Trash2
} from 'lucide-vue-next'

type ShotRow = {
  id: number
  no: number
  content: string
  lens: string
  move: string
  actor: string
}

const shots: ShotRow[] = [
  { id: 1, no: 1, content: '补充镜头内容', lens: '中景', move: '固定', actor: '演员' },
  { id: 2, no: 2, content: '补充镜头内容', lens: '中景', move: '固定', actor: '演员' },
  { id: 3, no: 3, content: '补充镜头内容', lens: '中景', move: '固定', actor: '演员' },
  { id: 4, no: 4, content: '补充镜头内容', lens: '中景', move: '固定', actor: '演员' }
]
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
            <button class="primary-button" type="button" title="新建分镜">
              <Plus class="h-4 w-4" />
              <span>新建</span>
            </button>
          </div>
        </div>
      </section>

      <section class="min-h-0 flex-1 overflow-hidden px-6 py-5">
        <div class="panel-shell h-full overflow-hidden rounded-xl border border-[var(--border-color)]">
          <div class="panel-topbar">
            <div>
              <p class="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--text-tertiary)]">
                Shot Table
              </p>
            </div>
            <div class="flex flex-wrap gap-2 text-[10px] text-[var(--text-tertiary)]">
              <span class="metric-pill">{{ shots.length }} shots</span>
            </div>
          </div>

          <div class="h-[calc(100%-72px)] overflow-auto custom-scrollbar">
            <table class="min-w-[1480px] border-collapse text-left">
              <colgroup>
                <col class="w-[78px]" />
                <col class="w-[94px]" />
                <col class="w-[218px]" />
                <col class="w-[320px]" />
                <col class="w-[170px]" />
                <col class="w-[170px]" />
                <col class="w-[170px]" />
                <col class="w-[112px]" />
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
                  <th class="table-head">操作</th>
                </tr>
              </thead>

              <tbody>
                <tr
                  v-for="shot in shots"
                  :key="shot.id"
                  class="border-b border-[var(--border-color)] last:border-b-0 hover:bg-white/[0.03]"
                >
                  <td class="table-cell">
                    <button class="drag-button" type="button" title="拖动排序">
                      <GripVertical class="h-4 w-4" />
                    </button>
                  </td>

                  <td class="table-cell">
                    <div class="number-badge">
                      {{ shot.no }}
                    </div>
                  </td>

                  <td class="table-cell">
                    <button class="image-placeholder" type="button" title="新增画面">
                      <ImagePlus class="h-6 w-6 text-[var(--text-tertiary)]" />
                      <span>新增画面</span>
                    </button>
                  </td>

                  <td class="table-cell">
                    <input class="plain-input" type="text" :value="shot.content" aria-label="镜头内容" />
                  </td>

                  <td class="table-cell">
                    <div class="select-shell">
                      <span>{{ shot.lens }}</span>
                      <ChevronDown class="h-4 w-4 text-[var(--text-tertiary)]" />
                    </div>
                  </td>

                  <td class="table-cell">
                    <div class="select-shell">
                      <span>{{ shot.move }}</span>
                      <ChevronDown class="h-4 w-4 text-[var(--text-tertiary)]" />
                    </div>
                  </td>

                  <td class="table-cell">
                    <input class="plain-input strong-input" type="text" :value="shot.actor" aria-label="演员" />
                  </td>

                  <td class="table-cell">
                    <div class="flex items-center gap-3 text-[var(--text-secondary)]">
                      <button class="icon-button" type="button" title="删除">
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
      </section>
    </main>
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
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

.toolbar-button:hover {
  border-color: rgba(96, 165, 250, 0.35);
  background: var(--bg-tertiary);
  color: var(--text-primary);
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

.primary-button:hover {
  background: rgb(59 130 246);
}

.primary-button:active {
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

.table-head {
  height: 2.75rem;
  padding: 0 0.875rem;
  white-space: nowrap;
}

.table-cell {
  height: 8.125rem;
  padding: 0.875rem;
  vertical-align: top;
}

.drag-button {
  display: grid;
  height: 2.5rem;
  width: 2.5rem;
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
  width: 4.375rem;
  place-items: center;
  border-radius: 0.625rem;
  border: 1px solid var(--border-color);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0));
  font-size: 1rem;
  font-weight: 800;
  color: var(--text-primary);
}

.image-placeholder {
  display: grid;
  aspect-ratio: 16 / 9;
  width: 11.5rem;
  place-items: center;
  gap: 0.45rem;
  border-radius: 0.5rem;
  border: 1px dashed rgba(113, 113, 122, 0.9);
  background: rgba(255, 255, 255, 0.02);
  color: var(--text-secondary);
  font-size: 0.8125rem;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.image-placeholder:hover {
  border-color: rgba(96, 165, 250, 0.45);
  background: rgba(59, 130, 246, 0.08);
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

.strong-input {
  font-weight: 600;
  color: var(--text-secondary);
}

.select-shell {
  display: flex;
  height: 2.25rem;
  width: 9rem;
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
</style>
