# Задачи с доски в графе модуля (v2) — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** дуга прогресса на треках, списки задач в карточке, на странице трека и под графом из снимка доски Scrumban, который делает отдельный job `board` в `pages.yml`.

**Architecture:** `scripts/board.ts` (CLI с GraphQL) пополняет поле «Трек» и пишет `site/modules/board.json`; чистый `site/.vitepress/board.ts` разбирает снимок и раскладывает задачи по модулям и трекам; загрузчик данных отдаёт результат компонентам; `pages.yml` получает job `board` с токеном и расписание, `build` — только JSON.

**Tech Stack:** Bun 1.3 (`bun test`), TypeScript 7, VitePress 1.6.4, Vue 3, GitHub GraphQL API, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-08-module-board-design.md` (v1 — `docs/superpowers/specs/2026-10-08-module-graph-design.md`).

## Global Constraints

- Ветка `docs/module-board`, worktree `.claude/worktrees/module-board`. Коммиты по-русски `тип(область): что сделано`.
- Перед коммитом задачи: `bun run typecheck && bun run test`. Полная сборка — `DIAGRAMS_NATIVE=1 bun run build` (Docker на маке не запущен).
- Зависимости ставить только с `NPM_CONFIG_REGISTRY=https://registry.npmjs.org/ BUN_CONFIG_REGISTRY=https://registry.npmjs.org/` (корпоративный реестр в `~/.npmrc` не отдаёт пакеты). Новых npm-зависимостей план не требует.
- **Настоящую доску не менять.** `bun scripts/board.ts sync` против `Cringe-Driven-Development-Team` проект 1 не запускать никогда. `snapshot` (только чтение) против настоящей доски — можно, с `GH_TOKEN="$(gh auth token)"`; токен не печатать.
- Инструменты подменяют строку `${{ secrets.… }}` заглушкой вида `__SECRET_N__`. В YAML workflow такие выражения собирать скриптом (`python3`, `"$" + "{{ secrets.ADD_TO_PROJECT_PAT }}"`) и после правки проверять `grep -n '__SECRET' .github/workflows/*.yml` → пусто.
- Время на сайте — Москва: `Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", … })`.
- Ошибки данных доски не роняют сборку (спека §4.5); ошибки frontmatter модулей — роняют (`ModuleDataError`, как в v1).
- Порядок групп статусов в списках: `In progress`, `In review`, `Ready`, `Backlog`, `Done`; статус вне списка — после `Backlog`; `null` — как `Backlog`.
- Тексты интерфейса — из спеки §5.1 дословно: «Задачи · N из M готово», «Задач пока нет: их привязывают на груминге полем «Трек» на доске», «Открытые задачи · N», «Снимок доски: <дата>, <время> МСК», «Задачи с доски не загружены», «Задачи без трека · N», «Задачи с неизвестным треком · N».

## Review Focus

1. `planOptions` при треке, удалённом из файлов, — значение остаётся на доске со своим `id` (иначе выбор на карточках сотрётся). Тест — задача 3.
2. Снимок, у которого поле «Трек» ещё не создано (первый запуск), — `track: null` у всех задач, а не падение. Тест `toSnapshot` — задача 3, проверка на настоящей доске — задача 3.
3. Задача без спринта, когда сегодня между модулями (нет модуля, чей спринт идёт), — уходит в самый новый модуль с `sprints`. Тест — задача 2.
4. `board.json` от старой версии формы (нет `sprints` или `tasks`) — сайт собирается без задач и пишет предупреждение. Тест `parseSnapshot` — задача 1, чтение — задача 4.
5. Исполнитель задачи не из `people.ts` — показывается логином, а не пустотой. Задача 5 (`TaskList`), проверка в браузере.

---

### Task 1: Спринты модуля и разбор снимка

**Files:**
- Modify: `site/.vitepress/modules.ts`, `scripts/modules.test.ts`
- Create: `site/.vitepress/board.ts`, `scripts/board-model.test.ts`

**Interfaces:**
- Produces (`modules.ts`): `Module` получает `sprints: string[]` (пусто, если поля нет); проверка в `parseModule`:
  - не список → `<file>: sprints — нужен список`;
  - элемент не `^Sprint \d+$` → `<file>: sprints[<i>] — нужен формат Sprint N`;
  - повтор → `<file>: sprints — Sprint 5 повторяется`.
