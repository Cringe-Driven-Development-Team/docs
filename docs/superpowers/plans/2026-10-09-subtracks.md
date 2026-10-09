# Подтреки и вложенные подзадачи — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Трек может быть подтреком другого (`part_of`), подзадача может иметь вложенные подзадачи; граф, прогресс, карточки, меню и список треков это показывают.

**Architecture:** Модель и проверки — в `site/.vitepress/modules.ts` (`Subtask`, `Track.partOf`, связь графа `sub`, хелперы дерева треков). Сумма задач родителя — `tasksWithSubtracks` в `site/.vitepress/board.ts`. Vue-компоненты только читают новую модель.

**Tech Stack:** TypeScript, Vue 3 (VitePress 1.6.4), force-graph 1.51.4, bun test.

**Spec:** `docs/superpowers/specs/2026-10-09-subtracks-design.md`

## Global Constraints

- Вложенность — один уровень: у подтрека нет подтреков, у вложенной подзадачи нет подзадач.
- Поле frontmatter — `part_of` (не `parent`); в модели — `partOf?: string`.
- Ошибки — `ModuleDataError(файл, поле, текст)`, тексты — дословно из спеки §4.3.
- Подзадача строкой читается как `{ title, subtasks: [] }`; у объекта `subtasks` можно не указывать — тогда `[]`.
- Адреса страниц треков не меняются; доска и `board sync` не меняются.
- Новых зависимостей нет.
- Коммиты по-русски: `тип(область): что сделано`.
- Перед каждым коммитом: `bun run typecheck && bun run test`.

## Review Focus

1. Подзадача-объект без `subtasks` (`- title: "Скиллы"`) — читается как `{ title: "Скиллы", subtasks: [] }`, не падает. Тест — задача 1.
2. `part_of` на трек другого модуля — ошибка правила 2 (`трека <id> нет в модуле <модуль>`), а не молчаливый трек без родителя. Тест — задача 2.
3. Подтрек с собственными подстраницами (как `front-harness`) — в меню его подстраницы вложены в него, а он — в родителя. Тест — задача 5.
4. Карточка вложенной подзадачи по id `subtask:<трек>/<i>/<j>` — находит заголовок по двум индексам, а не берёт подзадачу первого уровня. Логика в чистой функции, тест — задача 3.
5. У родителя нет своих задач, есть только у подтрека — кольцо прогресса у родителя всё равно есть. Тест — задача 4.

---

### Task 1: `Subtask`, `partOf` и проверки трека

**Files:**
- Modify: `site/.vitepress/modules.ts:51-64` (типы), `:91-96` (`strings` не трогать), `:154` (`subtasks`), возврат `parseTrack`
- Test: `scripts/modules.test.ts`, `scripts/modules-read.test.ts`, `scripts/board-model.test.ts:67` (`mkTrack`)

**Interfaces:**
- Produces: `export type Subtask = { title: string; subtasks: string[] }`; `Track.subtasks: Subtask[]`; `Track.partOf?: string` (ключ есть только при заданном `part_of`).

- [ ] **Step 1: Тесты в `scripts/modules.test.ts`, `describe("parseTrack")`**

