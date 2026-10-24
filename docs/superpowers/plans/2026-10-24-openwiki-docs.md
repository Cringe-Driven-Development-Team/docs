# OpenWiki для документации CDD — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Опубликовать производную OpenWiki по `docs` и поддерживать её актуальность после изменений канонических документов.

**Architecture:** Исходники остаются в `docs`; OpenWiki `code` создаёт коммитируемый `docs/openwiki/` с Claims и checkpoint. Только явная команда владельца запускает локальный Codex с подпиской и создаёт PR; GitHub Actions проверяет свежесть этого PR. Агент в любом из четырёх репозиториев находит wiki через короткий `AGENTS.md` и сверяет SHA с источниками.

**Tech Stack:** OpenWiki `0.7.2` как Codex MCP integration, локальный `codex exec` с подпиской, Node `22.22.0+`, Bun/TypeScript, GitHub Actions без модели, VitePress для указателя.

**Spec:** `docs/superpowers/specs/2026-10-24-openwiki-docs-design.md`.

## Global Constraints

- Канонический общепроектный текст — `docs`; wiki не редактируют руками, кроме `openwiki/INSTRUCTIONS.md`.
- Текущую реализацию подтверждают кодом на актуальном SHA; модули и старые планы маркируют как намерение.
- Wiki создаётся на русском языке. В публичный репозиторий не попадают секреты, реальные IP/CIDR и внутренние адреса.
- Wiki PR не включает изменения `AGENTS.md`, `CLAUDE.md` или исполняемого workflow от OpenWiki.
- Промежуточная несовместимость/недоступность учебного прода допустима; legacy-режимы и безостановочный деплой не добавлять.

## Review Focus

- Слияние PR только с `openwiki/**` после исходного checkpoint: результат остаётся свежим; тест задачи 1.
- Изменение `AGENTS.md` или `site/**` после checkpoint: wiki становится устаревшей; тест задачи 1.
- `gitHead` отсутствует или не является предком целевого SHA: проверка выдаёт ошибку, а не «свежо»; тест задачи 1.
- Частичная генерация или неожиданный изменённый путь: ручная команда не создаёт PR и сообщает причину; проверка задачи 2.
- Старый план модуля выглядит как действующая функциональность: оценка задачи 3 проверяет факт по источнику и отвергает такой вывод.

## Карта файлов и порядок публикации

| Файл | Ответственность |
| --- | --- |
| `docs/scripts/openwiki-check.ts` и `.test.ts` | Проверка checkpoint против заданного SHA, диагностика изменений источника |
| `docs/package.json` | Команда `wiki:check` |
| `docs/.gitignore` | Исключение временного `openwiki/.run.json` |
| `docs/AGENTS.md`, `docs/CLAUDE.md`, `docs/site/project-context.md`, `docs/README.md` | Короткие указатели и правило проверки источника |
| `docs/.openwikiignore`, `docs/openwiki/INSTRUCTIONS.md` | Состав корпуса и цель генерации |
| `docs/openwiki/**` | Сгенерированные страницы, Claims, индексы, manifest и checkpoint |
| `docs/scripts/openwiki-update-local.ts` и `.test.ts` | По явной команде: локальная сверка, запуск Codex, проверка результата и создание PR |
| `docs/.github/workflows/openwiki-freshness.yml` | Проверка свежести только в wiki PR без вызова модели |
| `frontend/AGENTS.md`, `backend/AGENTS.md`, `infra/AGENTS.md` | Обнаружение общей wiki из репозитория компонента |

Задачи 1 и 2 должны попасть в `docs/main` **до** первой генерации: OpenWiki запишет итоговый SHA источника в `.last-update.json`. При squash merge промежуточный SHA ветки не станет предком `main`. Затем задача 3 создаёт отдельный PR только с wiki. Изменения `AGENTS.md` компонентов могут идти отдельно; они не меняют источник `docs`.

### Task 1: Исходный контракт и проверка свежести в `docs`

