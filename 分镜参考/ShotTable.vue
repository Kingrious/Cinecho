<template>
  <div class="grid gap-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-black">制作分镜</h2>
        <p class="muted">可直接编辑单元格，拖动行调整镜头顺序，镜号会自动按当前行序重排。</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <n-popover trigger="click" placement="bottom-end" :show-arrow="false">
          <template #trigger>
            <button class="tool-button" title="列设置">
              <SlidersHorizontal class="h-4 w-4" />
              列设置
            </button>
          </template>
          <div class="w-[560px] max-w-[calc(100vw-32px)]">
            <ColumnSettings
              :columns="allColumns"
              :labels="store.columnLabels"
              :hidden="store.hiddenColumns"
              @rename="store.setColumnLabel"
              @toggle="store.toggleColumn"
            />
            <div v-if="store.deletedColumns.length" class="mt-3 flex justify-end">
              <n-button size="small" @click="store.restoreColumns">恢复已删除列</n-button>
            </div>
          </div>
        </n-popover>
        <button class="tool-button" title="批量模式" @click="message.info('已进入批量模式')">
          <ListChecks class="h-4 w-4" />
          批量模式
        </button>
        <button class="primary-button" @click="addShot">
          <Plus class="h-4 w-4" />
          新建
        </button>
      </div>
    </div>

    <div class="surface overflow-auto">
      <table class="min-w-max border-collapse">
        <colgroup>
          <col v-for="column in visibleColumns" :key="column.key" :style="{ width: `${columnWidths[column.key] || column.width}px` }" />
        </colgroup>
        <thead>
          <tr class="bg-zinc-50 text-left text-xs font-bold text-zinc-500">
            <th
              v-for="header in table.getHeaderGroups()[0].headers"
              :key="header.id"
              class="group relative select-none border-b border-line px-3 py-3"
            >
              <div class="flex items-center justify-between gap-2 pr-5">
                <span class="truncate">{{ header.column.columnDef.header }}</span>
                <n-dropdown
                  trigger="click"
                  placement="bottom-end"
                  :options="columnMenuOptionsFor(header.column.id)"
                  @select="(key: string | number) => handleColumnMenu(String(key), header.column.id)"
                >
                  <button class="absolute right-5 top-1/2 hidden h-6 w-6 -translate-y-1/2 place-items-center rounded-md border border-line bg-white text-zinc-500 shadow-sm group-hover:grid" title="列菜单">
                    <ChevronDown class="h-4 w-4" />
                  </button>
                </n-dropdown>
              </div>
              <span
                class="absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none hover:bg-amber-200"
                title="拖动调整列宽"
                @pointerdown.prevent="startResize(header.column.id, $event)"
              />
            </th>
          </tr>
        </thead>
        <tbody ref="tbodyRef">
          <tr v-for="row in table.getRowModel().rows" :key="row.original.id" :data-id="row.original.id" class="border-b border-line last:border-0 hover:bg-amber-50/50">
            <td v-for="cell in row.getVisibleCells()" :key="cell.id" class="px-3 py-3 align-top">
              <template v-if="cell.column.id === 'drag'">
                <button class="drag-handle grid h-9 w-9 cursor-grab place-items-center rounded-lg border border-line bg-white" title="拖动排序">
                  <GripVertical class="h-4 w-4" />
                </button>
              </template>

              <template v-else-if="cell.column.id === 'image'">
                <div
                  class="group/image relative grid aspect-video min-h-20 w-full place-items-center overflow-hidden rounded-lg border border-dashed border-zinc-300 bg-zinc-100 text-xs text-zinc-500 transition hover:border-ink hover:bg-zinc-50"
                  @dragover.prevent
                  @drop.prevent="event => handleImageDrop(row.original.id, event)"
                >
                  <img v-if="row.original.imageUrl" :src="row.original.imageUrl" :alt="row.original.image" class="h-full w-full object-cover" />
                  <div v-else class="grid place-items-center gap-2 px-3 text-center">
                    <ImagePlus class="h-5 w-5 text-zinc-400" />
                    <span>{{ row.original.image }}</span>
                  </div>
                  <button
                    class="absolute bottom-2 right-2 inline-flex h-8 items-center gap-1 rounded-lg bg-white/95 px-2 text-xs font-semibold text-ink opacity-0 shadow-sm ring-1 ring-black/5 transition hover:bg-ink hover:text-white group-hover/image:opacity-100"
                    title="上传画面"
                    @click="openImagePicker(row.original.id)"
                  >
                    <Upload class="h-3.5 w-3.5" />
                    上传
                  </button>
                  <span class="pointer-events-none absolute left-2 top-2 hidden rounded bg-black/55 px-2 py-1 text-[11px] text-white group-hover/image:block">支持拖拽图片</span>
                </div>
              </template>

              <template v-else-if="cell.column.id === 'lens'">
                <n-select
                  class="min-w-[132px]"
                  :value="row.original.lens"
                  :options="selectOptions(store.lensOptions)"
                  :consistent-menu-width="false"
                  :menu-props="{ style: { minWidth: '168px' } }"
                  size="small"
                  @update:value="(value: string) => store.updateShot(row.original.id, { lens: String(value) })"
                />
              </template>

              <template v-else-if="cell.column.id === 'move'">
                <n-select
                  class="min-w-[132px]"
                  :value="row.original.move"
                  :options="selectOptions(store.moveOptions)"
                  :consistent-menu-width="false"
                  :menu-props="{ style: { minWidth: '168px' } }"
                  size="small"
                  @update:value="(value: string) => store.updateShot(row.original.id, { move: String(value) })"
                />
              </template>

              <template v-else-if="cell.column.id === 'duration'">
                <n-input-number
                  class="min-w-[92px]"
                  :value="row.original.duration"
                  :min="0"
                  size="small"
                  @update:value="(value: number | null) => store.updateShot(row.original.id, { duration: Number(value) || 0 })"
                >
                  <template #suffix>s</template>
                </n-input-number>
              </template>

              <template v-else-if="cell.column.id === 'actions'">
                <div class="flex gap-1">
                  <n-button size="small" quaternary circle title="复制" @click="duplicate(row.original.id)">
                    <template #icon><Copy class="h-4 w-4" /></template>
                  </n-button>
                  <n-button size="small" quaternary circle title="删除" @click="store.removeShot(row.original.id)">
                    <template #icon><Trash2 class="h-4 w-4" /></template>
                  </n-button>
                </div>
              </template>

              <template v-else-if="cell.column.id === 'no'">
                <div class="grid h-9 w-full place-items-center rounded-md bg-zinc-50 text-sm font-bold text-zinc-700">
                  {{ row.original.no }}
                </div>
              </template>

              <template v-else>
                <input
                  class="table-input"
                  :value="String(cell.getValue() ?? '')"
                  :placeholder="cell.column.id === 'content' ? '补充镜头内容' : ''"
                  @change="event => updateCell(row.original.id, cell.column.id, event)"
                />
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex flex-wrap gap-2 text-xs text-zinc-500">
      <span class="rounded bg-zinc-100 px-2 py-1">镜头总数 {{ store.shots.length }}</span>
      <span class="rounded bg-zinc-100 px-2 py-1">总时长 {{ store.totalDuration }} s</span>
      <span class="rounded bg-zinc-100 px-2 py-1">协作状态 在线同步</span>
    </div>

    <n-modal v-model:show="editColumn.visible" preset="card" title="编辑列" class="max-w-md">
      <n-input v-model:value="editColumn.label" placeholder="请输入列标题" />
      <template #footer>
        <div class="flex justify-end gap-2">
          <n-button @click="editColumn.visible = false">取消</n-button>
          <n-button type="primary" @click="saveColumnName">保存</n-button>
        </div>
      </template>
    </n-modal>

    <input ref="imageInputRef" class="hidden" type="file" accept="image/*" @change="handlePickedImage" />
  </div>