- Produces (`board.ts`):
  - `export type BoardState = "open" | "closed" | "not_planned"`
  - `export type BoardTask = { ref: string; title: string; url: string; state: BoardState; status: string | null; sprint: string | null; assignees: string[]; track: string | null; parent: string | null }`
  - `export type BoardSprint = { title: string; start: string; days: number }`
  - `export type BoardSnapshot = { takenAt: string; sprints: BoardSprint[]; tasks: BoardTask[] }`
  - `export class SnapshotError extends Error` — `message` = `board.json: <problem>`
  - `export function parseSnapshot(json: unknown): BoardSnapshot` — проверяет форму спеки §4.3 поле за полем; первая ошибка → `SnapshotError` с путём поля, например `board.json: tasks[2].ref — нужна строка`.

- [ ] **Step 1: Тесты** — в `scripts/modules.test.ts`: `parseModule` читает `sprints: ["Sprint 5","Sprint 6"]`; без поля → `[]`; три ошибки выше дословно. В `scripts/board-model.test.ts`: валидный снимок из двух задач проходит и возвращается равным входу; `parseSnapshot("x")` → `board.json: нужен объект`; без `tasks` → `board.json: tasks — нужен список`; `tasks[0].ref` число → `board.json: tasks[0].ref — нужна строка`; `state: "weird"` → `board.json: tasks[0].state — допустимо: open, closed, not_planned`; `sprints[0].days` строка → `board.json: sprints[0].days — нужно число`.
- [ ] **Step 2: Run** `bun test scripts/modules.test.ts scripts/board-model.test.ts` — Expected: FAIL (нет `sprints`, нет `board.ts`).
- [ ] **Step 3: Реализовать.**
- [ ] **Step 4: Run** `bun run typecheck && bun run test` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(modules): спринты модуля и разбор снимка доски`

### Task 2: Раскладка задач по модулям и трекам

**Files:**
- Modify: `site/.vitepress/board.ts`, `scripts/board-model.test.ts`

**Interfaces:**
- Consumes: `Module` (с `sprints`), `BoardSnapshot`, `BoardTask` (Task 1).
- Produces:
  - `export type Progress = { done: number; active: number; total: number }`
  - `export type ModuleTasks = { byTrack: Record<string, BoardTask[]>; untracked: BoardTask[]; unknown: BoardTask[] }`
  - `export function moscowDate(iso: string): string` — `YYYY-MM-DD` по Москве.
  - `export function assignTasks(modules: readonly Module[], snapshot: BoardSnapshot): Record<string, ModuleTasks>` — правила спеки §4.4; «сегодня» — `moscowDate(snapshot.takenAt)`; ключи — id всех модулей (пустые `ModuleTasks` у модулей без задач).
  - `export function trackProgress(tasks: readonly BoardTask[]): Progress` — §4.4 п. 4.
  - `export const STATUS_ORDER = ["In progress", "In review", "Ready", "Backlog", "Done"] as const`
  - `export function sortTasks(tasks: readonly BoardTask[]): BoardTask[]` — по `STATUS_ORDER` (правило из Global Constraints), внутри группы по `ref`; `not_planned` — в конце.

- [ ] **Step 1: Тесты** на фикстуре: модули `2026-10` (`sprints` Sprint 5–8, треки `bff`, `xss`) и `2026-11` (`sprints` Sprint 9–12, трек `bff`); спринты Sprint 5 с 2026-10-12 … Sprint 12 с 2026-11-30, `days: 7`:
  - `track from parent` — задача без трека с `parent` на задачу с `track: "bff"` → в `byTrack.bff`;
  - `module by sprint` — `bff` + `Sprint 9` → модуль `2026-11`, не `2026-10`;
  - `sprint outside modules` — `Sprint 3` → ни в один модуль;
  - `no sprint goes to the current module` — `takenAt` 2026-10-20T10:00:00Z → `2026-10`;
  - `no sprint between modules goes to the newest` — `takenAt` 2026-12-20T10:00:00Z → `2026-11`;
  - `untracked only from module sprints` — без трека и без спринта → нигде; без трека и `Sprint 6` → `untracked` модуля `2026-10`;
  - `unknown track` — `track: "ghost"`, `Sprint 6` → `unknown` модуля `2026-10`;
  - `trackProgress` — `Done` открытая, закрытая `Backlog`, `In review`, `Ready`, `not_planned` → `{ done: 2, active: 1, total: 4 }`;
  - `sortTasks` — порядок групп и `not_planned` в конце;
  - `moscowDate("2026-10-11T21:30:00Z") === "2026-10-12"`.
- [ ] **Step 2: Run** `bun test scripts/board-model.test.ts` — Expected: FAIL.
- [ ] **Step 3: Реализовать.**
- [ ] **Step 4: Run** `bun run typecheck && bun run test` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(modules): задачи доски по модулям и трекам`

