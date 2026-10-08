# Граф учебного модуля (v1) — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** страницы `/modules/<YYYY-MM>/` с живым графом «люди — треки — подзадачи», страница на каждый трек и архив модулей в VitePress репы `docs`.

**Architecture:** данные — frontmatter markdown-файлов треков и `people.ts`. Чистый `site/.vitepress/modules.ts` разбирает и проверяет их и строит граф и фильтры; `modules-read.ts` читает файлы для загрузчика данных VitePress и для меню в `config.mts`; Vue-компоненты темы только рисуют, граф — `force-graph` на canvas, грузится в браузере.

**Tech Stack:** VitePress 1.6.4, Vue 3, Bun 1.3 (`bun test`), TypeScript 7 (`tsc`), `force-graph` 1.51.4, `gray-matter` 4.0.3.

**Spec:** `docs/superpowers/specs/2026-10-08-module-graph-design.md`

## Global Constraints

- Версии в `devDependencies` — точные: `"force-graph": "1.51.4"`, `"gray-matter": "4.0.3"`; `bun.lock` обновлён `bun install`.
- Направления: `front` «Фронт», `back` «Бэк», `devops` «DevOps», `fullstack` «Фронт + бэк», `team` «Инструменты команды». Стороны: `front` «фронт», `back` «бэк», `devops` «devops», `team` «команда».
- Текст ошибки данных: `<путь от site/>: <поле> — <что не так>`, например `modules/2026-10/tracks/bff.md: do — логина MrDuck нет в people.ts`.
- `id` трека — `^[a-z0-9]+(?:-[a-z0-9]+)*$`; каталог модуля — `^\d{4}-(0[1-9]|1[0-2])$`.
- Ссылки в компонентах — через `withBase()` из `vitepress`: сайт живёт под `/docs/` и `/docs/branches/<slug>/`.
- Тексты интерфейса — по-русски; строки, зафиксированные спекой: «Описание ещё не написано», «В модуле пока нет треков. Добавьте файл в `site/modules/<YYYY-MM>/tracks/`», «Граф не загрузился, ниже — список треков», «Открыть страницу трека», «На графе модуля».
- Коммиты — `тип(область): что сделано` по-русски; работа в worktree `.claude/worktrees/module-graph`, ветка `docs/module-graph`.
- Перед коммитом задачи с кодом: `bun run typecheck && bun run test`. Полная сборка `bun run build` идёт в Docker; без Docker — `DIAGRAMS_NATIVE=1 bun run build`.
- Публичный репозиторий: никаких адресов, токенов, IP.

## Review Focus

1. Логин в frontmatter в другом регистре (`iredtea` вместо `iRedTea`) — GitHub логины не различает, человек ждёт подсказку, а не загадочное «нет в people.ts»: ошибка называет правильное написание. Тест — задача 2.
2. `help: YarikMix` строкой вместо списка, подзадача числом (`- 404`) — ожидается понятная ошибка с полем, а не падение внутри графа. Тест — задача 2.
3. Ссылка с устаревшим или битым фильтром (`?people=ghost&area=zzz&hide=foo`) — граф открывается в обычном виде, неизвестное отброшено. Тест — задача 4.
4. Фильтр, под который ничего не попало (`?area=team&people=GrayMouse9`) — не пустой холст, а «Под фильтр ничего не попало» и кнопка «Сбросить фильтры»; выбранный человек остаётся узлом. Тест `buildGraph` — задача 4, текст — задача 7.
5. Новый трек при запущенном `vitepress dev`: граф обновится (загрузчик следит за файлами), боковое меню — нет, его строит `config.mts` один раз. README говорит перезапустить dev-сервер. Задача 8.

---

### Task 1: Зависимости, типы направлений и люди

**Files:**
- Modify: `package.json`, `bun.lock`, `tsconfig.json`
- Create: `site/.vitepress/modules.ts`, `site/modules/people.ts`
- Test: `scripts/modules.test.ts`

