# Перевод `docs` на `@tp-prepare/vitepress-module-graph` (план B) — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сайт `docs` строит граф, архив и шапки треков пакетом `@tp-prepare/vitepress-module-graph`, своего кода графа в репозитории нет, на Pages всё выглядит как до перевода.

**Architecture:** Задача 1 — данные (`people.yaml`, `module-graph.yaml`), подключение пакета (§3.2 спеки), удаление
своего кода и тестов, тесты реальных данных — через пакет. Задача 2 — CLI в `pages.yml`, хук агента, README,
сборка и сравнение в Chrome.

**Tech Stack:** bun 1.3.13, VitePress 1.6.4, пакет `@tp-prepare/vitepress-module-graph` (точная версия из npm).

**Spec:** `docs/superpowers/specs/2026-10-09-vitepress-module-graph-design.md` §7–8

**Начало:** план A влит, `npm view @tp-prepare/vitepress-module-graph version` печатает версию (≥ `0.1.0`) — иначе
не начинать. Worktree `docs`: `.claude/worktrees/module-graph-switch`, ветка `feat/module-graph-package` от `origin/main`.

## Global Constraints

- Зависимость — точная версия из `npm view` (без `^`), в `devDependencies`, как остальные.
- `module-graph.yaml` в `site/modules/` — все разделы явно: значения как сейчас (спека §4.1) и `board: { owner: Cringe-Driven-Development-Team, project: 1, field: Трек }`.
- `people.yaml` — те же шесть людей в том же порядке и с теми же полями, что `site/modules/people.ts` на `main`.
- Остаются без изменений: `MODULE_MOVES`, `PAGE_REDIRECTS`, `bff-pages.test.ts`, `lefthook.yml`, `ci.yml`, `install-hooks.ts`.
- Публичный репозиторий: никаких токенов и внутренних адресов.

## Review Focus

- Docker-сборка (`bun run build`): пакет ставится в контейнере из npm по `bun.lock`, `.vue` из `node_modules` компилируются (полная сборка в задаче 1).
- Превью ветки (`/docs/branches/<ветка>/…`): ссылки пакета идут через `withBase`, граф и шапки открываются под префиксом (Chrome в задаче 2 — превью PR).
- Хук агента в worktree без `node_modules`: `bunx module-graph check --hook` не ломает правку (ручная проверка в задаче 2).
- Старый `board.json` из артефакта Pages, снятый ещё `scripts/board.ts`: пакет читает его без предупреждения (задача 2, подложенный снимок).
- Тёмная тема: цвета направлений — `dark` из `module-graph.yaml` (сравнение снимков в задаче 2 в обеих темах).

---

### Task 1: Данные, подключение пакета, удаление своего кода

**Files:**
- Create: `site/modules/people.yaml`, `site/modules/module-graph.yaml`, `scripts/modules-data.test.ts`.
- Modify: `site/modules/modules.data.ts`, `site/.vitepress/config.mts:5-11,31`, `site/.vitepress/theme/index.ts:9-12,47-52`, `site/.vitepress/theme/custom.css:12-25`, `package.json`, `bun.lock`.
- Delete: `site/modules/people.ts`, `site/.vitepress/{modules,modules-read,board}.ts`, `site/.vitepress/theme/components/{ModuleGraph,GraphCanvas,GraphFilters,NodeCard,TrackMeta,TrackList,TaskList,ModuleList}.vue`, `scripts/board.ts`, `scripts/modules-check.ts`, `scripts/fixtures/board-items.json`, `scripts/{modules,modules-graph,modules-read,board-model,board,modules-check}.test.ts`.

**Interfaces:** Consumes из пакета: `createModulesLoader`, `readModules`, `moduleSidebar`, `loadModuleDir` (`./node`); `installModuleGraph`, `trackHeader` (`./theme`); `parseTrack`, `personLoad`, `DEFAULT_CONFIG` (`.`).

