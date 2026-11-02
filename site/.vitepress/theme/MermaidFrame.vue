<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue';
import DiagramFrame from './DiagramFrame.vue';
import type { DiagramSize } from './diagram-scale.ts';
import { readMermaidSize } from './mermaid-size.ts';

withDefaults(defineProps<{ title?: string }>(), { title: 'Mermaid' });
const size = ref<DiagramSize | null>(null);
const error = ref('');
let revision = 0;
let disposed = false;

async function rendered(event: Event): Promise<void> {
  const current = ++revision;
  const wrapper = event.target as HTMLElement;
  const { success } = (event as CustomEvent<{ id: string; success: boolean }>).detail;
  if (!success) { size.value = null; error.value = 'Не удалось отрисовать схему'; return; }
  await nextTick();
  if (disposed || current !== revision || !wrapper.isConnected) return;
  const svg = wrapper.querySelector('svg');
  const natural = svg && readMermaidSize(svg);
  if (!natural) { size.value = null; error.value = 'Не удалось определить размер схемы'; return; }
  svg.style.width = `${natural.width}px`;
  svg.style.height = `${natural.height}px`;
  size.value = natural;
  error.value = '';
}
onBeforeUnmount(() => { disposed = true; revision++; });
</script>

<template>
  <DiagramFrame :title="title" :size="size" data-diagram-kind="mermaid" @vitepress-mermaid:render-complete="rendered">
    <slot />
    <template #status>
      <p v-if="error" role="alert" class="diagram-error">{{ error }}</p>
      <p v-else role="status">Загрузка схемы…</p>
    </template>
  </DiagramFrame>
</template>