**Files:**
- Create: `scripts/openwiki-check.ts`, `scripts/openwiki-check.test.ts`, `.openwikiignore`
- Modify: `package.json`, `.gitignore`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `site/project-context.md`
- Test: `scripts/openwiki-check.test.ts`, `scripts/openwiki-pages.test.ts`

**Interfaces:**
- Produces: `checkOpenWiki(root: string, targetSha: string): Promise<{ sourceSha: string; targetSha: string; changedPaths: string[]; fresh: boolean }>`; CLI `bun scripts/openwiki-check.ts --against <SHA>` returns 0 only for a complete fresh wiki, 1 otherwise. `bun run wiki:check --against <SHA>` is the public command.
- Source path set: all tracked files except `openwiki/**`; the initial `.openwikiignore` excludes `.agents/skills/**`, `.claude/skills/**`, `dist/**`, `node_modules/**` from model research, but the freshness check treats changes to tracked instructions and workflows as source changes.

- [ ] **Step 1: Write the failing tests.** In `scripts/openwiki-check.test.ts`, construct temporary Git repos. Assert `status=complete` plus valid ancestor `gitHead` and wiki-only commit gives `fresh=true`; changed `site/a.md`, `AGENTS.md` or the freshness workflow gives `fresh=false` and exact `changedPaths`; absent/invalid/non-ancestor SHA and `status=interrupted` fail. Add `scripts/openwiki-pages.test.ts` to check the project-context/README links, source-of-truth wording and intact `CLAUDE.md` import.
- [ ] **Step 2: Run `bun test scripts/openwiki-check.test.ts scripts/openwiki-pages.test.ts`.** Expected: fail because files/exports are absent.
- [ ] **Step 3: Implement `checkOpenWiki` and CLI.** Parse `.last-update.json`, validate SHA and `status`, call Git with argument arrays (`merge-base --is-ancestor`, `diff --name-only -z`), filter only `openwiki/**`, print source/target SHA and changed paths. Reject a missing wiki/checkpoint. Add `wiki:check` script.
- [ ] **Step 4: Add source pointers and corpus rules.** Add the OpenWiki managed block to `AGENTS.md` using the literal markers `<!-- OPENWIKI:START -->`/`<!-- OPENWIKI:END -->` and the 0.7.2 expected content; retain `CLAUDE.md`'s `@AGENTS.md`. Add a derived-wiki row/link in `site/project-context.md`, a short README link, `.openwikiignore` and `openwiki/.run.json` to root `.gitignore`. The link target is `https://github.com/Cringe-Driven-Development-Team/docs/blob/main/openwiki/quickstart.md`; it will resolve after Task 3's PR.
- [ ] **Step 5: Run `bun run typecheck && bun run test && bun run modules:check && bun run build`.** Expected: all pass; built `/project-context` includes a clickable wiki link. Follow `docs-site` checks for the new page text.
- [ ] **Step 6: Commit in the `docs` worktree, open a source-only PR, run CI, and merge after review.** Confirm `docs/main` contains these changes before Task 2. Do not generate wiki against an unmerged task branch.

### Task 2: Обновление по команде владельца и проверка wiki PR

**Files:**
- Create: `scripts/openwiki-update-local.ts`, `scripts/openwiki-update-local.test.ts`, `.github/workflows/openwiki-freshness.yml`
- Modify: `package.json`, `README.md`, `scripts/openwiki-check.test.ts` only if workflow-specific path cases need coverage
- Test: local runner with fake Codex/GitHub commands, Actions check on a wiki PR

**Interfaces:**
- Consumes: `checkOpenWiki(root, targetSha)` and test fixtures; the actual wiki and user-scoped OpenWiki MCP integration are available after Task 3.
- Produces: `bun run wiki:update-local`, a PR branch `docs/openwiki-update-<source-sha12>` containing only `openwiki/**`; a failed run prints a reason and creates no PR. GitHub Actions validates the wiki PR without model access. No timer, service or automatic trigger invokes this command.

