<script setup lang="ts">
import type { PanzoomObject } from '@panzoom/panzoom';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { fitOffset, fitScale, frameStyle, MAX_SCALE, stepScale, widthChanged, type DiagramSize } from './diagram-scale.ts';

const props = defineProps<{ title: string; size: DiagramSize | null }>();
const card = ref<HTMLElement>();
const frame = ref<HTMLElement>();
const canvas = ref<HTMLElement>();
const overlay = ref(false);
const frameCss = computed(() => props.size ? frameStyle(props.size.width, props.size.height) : { minHeight: '320px' });
let panzoom: PanzoomObject | undefined;
let observer: ResizeObserver | undefined;
let observedWidth: number | undefined;
let fit = 1;
let generation = 0;
let animation = 0;
let wasFullscreen = false;
let saved: { y: number; overflow: string; focus: HTMLElement | null } | undefined;

function fitToFrame(): void {
  const box = frame.value;
  const size = props.size;
  if (!box?.clientWidth || !size || !panzoom) return;
  const full = overlay.value || document.fullscreenElement === card.value;
  fit = full ? fitScale(box.clientWidth, size.width, box.clientHeight, size.height) : fitScale(box.clientWidth, size.width);
  const offset = fitOffset(size.width, size.height, fit);
  panzoom.setOptions({ minScale: fit, maxScale: MAX_SCALE, startScale: fit, startX: offset.x, startY: offset.y });
  panzoom.reset({ animate: false });
}
function scheduleFit(): void {
  cancelAnimationFrame(animation);
  animation = requestAnimationFrame(fitToFrame);
}
function step(direction: 1 | -1): void {
  if (panzoom) panzoom.zoom(stepScale(panzoom.getScale(), direction, fit), { animate: true });
}
function onWheel(event: WheelEvent): void {
  if (!panzoom || !(event.ctrlKey || event.metaKey)) return;
  event.preventDefault();
  panzoom.zoomWithWheel(event);
}
function onArrow(event: KeyboardEvent): void {
  if (event.target !== frame.value || !panzoom || event.altKey || event.ctrlKey || event.metaKey) return;
  const directions: Record<string, [number, number]> = { ArrowDown: [0, -1], ArrowUp: [0, 1], ArrowLeft: [1, 0], ArrowRight: [-1, 0] };
  const direction = directions[event.key];
  if (!direction) return;
  event.preventDefault();
  const distance = 40 / panzoom.getScale();
  panzoom.pan(direction[0] * distance, direction[1] * distance, { relative: true });
}
function rememberView(): void {
  saved = { y: scrollY, overflow: document.body.style.overflow, focus: document.activeElement as HTMLElement | null };
}
function restoreView(): void {
  if (!saved) return;
  document.body.style.overflow = saved.overflow;
  if (saved.focus?.isConnected) saved.focus.focus({ preventScroll: true });
  window.scrollTo({ top: saved.y, behavior: 'instant' });
  saved = undefined;
}
function closeOverlay(): void {
  overlay.value = false;
  restoreView();
  scheduleFit();
}
async function toggleFullscreen(): Promise<void> {
  if (!card.value) return;
  if (document.fullscreenElement === card.value) { await document.exitFullscreen(); return; }
  if (overlay.value) { closeOverlay(); return; }
  rememberView();
  if (typeof card.value.requestFullscreen === 'function') {
    try { await card.value.requestFullscreen(); return; } catch { /* Fall back when native fullscreen is unavailable. */ }
  }
  if (!card.value?.isConnected) return;
  overlay.value = true;
  document.body.style.overflow = 'hidden';
  scheduleFit();
}
function onFullscreenChange(): void {
  const active = document.fullscreenElement === card.value;
  if (!active && !wasFullscreen) return;
  wasFullscreen = active;
  if (!active) restoreView();
  scheduleFit();
}
function onEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return;
  if (overlay.value) { event.preventDefault(); closeOverlay(); }
  else if (document.fullscreenElement === card.value) { event.preventDefault(); void document.exitFullscreen(); }
}
onMounted(() => {
  frame.value!.addEventListener('wheel', onWheel, { passive: false });
  observer = new ResizeObserver(([entry]) => {
    const width = entry?.contentRect.width ?? 0;
    if (!widthChanged(observedWidth, width)) return;
    observedWidth = width;
    fitToFrame();
  });
  observer.observe(frame.value!);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('keydown', onEscape);
  watch(() => props.size, async (size, previous) => {
    if (size && size.width === previous?.width && size.height === previous?.height) return;
    const version = ++generation;
    if (!size) { panzoom?.destroy(); panzoom = undefined; return; }
    await nextTick();
    if (version !== generation) return;
    if (panzoom) {
      const box = frame.value!;
      const full = overlay.value || document.fullscreenElement === card.value;
      fit = full ? fitScale(box.clientWidth, size.width, box.clientHeight, size.height) : fitScale(box.clientWidth, size.width);
      panzoom.setOptions({ minScale: fit });
      if (panzoom.getScale() < fit) panzoom.zoom(fit, { animate: false });
      return;
    }
    const { default: Panzoom } = await import('@panzoom/panzoom');
    if (version !== generation || !canvas.value || !frame.value) return;
    panzoom = Panzoom(canvas.value, { canvas: true, cursor: 'grab', maxScale: MAX_SCALE, animate: false });
    fitToFrame();
  }, { immediate: true, flush: 'post' });
});
onBeforeUnmount(() => {
  generation++;
  cancelAnimationFrame(animation);
  observer?.disconnect();
  frame.value?.removeEventListener('wheel', onWheel);
  document.removeEventListener('fullscreenchange', onFullscreenChange);
  document.removeEventListener('keydown', onEscape);
  if (saved) document.body.style.overflow = saved.overflow;
  if (document.fullscreenElement === card.value) void document.exitFullscreen();
  panzoom?.destroy();
});
</script>

<template>
  <figure ref="card" class="diagram" :class="{ 'diagram--overlay': overlay }">
    <div class="diagram__toolbar">
      <span class="diagram__name">{{ title }}</span>
      <template v-if="size">
        <button type="button" aria-label="Уменьшить" title="Уменьшить" @click="step(-1)">−</button>
        <button type="button" aria-label="Увеличить" title="Увеличить" @click="step(1)">+</button>
        <button type="button" aria-label="Вписать" title="Вписать" @click="fitToFrame">⤢</button>
        <button type="button" aria-label="На весь экран" title="На весь экран" @click="toggleFullscreen">⛶</button>
      </template>
    </div>
    <div ref="frame" class="diagram__frame" role="group" :style="frameCss" :tabindex="size ? 0 : -1" :aria-label="`Схема ${title}. Стрелки — перемещение`" @keydown="onArrow">
      <div ref="canvas" class="diagram__canvas" :class="{ 'diagram__canvas--pending': !size }" :style="size ? { width: `${size.width}px`, height: `${size.height}px` } : undefined">
        <slot />
      </div>
      <div v-if="!size" class="diagram__status"><slot name="status" /></div>
    </div>
    <figcaption class="diagram__links">
      <slot name="footer" />
      <span class="diagram__hint">Ctrl/⌘ + колесо — масштаб, перетаскивание или стрелки — сдвиг</span>
    </figcaption>
  </figure>
</template>
