# Задачи у подзадач графа и без «Вписать» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** карточка подзадачи на графе модуля показывает задачи из поля `issues` подзадачи; кнопки «Вписать» нет.

**Architecture:** разбор `subtasks` в `src/model/modules.ts` принимает `issues`; `BoardData` получает `byRef` — все
задачи снимка; чистая функция `subtaskIssues` сопоставляет номера с задачами; `NodeCard.vue` рисует блок задач
подзадачи тем же `TaskList`. Затем выпуск 0.3.0 и правка docs.

**Tech Stack:** TypeScript, Vue 3 SFC, VitePress, bun test, tsdown, release-please.

**Spec:** `docs/superpowers/specs/2026-10-11-subtask-issues-design.md` (репозиторий docs).

## Global Constraints

- Задачи 1–3 — репозиторий `TP-Prepare/frontend-packages`, пакет `packages/vitepress-module-graph`, worktree
  `frontend-packages/.claude/worktrees/subtask-issues`, ветка `feat/subtask-issues` от `origin/main` `0b25e1c`.
- Задача 4 — репозиторий docs, worktree `cdd-docs/.claude/worktrees/subtask-issues`, ветка `feat/subtask-issues`;
  начинается только после того, как пользователь вольёт PR плагина и PR release-please и 0.3.0 появится в npm.
- Номер задачи: `^(?:[A-Za-z0-9-]+/)?[A-Za-z0-9._-]+#[1-9][0-9]*$`.
- Тексты ошибок (после `<файл>: <поле> — `): «нужна строка или { title, issues, subtasks }», «нужна строка или
  { title, issues }», «нужен номер задачи вида репо#N или владелец/репо#N», «задача <номер> повторяется».
- Задача «нет на доске» сборку не роняет; одна задача у нескольких подзадач — не ошибка.
- Кружки графа и карточка трека не меняются.
- Коммиты по-русски: `feat(vitepress-module-graph): …`, `test(…)`, `docs(…)`; в docs — `feat(modules): …`.
- Проверка пакета, как в CI (из корня `frontend-packages`): `bun run build && bun run typecheck && bun run test && bun run --filter '*' test:site`.
- Мерж, публикация и push в `main` — только пользователь; PR открывать можно.

## Review Focus

1. Задача из `issues`, которую раскладка по модулям отбросила (нет спринта и трека), — в карточке со статусом,
   а не «нет на доске». Тест в задаче 2.
2. Чужой номер `владелец/репо#N`, которого нет в снимке, — ссылка на `github.com/владелец/репо/issues/N`, а не на
   владельца доски. Тест в задаче 2.
3. Вложенная подзадача с ключом `subtasks` — ошибка сборки, а не молча отброшенная вложенность. Тест в задаче 1.
4. Повтор названий среди вложенных подзадач-объектов по-прежнему ловится. Тест в задаче 1.
5. `not_planned` задача у подзадачи не входит в «M» в «N из M готово» — счёт делает `trackProgress`. Тест в задаче 2.

---

### Задача 1: формат `subtasks` с `issues`

**Files:**
- Modify: `src/model/modules.ts:19-20` (типы), `:75-100` (разбор), `:332-338` (`buildGraph`), `:374-386` (`subtaskByNodeId`)
- Modify: `src/theme/components/NodeCard.vue:138-139, 172-173`, `src/theme/components/TrackMeta.vue:92-93` — вложенные читаются через `.title`
- Test: `test/modules.test.ts`, `test/modules-graph.test.ts`

**Interfaces:**
- Produces: `export type SubtaskLeaf = { title: string; issues: string[] }`;
  `export type Subtask = { title: string; issues: string[]; subtasks: SubtaskLeaf[] }`;
  `subtaskByNodeId(module, id): { track: Track; title: string; issues: string[]; children: string[]; parent: { index: number; title: string } | null } | null`
  (`children` — названия вложенных).

- [ ] **Шаг 1: падающие тесты** в `test/modules.test.ts`:

```ts
test("subtasks: issues on top and nested", () => {
  const t = track({ ...valid(), subtasks: ["a", { title: "b", issues: ["figma#5", "TP-Prepare/x#2"], subtasks: ["c", { title: "d", issues: ["frontend#40"] }] }] });
  expect(t.subtasks).toEqual([
    { title: "a", issues: [], subtasks: [] },
    { title: "b", issues: ["figma#5", "TP-Prepare/x#2"], subtasks: [{ title: "c", issues: [] }, { title: "d", issues: ["frontend#40"] }] },
  ]);
});

test("subtasks: issues are checked", () => {
  const bad = "нужен номер задачи вида репо#N или владелец/репо#N";
  fails({ ...valid(), subtasks: [{ title: "a", issues: "figma#5" }] }, `subtasks[0].issues — ${bad}`);
  fails({ ...valid(), subtasks: [{ title: "a", issues: [] }] }, `subtasks[0].issues — ${bad}`);
  fails({ ...valid(), subtasks: [{ title: "a", issues: ["figma#5", "figma 6"] }] }, `subtasks[0].issues[1] — ${bad}`);
  fails({ ...valid(), subtasks: [{ title: "a", issues: ["figma#0"] }] }, `subtasks[0].issues[0] — ${bad}`);
  fails({ ...valid(), subtasks: [{ title: "a", issues: ["figma#5", "figma#5"] }] }, "subtasks[0].issues — задача figma#5 повторяется");
  fails({ ...valid(), subtasks: [{ title: "a", subtasks: [{ title: "b", issues: [5] }] }] }, `subtasks[0].subtasks[0].issues[0] — ${bad}`);
  fails({ ...valid(), subtasks: [{ title: "a", subtasks: [{ title: "b", subtasks: ["c"] }] }] }, "subtasks[0].subtasks[0] — нужна строка или { title, issues }");
  fails({ ...valid(), subtasks: [{ title: "a", subtasks: [{ title: "" }] }] }, "subtasks[0].subtasks[0].title — нужна непустая строка");
  fails({ ...valid(), subtasks: [{ title: "a", subtasks: ["b", { title: "b" }] }] }, "subtasks — подзадача «b» повторяется");
  expect(track({ ...valid(), subtasks: [{ title: "a", issues: ["figma#5"] }, { title: "b", issues: ["figma#5"] }] }).subtasks).toHaveLength(2);
});
```

Существующие тесты привести к новой форме: `:44` и `:112-116` — добавить `issues: []`, вложенные — объекты
`{ title, issues: [] }`; `:97`, `:126-127` — текст «нужна строка или { title, issues, subtasks }»; `:129` —
`subtasks: [{ title: "b" }]` теперь допустим, заменить на случай с `subtasks: [404]` и текстом
«нужна строка или { title, issues }».

В `test/modules-graph.test.ts` в тест `subtaskByNodeId` добавить:
`expect(subtaskByNodeId(NESTED, "subtask:service/0")).toMatchObject({ issues: [], children: ["/apidog"] })` и модуль
с `subtasks: [{ title: "Скиллы", issues: ["x#1"], subtasks: [{ title: "/apidog", issues: ["x#2"] }] }]`, для
которого `subtask:<id>/0` даёт `issues: ["x#1"]`, `subtask:<id>/0/0` — `issues: ["x#2"]`, а узел
`subtask:<id>/0/0` в `buildGraph` имеет `label: "/apidog"`.

- [ ] **Шаг 2:** `cd packages/vitepress-module-graph && bun test test/modules.test.ts test/modules-graph.test.ts` — Expected: FAIL (нет `issues`, старые тексты).
- [ ] **Шаг 3:** реализовать в `modules.ts`: ключи верхнего уровня `title, issues, subtasks`, вложенного — `title, issues`;
  `issues` разбирает отдельная функция `issues(file, field, value): string[]` (отсутствует → `[]`). Уникальность
  названий соседей — по `.title`, как сейчас. Обновить doc-комментарии типов и функции разбора (ссылка на спеку
  `2026-10-11-subtask-issues`). Перевести `buildGraph`, `subtaskByNodeId`, `NodeCard.vue`, `TrackMeta.vue` на `.title`.
- [ ] **Шаг 4:** те же тесты — PASS; `bun run typecheck` в пакете — без ошибок (ловит `.vue`).
- [ ] **Шаг 5:** коммит `feat(vitepress-module-graph): у подзадачи поле issues — номера задач доски`.

### Задача 2: `byRef` в данных доски и `subtaskIssues`

**Files:**
- Modify: `src/model/board.ts:88-98` (`BoardData`), новая функция рядом с `trackProgress`
- Modify: `src/node/read.ts:107-111` (`readBoard`)
- Test: `test/board-model.test.ts`, `test/read.test.ts`