- [ ] **Step 1: Write failing runner tests.** Inject command execution into `runLocalUpdate(root: string, exec: Exec): Promise<"fresh" | "pr-created" | "pr-exists">`, where `Exec` calls a binary with argument array and cwd and returns exit status/stdout/stderr; assert fresh wiki skips Codex/PR, stale wiki creates a worktree from fetched `origin/main`, calls `codex exec` once with the OpenWiki update instruction, validates complete metadata and allowed paths, and creates one PR named for the source SHA. Assert failed Codex, dirty source changes, missing/invalid checkpoint and an already open PR never create a duplicate PR or push partial output.
- [ ] **Step 2: Implement the explicitly invoked local command.** `bun run wiki:update-local` acquires an exclusive lock, fetches `origin/main`, creates an isolated Git worktree at that SHA and checks freshness **inside that worktree** (the caller's checkout may be stale). If stale, run the installed OpenWiki integration through `codex exec -s workspace-write` using the local subscription. After successful `openwiki_finish`, run `wiki:check` against the fetched source SHA and reject any modification outside `openwiki/**`; commit, push a unique branch and create a PR with SHA and validation summary. Clean up the worktree on success or failure; print a clear error locally, never write credentials to Git. If source `main` advances during the run, stop before push and tell the user to rerun when they choose.
- [ ] **Step 3: Document manual use.** README gives the one command, its prerequisites, how to inspect the source SHA and PR, and how to retry after failure. State that no local timer, GitHub push hook or weekly schedule runs the updater. A stale wiki remains readable as a navigation aid; agents confirm its claims against current canonical docs.
- [ ] **Step 4: Add model-free PR check.** `.github/workflows/openwiki-freshness.yml` runs only on `pull_request` when `openwiki/**` changes; fetch full history, install Bun, run `bun run wiki:check --against <PR-base SHA>`, and write source/target SHA plus changed paths to job summary. Ordinary docs PRs and `main` have no wiki freshness status. The workflow never launches Codex or OpenWiki generation.
- [ ] **Step 5: Verify against disposable Git fixtures.** Run unit tests for fresh, stale, failed Codex and changed base SHA; require no model call on fresh wiki and no PR/partial push on failure. Check the workflow syntax and trigger list. The live wiki PR and its CI are checked in Task 3.
- [ ] **Step 6: Run `bun run typecheck && bun run test && bun run build`, commit, open a source-only PR and merge after CI/review.** Verify that no service, timer or push-triggered generation was added. Record the merged `docs/main` SHA for Task 3.

### Task 3: Создать и проверить репозиторную wiki

**Files:**
- Create: `openwiki/INSTRUCTIONS.md`, generated `openwiki/**`
- Test: evidence in local `/home/oleg/2026_H2/context-benchmark/openwiki-code-report.md` (outside `docs` Git)

**Interfaces:**
- Consumes: `docs/main` with Tasks 1 and 2; `bun run wiki:check --against HEAD` from Task 1 and the wiki PR check from Task 2.
- Produces: complete `openwiki/.last-update.json` at the exact source `docs/main` SHA and generated pages/Claims grounded in this repository.

- [ ] **Step 1: Create a fresh `docs` worktree from merged `origin/main`; write `openwiki/INSTRUCTIONS.md`.** State the corpus, Russian prose, distinction between current sections and module/plan history, source-path citations, and no unsupported claims about the implementation. Root `.gitignore` from Task 1 excludes only transient `openwiki/.run.json`, not Claims or checkpoint.
- [ ] **Step 2: Install OpenWiki `0.7.2` and its Codex integration on the local machine, then run initial generation through the authenticated Codex session.** Use `openwiki integrations install codex` at user scope and a fresh `codex exec -C <worktree> -s workspace-write` with an explicit instruction to execute the OpenWiki `init` MCP lifecycle, pass `language: "ru"` to `openwiki_begin`, write Russian pages and call `openwiki_finish`. Verify the generated `.codex`/skill configuration in a disposable environment before touching user-level config. Capture duration, model, generated-page count and available usage; mark unknown usage as unknown. Do not copy credentials into the repo.
- [ ] **Step 3: Check files and grounding.** Require `status=complete`, no `.run.json`, `gitHead` equal to the starting `docs/main` SHA, Russian `quickstart`, linked thematic pages, no edits to `AGENTS.md`/`CLAUDE.md`/other source files, and `bun run wiki:check --against HEAD` passing. Verify sampled `repo://` Claims and Markdown source links resolve at that SHA. If code mode does not cover key topics, revise `INSTRUCTIONS.md`/source docs and regenerate before publication.
- [ ] **Step 4: Run the controlled update experiment in another disposable worktree.** Change one source fact; instruct `codex exec` to execute the OpenWiki `update` MCP lifecycle with `language: "ru"`; assert the affected page/Claim and checkpoint change. Run again without changes and assert no page generation. Restore the experiment without merging it.
- [ ] **Step 5: Repeat D01, C09, C12 three times each and run all 12 `context-benchmark/cases.json` cases** under the existing read-only protocol against the new wiki. In the report record per-case points, 24 evidence checks, critical errors, duration and tokens. Require ≥33/37, 24/24 and zero critical errors. When a case fails, correct `INSTRUCTIONS.md` or the canonical source and repeat affected cases; do not manually patch generated prose.
- [ ] **Step 6: Commit only `openwiki/`; open a wiki PR.** `git diff --name-only origin/main...HEAD` must show only those paths; keep the validation report outside `docs` so it does not make the wiki stale on merge. Confirm both standard CI and the wiki PR freshness check pass against the current `docs/main` SHA; if the base advances, rerun generation before merging. Merge after CI/review and verify the checkpoint still passes against merged `docs/main`.

### Task 4: Обнаружение из репозиториев компонентов

**Files:**
- Modify: `frontend/AGENTS.md`, `backend/AGENTS.md`, `infra/AGENTS.md` on fresh branches from their respective `origin/main`
- Test: local instruction inspection and a manual retrieval test from each repository

**Interfaces:**
- Consumes: `docs/openwiki/quickstart.md`, `openwiki_search`/`openwiki_read` with `root` equal to the absolute Git root of an up-to-date local `docs` clone, `bun run wiki:check --against <docs SHA>`.
- Produces: a short wiki pointer in each component `AGENTS.md`; component facts still resolve to that component's code and API contract.

- [ ] **Step 1: Add the same short navigation rule to the three `AGENTS.md` files.** Link to the committed `docs` wiki and its quickstart, say it is derived, show when to use MCP and the Markdown fallback, require freshness/source verification, and preserve all existing local rules. Do not hard-code `/home/oleg/...` or require wiki preloading at every task start.
- [ ] **Step 2: Check the text and invoke retrieval from each repository context.** Search for one shared architecture question, read a matching page, open its canonical source and record the docs SHA. When wiki is stale, use it only to locate a document and verify facts there; when MCP is unavailable, read Markdown directly.
- [ ] **Step 3: Run each repository's required checks for a docs-only change, commit and open separate PRs.** Confirm no component-specific implementation files changed. After both docs and component PRs land, repeat the cross-repository retrieval check.

### Task 5: Завершающая проверка публикации

**Files:**
- Modify: local `/home/oleg/2026_H2/context-benchmark/openwiki-code-report.md` (outside `docs` Git)

**Interfaces:**
- Consumes: merged SHAs and Actions runs from Tasks 1–4.
- Produces: reproducible evidence that docs source, wiki, website pointer and agent navigation agree.

- [ ] **Step 1: Fetch all four `origin/main` refs and check worktree status.** Run `wiki:check` against the exact `docs/main` SHA, verify source links on GitHub and the `/project-context` link on `docs.cellestial.ru`.
- [ ] **Step 2: Verify the manual update boundary.** Confirm no timer or `push`/schedule trigger invokes generation, then run the local command against the freshly merged wiki and confirm it skips the model and creates no PR. The changed-document update experiment from Task 3 proves the update path without modifying `docs/main` again.
- [ ] **Step 3: Finish the report with version, source SHA, wiki SHA, quality score, changed-document experiment, Actions links, known limitations and the manual retry command.** Report generation tokens/cost only if the provider exposes trustworthy numbers.