### Task 3: CLI доски — пополнение «Трек» и снимок

**Files:**
- Create: `scripts/board.ts`, `scripts/board.test.ts`, `scripts/fixtures/board-items.json`

**Interfaces:**
- Consumes: `readModules` (v1), `BoardSnapshot`, `parseSnapshot` (Task 1).
- Produces:
  - `export type FieldOption = { id: string; name: string; description: string; color: string }`
  - `export type OptionInput = { id?: string; name: string; description: string; color: string }`
  - `export function trackCatalog(modules: readonly Module[]): Map<string, string>` — id → `title` из самого нового модуля (модули от новых к старым, как отдаёт `readModules`).
  - `export function planOptions(existing: readonly FieldOption[], tracks: ReadonlyMap<string, string>): OptionInput[] | null` — все существующие значения со своими `id`, `name`, `color` (описание обновляется, если id есть в `tracks` и `title` другой); новые id из `tracks` — в конце, по алфавиту, `color: "GRAY"`, без `id`; ничего не изменилось → `null`.
  - `export function toSnapshot(items: readonly unknown[], iterations: unknown, takenAt: string): BoardSnapshot` — из узлов GraphQL (форма запроса ниже); только `Issue`; `stateReason` `NOT_PLANNED` или `DUPLICATE` при `CLOSED` → `not_planned`; `ref` = `<repository.name>#<number>`; результат проходит `parseSnapshot`.
  - CLI `bun scripts/board.ts sync | snapshot <path>`; env: `GH_TOKEN` (обязателен), `BOARD_OWNER` (по умолчанию `Cringe-Driven-Development-Team`), `BOARD_OWNER_KIND` (`organization` | `user`, по умолчанию `organization`), `BOARD_PROJECT` (по умолчанию `1`). Ошибка API → сообщение без токена и код 1. Если задан `GITHUB_STEP_SUMMARY` — дописывает туда строку итога (`sync: добавлено N значений «Трек»` / `snapshot: N задач`).
  - `sync`: поля «Трек» нет → `createProjectV2Field` (`SINGLE_SELECT`, все значения каталога); есть → `planOptions`, при не-`null` — `updateProjectV2Field` с `singleSelectOptions`.
  - Запрос карточек (по 100, постранично): `content { __typename ... on Issue { number title url state stateReason repository { name } assignees(first: 10) { nodes { login } } parent { number repository { name } } } }`, `status: fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } }`, `sprint: fieldValueByName(name: "Sprint") { ... on ProjectV2ItemFieldIterationValue { title } }`, `track: fieldValueByName(name: "Трек") { ... on ProjectV2ItemFieldSingleSelectValue { name } }`; итерации — `field(name: "Sprint") { ... on ProjectV2IterationField { configuration { iterations { title startDate duration } completedIterations { title startDate duration } } } }`.