```ts
test("subtasks: string and object read the same", () => {
  const t = track({ ...valid(), subtasks: ["tRPC", { title: "Скиллы", subtasks: ["/apidog"] }, { title: "Orval" }] });
  expect(t.subtasks).toEqual([
    { title: "tRPC", subtasks: [] },
    { title: "Скиллы", subtasks: ["/apidog"] },
    { title: "Orval", subtasks: [] },
  ]);
});

test("part_of is read", () => {
  expect(track({ ...valid(), part_of: "service" }).partOf).toBe("service");
  expect("partOf" in track(valid())).toBe(false);
});

test("part_of and subtasks are checked", () => {
  fails({ ...valid(), part_of: "" }, "part_of — нужна непустая строка");
  fails({ ...valid(), subtasks: [404] }, "subtasks[0] — нужна строка или { title, subtasks }");
  fails({ ...valid(), subtasks: [{ title: "a", note: "x" }] }, "subtasks[0] — нужна строка или { title, subtasks }");
  fails({ ...valid(), subtasks: [{ title: "" }] }, "subtasks[0].title — нужна непустая строка");
  fails({ ...valid(), subtasks: [{ title: "a", subtasks: [{ title: "b" }] }] }, "subtasks[0].subtasks[0] — нужна строка: вложенность — один уровень");
  fails({ ...valid(), subtasks: ["a", { title: "a" }] }, "subtasks — подзадача «a» повторяется");
  fails({ ...valid(), subtasks: [{ title: "a", subtasks: ["b", "b"] }] }, "subtasks — подзадача «b» повторяется");
});
```

Существующие правки: в «label, help, subtasks…» ожидание `["tRPC"]` → `[{ title: "tRPC", subtasks: [] }]`; `subtasks[0] — нужна строка` → `subtasks[0] — нужна строка или { title, subtasks }`. Повтор одного названия на разных уровнях (`["a", { title: "b", subtasks: ["a"] }]`) — допустим, отдельной проверки нет.

- [ ] **Step 2: Запустить — падают**

Run: `bun test scripts/modules.test.ts`
Expected: FAIL — `subtasks` строки, `partOf` нет.

- [ ] **Step 3: Реализовать в `modules.ts`**

`function subtasks(file: string, value: unknown): Subtask[]` — правила 6–9 спеки §4.3; объект — ровно ключи из `{title, subtasks}`, `subtasks` необязателен. `part_of` — правило 1; в результат `...(partOf ? { partOf } : {})`. `mkTrack` в `board-model.test.ts` остаётся с `subtasks: []`.

- [ ] **Step 4: Реальные данные**

В `scripts/modules-read.test.ts` ожидания подзадач (`monaco`, `front-harness`, `react`, `bff`, `xss`, `ai-review`, `service-harness`, `runtime-grooming`) переписать через `.subtasks.map((s) => s.title)`, значения не менять.

- [ ] **Step 5: Запустить всё**

Run: `bun run typecheck && bun run test`
Expected: tsc без ошибок; падают только места, где Vue/граф читают `subtasks` как строки — `tsc` их покажет: `modules.ts:278-279` (`label: s` → `s.title`), `NodeCard.vue:48,104`, `TrackMeta.vue:59`. Временно чинить их до `.title` (полноценно — задачи 3 и 6). Тесты зелёные.

- [ ] **Step 6: Commit**

```bash
git add site/.vitepress scripts
git commit -m "feat(modules): подзадачи-объекты с вложенными и поле part_of"
```

### Task 2: Проверки модуля для `part_of`

**Files:**
- Modify: `site/.vitepress/modules.ts` (`parseModule`, после проверки `related`)
- Test: `scripts/modules.test.ts`, `describe("parseModule")`

**Interfaces:**
- Consumes: `Track.partOf` (задача 1).

- [ ] **Step 1: Тесты**

```ts
test("part_of is checked against the module", () => {
  const p = (id: string, extra: Record<string, unknown> = {}) => track({ title: id, area: "team", do: { YarikMix: "team" }, ...extra }, id);
  const mod = (...tracks: Track[]) => () => parseModule(INDEX, "2026-10", { title: "М" }, tracks);
  const file = (id: string) => `modules/2026-10/tracks/${id}.md`;
  expect(mod(p("a", { part_of: "x" }))).toThrow(`${file("a")}: part_of — трека x нет в модуле 2026-10`);
  expect(mod(p("a", { part_of: "a" }))).toThrow(`${file("a")}: part_of — трек ссылается сам на себя`);
  expect(mod(p("a"), p("b", { part_of: "a" }), p("c", { part_of: "b" }))).toThrow(`${file("c")}: part_of — b сам подтрек: вложенность — один уровень`);
  expect(mod(p("a"), p("b", { part_of: "a", related: [{ track: "a", why: "w" }] }))).toThrow(
    `${file("b")}: related[0].track — a — родитель или подтрек, связь уже есть через part_of`,
  );
  expect(mod(p("a", { related: [{ track: "b", why: "w" }] }), p("b", { part_of: "a" }))).toThrow(
    `${file("a")}: related[0].track — b — родитель или подтрек, связь уже есть через part_of`,
  );
  expect(mod(p("a"), p("b", { part_of: "a" }))().tracks.find((t) => t.id === "b")?.partOf).toBe("a");
});
```

