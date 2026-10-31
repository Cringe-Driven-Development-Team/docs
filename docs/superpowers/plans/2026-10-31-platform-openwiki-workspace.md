# Платформенные OpenWiki и общее пространство Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать по wiki в `frontend`, `backend`, `infra` и дать агентам один локальный поиск по четырём соседним репозиториям вместе с `docs`.

**Architecture:** Каждая wiki генерируется из своего репозитория на указанном SHA, хранится в его `openwiki/` и публикуется отдельным wiki-only PR. Проверка свежести и CI живут в репозитории владельца; существующий локальный updater `docs` расширяется одним аргументом `--repo`, чтобы использовать одну реализацию прогресса и PR для всех четырёх репозиториев. OpenWiki `link` объединяет готовые wiki только в локальном реестре студента; публичный `/openwiki/` остаётся визуализацией `docs`.

**Tech Stack:** OpenWiki 0.7.2 и его Codex MCP, Bun/TypeScript для локальных проверок, Git, GitHub Actions/CLI; существующие тестовые команды каждого репозитория.

**Spec:** `docs/superpowers/specs/2026-10-25-current-documentation-openwiki-design.md`. Требует готовых текущих страниц и wiki `docs` из `docs/superpowers/plans/2026-10-31-current-documentation-openwiki.md`.

## Global Constraints

- Каждый студент держит рядом `docs`, `frontend`, `backend`, `infra` из `Cringe-Driven-Development-Team`; локальный workspace создаётся один раз и не коммитится.
- Генерация wiki только по явной локальной команде через существующую подписку Codex; без таймера, API-ключа модели в CI и автогенерации после каждого PR.
- `docs` wiki говорит о проверенном проде и владельцах; платформенные wiki говорят о состоянии кода/config на своём SHA, не доказывают выкладку или состояние облака.
- Каждая wiki имеет собственный checkpoint, Claims, quickstart, проверки freshness и отдельный wiki-only PR. Изменения других репозиториев не делают её автоматически stale.
- Не индексировать секреты, реальные IP/CIDR, токены, vault, локальные `.env`, generated/compiled файлы и старые планы как факты о текущем коде.
- Интеграция — контекст по запросу; агент не перечитывает все wiki в начале задачи. При stale проверяет первоисточник и код на актуальном SHA.

## Review Focus

1. Передан путь к учебному или чужому `origin`: updater отвергает его до push; тест задачи 1.
2. Генерация остановилась или изменила файл вне `openwiki/`: PR не появляется, worktree/lock очищаются; фикстуры задачи 1.
3. Первый init ещё не создал `openwiki/quickstart.md`: команда обновления даёт подсказку о bootstrap; проверки задач 3, 5, 7.
4. Wiki отстаёт от собственного `main` либо checkpoint неполный: CI wiki PR падает; тесты задач 2, 4, 6.
5. Одно wiki в нескольких пространствах или MCP недоступен: инструкции задают `workspace use` либо Markdown fallback; ручная проверка задачи 8.

## Карта файлов

Пути в таблице даны от `/home/oleg/2026_H2`; каждый репозиторий изменяется в своей ветке и PR. Не добавлять общий корневой `package.json` в `backend` или `infra` ради wiki.

| Файлы | Ответственность |
| --- | --- |
| `docs/scripts/openwiki-update-local.ts`, `docs/scripts/openwiki-update-local.test.ts`, `docs/README.md` | Один ручной updater с `--repo <путь>`; старый вызов без аргумента обновляет `docs`. |
| `{frontend,backend,infra}/scripts/openwiki-check.ts`, `scripts/openwiki-check-pr.ts`, `scripts/openwiki-check.test.ts` | Собственный source SHA/checkpoint, отсев wiki-only PR и тесты в каждом репозитории. |
| `{frontend,backend,infra}/.github/workflows/openwiki-freshness.yml` | Проверка wiki PR без модели и секретов. |
| `{frontend,backend,infra}/.openwikiignore`, `openwiki/INSTRUCTIONS.md`, `AGENTS.md` | Разрешённый корпус, русские страницы, отсутствие секретов, маршрут агента. |
| `{frontend,backend,infra}/openwiki/**` кроме `INSTRUCTIONS.md` | Сгенерированные страницы, Claims и checkpoint; только отдельный wiki PR после bootstrap. |
| `docs/README.md` | Короткая установка интеграции и `openwiki link` для четырёх соседних клонов. |

