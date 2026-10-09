# Пакет `@tp-prepare/vitepress-module-graph` (план A) — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Граф модулей, проверка треков и CLI доски из `docs` — пакетом npm в `TP-Prepare/frontend-packages` с настройками в `module-graph.yaml` и людьми в `people.yaml`.

**Architecture:** Код переносится из `docs` на `72f0883` (`git -C <docs> show 72f0883:<путь>`) вместе с тестами и
обобщается: зашитые направления, стороны, `checkFullstack`, формат спринта и `/modules/` берутся из конфига.
Слои: модель (`src/model/`, без файлов и DOM) → чтение папки (`src/node/`) → CLI (`src/cli.ts`) и тема
(`src/theme/`). Задача 1 — каркас монорепозитория и релизы, задачи 2–6 — пакет по слоям.

**Tech Stack:** bun 1.4.2 workspaces, TypeScript 7.0.2, tsdown 0.23.0 (`unbundle`), bun test, Vue 3.5 SFC, VitePress 1.6.4, force-graph 1.51.4, gray-matter 4.0.3, js-yaml 4, release-please-action v5.

**Spec:** `docs/superpowers/specs/2026-10-09-vitepress-module-graph-design.md` (репозиторий `docs`)

**Репозиторий:** клон `git@github.com:TP-Prepare/frontend-packages.git` в `~/projects/frontend-packages`; до
задачи 1 — `echo .claude/worktrees/ >> .git/info/exclude`, worktree `.claude/worktrees/module-graph`, ветка
`feat/vitepress-module-graph` от `origin/main`. Пакет — `packages/vitepress-module-graph/` (дальше «пакет»).
Источник кода — клон `docs`: `~/projects/cdd-docs`, коммит `72f0883`.

## Global Constraints

- Имя пакета `@tp-prepare/vitepress-module-graph`, версия в манифесте `0.1.0`, `engines.node: ">=22"`, `type: module`.
- Входы: `.` (модель), `./node`, `./theme`, `./style.css`; bin `module-graph` → `dist/cli.mjs`.
- `peerDependencies`: `vitepress ^1.6`, `vue ^3.5`; `dependencies`: `force-graph`, `gray-matter`, `js-yaml`. Новые версии — не моложе двух недель.
- Формат ошибки: `<файл от родителя папки модулей>: <поле> — <что не так>` (класс `ModuleDataError`); папка модулей `site/modules` → префикс `modules/`.
- Значения по умолчанию конфига — ровно §4.1 спеки (подписи, цвета, `needs: [front, back]` у `fullstack`, `route: /modules/`, `sprint: "Sprint {n}"`), раздела `board` по умолчанию нет.
- Подписи интерфейса — русские, тексты компонентов не меняются.
- Публикацию в npm делает пользователь (спека §6); агент не запускает `npm publish` и не мержит PR.
- Коммиты по-русски: `тип(область): что сделано`.

## Review Focus

- Направление с ключом-числом (`"1"`) или ключи не в алфавитном порядке: порядок в фильтре и легенде — как в файле (конфиг хранит списки, не объекты; тест в задаче 2).
- `module-graph.yaml` без `areas`, но с `sides` без `front`: ошибка про `areas.fullstack.needs`, а не падение позже на треке (тест в задаче 2).
- Сайт с `route: /course/modules/`: ссылки треков, подстраниц, модуля, `pageRef` и `--hook` работают (тесты в задачах 3 и 5).
- Сборка пакета, установленного как зависимость: Vite сайта компилирует `.vue` из `dist/` и разрешает их импорты (тестовый сайт VitePress в задаче 6).
- `board.json` от старого формата или битый — сборка не падает, предупреждение и граф без прогресса (перенесённые тесты `readBoard`, задача 4).

---

### Task 1: Каркас монорепозитория, релизы, пустой пакет

**Files:** Create в корне: `package.json`, `tsconfig.base.json`, `.gitignore`, `release-please-config.json`,
`.release-please-manifest.json`, `.github/workflows/{ci,release}.yml`, `bun.lock`; в пакете: `package.json`,
`tsconfig.json`, `tsdown.config.ts`, `src/index.ts`, `test/package.test.ts`. Образец — `TP-Prepare/release-please-playground`
(`gh api repos/TP-Prepare/release-please-playground/contents/<файл> -H "Accept: application/vnd.github.raw"`).

