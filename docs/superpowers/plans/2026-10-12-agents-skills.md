# AGENTS.md и скиллы docs для Claude Code и Codex — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** правила docs — в `AGENTS.md` (Claude подключает его из `CLAUDE.md`), скиллы `eraser-diagrams`, `docs-modules`, `docs-site` — в `.agents/skills/` с копией в `.claude/skills/`; оба хоста видят их без установки.

**Architecture:** основное место скиллов `.agents/skills/`, копию делает `scripts/skills-sync.ts`, расхождение ловит тест. Новые скиллы пишутся по отложенным задачам: сначала прогон без скилла (RED), потом со скиллом (GREEN), в `claude -p` и `codex exec`.

**Tech Stack:** bun, TypeScript, Markdown (SKILL.md), Claude Code CLI, Codex CLI.

**Spec:** `docs/superpowers/specs/2026-10-12-agents-skills-design.md`

## Global Constraints

- Worktree `cdd-docs/.claude/worktrees/agents-skills`, ветка `docs/agents-skills` от `main` `0158ac6`.
- Правка скилла — только в `.agents/skills/<имя>/`; `.claude/skills/<имя>/` — побайтовая копия через `bun run skills:sync`.
- `.claude/skills/README.md` — единственный файл копии, которого нет в `.agents/skills/`; `diffSkills` его игнорирует.
- В `.agents/` нет тестовых фикстур с `SKILL.md` (Codex сканирует рекурсивно): юнит-тесты синхронизации — на временных каталогах.
- Отложенные задачи и критерии — вне репозитория: `<scratchpad>/agents-skills-eval/`. Их формулировки и ответы не попадают в тексты скиллов, спеку и план.
- Прогоны RED/GREEN — в отдельном worktree от `origin/main` (без этой ветки, без `docs/superpowers/` ветки): RED — как есть, GREEN — плюс `.agents/skills/` и `.claude/skills/` из ветки.
- `claude -p` с явным `--allowedTools`, свежий процесс на каждый прогон; `codex exec` — в каталоге worktree.
- Описание скилла: суть → триггеры → симптомы → чем отличается от соседей; до ~500 символов.
- Коммиты по-русски `docs(agents): …`; перед коммитом `bun run typecheck && bun run test`.

## Review Focus

1. Скилл изменён только в `.claude/skills/` — тест синхронизации должен упасть с понятным сообщением. Тест в задаче 1.
2. В основном месте удалён файл скилла — `skills:sync` удаляет его из копии, а не оставляет. Тест в задаче 1.
3. `CLAUDE.md` после переделки не теряет правил: всё, что было в `CLAUDE.md`, есть в `AGENTS.md`. Проверка в задаче 2.
4. Codex видит скиллы, но не дважды и не лишние (вложенные `SKILL.md`). Проверка в задаче 5.
5. GREEN не объясняется утечкой ответа: в прогоне нет доступа к спеке и плану. Порядок в задачах 3–4.

---

### Задача 1: синхронизация скиллов и переезд `eraser-diagrams`

**Files:**
- Create: `scripts/skills-sync.ts`, `scripts/skills-sync.test.ts`, `.claude/skills/README.md`
- Move: `.claude/skills/eraser-diagrams/SKILL.md` → `.agents/skills/eraser-diagrams/SKILL.md` (`git mv`), затем копия обратно скриптом
- Modify: `package.json` (`"skills:sync": "bun scripts/skills-sync.ts"`)

**Interfaces:**
- Produces: `syncSkills(from = ".agents/skills", to = ".claude/skills"): void`; `diffSkills(from = ".agents/skills", to = ".claude/skills"): string[]` — строки вида `нет в копии: <путь>`, `лишний в копии: <путь>`, `отличается: <путь>`, пути относительно `to`; `README.md` в корне `to` не учитывается.

- [ ] **Шаг 1: падающие тесты** в `scripts/skills-sync.test.ts`:

```ts
test("копия .claude/skills совпадает с .agents/skills", () => {
  const diff = diffSkills();
  expect(diff, `скиллы правятся в .agents/skills, затем bun run skills:sync:\n${diff.join("\n")}`).toEqual([]);
});
test("diffSkills: нет файла, лишний файл, другое содержимое, вложенная папка", () => { /* временные каталоги */ });
test("syncSkills копирует вложенные папки и удаляет лишнее, README.md копии не трогает", () => { /* временные каталоги */ });
test("в .agents нет SKILL.md глубже .agents/skills/<имя>/SKILL.md", () => { /* обход .agents */ });
```

Во втором и третьем тестах — точные ожидаемые строки `diffSkills` для каждого случая.

- [ ] **Шаг 2:** `bun test scripts/skills-sync.test.ts` — FAIL (нет модуля).
- [ ] **Шаг 3:** реализовать `scripts/skills-sync.ts` (`node:fs`, сравнение содержимого побайтово); `git mv` `eraser-diagrams` в `.agents/skills/`; `bun run skills:sync`; `.claude/skills/README.md` — «Копия `.agents/skills/`: не править. Правка — в `.agents/skills/<имя>/`, затем `bun run skills:sync`.»
- [ ] **Шаг 4:** тесты — PASS; `bun run typecheck && bun run test`.
- [ ] **Шаг 5:** коммит `docs(agents): скиллы в .agents/skills, копия для Claude — bun run skills:sync`.