---

### Task 1: Научить существующий updater выбирать репозиторий

**Files:** Modify: `docs/scripts/openwiki-update-local.ts`, `docs/scripts/openwiki-update-local.test.ts`, `docs/README.md`. Test: `cd docs && bun test scripts/openwiki-update-local.test.ts`.

**Interfaces:** Preserve `runLocalUpdate(root: string, exec: Exec): Promise<"fresh" | "pr-created" | "pr-exists">`. CLI: `bun run wiki:update-local` для `docs`; `bun run wiki:update-local --repo ../frontend|../backend|../infra` для соседнего клона. Требование к каждому репозиторию: `scripts/openwiki-check.ts` экспортирует совместимую `checkOpenWiki(root: string, targetSha: string)` и CLI `bun scripts/openwiki-check.ts --against <SHA>`.

- [ ] **Step 1: Добавить fixture-тесты.** Проверить выбор `--repo` с пробелами в пути, прежний вызов без аргумента, отказ для `origin` вне четырёх URL организации, отсутствие `quickstart.md`, чужой файл после Codex, неполный checkpoint и продвижение `origin/main` до push.
- [ ] **Step 2: Увидеть красный результат.** `bun test scripts/openwiki-update-local.test.ts` падает на новых случаях.
- [ ] **Step 3: Расширить CLI и использовать checker владельца.** Разрешить только `docs|frontend|backend|infra` с `origin` вида `https://github.com/Cringe-Driven-Development-Team/<имя>.git` или `git@github.com:Cringe-Driven-Development-Team/<имя>.git` и полным `main` SHA; `--repo` нормализовать в абсолютный корень. В изолированном worktree вызывать `checkOpenWiki` из его `scripts/openwiki-check.ts` и затем его CLI, чтобы фильтр источников совпадал с CI этого репозитория. Сохранить lock, прогресс, очистку, проверку только сгенерированных `openwiki/**` без `INSTRUCTIONS.md`, защиту от гонки и отдельный PR; prompt для платформенной wiki говорит о коде на SHA, без утверждений о проде.
- [ ] **Step 4: Увидеть зелёный результат.** `cd docs && bun run typecheck && bun test scripts/openwiki-update-local.test.ts && bun run test && bun run build && bun run modules:check`; отдельно проверить ошибку неверного `--repo` без модели и push.
- [ ] **Step 5: Коммит.** `git add scripts/openwiki-update-local.ts scripts/openwiki-update-local.test.ts README.md && git commit -m 'feat(openwiki): обновлять wiki соседнего репозитория'`.

### Task 2: Подготовить frontend к собственной wiki

**Files:** Create: `frontend/scripts/openwiki-check.ts`, `frontend/scripts/openwiki-check-pr.ts`, `frontend/scripts/openwiki-check.test.ts`, `frontend/.github/workflows/openwiki-freshness.yml`, `frontend/.openwikiignore`, `frontend/openwiki/INSTRUCTIONS.md`. Modify: `frontend/AGENTS.md`, кратко `frontend/README.md`. Test: `cd frontend && bun test scripts/openwiki-check.test.ts && bun run test:scripts && bun run check`.

**Interfaces:** Produce `checkOpenWiki(root, targetSha)` и CLI из задачи 1. Источники frontend: рабочий код BFF/клиента, тесты, конфигурация, `docs/local-development.md`, `docs/release.md`, README/AGENTS; исключить `docs/superpowers/**`, outputs, секреты и generated API code как самостоятельное доказательство. `openwiki/INSTRUCTIONS.md` считается входом, остальные `openwiki/**` — выходом.