**Interfaces:** Produces: скрипты корня `build`, `typecheck`, `test` (`bun run --filter '*' <скрипт>`); пакет
собирается `tsdown` в `dist/` с сохранением структуры `src/` (`unbundle: true`).

- [ ] **Step 1 (RED):** `test/package.test.ts`: `package.json` пакета — `name`, `version: "0.1.0"`, `engines.node: ">=22"`,
  `bin["module-graph"] === "dist/cli.mjs"`, `exports` содержит `"."`, `"./node"`, `"./theme"`, `"./style.css"`,
  `files: ["dist"]`, `publishConfig.access: "public"`, `peerDependencies` `vitepress`/`vue` как в Global Constraints;
  `release-please-config.json` — пакет `packages/vitepress-module-graph` с `component: "vitepress-module-graph"`,
  плагин `node-workspace`; манифест — `"packages/vitepress-module-graph": "0.1.0"`.
- [ ] **Step 2:** `bun test` в пакете → FAIL (нет файлов).
- [ ] **Step 3:** файлы по образцу. Отличия от образца: один пакет; `exports` с `types`/`import` на `dist/index.mjs`,
  `dist/node/index.mjs`, `dist/theme/index.mjs` и `./style.css` → `dist/theme/style.css`;
  `sideEffects: ["*.css", "*.vue"]`; `.gitignore` с `node_modules/`, `dist/`, `.claude/worktrees/`, `.superpowers/`;
  `ci.yml` дополнительно запускает `bun run --filter '*' test:site` (появится в задаче 6, до тех пор скрипт — `true`).
  `src/index.ts` пока экспортирует `VERSION = "0.1.0"` для дымовой сборки.
- [ ] **Step 4:** `bun install && bun run build && bun run typecheck && bun run test` → PASS; `ls packages/vitepress-module-graph/dist/index.mjs`.
- [ ] **Step 5: Commit** `chore: каркас монорепозитория, release-please и пакет vitepress-module-graph`.

### Task 2: Конфиг и люди — `module-graph.yaml`, `people.yaml`

**Files:** Create `src/model/errors.ts` (перенос `ModuleDataError`), `src/model/config.ts`, `src/model/people.ts`;
`test/config.test.ts`, `test/people.test.ts`. Modify `src/index.ts` — реэкспорт `src/model/*` вместо `VERSION`.

**Interfaces:**
- Produces (экспорт из `.`):
  - `type AreaConfig = { key: string; label: string; color: string; dark: string; needs: string[] }`
  - `type SideConfig = { key: string; label: string }`
  - `type BoardConfig = { owner: string; project: number; field: string }`
  - `type ModuleGraphConfig = { route: string; areas: AreaConfig[]; sides: SideConfig[]; sprint: string; board: BoardConfig | null }`
  - `DEFAULT_CONFIG: ModuleGraphConfig`; `parseConfig(file: string, data: unknown): ModuleGraphConfig` (`undefined` → `DEFAULT_CONFIG`)
  - `areaLabel(config, key): string`, `sideLabel(config, key): string`, `areaCss(config): string`
  - `type Person = { login: string; name: string; role: string; area: string; mentor?: true }`; `parsePeople(file: string, data: unknown, config: ModuleGraphConfig): Person[]`

