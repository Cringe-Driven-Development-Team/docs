# Быстрая проверка треков — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `bun run modules:check` за секунду, плюс хук агента, pre-commit (lefthook) и шаг CI.

**Architecture:** Задача 1 — скрипт `scripts/modules-check.ts` поверх `readModules` с режимом `--hook` и тестами. Задача 2 — подключение: `.claude/settings.json`, lefthook, CI, CLAUDE.md и ручная проверка.

**Tech Stack:** TypeScript, bun test, lefthook 2.1.14, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-09-modules-check-design.md`

## Global Constraints

- Проверка — только `readModules`, своей логики нет.
- Успех: `modules ok: <N> <модуль|модуля|модулей>, <M> <трек|трека|треков>`, код 0; ошибка — текст `ModuleDataError` в stderr, код 1.
- `--hook`: путь без `/site/modules/` или исправный трек — код 0 без вывода; ошибка — stderr и код 2.
- lefthook — точно `2.1.14`; хуки ставит `"prepare": "lefthook install"`.

## Review Focus

- Хук агента в worktree: проверяется `site/modules` того пути, что правили, а не `$CLAUDE_PROJECT_DIR` (тест в задаче 1).
- Не JSON или JSON без `tool_input.file_path` на stdin хука — код 0 без вывода, а не падение хука (тест в задаче 1).
- Ошибка не `ModuleDataError` (например, сломанный YAML) — тоже текст и ненулевой код, без стека bun (тест в задаче 1).
- `bun install` в CI-контейнере и на раннере Pages с `prepare: lefthook install` не падает (проверка в задаче 2 — CI зелёный).
- Коммит без файлов `site/modules/**` не запускает проверку (ручная проверка в задаче 2).

---

### Task 1: `scripts/modules-check.ts`

**Files:** Create `scripts/modules-check.ts`, `scripts/modules-check.test.ts`; Modify `package.json` (`"modules:check": "bun scripts/modules-check.ts"`).

**Interfaces:**
- Produces: `checkModules(dir: string): string` — строка успеха или исключение; `hookModulesDir(stdin: string): string | null` — каталог `…/site/modules` из `tool_input.file_path` или `null`; CLI `bun scripts/modules-check.ts [--hook]`.

- [ ] **Step 1 (RED):** тесты на временном каталоге (структура как в `modules-read.test.ts`: `index.md`, `2/index.md`, `2/tracks/bff.md`):
  - `checkModules(dir)` → `"modules ok: 1 модуль, 1 трек"`; на сломанном треке (`do: {}`) бросает с текстом `modules/2/tracks/bff.md: do — нужен хотя бы один исполнитель: логин → сторона`.
  - `hookModulesDir(JSON.stringify({ tool_input: { file_path: "/x/repo/site/modules/2/tracks/bff.md" } }))` → `"/x/repo/site/modules"`; путь `/x/repo/README.md` → `null`; `"не json"` и `"{}"` → `null`.
  - CLI через `Bun.spawnSync(["bun", "scripts/modules-check.ts", "--hook"], { stdin })`: путь к сломанному треку во временном `…/site/modules` → код 2, stderr содержит `do — нужен хотя бы один исполнитель`, stdout пуст; исправный → код 0, stdout и stderr пусты; путь вне модулей → код 0 без вывода.
  - CLI без флага на реальном репозитории → код 0, stdout начинается с `modules ok: `.
  - Сломанный YAML (`---\ntitle: [\n---`) → ненулевой код, stderr с путём файла, без `at ` в стеке.
- [ ] **Step 2:** `bun test scripts/modules-check.test.ts` → FAIL (нет модуля).
- [ ] **Step 3:** реализовать; CLI без флага проверяет `site/modules` от корня репозитория (каталог скрипта `..`).
- [ ] **Step 4:** `bun run typecheck && bun test scripts/modules-check.test.ts` → PASS; `time bun run modules:check` — меньше секунды.
- [ ] **Step 5: Commit** `feat(modules): bun run modules:check — быстрая проверка треков`.

### Task 2: Хук агента, lefthook, CI, CLAUDE.md

**Files:** Create `.claude/settings.json`, `lefthook.yml`; Modify `package.json` (devDependency `"lefthook": "2.1.14"`, `"prepare": "lefthook install"`), `bun.lock`, `.github/workflows/ci.yml`, `CLAUDE.md` (раздел «Сборка»).

**Interfaces:** Consumes: CLI из задачи 1.

- [ ] **Step 1:** `.claude/settings.json` — `hooks.PostToolUse`: matcher `Edit|Write|MultiEdit`, `{ "type": "command", "command": "bun \"$CLAUDE_PROJECT_DIR/scripts/modules-check.ts\" --hook" }`.
- [ ] **Step 2:** lefthook: `bun add -d --exact lefthook@2.1.14` (реестр npmjs), `lefthook.yml`: `pre-commit.commands.modules-check` с `glob: "site/modules/**"` и `run: bun run modules:check`; `prepare`.
- [ ] **Step 3:** `ci.yml`, до сборки образа: `oven-sh/setup-bun@v2`, `bun install --frozen-lockfile`, `bun run modules:check`.
- [ ] **Step 4:** CLAUDE.md — строка из спеки §3.
- [ ] **Step 5:** `bun run typecheck && bun run test` → PASS.
- [ ] **Step 6:** Вручную во временной копии трека: `git commit` с `do: {}` — остановлен lefthook с текстом ошибки; коммит только `README.md` — проверка не запускалась (`lefthook` пишет `skip`); правка трека агентом (Edit) с ошибкой — хук вернул ошибку, после исправления — молча. Все пробные изменения откатить.
- [ ] **Step 7: Commit** `ci(modules): хук агента, pre-commit через lefthook и шаг CI для modules:check`.