**Interfaces:**
- Produces: `BoardData = { takenAt: string; byModule: Record<string, ModuleTasks>; byRef: Record<string, BoardTask> }`;
  `export type SubtaskIssue = { ref: string; task: BoardTask | null; url: string | null }`;
  `export function subtaskIssues(issues: readonly string[], byRef: Readonly<Record<string, BoardTask>>, owner: string | null): SubtaskIssue[]`.
  `url` — `task.url`; задачи нет — `https://github.com/<владелец>/<репо>/issues/<N>`, владелец из номера, иначе
  `owner`; при `owner === null` и номере без владельца — `null` (номер рисуется текстом).

- [ ] **Шаг 1: падающие тесты.** В `test/board-model.test.ts`:

```ts
test("subtaskIssues: found, missing, foreign, order", () => {
  const task = { ref: "figma#5", title: "Экран профиля", url: "https://github.com/o/figma/issues/5", state: "open", status: "Ready", sprint: null, assignees: [], track: null, parent: null } as const;
  expect(subtaskIssues(["figma#9", "figma#5", "TP-Prepare/x#2"], { "figma#5": task }, "Cringe-Driven-Development-Team")).toEqual([
    { ref: "figma#9", task: null, url: "https://github.com/Cringe-Driven-Development-Team/figma/issues/9" },
    { ref: "figma#5", task, url: task.url },
    { ref: "TP-Prepare/x#2", task: null, url: "https://github.com/TP-Prepare/x/issues/2" },
  ]);
  expect(subtaskIssues(["figma#9"], {}, null)).toEqual([{ ref: "figma#9", task: null, url: null }]);
});

test("subtask progress skips not_planned", () => {
  // две найденные задачи: closed и not_planned → trackProgress даёт { total: 1, done: 1 }
});
```

Во втором тесте собрать две задачи и проверить `trackProgress(subtaskIssues(...).flatMap((i) => (i.task ? [i.task] : [])))`
→ `toMatchObject({ total: 1, done: 1 })`.

В `test/read.test.ts` тест «readBoard: byRef has every task of the snapshot»: снимок `SNAPSHOT` плюс задача
`{ ref: "figma#5", …, sprint: null, track: null }`; `board.byRef["figma#5"]?.title` равен её названию,
`Object.keys(board.byRef).sort()` — `["figma#5", "frontend#1"]`, при этом `figma#5` нет ни в одной корзине
`byModule["2"]` (`byTrack`, `untracked`, `unknown`).

- [ ] **Шаг 2:** `bun test test/board-model.test.ts test/read.test.ts` — Expected: FAIL (`subtaskIssues` нет, `byRef` undefined).
- [ ] **Шаг 3:** реализовать; разбор номера — `/^(?:([^/]+)\/)?([^#]+)#(\d+)$/`. Проверить другие места, которые
  создают `BoardData` литералом (`git grep -n "byModule:" src test`), и дополнить их `byRef`.
- [ ] **Шаг 4:** тесты — PASS; `bun run typecheck` — без ошибок.
- [ ] **Шаг 5:** коммит `feat(vitepress-module-graph): все задачи снимка по номеру и сопоставление с подзадачей`.

### Задача 3: карточка подзадачи, без «Вписать», README

**Files:**
- Modify: `src/theme/components/NodeCard.vue` (проп, `view` подзадачи `:64-66`, шаблон `:160-188`)
- Modify: `src/theme/components/ModuleGraph.vue:37, 102, 116-124, 127, 190-201, 220-223`
- Modify: `src/theme/components/GraphCanvas.vue:12`
- Modify: `README.md` (раздел «Трек», `:150-175`), `test/site/modules/2/tracks/figma.md`
- Create: `test/site/modules/board.json`
- Test: `test/theme.test.ts`

**Interfaces:**
- Consumes: `Subtask.issues`, `subtaskByNodeId(...).issues` (задача 1); `BoardData.byRef`, `subtaskIssues`, `trackProgress` (задача 2).
- Produces: проп `NodeCard` `byRef: Readonly<Record<string, BoardTask>> | null`.

- [ ] **Шаг 1: падающий тест** в `test/theme.test.ts` (по исходникам, не по `dist`):

```ts
test("ModuleGraph: no fit button, canvas is not exposed", () => {
  const src = (name: string) => readFileSync(fileURLToPath(new URL(`../src/theme/components/${name}.vue`, import.meta.url)), "utf8");
  expect(src("ModuleGraph")).not.toContain("Вписать");
  expect(src("ModuleGraph")).not.toContain(".hud button");
  expect(src("GraphCanvas")).not.toContain("defineExpose");
});
```