- [ ] **Step 1 (RED):** `test/config.test.ts`:
  - `parseConfig("modules/module-graph.yaml", undefined)` равен `DEFAULT_CONFIG`; ключи `areas` — `["front","back","devops","fullstack","team"]`, `fullstack.needs` — `["front","back"]`, цвета — из спеки §4.1, `board` — `null`.
  - `{ areas: { zeta: {…}, alpha: {…} } }` (оба с `label`, `color: "#111111"`, `dark: "#222222"`) → ключи `["zeta","alpha"]` (порядок файла), `sides` — по умолчанию; ключ `"1"` → `areas.1 — ключ: строчная латиница, цифры и дефис, первая — буква`.
  - `{ sides: { web: веб } }` без `areas` → бросает `modules/module-graph.yaml: areas.fullstack.needs — нет стороны front; допустимо: web`.
  - ошибки, каждая — точный текст: неизвестный ключ верхнего уровня `colour` (`colour — неизвестный ключ; допустимо: route, areas, sides, sprint, board`), неизвестный ключ `colr` в `areas.front` (`areas.front.colr — неизвестный ключ; допустимо: label, color, dark, needs`), `color: red` (`areas.front.color — нужен цвет #rrggbb`), ключ `Front` (`areas.Front — ключ: строчная латиница, цифры и дефис, первая — буква`), `route: modules` (`route — нужен путь с / в начале и в конце`), `sprint: "Sprint"` (`sprint — нужен шаблон с одним {n}`), `board: { owner: x }` (`board.project — нужно целое число от 1`), пустой `areas: {}` (`areas — нужно хотя бы одно направление`).
  - `areaCss(DEFAULT_CONFIG)` содержит `:where(:root){--mg-area-front:#2c6bd4;` и `:where(html.dark){--mg-area-front:#5f95f1;`.
  `test/people.test.ts`: валидный список из спеки §4.2; `[2].area` неизвестное → `modules/people.yaml: [2].area — неизвестное направление qa; допустимо: front, back, devops, fullstack, team`; повтор логина → `[1].login — логин a повторяется`; `mentor: false` → `[0].mentor — только true`; пустое `name` → `[0].name — нужна непустая строка`; не список (`{a: 1}`) → `modules/people.yaml: файл — нужен список людей`; неизвестный ключ `email` → `[0].email — неизвестный ключ; допустимо: login, name, role, area, mentor`.
- [ ] **Step 2:** `bun test test/config.test.ts test/people.test.ts` → FAIL.
- [ ] **Step 3:** реализовать. Ключи `areas`/`sides` — `^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$` (спека §4.1): порядок `Object.keys` тогда совпадает с файлом. `areaCss` — одна строка: блок `:where(:root){…}` со всеми `color` и блок `:where(html.dark){…}` со всеми `dark`.
- [ ] **Step 4:** `bun test` в пакете → PASS; `bun run typecheck` → 0.
- [ ] **Step 5: Commit** `feat(model): module-graph.yaml и people.yaml — настройки и люди с проверками`.

### Task 3: Модель — треки, модули, граф, фильтры, доска

**Files:** Create `src/model/modules.ts` (из `site/.vitepress/modules.ts`), `src/model/board.ts` (из
`site/.vitepress/board.ts`); Modify `src/index.ts` (реэкспорт новых файлов); тесты из `scripts/modules.test.ts`,
`modules-graph.test.ts`, `board-model.test.ts` → `test/modules.test.ts`, `test/modules-graph.test.ts`,
`test/board-model.test.ts`; общая фикстура `test/fixtures/people.ts` (шесть людей из `docs` `site/modules/people.ts`
как `Person[]`).

**Interfaces:**
- Consumes: Task 2 — `ModuleGraphConfig`, `Person`, `ModuleDataError`, `areaLabel`, `sideLabel`.
- Produces: `type Context = { config: ModuleGraphConfig; people: readonly Person[]; prefix: string }` (`prefix` — имя папки модулей, `"modules"`);
  `Area`, `Side` — `string`; `AREAS`, `SIDES`, `AREA_LABELS`, `SIDE_LABELS`, `DEFAULT_FILTER`, `validatePeople`, `checkFullstack` — удалены;
  - `checkModuleId(id: string, prefix: string): void`
  - `parseTrack(file, moduleId, id, data, body, ctx: Context, pages?: readonly TrackPage[]): Track`
  - `trackPages(file, moduleId, trackId, declared, found, ctx: Context): TrackPage[]`
  - `parseModule(file, id, data, tracks: Track[], ctx: Context): Module`
  - `defaultFilter(config): Filter`; `filterFromQuery(search, people, config): Filter`; `filterToQuery(filter, config): string`
  - `pageRef(relativePath: string, config): { module: string; track?: string; page?: string } | null` — префикс пути — `route` без `/` в начале
  - без изменений сигнатур: `buildGraph`, `neighbours`, `subtaskByNodeId`, `searchMatches`, `personLoad`, `topTracks`, `subtracksOf`, `doersOf`, `moduleSidebar`, `nodePaint`, всё из `board.ts`.