**Interfaces:**
- Produces (`modules.ts`):
  - `export const AREAS = ["front", "back", "devops", "fullstack", "team"] as const; export type Area = (typeof AREAS)[number];`
  - `export const SIDES = ["front", "back", "devops", "team"] as const; export type Side = (typeof SIDES)[number];`
  - `export const AREA_LABELS: Record<Area, string>`, `export const SIDE_LABELS: Record<Side, string>` — значения из Global Constraints.
  - `export type Person = { login: string; name: string; role: string; area: Area; mentor?: true }`
  - `export class ModuleDataError extends Error {}` — `constructor(file: string, field: string, problem: string)`, `message` = `${file}: ${field} — ${problem}`.
  - `export function validatePeople(people: readonly Person[], file?: string): void` — `file` по умолчанию `"modules/people.ts"`.
- Produces (`people.ts`): `export const PEOPLE: readonly Person[]` — 6 записей спеки §4.1 в её порядке (`import type { Person } from "../.vitepress/modules.ts"`).

- [ ] **Step 1: Поставить зависимости**

Run: `bun add -d --exact force-graph@1.51.4 gray-matter@4.0.3`
Expected: в `package.json` `"force-graph": "1.51.4"`, `"gray-matter": "4.0.3"`, `bun.lock` изменён.

- [ ] **Step 2: Расширить `tsconfig.json` `include`** на `"site/.vitepress/**/*.ts"` и `"site/modules/**/*.ts"` (вместо `"site/.vitepress/*.ts"`; `*.mts` оставить).

- [ ] **Step 3: Написать падающие тесты**

```ts
import { expect, test } from "bun:test";
import { AREA_LABELS, ModuleDataError, validatePeople } from "../site/.vitepress/modules.ts";
import { PEOPLE } from "../site/modules/people.ts";

test("PEOPLE: the team from the spec, valid", () => {
  expect(PEOPLE.map((p) => p.login)).toEqual(["YarikMix", "blackHATred", "ManInTheCoat", "iRedTea", "GrayMouse9", "MrDuckVC"]);
  expect(PEOPLE.filter((p) => p.mentor).map((p) => p.name)).toEqual(["Ярослав", "Саша"]);
  expect(() => validatePeople(PEOPLE)).not.toThrow();
});

test("validatePeople: duplicate login and unknown area", () => {
  const a = { login: "a", name: "A", role: "фронт", area: "front" } as const;
  expect(() => validatePeople([a, { ...a, name: "B" }])).toThrow("modules/people.ts: login — логин a повторяется");
  expect(() => validatePeople([{ ...a, area: "qa" as never }])).toThrow("modules/people.ts: area — неизвестное направление qa у a");
});

test("ModuleDataError: message format", () => {
  expect(new ModuleDataError("modules/2026-10/tracks/bff.md", "do", "пусто").message).toBe("modules/2026-10/tracks/bff.md: do — пусто");
  expect(AREA_LABELS.fullstack).toBe("Фронт + бэк");
});
```

- [ ] **Step 4: Run** `bun test scripts/modules.test.ts` — Expected: FAIL, модулей нет.
- [ ] **Step 5: Реализовать** `modules.ts` (только экспорты этой задачи) и `people.ts`.
- [ ] **Step 6: Run** `bun run typecheck && bun test scripts/modules.test.ts` — Expected: PASS.
- [ ] **Step 7: Commit** — `git add package.json bun.lock tsconfig.json site/.vitepress/modules.ts site/modules/people.ts scripts/modules.test.ts && git commit -m "feat(modules): люди команды и направления треков"`

### Task 2: Разбор и проверка трека и модуля

