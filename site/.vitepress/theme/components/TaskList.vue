<script setup lang="ts">
// Задачи с доски группами по статусу: ссылка на issue, заголовок, спринт, исполнители.
// Рендерится при сборке. Спека: docs/superpowers/specs/2026-10-08-module-board-design.md §5.1.
import { computed } from 'vue';
import { type BoardTask, sortTasks, STATUS_ORDER } from '../../board.ts';
import type { Person } from '../../modules.ts';

const props = defineProps<{ tasks: BoardTask[]; people: readonly Person[] }>();

const KNOWN: readonly string[] = STATUS_ORDER;
// Без статуса — в группе Backlog; статус вне списка — сразу после Backlog.
const rank = (status: string) => {
  const i = KNOWN.indexOf(status);
  return i === -1 ? KNOWN.indexOf('Backlog') + 0.5 : i;
};
const groups = computed(() => {
  const byStatus = new Map<string, BoardTask[]>();
  for (const task of sortTasks(props.tasks)) {
    const status = task.status ?? 'Backlog';
    byStatus.set(status, [...(byStatus.get(status) ?? []), task]);
  }
  return [...byStatus].sort(([a], [b]) => rank(a) - rank(b)).map(([status, tasks]) => ({ status, tasks }));
});
const name = (login: string) => props.people.find((p) => p.login === login)?.name ?? login;
const meta = (task: BoardTask) =>
  [task.sprint, task.assignees.length ? task.assignees.map(name).join(', ') : 'без исполнителя'].filter(Boolean).join(' · ');
</script>

<template>
  <div class="task-list">
    <section v-for="group in groups" :key="group.status" class="group">
      <p class="status">{{ group.status }}</p>
      <ul class="tasks">
        <li v-for="task in group.tasks" :key="task.ref" class="task">
          <a class="ref" :href="task.url">{{ task.ref }}</a>
          <s v-if="task.state === 'not_planned'" class="title">{{ task.title }}</s>
          <span v-else class="title">{{ task.title }}</span>
          <span class="meta">{{ meta(task) }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.task-list .group + .group {
  margin-top: 8px;
}
.task-list .status {
  margin: 0 0 2px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--vp-c-text-2);
}
.task-list .tasks {
  margin: 0;
  padding: 0;
  list-style: none;
}
.task-list .task {
  margin: 0;
  padding: 2px 0;
  line-height: 1.4;
}
.task-list .ref {
  margin-right: 6px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.task-list .meta {
  display: block;
  font-size: 12px;
  color: var(--vp-c-text-2);
}
</style>