- [ ] **Step 1 (RED):** перенести три файла тестов, заменить импорты на `../src/index.ts`, `PEOPLE` — на фикстуру, вызовы — на новые сигнатуры с `ctx = { config: DEFAULT_CONFIG, people: PEOPLE, prefix: "modules" }`. Ожидаемые тексты, которые меняются:
  - `логина X нет в people.ts` → `логина X нет в people.yaml`; `в people.ts нет mentor: true` → `в people.yaml нет mentor: true`;
  - нарушение `needs`: `do — у трека «Фронт + бэк» нужны исполнители со сторон front, back`;
  - тест «`validatePeople`» удалить (покрыт `parsePeople` в задаче 2); `AREA_LABELS.fullstack` → `areaLabel(DEFAULT_CONFIG, "fullstack")`.
  Новые тесты в `test/modules.test.ts`:
  - конфиг с `areas: [{key:"ml",…,needs:["data","back"]}]`, `sides: data, back` — трек `area: ml` с одним `do: {x: data}` бросает `у трека «ML» нужны исполнители со сторон data, back`; с подтреком `back` — проходит;
  - `sprint: "Спринт {n}"` — `sprints: [Спринт 3]` проходит, `Sprint 3` бросает `нужен формат Спринт N`;
  - `route: "/course/modules/"` — `track.url === "/course/modules/2/tracks/bff"`, подстраница `/course/modules/2/tracks/bff/auth`, модуль `/course/modules/2/`; `pageRef("course/modules/2/tracks/bff.md", config)` → `{ module: "2", track: "bff" }`, `pageRef("modules/2/index.md", config)` → `null`;
  - `filterFromQuery("?area=ml", people, mlConfig).areas` → `["ml"]`; неизвестное — все направления конфига; `filterToQuery` с полным списком — `""`.
- [ ] **Step 2:** `bun test` → FAIL (нет модуля).
- [ ] **Step 3:** перенести `modules.ts`, `board.ts`; заменить константы на `ctx.config`/`config`, URL — от `config.route`, пути ошибок — от `ctx.prefix`. Правило `needs`: `doersOf` (с подтреками) должен покрывать все стороны из `needs` направления трека; проверка — там же, где сейчас `checkFullstack`.
- [ ] **Step 4:** `bun test && bun run typecheck` → PASS; число тестов из `docs` в трёх файлах — 41 + 23 + 26 минус удалённый `validatePeople` (печатать фактические счётчики `bun test` рядом).
- [ ] **Step 5: Commit** `feat(model): треки, граф и доска на настройках из module-graph.yaml`.

### Task 4: Чтение папки и загрузчик VitePress — `./node`

**Files:** Create `src/node/read.ts` (из `site/.vitepress/modules-read.ts`), `src/node/loader.ts`, `src/node/index.ts`;
`test/read.test.ts` (из `scripts/modules-read.test.ts`), `test/fixtures/cdd/modules/` (копия `site/modules/2/**`
и `index.md` из `docs` на `72f0883`, `people.yaml` из `people.ts`, `module-graph.yaml` не кладётся).

**Interfaces:**
- Consumes: Tasks 2–3.
- Produces (экспорт из `./node`):
  - `type ModuleGraphData = { config: ModuleGraphConfig; people: Person[]; modules: Module[]; board: BoardData | null }` (тип экспортируется и из `.`)
  - `loadModuleDir(dir: string): ModuleGraphData`; `readModules(dir: string): Module[]`
  - `createModulesLoader(url: string): { watch: string[]; load(): ModuleGraphData }` — `url` = `import.meta.url` файла `*.data.ts`, его папка = папка модулей
  - реэкспорт `moduleSidebar`.

- [ ] **Step 1 (RED):** перенести тесты `modules-read.test.ts` (временная папка пишет `people.yaml` вместо `people.ts`); тест «real site/modules» → фикстура `test/fixtures/cdd/modules`: модуль `2`, `Модуль №2`, 35 треков, подстраницы `bff` `["Контракт","Авторизация и CSRF"]`, нагрузка `YarikMix [7,7], blackHATred [2,5], ManInTheCoat [10,0], iRedTea [8,0], GrayMouse9 [5,0], MrDuckVC [4,0]`, спринты `Sprint 5…8`. Новые:
  - нет `people.yaml` → `modules/people.yaml: файл — нет файла`;
  - `people.yaml` с `- login: a\n  name: [` → сообщение начинается с `modules/people.yaml: строка 2 — сломан YAML:` и не содержит `\n    at `;
  - `module-graph.yaml` с `sprint: "Спринт {n}"` и модулем `sprints: [Спринт 1]` — читается;
  - трек с битым frontmatter в строке 3 файла (`---\ntitle: x\narea: [\n---`) → `modules/2/tracks/x.md: строка 3 — сломан YAML:`;
  - `createModulesLoader(pathToFileURL(join(dir, "modules.data.ts")).href)`: `watch` содержит `./people.yaml`, `./module-graph.yaml`, `./board.json`, `./*/index.md`, `./*/tracks/**/*.md`; `load().modules[0].id === "10"`.
