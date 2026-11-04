<script setup lang="ts">
import { useRoute } from 'vitepress';
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const route = useRoute();
const message = ref('');
const tooltip = ref<HTMLElement>();
const position = ref({ left: '8px', top: '8px' });
let anchor: HTMLAnchorElement | undefined;
let revision = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

function clear() {
  revision++;
  clearTimeout(timer);
  message.value = '';
  anchor = undefined;
}

function place() {
  if (!anchor?.isConnected || !tooltip.value) return;
  const target = anchor.getBoundingClientRect();
  const box = tooltip.value.getBoundingClientRect();
  position.value = {
    left: `${Math.max(8, Math.min(target.left, innerWidth - box.width - 8))}px`,
    top: `${Math.max(8, Math.min(target.bottom + 8, innerHeight - box.height - 8))}px`,
  };
}

async function copy(event: MouseEvent) {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const link = event.target instanceof Element
    ? event.target.closest<HTMLAnchorElement>('.vp-doc a.header-anchor') : null;
  if (!link) return;
  // VitePress has already prevented the native click in its capture listener.
  clear();
  const current = revision;
  anchor = link;
  let result = 'Ссылка скопирована';
  try {
    await navigator.clipboard.writeText(link.href);
  } catch {
    result = 'Не удалось скопировать ссылку';
  }
  if (current !== revision) return;
  message.value = result;
  await nextTick();
  if (current !== revision) return;
  place();
  timer = setTimeout(clear, 2000);
}

watch(() => [route.path, route.query], clear);
onMounted(() => {
  document.addEventListener('click', copy);
  window.addEventListener('scroll', place, true);
  window.addEventListener('resize', place);
});
onBeforeUnmount(() => {
  clear();
  document.removeEventListener('click', copy);
  window.removeEventListener('scroll', place, true);
  window.removeEventListener('resize', place);
});
</script>

<template>
  <span class="heading-link-status" role="status" aria-live="polite">{{ message }}</span>
  <Teleport to="body">
    <span v-if="message" ref="tooltip" class="heading-link-feedback" :style="position" aria-hidden="true">{{ message }}</span>
  </Teleport>
</template>
