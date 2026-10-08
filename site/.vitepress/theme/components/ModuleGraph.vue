<script setup lang="ts">
// Страница модуля: граф (задача 7 плана) и список треков. Модуль — по пути страницы.
import { computed } from 'vue';
import { useData } from 'vitepress';
import { pageRef } from '../../modules.ts';
import { data } from '../../../modules/modules.data.ts';
import TrackList from './TrackList.vue';

const { page } = useData();
const module = computed(() => {
  const ref = pageRef(page.value.relativePath);
  return data.modules.find((m) => m.id === ref?.module);
});
</script>

<template>
  <div v-if="module" class="module-graph">
    <p v-if="module.period" class="period">{{ module.period }}</p>
    <p v-if="module.tracks.length === 0" class="empty">
      В модуле пока нет треков. Добавьте файл в <code>site/modules/{{ module.id }}/tracks/</code>.
    </p>
    <TrackList v-else :module="module" />
  </div>
</template>