- [ ] **Step 2:** `bun test test/read.test.ts` → FAIL.
- [ ] **Step 3:** реализовать. YAML — `js-yaml` `load`; у `YAMLException` строка — `mark.line + 1`, у frontmatter — `mark.line + 2` (строка `---` сверху). `board.json` — как `readBoard` сейчас (предупреждение, `null`). `prefix` = `basename(dir)`.
- [ ] **Step 4:** `bun test && bun run typecheck && bun run build` → PASS.
- [ ] **Step 5: Commit** `feat(node): loadModuleDir и загрузчик VitePress — модули, люди, настройки и доска из одной папки`.

### Task 5: CLI `module-graph`

**Files:** Create `src/cli.ts`, `src/cli/check.ts` (из `scripts/modules-check.ts`), `src/cli/board.ts` (из
`scripts/board.ts`); `test/cli-check.test.ts` (из `scripts/modules-check.test.ts`), `test/cli-board.test.ts` (из
`scripts/board.test.ts`), `test/fixtures/board-items.json`; `test/cli-node.test.ts`.

**Interfaces:**
- Consumes: Task 4 — `loadModuleDir`.
- Produces: `main(args: readonly string[], env: Record<string, string | undefined>, stdin: string, cwd: string): Promise<number>` в `src/cli.ts`; `hookModulesDir(stdin: string, route: string): string | null`; доска — `sync(token, board: BoardConfig, tracks)`, `fetchSnapshot(token, board, takenAt)`, `ownerKind(token, owner): Promise<"organization" | "user">`.

- [ ] **Step 1 (RED):** перенести тесты с новыми точками входа. Тексты и коды — спека §5. Новые и изменённые:
  - `check` без `--dir` в `cwd` с `site/modules` → `modules ok: 1 модуль, 35 треков` (фикстура `cdd`, скопированная во временный `site/modules`), код 0; `--dir test/fixtures/cdd/modules` — то же;
  - `--hook` с `route: /course/modules/` в `module-graph.yaml`: путь `/x/course/modules/2/tracks/bff.md` → проверяется `/x/course/modules`; путь `/x/modules/2/tracks/bff.md` при отсутствии там `people.yaml` → 0 молча; `C:\x\site\modules\2\tracks\bff.md` → `C:/x/site/modules`;
  - `board sync` без раздела `board` → stderr `module-graph: modules/module-graph.yaml: board — нет раздела; нужен { owner, project, field }`, код 1;
  - `board …` без `GH_TOKEN` → `не задан GH_TOKEN`, код 1; токен в тексте ошибки → `***`;
  - `ownerKind`: ответ `repositoryOwner.__typename: "User"` → `"user"`; GraphQL-запросы `sync`/`fetchSnapshot` используют `user(login:)` для пользователя (проверка по телу запроса в подменённом `fetch`);
  - `ref` в снимке: репозиторий владельца `board.owner` → `репо#N`, иначе `владелец/репо#N`;
  - поле `board.field: "Track"` — запрос и итог `sync: добавлено N значений «Track»`;
  - неизвестная команда → stderr начинается с `использование: module-graph check [--dir <папка>] [--hook] | board sync | board snapshot <файл>`, код 1.
  `test/cli-node.test.ts`: после `bun run build` — `node dist/cli.mjs check --dir test/fixtures/cdd/modules` → код 0, stdout `modules ok: 1 модуль, 35 треков\n`.
