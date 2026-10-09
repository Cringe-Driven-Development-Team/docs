# Номер модуля в адресе — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Адрес модуля `/modules/2/` вместо `/modules/2026-10/`, старые адреса переадресуются.

**Architecture:** Задача 1 — формат id и порядок модулей в модели, переезд каталога, тесты на номера. Задача 2 — заглушки переадресации по собранному `dist`, ссылки, README, сборка и Chrome.

**Tech Stack:** TypeScript, bun test, VitePress 1.6.4.

**Spec:** `docs/superpowers/specs/2026-10-09-module-number-urls-design.md`

## Global Constraints

- Ошибка формата: `modules/<id>: каталог — <id> — нужен номер модуля: 1, 2, 3…`.
- Цели переадресаций относительные, без `.html`, якорь сохраняется (`renderPageRedirect`).
- Даты вида `2026-10-12` в тестах — не id, их не менять.

## Review Focus

- `index.html` модуля и подстраницы трека: цель заглушки указывает на каталог/страницу без `.html` и правильной глубины (тест в задаче 2).
- Превью ветки (`/docs/branches/<ветка>/…`): относительные цели работают и там (тест — цели не начинаются с `/`).
- Номер `10` при модулях `9` и `10` — первым (тест в задаче 1).
- Старый `/bff/auth#якорь` — сразу на `/modules/2/…`, без второй переадресации (тест `PAGE_REDIRECTS`).
- Заглушки не перетирают реальные страницы: `dist/modules/2026-10` без исходного каталога пуст до записи.

---

### Task 1: Номер модуля в модели и переезд каталога

**Files:** `site/.vitepress/modules.ts:79-87`, `site/.vitepress/modules-read.ts:57`, `git mv site/modules/2026-10 site/modules/2`; тесты `scripts/{modules,modules-graph,modules-read,board-model,board,bff-pages}.test.ts`.

**Interfaces:** Produces: id модуля — строка с целым числом от 1; `readModules` — по убыванию номера.

- [ ] **Step 1 (RED):** в тестах фикстуры `"2026-10"`/`"2026-11"` и пути `modules/2026-10` → `2`/`3` (регэксп `2026-1([01])(?![-\d])`); тест формата: `checkModuleId` принимает `"1"`, `"2"`, `"10"`, бросает на `"0"`, `"02"`, `"2026-10"`, `"drafts"` с текстом из Global Constraints; тест порядка в `modules-read.test.ts`: каталоги `2`, `9`, `10` → `["10", "9", "2"]`; реальные данные — `readModules("site/modules").find((m) => m.id === "2")`.
- [ ] **Step 2:** `bun run test` → FAIL (формат, порядок, нет каталога `2`).
- [ ] **Step 3:** `MODULE_ID`, текст ошибки, числовая сортировка; `git mv site/modules/2026-10 site/modules/2`; ссылки `site/security/csrf/*.md:4` → `/modules/2/tracks/bff/auth`.
- [ ] **Step 4:** `bun run typecheck && bun run test` → PASS.
- [ ] **Step 5: Commit** `feat(modules): номер модуля вместо YYYY-MM, каталог site/modules/2`.

### Task 2: Заглушки старых адресов, README, проверка

**Files:** `scripts/build-index.ts:68-98`, `scripts/build-index.test.ts`, `README.md:128-140`.

**Interfaces:** Consumes: каталог `site/modules/2` (задача 1). Produces: `MODULE_MOVES: readonly { from: string; to: string }[]`, `moduleRedirects(dist: string, moves = MODULE_MOVES): { file: string; target: string }[]`.

- [ ] **Step 1 (RED):** `build-index.test.ts`: на временном `dist` с `modules/2/index.html`, `modules/2/tracks/bff.html`, `modules/2/tracks/bff/auth.html` → `moduleRedirects(dir)` = `[{file:"modules/2026-10/index.html",target:"../2/"},{file:"modules/2026-10/tracks/bff.html",target:"../../2/tracks/bff"},{file:"modules/2026-10/tracks/bff/auth.html",target:"../../../2/tracks/bff/auth"}]` (по пути); `writePageRedirects(dir)` пишет и эти файлы; `PAGE_REDIRECTS` → `../modules/2/tracks/bff`, `…/contract`, `…/auth`.
- [ ] **Step 2:** `bun test scripts/build-index.test.ts` → FAIL.
- [ ] **Step 3:** реализовать `MODULE_MOVES`, `moduleRedirects`, дописать в `writePageRedirects`; лог в `import.meta.main` и `build-site.ts` — число заглушек модулей; README — `<номер>`.
- [ ] **Step 4:** `bun run typecheck && bun run test && DIAGRAMS_NATIVE=1 bun run build` → PASS, `site ok`; в `dist/modules/2026-10/` столько `.html`, сколько в `dist/modules/2/`.
- [ ] **Step 5:** Chrome под локальным сервером `/docs/`: старые `/docs/modules/2026-10/`, `/tracks/bff`, `/tracks/bff/auth#<якорь>`, `/docs/bff/auth` → `/docs/modules/2/…` с якорем; граф и меню на `/docs/modules/2/`.
- [ ] **Step 6: Commit** `feat(site): переадресация /modules/2026-10/ на /modules/2/`.