**Files:**
- Modify: `site/.vitepress/modules.ts`
- Test: `scripts/modules.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `export type Doer = { login: string; side: Side }`
  - `export type Related = { track: string; why: string }`
  - `export type Track = { id: string; module: string; title: string; label: string; area: Area; do: Doer[]; help: string[]; subtasks: string[]; related: Related[]; hasBody: boolean; url: string }` — `label` = `label ?? title`; `url` = `/modules/<module>/tracks/<id>`.
  - `export type Module = { id: string; title: string; period?: string; url: string; tracks: Track[] }` — `url` = `/modules/<id>/`.
  - `export function parseTrack(file: string, moduleId: string, id: string, data: unknown, body: string, people: readonly Person[]): Track` — проверки спеки §4.4 п. 1–4, 6 (id); `hasBody` = `body.trim() !== ""`.
  - `export function parseModule(file: string, id: string, data: unknown, tracks: Track[]): Module` — проверка каталога §4.4 п. 6, `title` обязателен, `period` — необязательная строка, затем п. 5 для всех `related`; `tracks` отсортированы по `title` (`localeCompare(…, "ru")`).

Тексты ошибок (поле — что не так), их тесты проверяют дословно:

| Случай | `field` | `problem` |
|---|---|---|
| нет `title` / не строка | `title` | `нужна непустая строка` |
| `area` вне списка | `area` | `неизвестное направление <v>; допустимо: front, back, devops, fullstack, team` |
| `do` нет, не объект или пуст | `do` | `нужен хотя бы один исполнитель: логин → сторона` |
| сторона вне списка | `do.<login>` | `неизвестная сторона <v>; допустимо: front, back, devops, team` |
| логина нет, есть в другом регистре | `do` / `help` | `логина <v> нет в people.ts — может быть, <Правильный>?` |
| логина нет совсем | `do` / `help` | `логина <v> нет в people.ts` |
| логин и в `do`, и в `help` | `help` | `<v> уже исполнитель` |
| `help` / `subtasks` / `related` не список | `<поле>` | `нужен список` |
| элемент `help` / `subtasks` не строка | `<поле>[<i>]` | `нужна строка` |
| `fullstack` без `front` или `back` | `do` | `у трека «Фронт + бэк» нужны исполнители со стороны front и back` |
| `related` на чужой или несуществующий трек / на себя | `related[<i>].track` | `трека <v> нет в модуле <m>` / `трек ссылается сам на себя` |
| `related[i].why` пуст | `related[<i>].why` | `нужна непустая строка` |
| `id` не по шаблону | `id` | `имя файла <id>.md: только строчная латиница, цифры и дефис` |
| каталог модуля не `YYYY-MM` | `каталог` | `<id> — нужен формат YYYY-MM` |

- [ ] **Step 1: Написать падающие тесты** — `describe("parseTrack")` с фабрикой `valid = { title: "BFF", area: "fullstack", do: { iRedTea: "front", MrDuckVC: "back" } }` и файлом `modules/2026-10/tracks/bff.md`:
  - `parses a valid track` — `label === "BFF"`, `do` = `[{login:"iRedTea",side:"front"},{login:"MrDuckVC",side:"back"}]`, `help`/`subtasks`/`related` = `[]`, `hasBody === false` при `body = "\n  \n"`, `url === "/modules/2026-10/tracks/bff"`;
  - по тесту на каждую строку таблицы, `toThrow(<полный текст>)`; в том числе `do: { iredtea: "front", MrDuckVC: "back" }` → `…: do — логина iredtea нет в people.ts — может быть, iRedTea?`, `help: "YarikMix"` → `…: help — нужен список`, `subtasks: [404]` → `…: subtasks[0] — нужна строка`.
  - `describe("parseModule")`: `related` на трек из того же модуля проходит; на `ghost` и на себя падают текстами таблицы; каталог `2026-13` и `drafts` падают; треки отсортированы по `title`.
- [ ] **Step 2: Run** `bun test scripts/modules.test.ts` — Expected: FAIL, `parseTrack` нет.
- [ ] **Step 3: Реализовать** `parseTrack`, `parseModule` в `modules.ts`.
- [ ] **Step 4: Run** `bun run typecheck && bun test scripts/modules.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(modules): разбор и проверка треков и модуля`

### Task 3: Чтение каталога модулей

**Files:**
- Create: `site/.vitepress/modules-read.ts`
- Test: `scripts/modules-read.test.ts`

**Interfaces:**
- Consumes: `parseTrack`, `parseModule`, `validatePeople`, `Module` (Task 2), `PEOPLE` (Task 1).
- Produces: `export function readModules(modulesDir: string, people?: readonly Person[]): Module[]` — `people` по умолчанию `PEOPLE`; вызывает `validatePeople`; обходит подкаталоги `modulesDir` (файлы в корне игнорирует), в каждом читает `index.md` и `tracks/*.md` через `gray-matter`; пути в ошибках — от `site/`: `modules/<m>/…`; результат — модули от новых к старым (по `id`, убывание). Каталог без `index.md` → `ModuleDataError("modules/<m>", "index.md", "нет файла страницы модуля")`.

- [ ] **Step 1: Написать падающие тесты** — во временном каталоге (`mkdtempSync(join(tmpdir(), "modules-"))`, удаление в `afterEach`) с файлами, записанными тестом:
  - `reads modules newest first` — `2026-09/index.md` и `2026-10/index.md` + `2026-10/tracks/bff.md` (frontmatter `valid` из Task 2 и текст `## Цель\nтекст`) → `ids === ["2026-10","2026-09"]`, у `bff` `hasBody === true`, корневой `people.ts` в каталоге не мешает;
  - `rejects a stray directory` — каталог `drafts/` → `toThrow("modules/drafts: каталог — drafts — нужен формат YYYY-MM")`;
  - `requires index.md` → текст из Interfaces;
  - `real site/modules is valid` — `readModules("site/modules")` не бросает, модуль `2026-10` есть (тест включается задачей 5: до неё помечен `test.todo`).
- [ ] **Step 2: Run** `bun test scripts/modules-read.test.ts` — Expected: FAIL.
- [ ] **Step 3: Реализовать** `readModules` (`readdirSync` с `withFileTypes`, `matter(readFileSync(...))` → `data`, `content`).
- [ ] **Step 4: Run** `bun run typecheck && bun test scripts/modules-read.test.ts` — Expected: PASS (кроме `todo`).
- [ ] **Step 5: Commit** — `feat(modules): чтение каталога модулей`

### Task 4: Граф, фильтр, адрес, нагрузка

**Files:**
- Modify: `site/.vitepress/modules.ts`
- Test: `scripts/modules-graph.test.ts`

**Interfaces:**
- Consumes: `Module`, `Track`, `Person`, `Area`, `Side` (Tasks 1–2).
- Produces:
  - `export type NodeKind = "person" | "track" | "subtask"`
  - `export type GraphNode = { id: string; kind: NodeKind; label: string; title: string; area: Area; mentor?: true; login?: string; trackId?: string }` — id: `person:<login>`, `track:<id>`, `subtask:<trackId>/<index>`.
  - `export type LinkKind = "do" | "help" | "part" | "related"`
  - `export type GraphLink = { source: string; target: string; kind: LinkKind; side?: Side; why?: string }` — `do`/`help`: человек → трек; `part`: трек → подзадача; `related`: трек → трек.
  - `export type Layer = "subtasks" | "help" | "related"`
  - `export type Filter = { people: string[]; areas: Area[]; hide: Layer[] }`; `export const DEFAULT_FILTER: Filter = { people: [], areas: [...AREAS], hide: [] }`
  - `export function buildGraph(module: Module, people: readonly Person[], filter: Filter): { nodes: GraphNode[]; links: GraphLink[] }`
  - `export function neighbours(graph: { links: GraphLink[] }, id: string): Set<string>` — сам узел и соседи; для человека — ещё подзадачи его треков.
  - `export function searchMatches(nodes: GraphNode[], query: string): Set<string>` — без учёта регистра по `title` и `label`; пустой запрос → пустое множество.
  - `export function filterFromQuery(search: string, people: readonly Person[]): Filter` / `export function filterToQuery(filter: Filter): string` — формат спеки §5.2; неизвестные логины, направления и слои отбрасываются; `filterToQuery(DEFAULT_FILTER)` → `""`; `area` пишется, только если выбраны не все.
  - `export type Load = { login: string; doing: number; helping: number }`; `export function personLoad(module: Module, people: readonly Person[]): Load[]` — в порядке `people`.

Правила `buildGraph` (как прототип от 08.10):
1. Трек виден, если его `area` в `filter.areas` и (`filter.people` пуст или среди его участников есть выбранный). Участники — `do` и, если `help` не скрыт, `help`.
2. Люди — участники видимых треков и все выбранные (выбранный остаётся узлом, даже если его треков не видно).
3. Подзадачи и рёбра `part` — если `subtasks` не скрыт; `related` — если не скрыт и оба трека видны.
4. Порядок узлов: люди в порядке `people`, затем треки в порядке модуля, подзадача сразу за своим треком.

- [ ] **Step 1: Написать падающие тесты** на модуле-фикстуре из трёх треков (собран `parseModule`): `multibranch` (devops, do iRedTea, help YarikMix+blackHATred, related → `bff`), `bff` (fullstack, iRedTea front + MrDuckVC back, subtasks tRPC, Orval), `ai-review` (team, YarikMix):
  - `default filter shows everything` — 9 узлов: люди `iRedTea`, `YarikMix`, `blackHATred`, `MrDuckVC` (в порядке `PEOPLE`: `YarikMix`, `blackHATred`, `iRedTea`, `MrDuckVC`), 3 трека, 2 подзадачи; рёбра: 4 `do`, 2 `help`, 2 `part`, 1 `related`;
  - `person filter keeps co-workers` — `people: ["blackHATred"]` → треки только `multibranch`, люди `iRedTea`, `YarikMix`, `blackHATred`;
  - `hidden help drops helpers and their-only tracks` — `people: ["blackHATred"], hide: ["help"]` → треков нет, узлы `["person:blackHATred"]`;
  - `area filter` — `areas: ["team"]` → один трек `ai-review`;
  - `nothing matches but the selected person stays` — `areas: ["team"], people: ["GrayMouse9"]` → узлы `["person:GrayMouse9"]`, рёбер нет;
  - `layers` — `hide: ["subtasks","related"]` → нет `subtask:*`, нет `related`;
  - `neighbours of a person include subtasks of their tracks` — `neighbours(g, "person:MrDuckVC")` ⊇ `subtask:bff/0`, `subtask:bff/1`;
  - `searchMatches` — `"orval"` → `{"subtask:bff/1"}`, `""` → пусто;
  - `query round-trip` — `filterToQuery({people:["iRedTea","GrayMouse9"],areas:["devops","fullstack"],hide:["subtasks"]})` → `"?people=iRedTea,GrayMouse9&area=devops,fullstack&hide=subtasks"`, `filterFromQuery(<эта строка>, PEOPLE)` возвращает тот же фильтр; `filterToQuery(DEFAULT_FILTER) === ""`;
  - `stale query is ignored` — `filterFromQuery("?people=ghost&area=zzz&hide=foo", PEOPLE)` → `DEFAULT_FILTER`; `?people=ghost,iRedTea` → `people: ["iRedTea"]`;
  - `personLoad` — для `YarikMix` `{doing:1, helping:1}`, для `ManInTheCoat` `{doing:0, helping:0}`.
- [ ] **Step 2: Run** `bun test scripts/modules-graph.test.ts` — Expected: FAIL.
- [ ] **Step 3: Реализовать** функции в `modules.ts`.
- [ ] **Step 4: Run** `bun run typecheck && bun test` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(modules): граф, фильтры и нагрузка людей`

### Task 5: Данные модуля 2026-10 и загрузчик

**Files:**
- Create: `site/modules/modules.data.ts`, `site/modules/index.md`, `site/modules/2026-10/index.md`, `site/modules/2026-10/tracks/<id>.md` × 19
- Modify: `scripts/modules-read.test.ts` (снять `todo`)

**Interfaces:**
- Consumes: `readModules` (Task 3).
- Produces: `site/modules/modules.data.ts`:
  ```ts
  export interface Data { modules: Module[]; people: readonly Person[] }
  declare const data: Data; export { data };
  export default { watch: ["./*/index.md", "./*/tracks/*.md", "./people.ts"], load(): Data { … } };
  ```
  `load` вызывает `readModules(fileURLToPath(new URL(".", import.meta.url)))` и отдаёт `{ modules, people: PEOPLE }`.

- [ ] **Step 1: Создать 19 файлов треков** строго по таблице спеки §4.5: `title`, `label` (значение в скобках), `area`, `do`, `help`, `subtasks`; без `related`; тела нет, кроме `bff.md` — одна строка «Подзадачи — со стороны фронта (Денис).».
- [ ] **Step 2: Создать** `2026-10/index.md` — frontmatter `title: Модуль октября 2026`, `aside: false`; тело `<ModuleGraph />`. `site/modules/index.md` — `title: Модули`, заголовок `# Модули`, `<ModuleList />`.
- [ ] **Step 3: Создать** `modules.data.ts` по Interfaces.
- [ ] **Step 4: Снять `todo`** с `real site/modules is valid` и дописать: у `2026-10` 19 треков; `personLoad` — `ManInTheCoat` doing 8, `iRedTea` 6, `MrDuckVC` 4, `GrayMouse9` 3, `YarikMix` doing 3 / helping 2, `blackHATred` doing 0 / helping 3.
- [ ] **Step 5: Run** `bun run typecheck && bun test` — Expected: PASS.
- [ ] **Step 6: Commit** — `docs(modules): план модуля октября 2026`

### Task 6: Тема — страницы треков, список, архив, меню

**Files:**
- Create: `site/.vitepress/theme/components/TrackList.vue`, `TrackMeta.vue`, `ModuleList.vue`, `site/.vitepress/theme/components/ModuleGraph.vue` (заглушка: только `TrackList` модуля; граф — задача 7)
- Modify: `site/.vitepress/theme/index.ts`, `site/.vitepress/theme/custom.css`, `site/.vitepress/config.mts`

**Interfaces:**
- Consumes: `data` из `site/modules/modules.data.ts` (Task 5), `AREA_LABELS`, `SIDE_LABELS`, `personLoad` (Tasks 1, 4), `readModules` (Task 3).
- Produces:
  - `TrackList.vue` — `props: { module: Module }`; группы по `AREAS` (пустые не выводятся), заголовок группы — `AREA_LABELS`, строка: ссылка `withBase(track.url)` с `title`, исполнители «Имя (сторона)», помощники «помогают: …».
  - `ModuleGraph.vue` — без props; модуль — по `useData().page.value.relativePath` (`modules/<id>/index.md`); выводит `TrackList`; модуль без треков — текст из Global Constraints.
  - `TrackMeta.vue` — рисуется только на `modules/<m>/tracks/<id>.md`: эйбрау с направлением, исполнители со стороной, помощники, подзадачи, связи с `why`, ссылка «На графе модуля» → `withBase(module.url)`; если `!track.hasBody` — плашка «Описание ещё не написано» (`.custom-block.info`).
  - `ModuleList.vue` — таблица: название-ссылка, период (или «—»), треков, людей (уникальные логины `do` и `help`).
  - `theme/index.ts`: `Layout: () => h(DefaultTheme.Layout, null, { "doc-before": () => h(TrackMeta) })`; `enhanceApp({ app })` регистрирует `ModuleGraph`, `ModuleList`; существующий `setup()` не трогается.
  - `custom.css`: `--cdd-area-front|back|devops|fullstack|team` в `:root` и `.dark` — значения прототипа (тёмные: `#5f95f1 #3fbc9c #e1a740 #e47584 #a9ba5c`, светлые: `#2c6bd4 #13886b #b07710 #c9445a #6b7c1c`).
  - `config.mts`: `nav` + `{ text: 'Модули', link: '/modules/', activeMatch: '^/modules/' }`; `sidebar['/modules/']` — по модулю группа `{ text: module.title, items: [{ text: 'Граф', link: module.url }, ...tracks.map(t => ({ text: t.title, link: t.url }))] }`, источник — `readModules(fileURLToPath(new URL('../modules', import.meta.url)))`.

- [ ] **Step 1: Реализовать** файлы по Interfaces.
- [ ] **Step 2: Run** `bun run typecheck && bun run test && bun run build` — Expected: зелёная, `site ok: N pages`; `check-site` прошёл по ссылкам `TrackList` и `ModuleList`.
- [ ] **Step 3: Проверить собранный HTML**
  Run: `grep -o 'href="/docs/modules/2026-10/tracks/[a-z0-9-]*"' dist/modules/2026-10/index.html | sort -u | wc -l; grep -o 'Описание ещё не написано' dist/modules/2026-10/tracks/pwa.html | wc -l; grep -o 'Описание ещё не написано' dist/modules/2026-10/tracks/bff.html | wc -l`
  Expected: `19`, `1`, `0`.
- [ ] **Step 4: Commit** — `feat(site): страницы треков, архив модулей и меню`

### Task 7: Граф на canvas

**Files:**
- Create: `site/.vitepress/theme/components/GraphCanvas.vue`, `NodeCard.vue`, `GraphFilters.vue`
- Modify: `site/.vitepress/theme/components/ModuleGraph.vue`

**Interfaces:**
- Consumes: `buildGraph`, `neighbours`, `searchMatches`, `filterFromQuery`, `filterToQuery`, `personLoad`, `DEFAULT_FILTER` (Task 4); `data` (Task 5); `TrackList` (Task 6).
- Produces:
  - `GraphCanvas.vue` — `props: { nodes: GraphNode[]; links: GraphLink[]; selected: string | null; matches: Set<string> }`, `emits: { select: (id: string | null) => true }`, `defineExpose({ fit(): void })`. В `onMounted` — `const { default: ForceGraph } = await import("force-graph")`; при ошибке импорта — `emit("failed")` (добавить в `emits`). Рисует, как прототип: `nodeCanvasObject` (круг, кольцо ментора, кольцо выбранного/найденного, подпись с переносом по 18 символам, у подзадач — 22, подписи подзадач гаснут при `scale < 1.4`), `linkLineDash` (`help` `[4,3]`, `related` `[1,3]`), подсветка `neighbours` наведённого или выбранного узла, остальное с прозрачностью 0.18; `d3Force('charge').strength(-95)`, длина ребра `part` 16, `related` 70, прочих 40; `zoomToFit(500, 56)` после первой остановки и после смены данных. Цвета: `getComputedStyle` → `--vp-c-text-1`, `--vp-c-text-2`, `--vp-c-divider`, `--vp-c-brand-1`, `--cdd-area-*`; перечитываются по `watch(isDark)`. Размер — `ResizeObserver` на контейнере; высота контейнера `min(70vh, 640px)`, на ширине ≤ 640px — `70svh`. `prefers-reduced-motion` → длительности анимаций камеры 0. Узел ловится `nodeVal = (r + 1)²` при `nodeRelSize(1)`.
  - `GraphFilters.vue` — `props: { filter: Filter; people: readonly Person[]; load: Load[]; query: string }`, `emits: { "update:filter": (f: Filter) => true, "update:query": (q: string) => true }`: люди с полоской нагрузки (`aria-pressed`), чипы направлений, три переключателя («Подзадачи», «Помощь менторов», «Связи между треками»), поиск, «Сбросить фильтры».
  - `NodeCard.vue` — `props: { id: string; module: Module; people: readonly Person[] }`, `emits: { select, close }`: содержимое карточки по спеке §5.2; у трека — ссылка «Открыть страницу трека» (`withBase(track.url)`).
  - `ModuleGraph.vue` — состояние `filter` (из `filterFromQuery(location.search, data.people)` в `onMounted`), `query`, `selected`; при изменении фильтра — `history.replaceState(null, "", location.pathname + filterToQuery(filter))`; раскладка: фильтры слева (на ширине ≤ 640px — над графом), `<ClientOnly><GraphCanvas/></ClientOnly>` с `NodeCard` поверх, «Вписать», `Escape` закрывает карточку; пустой граф по фильтру — «Под фильтр ничего не попало» и «Сбросить фильтры»; `failed` — «Граф не загрузился, ниже — список треков»; ниже всегда `TrackList`.

- [ ] **Step 1: Реализовать** компоненты по Interfaces.
- [ ] **Step 2: Run** `bun run typecheck && bun run test && bun run build` — Expected: зелёная; `grep -c 'force-graph' dist/modules/2026-10/index.html` → `0` (библиотека в отдельном чанке, не в HTML).
- [ ] **Step 3: Проверить в браузере** — `node node_modules/vitepress/bin/vitepress.js preview site --port 4173`, агентский Chrome (`~/bin/chrome-agents`, порт 9333), `http://localhost:4173/docs/modules/2026-10/`:
  - граф нарисовался, 6 людей и 19 треков, подзадачи видны при приближении;
  - наведение на «Денис» подсвечивает его 6 треков и подзадачи BFF; клик по «Multi-branch + стейджинг (Coolify)» — карточка с Денисом (devops), помощники Ярослав и Саша; «Открыть страницу трека» ведёт на страницу трека с шапкой и плашкой;
  - клик по «Денис» в списке → адрес `?people=iRedTea`; перезагрузка — тот же вид; `?area=team&people=GrayMouse9` — «Под фильтр ничего не попало»; `?people=ghost&area=zzz` — обычный граф;
  - тёмная и светлая тема переключателем сайта, ширина 375 px — фильтры над графом, нет горизонтальной прокрутки;
  - скриншоты (десктоп светлая, десктоп тёмная, 375 px) — в scratchpad для PR.
- [ ] **Step 4: Commit** — `feat(site): интерактивный граф модуля`

### Task 8: Документация и PR

**Files:**
- Modify: `CLAUDE.md` (раздел «Сборка»), `README.md`

- [ ] **Step 1: CLAUDE.md** — пункт: «Модули — `site/modules/`: люди в `people.ts`, модуль — каталог `YYYY-MM`, трек — `tracks/<id>.md`; формат и проверки — `docs/superpowers/specs/2026-10-08-module-graph-design.md` §4.3–4.4».
- [ ] **Step 2: README.md** — раздел «Модули»: как завести модуль (каталог + `index.md` с `<ModuleGraph />`), трек (пример frontmatter спеки §4.3), человека (`people.ts`); «новый трек в `vitepress dev`: граф обновится сам, меню — после перезапуска dev-сервера».
- [ ] **Step 3: Run** `bun run typecheck && bun run test && bun run build` — Expected: зелёная.
- [ ] **Step 4: Commit** — `docs: модули в README и CLAUDE.md`
- [ ] **Step 5: С согласия владельца** — `git push -u origin docs/module-graph`, дождаться выкладки превью, открыть PR в `main` (`gh pr create`): разделы «Что», «Решения», «Проверка», ссылка на превью `…/docs/branches/<slug>/modules/2026-10/`. Скриншоты задачи 7 владелец перетаскивает в описание PR сам: `gh` картинки не загружает.
