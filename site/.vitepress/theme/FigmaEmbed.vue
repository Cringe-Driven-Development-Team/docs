<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { figmaUrls } from '../figma-embed';

const props = withDefaults(defineProps<{
  screens: { label: string; title: string; url: string }[];
  initialIndex?: number;
}>(), { initialIndex: 0 });
const screens = computed(() => {
  if (!props.screens?.length) throw new Error('Figma: укажите хотя бы один экран в screens');
  return props.screens.map(screen => {
    if (!screen.label?.trim()) throw new Error('Figma: укажите подпись экрана в label');
    if (!screen.title?.trim()) throw new Error('Figma: укажите название макета в title');
    return { ...screen, ...figmaUrls(screen.url) };
  });
});
if (!Number.isInteger(props.initialIndex) || props.initialIndex < 0 || props.initialIndex >= screens.value.length) {
  throw new Error('Figma: initialIndex должен указывать на экран из screens');
}
const selectedIndex = ref(props.initialIndex);
const visited = ref(new Set([props.initialIndex]));
const selected = computed(() => screens.value[selectedIndex.value]!);
const id = useId();
const tablist = ref<HTMLElement>();

function selectScreen(index: number): void {
  visited.value.add(index);
  selectedIndex.value = index;
}

function onKeydown(event: KeyboardEvent, index: number) {
  let next: number;
  switch (event.key) {
    case 'ArrowRight': next = (index + 1) % screens.value.length; break;
    case 'ArrowLeft': next = (index + screens.value.length - 1) % screens.value.length; break;
    case 'Home': next = 0; break;
    case 'End': next = screens.value.length - 1; break;
    default: return;
  }
  event.preventDefault();
  selectScreen(next);
  tablist.value?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
}
</script>

<template>
  <figure class="figma-embed">
    <div ref="tablist" role="tablist" aria-label="Шаги подключения">
      <button
        v-for="(screen, index) in screens" :id="`${id}-tab-${index}`" :key="index"
        type="button" role="tab" :aria-controls="`${id}-panel`"
        :aria-selected="selectedIndex === index" :tabindex="selectedIndex === index ? 0 : -1"
        @click="selectScreen(index)" @keydown="onKeydown($event, index)"
      ><span class="number" aria-hidden="true">{{ index + 1 }}</span>{{ screen.label }}</button>
    </div>
    <div :id="`${id}-panel`" role="tabpanel" :aria-labelledby="`${id}-tab-${selectedIndex}`" tabindex="0">
      <div v-for="(screen, index) in screens" v-show="selectedIndex === index" :key="index">
        <iframe v-if="visited.has(index)" :src="screen.embed" :title="screen.title" loading="lazy" allowfullscreen></iframe>
      </div>
    </div>
    <figcaption>
      <span>Шаг {{ selectedIndex + 1 }} из {{ screens.length }} · {{ selected.title }}</span>
      <a :href="selected.source" target="_blank" rel="noopener noreferrer">Открыть этот экран в Figma</a>
    </figcaption>
  </figure>
</template>

<style scoped>
.figma-embed {
  margin: 16px 0 24px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
}
[role='tablist'] {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  padding: 0 12px;
  border-bottom: 1px solid var(--vp-c-divider);
}
[role='tab'] {
  position: relative;
  padding: 18px 8px;
  font-size: 13px;
  line-height: 1.4;
  color: var(--vp-c-text-2);
}
[role='tab']:hover {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-default-soft);
}
[role='tab'][aria-selected='true'] {
  color: var(--vp-c-brand-1);
}
[role='tab'][aria-selected='true']::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 8px;
  right: 8px;
  height: 3px;
  border-radius: 3px 3px 0 0;
  background: var(--vp-c-brand-1);
}
button:focus-visible, [role='tabpanel']:focus-visible, a:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: -3px;
}
.number {
  display: inline-grid;
  place-items: center;
  width: 25px;
  height: 25px;
  margin-right: 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 50%;
  font-size: 12px;
}
[aria-selected='true'] .number {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}
iframe {
  display: block;
  width: 100%;
  height: 600px;
  border: 0;
}
figcaption {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 13px;
  color: var(--vp-c-text-2);
}
figcaption a {
  flex-shrink: 0;
}
@media (max-width: 650px) {
  [role='tablist'] { padding: 0 4px; }
  [role='tab'] { padding: 14px 4px; font-size: 12px; }
  .number { display: grid; margin: 0 auto 8px; }
  figcaption { flex-direction: column; align-items: flex-start; gap: 8px; padding: 14px; }
}
</style>
