<script setup lang="ts">
import { withBase } from 'vitepress';
import { computed } from 'vue';
import DiagramFrame from './DiagramFrame.vue';
import { data as sizes } from './diagrams.data.ts';

const props = defineProps<{ name: string }>();
const size = computed(() => sizes[props.name]);
const html = computed(() => withBase(`/${props.name}.html`));
const png = computed(() => withBase(`/${props.name}.png`));
</script>

<template>
  <DiagramFrame :title="name" :size="size?.rendered ? size : null" data-diagram-kind="eraser">
    <template v-if="size?.rendered">
      <iframe :src="html" :width="size.width" :height="size.height" loading="lazy" sandbox="" :title="`Схема ${name}`"></iframe>
      <div class="diagram__shield" aria-hidden="true"></div>
    </template>
    <template #status><p class="diagram__missing">Схема не отрисована: <code>bun run render</code></p></template>
    <template #footer><a :href="html" target="_self">HTML</a> · <a :href="png" target="_self">PNG</a></template>
  </DiagramFrame>
</template>