</template>

<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { createColumnHelper, getCoreRowModel, useVueTable } from '@tanstack/vue-table';
import Sortable from 'sortablejs';
import { ChevronDown, Copy, GripVertical, ImagePlus, ListChecks, Plus, SlidersHorizontal, Trash2, Upload } from 'lucide-vue-next';
import { useMessage, type DropdownOption } from 'naive-ui';
import ColumnSettings from './ColumnSettings.vue';
import type { Shot } from '@/types';
import { useWorkspaceStore } from '@/stores/workspace';

const store = useWorkspaceStore();
const message = useMessage();
const tbodyRef = ref<HTMLElement | null>(null);
const imageInputRef = ref<HTMLInputElement | null>(null);
const pickingImageFor = ref('');
const columnHelper = createColumnHelper<Shot>();

const allColumns = [
  { key: 'drag', label: '排序', type: '操作', system: true, width: 72 },
  { key: 'no', label: '镜号', type: '文本', system: true, width: 88 },
  { key: 'image', label: '画面', type: '图片', system: true, width: 190 },
  { key: 'content', label: '内容', type: '文本', system: true, width: 300 },
  { key: 'lens', label: '景别', type: '单选', width: 150 },
  { key: 'move', label: '运动', type: '单选', width: 150 },
  { key: 'actor', label: '演员', type: '文本', width: 150 },
  { key: 'sound', label: '声音', type: '文本', width: 150 },
  { key: 'duration', label: '时长', type: '数字', width: 126 },
  { key: 'actions', label: '操作', type: '操作', system: true, width: 96 },
];
const nonDeletableColumnKeys = ['drag', 'actions'];

