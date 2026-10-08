<script setup lang="ts">
// Страница модуля: фильтры, граф, карточка узла и список треков. Модуль — по пути страницы,
// фильтр — в query-строке адреса. Спека: docs/superpowers/specs/2026-10-08-module-graph-design.md §5.2.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useData } from 'vitepress';
import {
  AREAS,
  buildGraph,
  DEFAULT_FILTER,
  type Filter,
  filterFromQuery,
  filterToQuery,
  pageRef,
  personLoad,
  searchMatches,
} from '../../modules.ts';
import { data } from '../../../modules/modules.data.ts';
import GraphCanvas from './GraphCanvas.vue';
import GraphFilters from './GraphFilters.vue';
import NodeCard from './NodeCard.vue';
import TrackList from './TrackList.vue';

const { page } = useData();
const module = computed(() => data.modules.find((m) => m.id === pageRef(page.value.relativePath)?.module));
const filter = ref<Filter>({ ...DEFAULT_FILTER, areas: [...AREAS] });
const query = ref('');
const selected = ref<string | null>(null);
const failed = ref(false);
const canvas = ref<InstanceType<typeof GraphCanvas>>();

const graph = computed(() => (module.value ? buildGraph(module.value, data.people, filter.value) : { nodes: [], links: [] }));
const matches = computed(() => searchMatches(graph.value.nodes, query.value));
const load = computed(() => (module.value ? personLoad(module.value, data.people) : []));
const empty = computed(() => !graph.value.nodes.some((n) => n.kind === 'track'));

function reset(): void {
  filter.value = { ...DEFAULT_FILTER, areas: [...AREAS] };
  query.value = '';
}
function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') selected.value = null;
}

onMounted(() => {
  filter.value = filterFromQuery(location.search, data.people);
  window.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

watch(filter, (value) => history.replaceState(history.state, '', location.pathname + filterToQuery(value) + location.hash), { deep: true });
watch(graph, (value) => {
  if (selected.value && !value.nodes.some((n) => n.id === selected.value)) selected.value = null;
});
</script>

<template>
  <div v-if="module" class="module-graph">
    <p v-if="module.period" class="period">{{ module.period }}</p>
    <p v-if="module.tracks.length === 0" class="empty">
      В модуле пока нет треков. Добавьте файл в <code>site/modules/{{ module.id }}/tracks/</code>.
    </p>
    <template v-else>
      <div class="layout">
        <GraphFilters v-model:filter="filter" v-model:query="query" :people="data.people" :load="load" />
        <div class="stage">
          <ClientOnly>
            <GraphCanvas
              v-if="!failed"
              ref="canvas"
              :nodes="graph.nodes"
              :links="graph.links"
              :selected="selected"
              :matches="matches"
              @select="selected = $event"
              @failed="failed = true"
            />
          </ClientOnly>
          <p v-if="failed" class="notice">Граф не загрузился, ниже — список треков</p>
          <div v-else-if="empty" class="notice">
            <p>Под фильтр ничего не попало</p>
            <button type="button" class="reset" @click="reset">Сбросить фильтры</button>
          </div>
          <NodeCard v-if="selected" :id="selected" :module="module" :people="data.people" @select="selected = $event" @close="selected = null" />
          <div class="hud">
            <p>Наведите на узел, чтобы подсветить соседей. Клик открывает карточку, колесо мыши меняет масштаб.</p>
            <button type="button" @click="canvas?.fit()">Вписать</button>
          </div>
        </div>
      </div>
      <TrackList :module="module" />
    </template>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 16px;
  margin: 16px 0 32px;
}
.stage {
  position: relative;
  min-width: 0;
  height: min(70vh, 640px);
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-alt);
}
.notice {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 0;
  color: var(--vp-c-text-2);
  pointer-events: none;
}
.notice p {
  margin: 0;
}
.notice button {
  pointer-events: auto;
}
.reset,
.hud button {
  padding: 4px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  font-size: 13px;
}
.reset:hover,
.hud button:hover {
  border-color: var(--vp-c-brand-1);
}
.hud {
  position: absolute;
  right: 12px;
  bottom: 12px;
  left: 12px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  pointer-events: none;
}
.hud p {
  max-width: 46ch;
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--vp-c-text-2);
}
.hud button {
  flex: none;
  pointer-events: auto;
}
.period {
  color: var(--vp-c-text-2);
}
@media (max-width: 960px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 640px) {
  .stage {
    height: 70svh;
  }
  .hud p {
    display: none;
  }
}
</style>