- [ ] **Step 2:** `bun test test/cli-*.test.ts` → FAIL.
- [ ] **Step 3:** реализовать; `dist/cli.mjs` начинается с `#!/usr/bin/env node`; `stdin` читается только при `--hook`.
- [ ] **Step 4:** `bun run build && bun test && bun run typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(cli): module-graph check и board sync/snapshot на module-graph.yaml`.

### Task 6: Тема, стили, тестовый сайт, README

**Files:** Create `src/theme/index.ts`, `src/theme/data.ts`, `src/theme/AreaStyle.vue`, `src/theme/components/*.vue`
(восемь компонентов из `site/.vitepress/theme/components/`), `dist/theme/style.css` (генерируется при сборке: `areaCss(DEFAULT_CONFIG)`; стили компонентов остаются в `<style scoped>` самих `.vue`), `src/shims-vue.d.ts`; `test/site/` (тестовый сайт VitePress:
`.vitepress/config.mts`, `.vitepress/theme/index.ts`, `modules/` — копия фикстуры `cdd`, `modules/modules.data.ts`);
`test/theme.test.ts`; `README.md` пакета. Modify `package.json` пакета (`test:site`, devDependencies `vitepress`, `vue`, `vue-tsc`), `tsdown.config.ts`.

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces (экспорт из `./theme`): `installModuleGraph(app: App, data: ModuleGraphData): void` — `provide` и глобальные `ModuleGraph`, `ModuleList`; `trackHeader: () => VNode`; `useModuleGraph(): ModuleGraphData` (вне `installModuleGraph` — ошибка `module-graph: вызовите installModuleGraph(app, data) в enhanceApp`).

- [ ] **Step 1 (RED):** `test/theme.test.ts` после `bun run build`: `dist/theme/components/ModuleGraph.vue` и ещё семь `.vue` существуют; `dist/theme/style.css` равен `areaCss(DEFAULT_CONFIG)`; в `dist/` нет импортов `modules.data`; ни один `.vue` в `dist/` не содержит `--cdd-area-` и `/modules/` в строках адресов; `areaCss` в `AreaStyle.vue` используется (`grep`). Скрипт `test:site`: `vitepress build test/site` → код 0, в `test/site/.vitepress/dist/modules/2/index.html` есть `--mg-area-front:#2c6bd4`, в `…/modules/2/tracks/bff.html` — текст шапки трека `Трек · Фронт + бэк`.
- [ ] **Step 2:** `bun run build && bun test test/theme.test.ts` → FAIL.
- [ ] **Step 3:** перенести компоненты: `data` — из `useModuleGraph()`; `AREAS`/`AREA_LABELS`/`SIDE_LABELS` — из `config`; `--cdd-area-` → `--mg-area-`; адреса — `track.url`/`module.url` (`TrackMeta.vue:38` — через `module.tracks`); `pageRef(page.relativePath, config)`; текст «Добавьте файл в `site/modules/…`» — `<папка модулей>/{{ module.id }}/tracks/` из `config.route`. `AreaStyle.vue` рендерит `<component :is="'style'">{{ areaCss(config) }}</component>` и стоит в корне `ModuleGraph`, `ModuleList`, `TrackMeta`. Импорты в `.vue` — относительные без расширения (`../data`, `../../index`), tsdown `unbundle: true`, `.vue` — `external` и копируются в `dist/theme/` с той же структурой. `test/site` подключается по спеке §3.2 через имя пакета (workspace) — так же, как сайт потребителя.
- [ ] **Step 4:** `bun run build && bun run typecheck && bun test && bun run test:site` → PASS; `vue-tsc --noEmit` в `typecheck` → 0. `ci.yml`: `test:site` — настоящий скрипт.
- [ ] **Step 5:** `README.md` пакета по спеке §3.3: подключение (§3.2 дословно), `module-graph.yaml` (§4.1), `people.yaml` (§4.2), формат трека (из README `docs` на `72f0883`, раздел про треки), команды CLI (§5), шаги первой публикации (§6).
- [ ] **Step 6: Commit** `feat(theme): компоненты графа через provide/inject, цвета из module-graph.yaml, тестовый сайт`.
- [ ] **Step 7:** `npm pack --dry-run` в пакете — в списке есть `dist/cli.mjs`, `dist/theme/components/ModuleGraph.vue`, `dist/theme/style.css`, нет `test/` и `src/`. Push, PR в `TP-Prepare/frontend-packages` (по команде пользователя).