- [ ] **Step 1: Фикстура** `scripts/fixtures/board-items.json` — 4 узла в форме запроса: issue с треком и спринтом; issue без трека с родителем; закрытая `NOT_PLANNED`; узел `DraftIssue`. Плюс объект итераций с двумя спринтами (активный и завершённый).
- [ ] **Step 2: Тесты** `scripts/board.test.ts`: `planOptions` — пусто + 2 трека → 2 новых `GRAY` по алфавиту без `id`; существующее `bff` (`id: "a"`) + каталог без `bff` → `bff` остаётся с `id: "a"` (Review Focus 1); новое описание → значение с тем же `id` и новым описанием; ничего не изменилось → `null`. `trackCatalog` — описание из нового модуля. `toSnapshot` по фикстуре: 3 задачи (без `DraftIssue`), `not_planned`, `parent: "frontend#9"`, спринты объединены из активных и завершённых, `track: null` если `track` в узле `null` (Review Focus 2).
- [ ] **Step 3: Run** `bun test scripts/board.test.ts` — Expected: FAIL.
- [ ] **Step 4: Реализовать** (GraphQL через `fetch("https://api.github.com/graphql")` с `Authorization: bearer`).
- [ ] **Step 5: Run** `bun run typecheck && bun run test` — Expected: PASS.
- [ ] **Step 6: Снимок настоящей доски (только чтение)** — `GH_TOKEN="$(gh auth token)" bun scripts/board.ts snapshot site/modules/board.json` → Expected: код 0, в файле ≥ 99 задач, у всех `track: null` (поля «Трек» ещё нет). `sync` против настоящей доски не запускать.
- [ ] **Step 7: Commit** — `feat(board): CLI снимка доски и пополнения поля «Трек»` (без `board.json`: он в `.gitignore` — добавить строку `site/modules/board.json` в этой задаче).

### Task 4: Снимок в данных сайта и прогресс в графе

**Files:**
- Modify: `site/.vitepress/modules-read.ts`, `site/modules/modules.data.ts`, `site/.vitepress/modules.ts`, `site/modules/2026-10/index.md`, `scripts/modules-read.test.ts`, `scripts/modules-graph.test.ts`

**Interfaces:**
- Consumes: `parseSnapshot`, `assignTasks`, `trackProgress` (Tasks 1–2).
- Produces:
  - `export type BoardData = { takenAt: string; byModule: Record<string, ModuleTasks> }`
  - `export function readBoard(path: string, modules: readonly Module[]): BoardData | null` в `modules-read.ts` — нет файла → `null`; не JSON или `SnapshotError` → `console.warn("board.json: <что не так> — задачи не показаны")` и `null`.
  - `Data` в `modules.data.ts` получает `board: BoardData | null` (`watch` дополняется `./board.json`).
  - `buildGraph(module, people, filter, progress?: Readonly<Record<string, Progress>>)` — узел трека получает `progress`, если `total > 0`; `GraphNode` получает `progress?: Progress`.
  - `2026-10/index.md`: `sprints: [Sprint 5, Sprint 6, Sprint 7, Sprint 8]`.
- [ ] **Step 1: Тесты** — `readBoard`: нет файла → `null`; битый JSON → `null` и предупреждение (перехват `console.warn`); валидный → `byModule["2026-10"]` есть. `buildGraph` с прогрессом `{ bff: { done: 1, active: 0, total: 2 } }` → узел `track:bff` с `progress`, у других треков поля нет. Реальный модуль `2026-10` — `sprints` из четырёх.
- [ ] **Step 2: Run** — FAIL. **Step 3: Реализовать.** **Step 4: Run** `bun run typecheck && bun run test` — PASS.
- [ ] **Step 5: Commit** — `feat(modules): снимок доски в данных сайта и прогресс треков`

### Task 5: Задачи в интерфейсе

**Files:**
- Create: `site/.vitepress/theme/components/TaskList.vue`
- Modify: `GraphCanvas.vue`, `NodeCard.vue`, `TrackMeta.vue`, `ModuleGraph.vue`, `ModuleList.vue`

**Interfaces:**
- Consumes: `data.board` (Task 4), `sortTasks`, `trackProgress`, `STATUS_ORDER` (Task 2), `GraphNode.progress` (Task 4).
- Produces: интерфейс спеки §5.1:
  - `TaskList.vue` — `props: { tasks: BoardTask[]; people: readonly Person[] }`; группы по `STATUS_ORDER` с заголовком-статусом; строка: `<a :href="task.url">{{ task.ref }}</a>`, заголовок, спринт, исполнители (имя из `people` или логин; без исполнителей — «без исполнителя»); `not_planned` — `<s>`.
  - `GraphCanvas.vue` — дуга вокруг трека по `node.progress`: радиус `r + 2.2`, ширина 1.6; сплошная `colors.area[area]` от −90° на `done/total`, далее `rgba(area, 0.4)` на `active/total`, остаток — `colors.edge` с прозрачностью 0.35; учитывает приглушение.
  - `NodeCard.vue` — у трека блок «Задачи · N из M готово» + `TaskList` или фраза «Задач пока нет…»; у человека — «Открытые задачи · N» + `TaskList` (задачи модуля, где он в `assignees`, `state === "open"`, `status !== "Done"`). Без снимка (`data.board === null`) блоки не выводятся.
  - `TrackMeta.vue` — раздел «Задачи» (`h2`) с `TaskList` или фразой; без снимка не выводится.
  - `ModuleGraph.vue` — под графом строка времени снимка или «Задачи с доски не загружены»; `<details>` «Задачи без трека · N» и «Задачи с неизвестным треком · N» с `TaskList`; передаёт прогресс в `buildGraph`.
  - `ModuleList.vue` — колонка «Задачи»: `done / total` по трекам модуля, без снимка — «—».
