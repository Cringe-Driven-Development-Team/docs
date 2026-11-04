<script setup lang="ts">
import { withBase } from 'vitepress';
import { computed } from 'vue';
import { EraserFrame } from '@wely6743/vitepress-diagram-viewer';
import { data as sizes } from './diagrams.data.ts';

const props = defineProps<{ name: string }>();
const size = computed(() => sizes[props.name]);
const html = computed(() => withBase(`/${props.name}.html`));
const png = computed(() => withBase(`/${props.name}.png`));
</script>

<template>
  <EraserFrame :title="name" :src="html" :size="size?.rendered ? { width: size.width, height: size.height } : null" :png-src="png">
    <template #status><p class="diagram__missing">Схема не отрисована: <code>bun run render</code></p></template>
  </EraserFrame>
</template>