- [ ] **Step 2: Запустить — падает**

Run: `bun test scripts/modules.test.ts -t "part_of is checked"`
Expected: FAIL — проверок нет.

- [ ] **Step 3: Реализовать правила 2–5 спеки §4.3 в `parseModule`**

Порядок для трека: 3 (на себя) → 2 (нет в модуле) → 4 (родитель сам подтрек); правило 5 — по `related` каждого трека.

- [ ] **Step 4: Запустить**

Run: `bun run typecheck && bun run test`
Expected: всё зелёное.

- [ ] **Step 5: Commit**

```bash
git add site/.vitepress/modules.ts scripts/modules.test.ts
git commit -m "feat(modules): проверки part_of в модуле — существует, не на себя, один уровень, без related"
```

### Task 3: Граф — связь `sub`, вложенные подзадачи, соседи, поиск подзадачи по id

**Files:**
- Modify: `site/.vitepress/modules.ts` (`LinkKind`, `buildGraph`, `neighbours`), `site/.vitepress/theme/components/GraphCanvas.vue:161-162,189-190,209`
- Test: `scripts/modules-graph.test.ts`

**Interfaces:**
- Consumes: `Subtask`, `Track.partOf`.
- Produces: `LinkKind = "do" | "help" | "part" | "related" | "sub"`; id вложенной подзадачи `subtask:<трек>/<i>/<j>`; `export function subtaskByNodeId(module: Module, id: string): { track: Track; title: string; children: string[]; parent: { index: number; title: string } | null } | null` — для `subtask:<трек>/<i>`: `title` подзадачи, `children` — её вложенные, `parent: null`; для `…/<i>/<j>`: `title` — вложенная строка, `children: []`, `parent` — подзадача первого уровня и её индекс `i`.

- [ ] **Step 1: Тесты** — отдельный модуль в файле, старый `MODULE` не трогать:

```ts
const NESTED = parseModule("modules/2026-10/index.md", "2026-10", { title: "Тест" }, [
  t("service", { title: "Сервис", area: "team", do: { YarikMix: "team" }, subtasks: [{ title: "Скиллы", subtasks: ["/apidog"] }] }),
  t("front", { title: "Фронт", area: "front", do: { ManInTheCoat: "front" }, part_of: "service" }),
]);
const nested = (filter: Partial<Filter> = {}) => buildGraph(NESTED, PEOPLE, { ...DEFAULT_FILTER, ...filter });

test("sub link and nested subtasks", () => {
  const g = nested();
  expect(g.links.filter((l) => l.kind === "sub")).toEqual([{ source: "track:service", target: "track:front", kind: "sub" }]);
  expect(g.links.filter((l) => l.kind === "part")).toEqual([
    { source: "track:service", target: "subtask:service/0", kind: "part" },
    { source: "subtask:service/0", target: "subtask:service/0/0", kind: "part" },
  ]);
  expect(g.nodes.find((n) => n.id === "subtask:service/0/0")).toMatchObject({ kind: "subtask", label: "/apidog", trackId: "service" });
});

test("layers and filters for sub", () => {
  expect(nested({ hide: ["subtasks"] }).nodes.some((n) => n.kind === "subtask")).toBe(false);
  expect(nested({ hide: ["related"] }).links.some((l) => l.kind === "sub")).toBe(true);
  expect(nested({ areas: ["front"] }).links.some((l) => l.kind === "sub")).toBe(false);
  expect(nested({ areas: ["front"] }).nodes.map((n) => n.id)).toContain("track:front");
});

test("neighbours: person gets nested subtasks, parent gets subtrack", () => {
  expect([...neighbours(nested(), "person:YarikMix")].sort()).toEqual(["person:YarikMix", "subtask:service/0", "subtask:service/0/0", "track:service"]);
  expect(neighbours(nested(), "track:service").has("track:front")).toBe(true);
});

test("subtaskByNodeId", () => {
  expect(subtaskByNodeId(NESTED, "subtask:service/0")).toMatchObject({ title: "Скиллы", children: ["/apidog"], parent: null });
  expect(subtaskByNodeId(NESTED, "subtask:service/0/0")).toMatchObject({ title: "/apidog", children: [], parent: { index: 0, title: "Скиллы" } });
  expect(subtaskByNodeId(NESTED, "subtask:service/0/5")).toBeNull();
  expect(subtaskByNodeId(NESTED, "subtask:nope/0")).toBeNull();
});
```

