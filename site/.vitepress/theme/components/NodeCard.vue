<script setup lang="ts">
// Карточка выбранного узла графа: человек, трек или подзадача.
import { computed } from 'vue';
import { withBase } from 'vitepress';
import { AREA_LABELS, type Module, type Person, SIDE_LABELS, type Track } from '../../modules.ts';

const props = defineProps<{ id: string; module: Module; people: readonly Person[] }>();
const emit = defineEmits<{ select: [id: string]; close: [] }>();

const person = (login: string) => props.people.find((p) => p.login === login);
const trackById = (id: string) => props.module.tracks.find((t) => t.id === id);
const sideOf = (t: Track, login: string) => {
  const side = t.do.find((d) => d.login === login)?.side;
  return side ? SIDE_LABELS[side] : 'помогает';
};

const view = computed(() => {
  const [kind, rest = ''] = props.id.split(':') as [string, string];
  if (kind === 'person') {
    const p = person(rest);
    if (!p) return null;
    const doing = props.module.tracks.filter((t) => t.do.some((d) => d.login === p.login));
    const helping = props.module.tracks.filter((t) => t.help.includes(p.login));
    const mates = new Map<string, string[]>();
    for (const t of [...doing, ...helping]) {
      for (const login of [...t.do.map((d) => d.login), ...t.help]) {
        if (login !== p.login) mates.set(login, [...(mates.get(login) ?? []), t.label]);
      }
    }
    return { kind: 'person' as const, p, doing, helping, mates: [...mates] };
  }
  if (kind === 'track') {
    const t = trackById(rest);
    if (!t) return null;
    const incoming = props.module.tracks.flatMap((o) => o.related.filter((r) => r.track === t.id).map((r) => ({ track: o.id, why: r.why })));
    return { kind: 'track' as const, t, related: [...t.related, ...incoming] };
  }
  const [trackId = '', index = ''] = rest.split('/');
  const t = trackById(trackId);
  const title = t?.subtasks[Number(index)];
  return t && title !== undefined ? { kind: 'subtask' as const, t, title } : null;
});
</script>

<template>
  <section v-if="view" class="node-card" aria-live="polite">
    <button type="button" class="close" aria-label="Закрыть карточку" @click="emit('close')">×</button>

    <template v-if="view.kind === 'person'">
      <p class="eyebrow"><span class="dot" :style="{ background: `var(--cdd-area-${view.p.area})` }" />{{ view.p.role }}</p>
      <h3>{{ view.p.name }} <small>@{{ view.p.login }}</small></h3>
      <h4 v-if="view.doing.length">Делает · {{ view.doing.length }}</h4>
      <ul>
        <li v-for="t in view.doing" :key="t.id">
          <button type="button" class="go" @click="emit('select', `track:${t.id}`)">{{ t.label }}</button>
          <span class="side">{{ sideOf(t, view.p.login) }}</span>
        </li>
      </ul>
      <h4 v-if="view.helping.length">Помогает · {{ view.helping.length }}</h4>
      <ul>
        <li v-for="t in view.helping" :key="t.id">
          <button type="button" class="go" @click="emit('select', `track:${t.id}`)">{{ t.label }}</button>
        </li>
      </ul>
      <h4 v-if="view.mates.length">Работает вместе с</h4>
      <ul>
        <li v-for="[login, tracks] in view.mates" :key="login">
          <button type="button" class="go" @click="emit('select', `person:${login}`)">{{ person(login)?.name ?? login }}</button>
          <span class="why">{{ tracks.join(', ') }}</span>
        </li>
      </ul>
    </template>

    <template v-else-if="view.kind === 'track'">
      <p class="eyebrow"><span class="dot" :style="{ background: `var(--cdd-area-${view.t.area})` }" />Трек · {{ AREA_LABELS[view.t.area] }}</p>
      <h3>{{ view.t.title }}</h3>
      <h4>Делают</h4>
      <ul>
        <li v-for="d in view.t.do" :key="d.login">
          <button type="button" class="go" @click="emit('select', `person:${d.login}`)">{{ person(d.login)?.name ?? d.login }}</button>
          <span class="side">{{ SIDE_LABELS[d.side] }}</span>
        </li>
      </ul>
      <h4 v-if="view.t.help.length">Помогают</h4>
      <ul>
        <li v-for="login in view.t.help" :key="login">
          <button type="button" class="go" @click="emit('select', `person:${login}`)">{{ person(login)?.name ?? login }}</button>
        </li>
      </ul>
      <h4 v-if="view.t.subtasks.length">Подзадачи · {{ view.t.subtasks.length }}</h4>
      <ul>
        <li v-for="(s, i) in view.t.subtasks" :key="s">
          <button type="button" class="go" @click="emit('select', `subtask:${view.t.id}/${i}`)">{{ s }}</button>
        </li>
      </ul>
      <h4 v-if="view.related.length">Связи</h4>
      <ul>
        <li v-for="r in view.related" :key="r.track">
          <button type="button" class="go" @click="emit('select', `track:${r.track}`)">{{ trackById(r.track)?.label ?? r.track }}</button>
          <span class="why">{{ r.why }}</span>
        </li>
      </ul>
      <a class="page" :href="withBase(view.t.url)">Открыть страницу трека</a>
    </template>

    <template v-else>
      <p class="eyebrow"><span class="dot" :style="{ background: `var(--cdd-area-${view.t.area})` }" />Подзадача</p>
      <h3>{{ view.title }}</h3>
      <h4>Входит в трек</h4>
      <ul>
        <li><button type="button" class="go" @click="emit('select', `track:${view.t.id}`)">{{ view.t.label }}</button></li>
      </ul>
      <h4>Кто</h4>
      <ul>
        <li v-for="login in [...view.t.do.map((d) => d.login), ...view.t.help]" :key="login">
          <button type="button" class="go" @click="emit('select', `person:${login}`)">{{ person(login)?.name ?? login }}</button>
          <span class="side">{{ sideOf(view.t, login) }}</span>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.node-card {
  position: absolute;
  top: 12px;
  right: 12px;
  width: min(320px, calc(100% - 24px));
  max-height: calc(100% - 64px);
  overflow-y: auto;
  padding: 14px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-elv);
  box-shadow: var(--vp-shadow-3);
  font-size: 14px;
}
.close {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 18px;
  color: var(--vp-c-text-2);
}
.close:hover {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
}
.eyebrow {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 28px 6px 0;
  font-size: 12px;
  color: var(--vp-c-text-2);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
h3 {
  margin: 0 20px 10px 0;
  font-size: 16px;
  line-height: 1.35;
}
h3 small {
  font-weight: 400;
  color: var(--vp-c-text-2);
}
h4 {
  margin: 12px 0 4px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-2);
}
ul {
  margin: 0;
  padding: 0;
  list-style: none;
}
li {
  display: flex;
  gap: 8px;
  align-items: baseline;
  padding: 1px 0;
}
.go {
  text-align: left;
  text-decoration: underline;
  text-decoration-color: var(--vp-c-divider);
  text-underline-offset: 3px;
}
.go:hover {
  text-decoration-color: var(--vp-c-brand-1);
}
.side,
.why {
  margin-left: auto;
  font-size: 12px;
  color: var(--vp-c-text-2);
  text-align: right;
}
.page {
  display: inline-block;
  margin-top: 14px;
  font-weight: 500;
  color: var(--vp-c-brand-1);
}
</style>
