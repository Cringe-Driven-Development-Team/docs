<script setup lang="ts">
// Схема Eraser в рамке, как макет Figma в Confluence: HTML схемы во фрейме в натуральную величину,
// обёртка масштабируется @panzoom/panzoom. Ctrl/⌘ + колесо и щипок — масштаб, перетаскивание — сдвиг,
// колесо без модификатора листает страницу. Спека: docs/superpowers/specs/2026-10-08-diagrams-embed-design.md §4.1.
import type { PanzoomObject } from '@panzoom/panzoom';
import { withBase } from 'vitepress';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { fitOffset, fitScale, frameStyle, MAX_SCALE, stepScale, widthChanged } from './diagram-scale.ts';
import { data as sizes } from './diagrams.data.ts';

const props = defineProps<{ name: string }>();

const size = computed(() => sizes[props.name] ?? { width: 1600, height: 900, rendered: false });
const html = computed(() => withBase(`/${props.name}.html`));
const png = computed(() => withBase(`/${props.name}.png`));
const frameCss = computed(() => frameStyle(size.value.width, size.value.height));

const card = ref<HTMLElement>();
const frame = ref<HTMLElement>();
const canvas = ref<HTMLElement>();
const fit = ref(1);
const overlay = ref(false);

let panzoom: PanzoomObject | undefined;
let observer: ResizeObserver | undefined;
let observedWidth: number | undefined;

// «Вписать»: на странице — по ширине рамки, в полном экране — целиком по более тесной стороне;
// сдвиг fitOffset ставит угол холста в угол рамки. Значения задаются как стартовые и применяются
// reset — без гонки отдельных zoom и pan.
function fitToFrame(): void {
  const box = frame.value;
  if (!box || !panzoom) return;
  const { width, height } = size.value;
  const full = overlay.value || document.fullscreenElement === card.value;
  const scale = full ? fitScale(box.clientWidth, width, box.clientHeight, height) : fitScale(box.clientWidth, width);
  fit.value = scale;
  const offset = fitOffset(width, height, scale);
  panzoom.setOptions({ minScale: scale, maxScale: MAX_SCALE, startScale: scale, startX: offset.x, startY: offset.y });
  panzoom.reset({ animate: false });
}

function step(direction: 1 | -1): void {
  if (!panzoom) return;
  panzoom.zoom(stepScale(panzoom.getScale(), direction, fit.value), { animate: true });
}

// Колесо масштабирует только с Ctrl или ⌘ — и тогда не масштабирует страницу браузера.
function onWheel(event: WheelEvent): void {
  if (!panzoom || !(event.ctrlKey || event.metaKey)) return;
  event.preventDefault();
  panzoom.zoomWithWheel(event);
}

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape' && overlay.value) closeOverlay();
}

function closeOverlay(): void {
  overlay.value = false;
  document.body.style.overflow = '';
  requestAnimationFrame(fitToFrame);
}

// Полный экран: Fullscreen API, а где его нет (iPhone) — карточка поверх страницы.
async function toggleFullscreen(): Promise<void> {
  const el = card.value;
  if (!el) return;
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }
  if (overlay.value) {
    closeOverlay();
    return;
  }
  if (typeof el.requestFullscreen === 'function') {
    try {
      await el.requestFullscreen();
      return;
    } catch {
      // Браузер отказал (политика, фрейм без allowfullscreen) — карточка поверх страницы.
    }
  }
  openOverlay();
}

function openOverlay(): void {
  overlay.value = true;
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(fitToFrame);
}

function onFullscreenChange(): void {
  requestAnimationFrame(fitToFrame);
}

onMounted(async () => {
  if (!size.value.rendered || !canvas.value || !frame.value) return;
  const { default: Panzoom } = await import('@panzoom/panzoom');
  panzoom = Panzoom(canvas.value, { cursor: 'grab', maxScale: MAX_SCALE, animate: false });
  frame.value.addEventListener('wheel', onWheel, { passive: false });
  observer = new ResizeObserver(([entry]) => {
    const next = entry?.contentRect.width ?? 0;
    if (!widthChanged(observedWidth, next)) return;
    observedWidth = next;
    fitToFrame();
  });
  observer.observe(frame.value);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('keydown', onKey);
  fitToFrame();
});

onBeforeUnmount(() => {
  observer?.disconnect();
  frame.value?.removeEventListener('wheel', onWheel);
  document.removeEventListener('fullscreenchange', onFullscreenChange);
  document.removeEventListener('keydown', onKey);
  if (overlay.value) document.body.style.overflow = '';
  panzoom?.destroy();
});
</script>

<template>
  <figure ref="card" class="diagram" :class="{ 'diagram--overlay': overlay }">
    <div class="diagram__toolbar">
      <span class="diagram__name">{{ name }}</span>
      <template v-if="size.rendered">
        <button type="button" aria-label="Уменьшить" title="Уменьшить" @click="step(-1)">−</button>
        <button type="button" aria-label="Увеличить" title="Увеличить" @click="step(1)">+</button>
        <button type="button" aria-label="Вписать" title="Вписать" @click="fitToFrame">⤢</button>
        <button type="button" aria-label="На весь экран" title="На весь экран" @click="toggleFullscreen">⛶</button>
      </template>
    </div>
    <div v-if="size.rendered" ref="frame" class="diagram__frame" :style="frameCss">
      <div ref="canvas" class="diagram__canvas" :style="{ width: `${size.width}px`, height: `${size.height}px` }">
        <iframe
          :src="html"
          :width="size.width"
          :height="size.height"
          loading="lazy"
          sandbox=""
          :title="`Схема ${name}`"
        ></iframe>
        <div class="diagram__shield" aria-hidden="true"></div>
      </div>
    </div>
    <p v-else class="diagram__missing">Схема не отрисована: <code>bun run render</code></p>
    <figcaption class="diagram__links">
      <a :href="html" target="_self">HTML</a> · <a :href="png" target="_self">PNG</a>
      <span class="diagram__hint">Ctrl/⌘ + колесо — масштаб, перетаскивание — сдвиг</span>
    </figcaption>
  </figure>
</template>