- [ ] **Step 1: Написать fixture-тесты.** На временном Git-репозитории доказать fresh после wiki-only коммита, stale после изменения исходника или `openwiki/INSTRUCTIONS.md`, отсутствие stale после `docs/superpowers/**` и отказ для incomplete/non-ancestor checkpoint. В CI-тесте/проверке workflow зафиксировать: source PR с одним `INSTRUCTIONS.md` не требует wiki-only gate, сгенерированный wiki PR требует.
- [ ] **Step 2: Увидеть красный результат.** `bun test scripts/openwiki-check.test.ts` падает на новых случаях.
- [ ] **Step 3: Добавить checker, CI и brief.** Взять существующий контракт checker `docs`, настроить разрешённые пути frontend и NUL-delimited Git diff; CI запускается на изменениях сгенерированной wiki, проверяет только wiki paths, полный SHA и freshness к базе PR, без API-ключа и модели. В brief запретить объявлять код `main` продом, указывать ссылки на исходники с SHA, не дублировать содержимое `frontend-packages`; `.openwikiignore` исключает планы, сборку и секреты. `AGENTS.md` направляет локальные вопросы в свою wiki, межрепозиторные — в workspace/`docs`, с Markdown fallback.
- [ ] **Step 4: Увидеть зелёный результат.** `bun test scripts/openwiki-check.test.ts`, `bun run test:scripts`, `bun run check`, `bun run build`; проверить workflow YAML и `git diff --check`.
- [ ] **Step 5: Коммит и исходный PR.** Коммит `feat(openwiki): подготовить wiki фронтенда`. PR не содержит сгенерированных страниц.

### Task 3: Инициализировать и проверить wiki frontend

**Files:** Generated only: `frontend/openwiki/**` кроме `INSTRUCTIONS.md`. Test: `cd frontend && bun scripts/openwiki-check.ts --against <SHA origin/main>`, новый OpenWiki CI.

**Interfaces:** Consumes: слитый исходный PR задачи 2. Produces: завершённая wiki frontend с checkpoint; будущие обновления запускаются updater задачи 1.

- [ ] **Step 1: На полном SHA `frontend/main` запустить OpenWiki init локальным Codex в изолированном worktree.** Использовать MCP page-job lifecycle до `openwiki_finish`; не принимать создаваемый OpenWiki scheduled workflow или изменения `AGENTS.md` в wiki PR. До появления quickstart общий updater правильно сообщает о bootstrap.
- [ ] **Step 2: Проверить результат.** Wiki объясняет клиент, BFF и связь с `frontend-packages`; Claims указывают на реальные файлы/строки; не пишет «работает на проде» по одному коду. `bun scripts/openwiki-check.ts --against <полный SHA frontend/main>` выводит `fresh`; `git diff --name-only` не показывает правок вне сгенерированных `openwiki/**`.
- [ ] **Step 3: Создать wiki-only PR.** Коммит `docs(openwiki): создать wiki фронтенда` в ветке `docs/openwiki-init-<12 символов SHA>`, затем `gh pr create` с исходным SHA и результатом проверки в описании; wiki-only CI проходит.
- [ ] **Step 4: После слияния проверить обычное ручное обновление без новых источников.** `cd docs && bun run wiki:update-local --repo ../frontend` возвращает `fresh`, не запускает модель и не открывает PR. Записать ссылку на wiki PR.

### Task 4: Подготовить backend к собственной wiki

**Files:** Create: `backend/scripts/openwiki-check.ts`, `backend/scripts/openwiki-check-pr.ts`, `backend/scripts/openwiki-check.test.ts`, `backend/.github/workflows/openwiki-freshness.yml`, `backend/.openwikiignore`, `backend/openwiki/INSTRUCTIONS.md`. Modify: `backend/AGENTS.md`, кратко `backend/README.md`. Test: `cd backend && bun test scripts/openwiki-check.test.ts && go test ./...`.

**Interfaces:** Тот же контракт `checkOpenWiki(root, targetSha)` для задачи 1. Источники: `internal/**`, `docs/{authentication,input-security,redis-sessions,local-development,release,apidog}.md`, `go.mod`, конфигурация/тесты; исключить generated API `api.gen.go`, plans, mocks и секреты как независимое свидетельство.