- [ ] **Step 1 (RED):** `scripts/modules-data.test.ts` — тесты реальных данных из `modules-read.test.ts` через пакет:
  - `loadModuleDir("site/modules")`: модуль `2` — `Модуль №2`, 35 треков, подстраницы `bff` `["Контракт","Авторизация и CSRF"]`, спринты `Sprint 5…8`, нагрузка `YarikMix [7,7], blackHATred [2,5], ManInTheCoat [10,0], iRedTea [8,0], GrayMouse9 [5,0], MrDuckVC [4,0]`;
  - `config` из `module-graph.yaml`: `board` — `{ owner: "Cringe-Driven-Development-Team", project: 1, field: "Трек" }`, `areas`/`sides`/`route`/`sprint` равны `DEFAULT_CONFIG`;
  - пример трека из README (как `README track example is a valid track`) разбирается `parseTrack` с `ctx = { config, people, prefix: "modules" }`, менторы `["YarikMix","blackHATred"]`.
  Если число треков на `main` к началу плана другое — взять фактическое и записать в ledger.
- [ ] **Step 2:** `bun add -d --exact @tp-prepare/vitepress-module-graph@<версия>`; `bun test scripts/modules-data.test.ts` → FAIL (нет `people.yaml`).
- [ ] **Step 3:** `people.yaml` и `module-graph.yaml`; подключение — спека §3.2 (`modules.data.ts` — одна строка `createModulesLoader(import.meta.url)`, `Data` больше не объявлять); `custom.css` — убрать блок `--cdd-area-*` с комментарием; `package.json` — `"modules:check": "module-graph check"`; удалить файлы из списка.
- [ ] **Step 4:** `bun run typecheck && bun run test` → PASS; `grep -rn "modules.ts\|modules-read\|people.ts\|cdd-area" site scripts` — пусто; `bun run modules:check` → `modules ok: 1 модуль, 35 треков`.
- [ ] **Step 5:** `bun run build` (Docker) → `site ok`.
- [ ] **Step 6: Commit** `feat(modules): граф на пакете @tp-prepare/vitepress-module-graph, люди и настройки в YAML`.

### Task 2: CLI доски, хук, README, проверка в Chrome

**Files:** Modify `.github/workflows/pages.yml:46-52`, `.claude/settings.json`, `README.md` (раздел про треки), `CLAUDE.md` (строка про `modules:check` — без изменений, если команда та же).

**Interfaces:** Consumes: bin `module-graph` из пакета.

- [ ] **Step 1:** `pages.yml`, задача `board`: `bunx module-graph board sync` и `bunx module-graph board snapshot board.json`, `env` — только `GH_TOKEN`; остальное в задаче не меняется. `.claude/settings.json`: команда `bunx module-graph check --hook`.
- [ ] **Step 2:** README, раздел про треки: файлы папки модулей — `people.yaml` и `module-graph.yaml` (по строке, что в них), ссылка на README пакета на npm; пример трека остаётся (его проверяет тест задачи 1).
- [ ] **Step 3:** хук вручную: правка трека в worktree с `do: {}` через Edit → агент получает `do — нужен хотя бы один исполнитель…`; после исправления — молча; правка `README.md` — молча. Пробную правку откатить.
- [ ] **Step 4:** `bun run typecheck && bun run test && DIAGRAMS_NATIVE=1 bun run build` → `site ok`; `scripts/workflows.test.ts` среди зелёных.
- [ ] **Step 5:** Chrome. Снимок доски: `gh run download --repo Cringe-Driven-Development-Team/docs -n board -D <scratchpad>` из последнего успешного `pages.yml`, положить в `site/modules/board.json` (не коммитить) и пересобрать. «До» — `https://cringe-driven-development-team.github.io/docs/modules/2/`, «после» — локальный сервер под `/docs/`: граф (фильтр по человеку, направлению, слоям; карточка трека с менторами и подтреками; прогресс), `/docs/modules/2/tracks/bff` (шапка, подстраницы), `/docs/modules/` (архив), `/docs/modules/2026-10/` → `/docs/modules/2/`. Снимки экрана до/после в светлой и тёмной теме — цвета и подписи совпадают; положение узлов графа случайно и не сравнивается. Предупреждения `board.json` в выводе сборки нет.
- [ ] **Step 6: Commit** `ci(modules): доска и хук агента через module-graph из пакета`; push и PR — по команде пользователя; после мержа — задача `board` в `pages.yml` зелёная.