- [ ] **Шаг 2:** `bun test test/theme.test.ts` — Expected: FAIL на «Вписать».
- [ ] **Шаг 3:** `ModuleGraph.vue` — удалить кнопку, ref `canvas` (`:37`, `ref="canvas"` на `:102`), `.hud button` из
  общего правила с `.reset` и правило `:220-223`; передать `NodeCard` `:by-ref="tasks ? (data.board?.byRef ?? null) : null"`.
  `GraphCanvas.vue` — убрать `defineExpose({ fit })`. Если импорт `ref` или тип стал не нужен — убрать.
- [ ] **Шаг 4:** `NodeCard.vue` — в `view` подзадачи `issues: byRef && found.issues.length ? subtaskIssues(found.issues, byRef, config.board?.owner ?? null) : null`
  и `progress` по найденным задачам. В шаблоне подзадачи после блока «Подзадачи»:
  `<h4>Задачи · {{ progress.done }} из {{ progress.total }} готово</h4>`, `TaskList` по найденным (если есть), и
  для каждой ненайденной — `<p class="none">` с номером ссылкой (`url`, текстом при `url === null`) и словами
  «— нет на доске». Блок только при `view.issues !== null`.
- [ ] **Шаг 5:** `bun test test/theme.test.ts` — PASS.
- [ ] **Шаг 6:** фикстура тестового сайта: в `test/site/modules/2/tracks/figma.md` подзадачи
  `{ title: "Экран профиля", issues: [figma#5] }` и `{ title: "Экран блокнота", issues: [figma#6, figma#99] }`;
  `test/site/modules/board.json` — `takenAt` текущей недели, спринт `Sprint 5`, задачи `figma#5` (Ready, Sprint 5,
  ManInTheCoat, трек `figma`) и `figma#6` (Backlog, без спринта и трека). Проверить, что у модуля 2 тестового
  сайта есть `sprints` с `Sprint 5`; если нет — добавить в его `index.md`.
- [ ] **Шаг 7:** README, раздел «Трек»: в примере `subtasks` — строка и объект с `issues`; абзац: формат номера,
  что показывает карточка подзадачи, «нет на доске» не роняет сборку.
- [ ] **Шаг 8:** проверка как в CI (Global Constraints) — всё зелёное.
- [ ] **Шаг 9: глазами.** `bunx vitepress preview test/site` после `test:site`; в Chrome (предупредить пользователя
  об окне, закрыть после): граф модуля 2 — кнопки «Вписать» нет, граф вписан; клик по «Экран профиля» —
  «Задачи · 0 из 1 готово», figma#5 в группе Ready; «Экран блокнота» — figma#6 в Backlog и строка
  «figma#99 — нет на доске» со ссылкой на `github.com/<owner из module-graph.yaml>/figma/issues/99`; карточка
  трека Figma — прежняя. Скриншот — в scratchpad.
- [ ] **Шаг 10:** коммит `feat(vitepress-module-graph): задачи в карточке подзадачи, без кнопки «Вписать»`; push
  ветки, PR в `main` («Что / Решения / Проверка», скриншот карточки).

### Задача 4: docs на 0.3.0 и `issues` у Figma

Только после того, как пользователь вольёт PR плагина и PR release-please, и `curl -s https://registry.npmjs.org/@tp-prepare/vitepress-module-graph | jq -r '.["dist-tags"].latest'` покажет `0.3.0`.

**Files:**
- Modify: `package.json` (`"@tp-prepare/vitepress-module-graph": "0.3.0"`), `bun.lock`
- Modify: `site/modules/2/tracks/figma.md`
- Test: `scripts/modules-data.test.ts:57-70`

- [ ] **Шаг 1: падающий тест** — в тест Figma добавить
  `expect(figma?.subtasks.map((s) => s.issues)).toEqual([["figma#5"], ["figma#6"]])`.
- [ ] **Шаг 2:** `bun test scripts/modules-data.test.ts` — Expected: FAIL (на 0.2.0 поля `issues` нет).
- [ ] **Шаг 3:** `bun add @tp-prepare/vitepress-module-graph@0.3.0 --exact`; в `figma.md` подзадачи — объекты с
  `issues: [figma#5]` и `issues: [figma#6]`, названия прежние. `grep -c devmail bun.lock` — 0.
- [ ] **Шаг 4:** `bun run typecheck && bun run test && bun run build` — зелёное.
- [ ] **Шаг 5:** коммит `feat(modules): задачи Figma у подзадач, плагин 0.3.0`; push, PR в `main` со ссылкой на
  превью ветки. После сборки превью — глазами: карточка «Экран профиля» показывает figma#5 со статусом с доски.