- [ ] **Step 1: Написать fixture-тесты.** Проверить stale при изменении Go-исходника, README/brief и тестов; fresh при изменении `docs/superpowers/**` или wiki-only; отказ при сломанном checkpoint и при source+generated wiki PR.
- [ ] **Step 2: Увидеть красный результат.** `bun test scripts/openwiki-check.test.ts` падает на новых случаях.
- [ ] **Step 3: Добавить checker, CI и brief.** Повторить проверенный минимальный контракт frontend с backend-путями, без корневого package manifest. Brief описывает Go API, auth/Redis, BFF/S2S границы по фактическому коду на SHA; Apidog остаётся владельцем HTTP-контракта. Обновить `AGENTS.md` на собственную wiki и общий workspace, с Markdown fallback.
- [ ] **Step 4: Увидеть зелёный результат.** `bun test scripts/openwiki-check.test.ts`, `go test ./...`, `git diff --check`; workflow не вызывает модель и не требует секретов.
- [ ] **Step 5: Коммит и исходный PR.** Коммит `feat(openwiki): подготовить wiki бэкенда`.

### Task 5: Инициализировать и проверить wiki backend

**Files:** Generated only: `backend/openwiki/**` кроме `INSTRUCTIONS.md`. Test: `cd backend && bun scripts/openwiki-check.ts --against <SHA origin/main>`, новый OpenWiki CI.

**Interfaces:** Consumes: слитый исходный PR задачи 4. Produces: wiki backend с checkpoint для общего поиска.

- [ ] **Step 1: Локальным Codex и OpenWiki init создать wiki в изолированном worktree на `backend/main`.** Завершить `openwiki_finish`; не включать scheduled workflow и правки вне `openwiki/**`.
- [ ] **Step 2: Сверить Claims и термины с кодом backend на SHA.** Redis/S2S описаны как состояние кода, а не автоматическое доказательство продовой выкладки; `bun scripts/openwiki-check.ts --against <SHA>` выводит `fresh`; нет правок вне сгенерированных `openwiki/**`.
- [ ] **Step 3: Создать wiki-only PR.** Коммит `docs(openwiki): создать wiki бэкенда` в ветке `docs/openwiki-init-<12 символов SHA>`, затем `gh pr create` с SHA и результатом проверки; wiki-only CI проходит.
- [ ] **Step 4: После слияния проверить `cd docs && bun run wiki:update-local --repo ../backend` на fresh без вызова модели.** Записать ссылку на wiki PR.

### Task 6: Подготовить infra к собственной wiki

**Files:** Create: `infra/scripts/openwiki-check.ts`, `infra/scripts/openwiki-check-pr.ts`, `infra/scripts/openwiki-check.test.ts`, `infra/.github/workflows/openwiki-freshness.yml`, `infra/.openwikiignore`, `infra/openwiki/INSTRUCTIONS.md`. Modify: `infra/AGENTS.md`, `infra/SUMMARY.md` для краткого onboarding. Test: `cd infra && bun test scripts/openwiki-check.test.ts` плюс существующие безопасные проверки IaC.

**Interfaces:** Тот же контракт `checkOpenWiki(root, targetSha)` для задачи 1. Источники: `pulumi/**`, разрешённые `ansible/**`, `.github/workflows/infra.yml`, `SUMMARY.md`; исключить vault, clouds.yaml, env, ключи, state, plans, generated SDK/артефакты. Wiki говорит о декларативном коде, не о фактическом состоянии Selectel.

