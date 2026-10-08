<script setup lang="ts">
// Архив модулей: от новых к старым, с числом треков и людей.
import { withBase } from 'vitepress';
import type { Module } from '../../modules.ts';
import { data } from '../../../modules/modules.data.ts';

const peopleCount = (m: Module) => new Set(m.tracks.flatMap((t) => [...t.do.map((d) => d.login), ...t.help])).size;
</script>

<template>
  <table>
    <thead>
      <tr><th>Модуль</th><th>Период</th><th>Треков</th><th>Людей</th></tr>
    </thead>
    <tbody>
      <tr v-for="m in data.modules" :key="m.id">
        <td><a :href="withBase(m.url)">{{ m.title }}</a></td>
        <td>{{ m.period ?? '—' }}</td>
        <td>{{ m.tracks.length }}</td>
        <td>{{ peopleCount(m) }}</td>
      </tr>
    </tbody>
  </table>
</template>