### Задача 2: `AGENTS.md` и `CLAUDE.md`

**Files:**
- Create: `AGENTS.md`
- Modify: `CLAUDE.md` (полностью — по спеке §3.2), `README.md` (ссылки на путь скилла `.claude/skills/eraser-diagrams` → `.agents/skills/eraser-diagrams`)
- Test: `scripts/agents-md.test.ts`

**Interfaces:**
- Consumes: пути скиллов из задачи 1.

- [ ] **Шаг 1: падающий тест** `scripts/agents-md.test.ts`:
  - `CLAUDE.md` содержит строку `@AGENTS.md` и раздел `## Только для Claude Code`;
  - `AGENTS.md` содержит разделы `## Проект`, `## Что где лежит`, `## Схемы`, `## Сборка`, `## Процесс`, `## Публичный репозиторий`, `## Окружение: Windows`, `## Скиллы`;
  - `AGENTS.md` называет `eraser-diagrams`, `docs-modules`, `docs-site`, `.agents/skills/`, `bun run skills:sync`, `modules:check`, `lefthook`;
  - ни один файл репозитория вне `docs/superpowers/` не ссылается на `.claude/skills/eraser-diagrams` как на место правки (README, AGENTS.md);
  - `AGENTS.md` меньше 32 КиБ.
- [ ] **Шаг 2:** `bun test scripts/agents-md.test.ts` — FAIL.
- [ ] **Шаг 3:** `AGENTS.md` = текст `CLAUDE.md` с `0158ac6` + правки по спеке §3.1 (сверить построчно, что ничего не потеряно); `CLAUDE.md` — по спеке §3.2; README — пути.
- [ ] **Шаг 4:** тест — PASS; `bun run typecheck && bun run test && DIAGRAMS_NATIVE=1 bun run build`.
- [ ] **Шаг 5:** коммит `docs(agents): AGENTS.md — правила для всех агентов, CLAUDE.md подключает его`.

### Задача 3: отложенные задачи и прогон без скиллов (RED)

Выполняет контроллер или исполнитель вне ветки; в репозиторий ничего не коммитится.

- [ ] **Шаг 1:** в `<scratchpad>/agents-skills-eval/tasks.md` — по три задачи на `docs-modules` и `docs-site` из реальных случаев 11–12.10 (сессия, PR #56–#66) и критерии к каждой: что в диффе обязано быть и чего не должно быть. Формулировки — как их сказал бы участник команды, без подсказок решения.
- [ ] **Шаг 2:** worktree `<scratchpad>/agents-skills-eval/wt` от `origin/main` (`git worktree add --detach`), `bun install`.
- [ ] **Шаг 3:** на каждую задачу — свежий `claude -p "<задача>" --allowedTools "Read,Edit,Write,Bash(bun:*),Bash(git diff:*),Glob,Grep"` и `codex exec -s workspace-write -C <wt> "<задача>"`; после каждого прогона — `git diff > <scratchpad>/agents-skills-eval/red/<хост>-<задача>.diff`, затем `git checkout -- . && git clean -fd` в `wt` (только в этом одноразовом worktree).
- [ ] **Шаг 4:** оценить каждый дифф по критериям → `<scratchpad>/agents-skills-eval/red.md` (pass/fail и что упущено). Ожидается: заметная часть провалов — это и есть то, чему учат скиллы. Если RED проходит всё — задачи слишком лёгкие, заменить.

### Задача 4: скиллы `docs-modules` и `docs-site` (GREEN)

**Files:**
- Create: `.agents/skills/docs-modules/SKILL.md`, `.agents/skills/docs-site/SKILL.md`; копии через `bun run skills:sync`
- Test: `scripts/skills-sync.test.ts` (копия), `scripts/agents-md.test.ts` (имена уже названы)

- [ ] **Шаг 1:** написать `docs-modules` по спеке §3.4 и `docs-site` по спеке §3.5: frontmatter `name`, `description` (ограничение из Global Constraints), тело — правила и проверки, с путями файлов. Примеры в тексте — не из отложенных задач.
- [ ] **Шаг 2:** `bun run skills:sync`; `bun run typecheck && bun run test`.
- [ ] **Шаг 3:** GREEN: в `wt` скопировать `.agents/skills/` и `.claude/skills/` из ветки; повторить прогоны задачи 3 → `green/`; оценка → `green.md`. Цель: каждая задача, проваленная в RED, проходит в GREEN в обоих хостах. Не прошла — поправить скилл (не задачу), повторить.
- [ ] **Шаг 4:** коммит `docs(agents): скиллы docs-modules и docs-site`. В описание коммита — сводка RED/GREEN (число задач и проходов по хостам), без текста задач.

### Задача 5: видимость скиллов и PR

- [ ] **Шаг 1:** в чистом worktree ветки: свежий `claude -p "перечисли скиллы этого проекта"` и `codex exec "перечисли доступные скиллы"` — оба называют `eraser-diagrams`, `docs-modules`, `docs-site`; Codex — каждый один раз. Вывод — в отчёт.
- [ ] **Шаг 2:** push ветки, PR в `main` («Что / Решения / Проверка»: схема двух хостов, почему не маркетплейс и не симлинк, сводка RED/GREEN, как обновлять скилл).