- [ ] **Step 1: Написать fixture-тесты.** Изменение Pulumi/Ansible-шаблона делает wiki stale; изменение `docs/superpowers/**`, state/vault или wiki-only — нет; неполный checkpoint и смешанный wiki PR отвергаются. Проверить, что исключённый файл не читается генератором по `.openwikiignore`.
- [ ] **Step 2: Увидеть красный результат.** `bun test scripts/openwiki-check.test.ts` падает на новых случаях.
- [ ] **Step 3: Добавить checker, CI и brief.** Создать только `scripts/` для wiki, без корневого package manifest; CI с `setup-bun` и Git history проверяет wiki PR без production environment и секретов. Brief требует путей/Claims, запрещает IP/CIDR/токены и отличает декларацию от состояния облака. `AGENTS.md` направляет к своей wiki и общему workspace, с Markdown fallback.
- [ ] **Step 4: Увидеть зелёный результат.** `bun test scripts/openwiki-check.test.ts`, `(cd pulumi && bun test)`, `(cd pulumi/bootstrap && bun test)`, `(cd ansible && COMPOSE_CLI='docker compose' python -m unittest discover -s tests -v)`, `git diff --check`; убедиться, что wiki-only workflow не вызывает `infra-preview` и deploy.
- [ ] **Step 5: Коммит и исходный PR.** Коммит `feat(openwiki): подготовить wiki инфраструктуры`.

### Task 7: Инициализировать и проверить wiki infra

**Files:** Generated only: `infra/openwiki/**` кроме `INSTRUCTIONS.md`. Test: `cd infra && bun scripts/openwiki-check.ts --against <SHA origin/main>`, новый OpenWiki CI.

**Interfaces:** Consumes: слитый исходный PR задачи 6. Produces: wiki infra с checkpoint для общего поиска.

- [ ] **Step 1: Локальным Codex и OpenWiki init создать wiki в изолированном worktree на `infra/main`.** Завершить `openwiki_finish`; отклонить workflow генерации и правки вне `openwiki/**`.
- [ ] **Step 2: Проверить каждую страницу на секреты, IP/CIDR и утверждения о текущем облаке без проверки.** Claims указывают на разрешённые исходники; `bun scripts/openwiki-check.ts --against <SHA>` выводит `fresh`; нет правок вне сгенерированных `openwiki/**`.
- [ ] **Step 3: Создать wiki-only PR.** Коммит `docs(openwiki): создать wiki инфраструктуры` в ветке `docs/openwiki-init-<12 символов SHA>`, затем `gh pr create` с SHA и результатом проверки; wiki-only CI проходит.
- [ ] **Step 4: После слияния проверить `cd docs && bun run wiki:update-local --repo ../infra` на fresh без модели.** Записать ссылку на wiki PR.

### Task 8: Связать четыре wiki и проверить маршруты агентов

**Files:** Modify: `docs/README.md` (короткий onboarding); `AGENTS.md` всех четырёх репозиториев уже подготовлены предыдущими задачами. Test: ручной `openwiki link` и MCP `openwiki_search`/`openwiki_read` из каждого клона.

**Interfaces:** Consumes: опубликованные четыре wiki. Produces: именованное локальное пространство CDD у владельца и воспроизводимую инструкцию для каждого студента; реестр `~/.openwiki` не коммитится.

- [ ] **Step 1: Описать настройку.** `docs/README.md` даёт установку OpenWiki-интеграции в среде агента, расположение четырёх соседних клонов, `openwiki link` из общего родителя, проверку `origin`, `openwiki workspace current/use`, проверку свежести каждой wiki и Markdown fallback. Не требовать пятого клона `frontend-packages` для общего поиска.
- [ ] **Step 2: Проверить на четырёх локальных клонах.** Интерактивно связать wiki; из каждого репозитория найти страницу другого и прочитать её с ID wiki из результата. Контрольные запросы: Vite-плагин → карта `docs` → `frontend-packages`; Go S2S → `backend`; выкладка → `infra`; будущая фича → `/modules/`, без ложного «есть на проде».
- [ ] **Step 3: Проверить fallback и завершить.** При отключённом MCP агент находит нужный `quickstart.md`/исходники; при нескольких workspace инструкция объясняет `workspace use`; при stale выдаёт путь и сверяет актуальный код. `git status` всех четырёх репозиториев не показывает локальный workspace; коммит `docs(openwiki): описать общее пространство` и итоговый обзор PR/CI.