const columnWidths = reactive<Record<string, number>>(
  Object.fromEntries(allColumns.map(column => [column.key, column.width])),
);

const columnMenuOptions: DropdownOption[] = [
  { label: '编辑列', key: 'edit' },
  { label: '删除列', key: 'delete' },
  { label: '隐藏列', key: 'hide' },
];

function columnMenuOptionsFor(key: string) {
  return nonDeletableColumnKeys.includes(key)
    ? columnMenuOptions.filter(option => option.key !== 'delete')
    : columnMenuOptions;
}

const editColumn = reactive({
  visible: false,
  key: '',
  label: '',
});

const visibleColumns = computed(() => allColumns
  .filter(column => !store.hiddenColumns.includes(column.key) && !store.deletedColumns.includes(column.key)));

const columns = computed(() => visibleColumns.value
  .map(column => columnHelper.accessor(row => row[column.key as keyof Shot], {
    id: column.key,
    header: store.columnLabels[column.key] || column.label,
    cell: info => h('span', String(info.getValue() ?? '')),
  })));

const table = useVueTable({
  get data() {
    return store.shots;
  },
  get columns() {
    return columns.value;
  },
  getCoreRowModel: getCoreRowModel(),
});

function selectOptions(options: string[]) {
  return options.map(label => ({ label, value: label }));
}

function updateCell(id: string, key: string, event: Event) {
  const value = (event.target as HTMLInputElement).value;
  store.updateShot(id, { [key]: value });
  message.success('分镜已更新');
}

function addShot() {
  store.addShot();
  message.success('创建分镜成功');
}

function duplicate(id: string) {
  store.duplicateShot(id);
  message.success('复制成功');
}

function handleColumnMenu(action: string, key: string) {
  if (action === 'edit') {
    const column = allColumns.find(item => item.key === key);
    editColumn.key = key;
    editColumn.label = store.columnLabels[key] || column?.label || '';
    editColumn.visible = true;
    return;
  }

  if (action === 'delete') {
    if (nonDeletableColumnKeys.includes(key)) {
      message.warning('排序列和操作列不可删除');
      return;
    }
    store.deleteColumn(key);
    message.success('列已删除');
    return;
  }

  if (action === 'hide') {
    store.toggleColumn(key);
    message.success('列已隐藏');
  }
}

function saveColumnName() {
  if (!editColumn.key || !editColumn.label.trim()) return;
  store.setColumnLabel(editColumn.key, editColumn.label.trim());
  editColumn.visible = false;
  message.success('列名已更新');
}

function startResize(key: string, event: PointerEvent) {
  const startX = event.clientX;
  const startWidth = columnWidths[key] || allColumns.find(column => column.key === key)?.width || 120;

  const move = (moveEvent: PointerEvent) => {
    columnWidths[key] = Math.max(72, startWidth + moveEvent.clientX - startX);
  };

  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function openImagePicker(id: string) {
  pickingImageFor.value = id;
  imageInputRef.value?.click();
}

function handlePickedImage(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file && pickingImageFor.value) applyImageFile(pickingImageFor.value, file);
  pickingImageFor.value = '';
  (event.target as HTMLInputElement).value = '';
}

function handleImageDrop(id: string, event: DragEvent) {
  const file = Array.from(event.dataTransfer?.files || []).find(item => item.type.startsWith('image/'));
  if (file) applyImageFile(id, file);
}

function applyImageFile(id: string, file: File) {
  const imageUrl = URL.createObjectURL(file);
  store.updateShot(id, { image: file.name, imageUrl });
  message.success('画面已上传');
}

onMounted(() => {
  if (!tbodyRef.value) return;
  Sortable.create(tbodyRef.value, {
    handle: '.drag-handle',
    animation: 150,
    ghostClass: 'drag-ghost',
    onEnd: () => {
      const ids = Array.from(tbodyRef.value?.querySelectorAll('tr') || []).map(row => row.getAttribute('data-id') || '');
      store.reorderShots(ids);
      message.success('排序已保存，镜号已重排');
    },
  });
});

onBeforeUnmount(() => {
  store.shots.forEach(shot => {
    if (shot.imageUrl?.startsWith('blob:')) URL.revokeObjectURL(shot.imageUrl);
  });
});
</script>