Старый `kinds()` в «default filter shows everything» не меняется: в `MODULE` нет `part_of`.

- [ ] **Step 2: Запустить — падают**

Run: `bun test scripts/modules-graph.test.ts`
Expected: FAIL — `sub` и вложенных узлов нет, `subtaskByNodeId` не экспортирован.

- [ ] **Step 3: Реализовать**

`buildGraph`: связи `sub` — в блоке после треков, вне условия `hide related`, если видны оба. `neighbours`: у человека к подзадачам его треков добавить их соседей `subtask:`. `GraphCanvas.vue`: `sub` — без пунктира, цвет и прозрачность как `part`, толщина 0.8, длина связи 45.

- [ ] **Step 4: Запустить**

Run: `bun run typecheck && bun run test`
Expected: всё зелёное.

- [ ] **Step 5: Commit**

```bash
git add site/.vitepress scripts/modules-graph.test.ts
git commit -m "feat(modules): граф — связь sub к подтреку и вложенные подзадачи"
```

### Task 4: Прогресс родителя — `tasksWithSubtracks`

**Files:**
- Modify: `site/.vitepress/board.ts` (после `trackProgress`), `site/.vitepress/theme/components/ModuleGraph.vue:35-37`
- Test: `scripts/board-model.test.ts`

**Interfaces:**
- Produces: `export function tasksWithSubtracks(module: Module, byTrack: Readonly<Record<string, readonly BoardTask[]>>, id: string): BoardTask[]` — свои задачи трека, затем задачи подтреков в порядке `module.tracks`.

- [ ] **Step 1: Тест**

```ts
test("tasksWithSubtracks: parent sums subtracks, others only own", () => {
  const m: Module = { ...mkModule("2026-10", [], ["svc", "front", "xss"]) };
  m.tracks[1] = { ...m.tracks[1]!, partOf: "svc" };
  const a = mkTask({ ref: "frontend#1" });
  const b = mkTask({ ref: "frontend#2" });
  expect(tasksWithSubtracks(m, { front: [b] }, "svc")).toEqual([b]);
  expect(tasksWithSubtracks(m, { svc: [a], front: [b] }, "svc")).toEqual([a, b]);
  expect(tasksWithSubtracks(m, { svc: [a], front: [b] }, "front")).toEqual([b]);
  expect(tasksWithSubtracks(m, {}, "xss")).toEqual([]);
});
```

- [ ] **Step 2: Запустить — падает**

Run: `bun test scripts/board-model.test.ts -t tasksWithSubtracks`
Expected: FAIL — функции нет.

- [ ] **Step 3: Реализовать и подключить**

