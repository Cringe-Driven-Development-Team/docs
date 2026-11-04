<script setup lang="ts">
import { computed } from 'vue';
import { figmaUrls } from '../figma-embed';

const props = defineProps<{ url: string; title: string }>();
if (!props.title?.trim()) throw new Error('Figma: укажите название макета в title');
const links = computed(() => figmaUrls(props.url));
</script>

<template>
  <figure class="figma-embed">
    <iframe :src="links.embed" :title="title" loading="lazy" allowfullscreen></iframe>
    <figcaption>
      <a :href="links.source" target="_blank" rel="noopener noreferrer">Открыть в Figma</a>
    </figcaption>
  </figure>
</template>

<style scoped>
.figma-embed {
  margin: 16px 0 24px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
}
iframe {
  display: block;
  width: 100%;
  height: 600px;
  border: 0;
}
figcaption {
  padding: 6px 12px;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 13px;
}
</style>
