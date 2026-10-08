<script setup lang="ts">
// Архив модулей: от новых к старым, с числом треков, людей и готовых задач треков.
import { withBase } from 'vitepress';
import type { Module } from '../../modules.ts';
import { trackProgress } from '../../board.ts';
import { data } from '../../../modules/modules.data.ts';

const peopleCount = (m: Module) => new Set(m.tracks.flatMap((t) => [...t.do.map((d) => d.login), ...t.help])).size;
// done / total по всем трекам модуля; «—» без снимка доски.
function taskCount(m: Module): string {
  if (!data.board) return '—';
  const p = trackProgress(Object.values(data.board.byModule[m.id]?.byTrack ?? {}).flat());
  return `${p.done} / ${p.total}`;
}
</script>

<template>
  <table>
    <thead>
      <tr><th>Модуль</th><th>Период</th><th>Треков</th><th>Людей</th><th>Задачи</th></tr>
    </thead>
    <tbody>
      <tr v-for="m in data.modules" :key="m.id">
        <td><a :href="withBase(m.url)">{{ m.title }}</a></td>
        <td>{{ m.period ?? '—' }}</td>
        <td>{{ m.tracks.length }}</td>
        <td>{{ peopleCount(m) }}</td>
        <td>{{ taskCount(m) }}</td>
      </tr>
    </tbody>
  </table>
</template>
