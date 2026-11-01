# Обновление справки docs-site для VitePress v2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Пользователь явно выбрал SDD.

**Goal:** Дополнить docs-site четырьмя подтверждёнными группами инструкций и установить проверенную копию.
**Architecture:** Один справочный SKILL.md, существующий skills:sync и текущие инструменты проверки. Один атомарный task, затем его независимый review и whole-branch review; установку принятого документа и draft PR завершает контроллер.
**Tech Stack:** Markdown, Bun, существующие VitePress config/theme/browser CLI.
**Spec:** `docs/superpowers/specs/2026-11-01-docs-site-v2-skill-design.md`.

## Global Constraints

- Меняются только `.agents/skills/docs-site/SKILL.md`, его зеркало `.claude/skills/docs-site/SKILL.md` и документы этой задачи; `docs-modules`, сайт, зависимости, схемы и OpenWiki не меняются.
- Сохраняются имя, смысл description, остальные поля frontmatter, правила редактуры, проверенных фактов, истории, ссылок и redirects; в description убираются только угловые скобки у `<Diagram>` для прохождения валидатора; добавление остаётся кратким справочником по текущим исходникам, без нового универсального процесса или запретов.
- Копия Claude создаётся через `bun run skills:sync`; проверенная установленная копия `/home/oleg/.codex/skills/docs-site/SKILL.md` обновляется после ревью с проверкой исходного хеша, без перезаписи параллельных правок.
- Проверки соразмерны изменению: retrieval/application-сценарий до/после, валидатор скилла, тесты синхронизации и обязательные проверки репозитория; новые тесты на наличие конкретных фраз и повторная UI-матрица не нужны.
- Результат — коммит в feature-ветке, draft PR и установленная проверенная копия; слияние нового PR отдельно не поручено.

## Review Focus

1. Новая вложенная страница сохраняет общую левую навигацию; aside не путают с sidebar.
2. FullWidth — начальное значение, сохранённый узкий режим не сбрасывают.
3. Root architecture/wiki/graph исключены из preview, module offline/architecture допустима; base не теряется.
4. Browser-команды соответствуют реальным секциям, Chrome env и текущей собранной базе; полный прогон не навязывается текстовым правкам.
5. Home Codex копия и mirror проверяются отдельно: skills:sync обновляет только Claude.

### Task 1: Дополнить справку и проверить применение

**Files:**
- Modify: `.agents/skills/docs-site/SKILL.md`.
- Generated mirror: `.claude/skills/docs-site/SKILL.md`.
- Include authored spec/plan of this task in the same commit.
- Evidence only: own SDD workspace; existing tests `scripts/skills-sync.test.ts`.

**Interfaces:**
- Consumes: exact spec content contract copied to task brief; current config/theme/link-preview/browser CLI and RED reference scenario/report.
- Produces: concise validated canonical skill + byte-identical Claude mirror; commit and report. Home installation and draft delivery follow accepted reviews, not worker-owned product changes.

- [ ] **Step 1: Read RED and source contracts.** Controller runs fresh reference-coverage/application baseline before editing and saves scenario/output in this plan workspace. Inspect exact missing facts and named source locations; no guessed APIs. If baseline gives all four groups correctly, report this rather than inventing a failure; explicit missing reference details still determine requested documentation scope.
- [ ] **Step 2: Update canonical skill.** Add the four spec groups near existing routing/readability/build sections, keep existing content and frontmatter except replacing `<Diagram>` with `Diagram` in description (R3). Reference current source files instead of copying plugin implementation or maintaining a second dependency/version table. No universal added approval flow, blanket test matrix, CSS recipe or new helper.
- [ ] **Step 3: Sync and request GREEN probe.** `bun run skills:sync`; tell controller skill is stable and ready for fresh application check. Controller reruns identical scenario against updated skill with a fresh agent; worker continues independent validation, no further skill edits until result. Address a concrete semantic gap if found; no wording-based tests.
- [ ] **Step 4: Verify.** Run `python3 /home/oleg/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/docs-site`, `bun test scripts/skills-sync.test.ts`, `bun run typecheck`, `bun run test`, `bun run modules:check`, and `CHROMIUM_PATH=/opt/google/chrome/chrome DIAGRAMS_NATIVE=1 bun run build` before commit. Save commands/output/exitcodes in own workspace. Native build is not Docker CI; existing output warnings are reported, not repaired. No source site/browser-product changes require a UI matrix. Installed-home copy remains untouched until reviews.
- [ ] **Step 5: Self-review and commit.** Check exactly four tracked files (canonical, mirror, spec, plan), source/module/wiki/dependency trees unchanged, frontmatter unchanged except R3, mirror equal. Commit `docs(скилл): дополнить docs-site правилами VitePress v2`; report `<workspace>/task-1-report.md` with RED/GREEN, checks, concerns and commit. No subagents/reviewer spawned by worker; no push/PR/home changes yet. Controller conducts task review, then strongest whole-branch review, then exact reviewed home install, feature push/draft PR and fresh CI validation. Archive own SDD evidence before cleanup; preserve branch/worktree.