- [ ] **Step 1: Реализовать.**
- [ ] **Step 2: Run** `bun run typecheck && bun run test && DIAGRAMS_NATIVE=1 bun run build` — Expected: зелёная, `site ok`.
- [ ] **Step 3: Проверить HTML со снимком** (снимок из задачи 3 в `site/modules/board.json`): `grep -o 'Снимок доски: [^<]*МСК' dist/modules/2026-10/index.html` → одна строка; `grep -o 'Задачи с доски не загружены' dist/modules/2026-10/index.html | wc -l` → `0`. Без снимка (переименовать файл, пересобрать `bun run site:vitepress`): надпись есть.
- [ ] **Step 4: Проверить в браузере** со снимком, где трекам вручную проставлены `track` (копия снимка в scratchpad, правка 4–5 задач на `bff`, `xss`, `ghost`, одна без трека в `Sprint 5`): `vitepress preview site --port 4174`, агентский Chrome (порт 9333): дуги на `bff`/`xss`; карточка `bff` со списком; карточка человека с открытыми задачами; `<details>` под графом; страница трека `bff` с разделом «Задачи»; тёмная тема. Скриншоты в scratchpad сессии. После проверки вернуть настоящий снимок.
- [ ] **Step 5: Commit** — `feat(site): задачи доски на графе, в карточках и на страницах треков`

### Task 6: Workflow, ветки, README

**Files:**
- Modify: `.github/workflows/pages.yml`, `scripts/build-site.ts`, `scripts/build-site.test.ts`, `README.md`

**Interfaces:**
- Produces:
  - `pages.yml` по спеке §5.2: `schedule: cron "7 3-20 * * *"`; job `board` (`if: github.ref == 'refs/heads/main' && github.event_name != 'delete'`, `continue-on-error: true`, `permissions: contents: read`; шаги: `actions/checkout@v4` с `persist-credentials: false`, `oven-sh/setup-bun@v2` с `bun-version: 1.3.13`, `bun install --frozen-lockfile`, `sync` с `GH_TOKEN` из `secrets.ADD_TO_PROJECT_PAT`, `snapshot board.json` с `if: always()` и тем же токеном, `actions/upload-artifact@v4` `name: board`, `if-no-files-found: ignore`); job `build` — `needs: board`, условие `always() && <прежнее условие>`, шаг `actions/download-artifact@v4` `name: board`, `path: site/modules`, `continue-on-error: true` до запуска Docker. Остальное в `pages.yml` не меняется.
  - `build-site.ts`: экспорт `BOARD_SNAPSHOT = "site/modules/board.json"`; в `buildBranch` после кэша иконок — копия снимка в worktree ветки, если файл есть.
  - README «Модули»: подраздел «Задачи с доски» — поле «Трек», `sprints`, расписание, локальный снимок `GH_TOKEN="$(gh auth token)" bun scripts/board.ts snapshot site/modules/board.json`.
- [ ] **Step 1: Тест** `build-site.test.ts`: `BOARD_SNAPSHOT === "site/modules/board.json"` (константа используется и в `.gitignore` — проверить, что строка там есть: `readFileSync(".gitignore")` содержит её).
- [ ] **Step 2: Run** — FAIL. **Step 3: Реализовать** (YAML — скриптом, см. Global Constraints).
- [ ] **Step 4: Проверить** `grep -n '__SECRET' .github/workflows/*.yml` → пусто; `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/pages.yml'))"` → без ошибок; `grep -c 'ADD_TO_PROJECT_PAT' .github/workflows/pages.yml` → `2`; `bun run typecheck && bun run test` → PASS.
- [ ] **Step 5: Commit** — `ci(pages): снимок доски в отдельном job и расписание`