`ModuleGraph.vue`: `progress` — по `module.tracks`, для каждого `trackProgress(tasksWithSubtracks(module, byTrack, t.id))`; трек с `total === 0` узел и так не рисует кольцом.

- [ ] **Step 4: Запустить**

Run: `bun run typecheck && bun run test`
Expected: всё зелёное.

- [ ] **Step 5: Commit**

```bash
git add site/.vitepress scripts/board-model.test.ts
git commit -m "feat(board): прогресс родителя — с задачами подтреков"
```

### Task 5: Дерево треков — меню и список под графом

**Files:**
- Modify: `site/.vitepress/modules.ts` (`moduleSidebar`, новые хелперы), `site/.vitepress/theme/components/TrackList.vue`
- Test: `scripts/modules.test.ts`, `describe("moduleSidebar")`

**Interfaces:**
- Produces: `export function subtracksOf(module: Module, id: string): Track[]` (в порядке `module.tracks`); `export function topTracks(module: Module): Track[]` — треки без `partOf`.

- [ ] **Step 1: Тест**

```ts
test("subtrack is nested under its parent after the parent's subpages", () => {
  const sub = (track: string, id: string, title: string): TrackPage => ({ id, title, url: `/modules/2026-10/tracks/${track}/${id}` });
  const svc = parseTrack("modules/2026-10/tracks/svc.md", "2026-10", "svc", { title: "Сервис", area: "team", do: { YarikMix: "team" } }, "", PEOPLE, [sub("svc", "plan", "План")]);
  const front = parseTrack("modules/2026-10/tracks/front.md", "2026-10", "front", { title: "Фронт", area: "front", do: { ManInTheCoat: "front" }, part_of: "svc" }, "", PEOPLE, [sub("front", "lsp", "LSP")]);
  const m = parseModule("modules/2026-10/index.md", "2026-10", { title: "Октябрь" }, [svc, front]);
  expect(moduleSidebar([m])[0]?.items).toEqual([
    { text: "Граф", link: "/modules/2026-10/" },
    {
      text: "Сервис",
      link: "/modules/2026-10/tracks/svc",
      collapsed: false,
      items: [
        { text: "План", link: "/modules/2026-10/tracks/svc/plan" },
        { text: "Фронт", link: "/modules/2026-10/tracks/front", collapsed: false, items: [{ text: "LSP", link: "/modules/2026-10/tracks/front/lsp" }] },
      ],
    },
  ]);
  expect(topTracks(m).map((t) => t.id)).toEqual(["svc"]);
  expect(subtracksOf(m, "svc").map((t) => t.id)).toEqual(["front"]);
});
```

- [ ] **Step 2: Запустить — падает**

Run: `bun test scripts/modules.test.ts -t "nested under its parent"`
Expected: FAIL.

- [ ] **Step 3: Реализовать**

`moduleSidebar` — по `topTracks`, у трека — `[...подстраницы, ...подтреки]`, `collapsed: false`, если список не пуст. `TrackList.vue`: группы направлений — по `topTracks`; под каждым треком вложенный `<ul>` из `subtracksOf` с той же строкой исполнителей.

- [ ] **Step 4: Запустить**

Run: `bun run typecheck && bun run test`
Expected: всё зелёное.

- [ ] **Step 5: Commit**

```bash
git add site/.vitepress scripts/modules.test.ts
git commit -m "feat(modules): подтрек вложен в родителя в меню и в списке треков"
```

### Task 6: Карточка узла и страница трека

**Files:**
- Modify: `site/.vitepress/theme/components/NodeCard.vue` (`view`, шаблон трека и подзадачи), `site/.vitepress/theme/components/TrackMeta.vue:56-70`

**Interfaces:**
- Consumes: `subtaskByNodeId`, `subtracksOf` (задачи 3, 5), `tasksWithSubtracks` (задача 4), `trackProgress`.

