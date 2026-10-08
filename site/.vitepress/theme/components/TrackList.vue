<script setup lang="ts">
// Треки модуля текстом по направлениям: рендерится при сборке, работает без JS, видна check-site.
import { computed } from 'vue';
import { withBase } from 'vitepress';
import { AREA_LABELS, AREAS, SIDE_LABELS, type Module } from '../../modules.ts';
import { data } from '../../../modules/modules.data.ts';

const props = defineProps<{ module: Module }>();
const name = (login: string) => data.people.find((p) => p.login === login)?.name ?? login;
const groups = computed(() =>
  AREAS.map((area) => ({ area, tracks: props.module.tracks.filter((t) => t.area === area) })).filter((g) => g.tracks.length > 0),
);
</script>

<template>
  <section class="track-list">
    <h2 id="треки">Треки</h2>
    <template v-for="group in groups" :key="group.area">
      <h3 :id="`треки-${group.area}`">
        <span class="area-dot" :style="{ background: `var(--cdd-area-${group.area})` }" />{{ AREA_LABELS[group.area] }}
      </h3>
      <ul>
        <li v-for="track in group.tracks" :key="track.id">
          <a :href="withBase(track.url)">{{ track.title }}</a>
          — {{ track.do.map((d) => `${name(d.login)} (${SIDE_LABELS[d.side]})`).join(', ') }}<template v-if="track.help.length">;
            помогают: {{ track.help.map(name).join(', ') }}</template>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.area-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 8px;
  vertical-align: 1px;
}
</style>