Чистая логика уже покрыта задачами 3–5; здесь — разметка по спеке §5.4 и §6:

- [ ] **Step 1: `NodeCard.vue`**
  - трек: «Подзадачи · N» — первый уровень, вложенные списком под своей; у подтрека — «Входит в трек» (кнопка `track:<partOf>`); у родителя — «Подтреки»: кнопка узла и «a из b готово» по своим задачам подтрека (только при снимке доски); «Задачи · X из Y готово» — по `tasksWithSubtracks`, список — свои задачи;
  - подзадача: через `subtaskByNodeId`; у первого уровня — «Подзадачи» кнопками `subtask:<трек>/<i>/<j>`; у вложенной — «Входит в подзадачу» (кнопка `subtask:<трек>/<i>`), затем «Входит в трек», «Кто»;
  - `:key` списков подзадач — индекс.
- [ ] **Step 2: `TrackMeta.vue`** — «Подзадачи» вложенным списком; строка «Входит в трек» со ссылкой у подтрека; раздел «Подтреки» со ссылками и «a из b готово» у родителя; заголовок задач — по `tasksWithSubtracks`.
- [ ] **Step 3: Проверить**

Run: `bun run typecheck && bun run test && DIAGRAMS_NATIVE=1 bun run build`
Expected: tsc без ошибок, тесты зелёные, `site ok`.

- [ ] **Step 4: Commit**

```bash
git add site/.vitepress
git commit -m "feat(modules): карточка и страница трека — подтреки и вложенные подзадачи"
```

### Task 7: Перенос данных и документация

**Files:**
- Modify: `site/modules/2026-10/tracks/front-harness.md`, `site/modules/2026-10/tracks/service-harness.md`, `docs/superpowers/specs/2026-10-08-module-graph-design.md` (§4.3, §4.4, §5.2)
- Test: `scripts/modules-read.test.ts`

- [ ] **Step 1: Тест на реальные данные**

```ts
expect(track("front-harness")?.partOf).toBe("service-harness");
expect(track("front-harness")?.related).toEqual([]);
expect(track("service-harness")?.subtasks).toEqual([{ title: "Скиллы", subtasks: ["/apidog"] }]);
```

Старое ожидание `front-harness` related `["service-harness"]` и `["Скиллы: /apidog"]` — убрать.

- [ ] **Step 2: Запустить — падает**

Run: `bun test scripts/modules-read.test.ts`
Expected: FAIL.

- [ ] **Step 3: Перенести данные по спеке §8**; в спеке графа — по строке «Подтреки и вложенные подзадачи — `2026-10-09-subtracks-design.md`» в §4.3, §4.4 и §5.2.

- [ ] **Step 4: Запустить**

Run: `bun run typecheck && bun run test && DIAGRAMS_NATIVE=1 bun run build`
Expected: всё зелёное, `site ok`.

- [ ] **Step 5: Commit**

```bash
git add site/modules docs scripts/modules-read.test.ts
git commit -m "docs(modules): «Harness фронта» — подтрек «Harness сервиса», «Скиллы» → «/apidog»"
```

### Task 8: Проверка глазами

- [ ] **Step 1:** Локальная сборка (`DIAGRAMS_NATIVE=1 bun run build`) и сервер как у GitHub Pages (`x.html` раньше папки `x/`).
- [ ] **Step 2:** Chrome, `/docs/modules/2026-10/`: подтрек «Harness фронта» висит на «Harness сервиса» сплошной линией; «/apidog» — на «Скиллы»; карточки родителя, подтрека, «Скиллы», «/apidog»; слой «Связи между треками» выключен — линия `sub` осталась; меню — «Harness фронта» внутри «Harness сервиса» вместе с подстраницами; страница `service-harness`. Светлая и тёмная тема, 375 px.
- [ ] **Step 3:** Найденное — исправить с тестом, где логика в `.ts`; разметку — правкой и повторной проверкой.
