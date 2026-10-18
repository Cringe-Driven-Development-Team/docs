# Единый маршрут к контексту проекта — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Из любого репозитория команды агент попадает к актуальному общепроектному контексту, не получает дубликат архитектуры и сохраняет локальные правила работы.

**Architecture:** `docs/site/project-context.md` — навигатор к текущей архитектуре, планам и источникам фактов. Корневые `AGENTS.md` репозиториев содержат короткую ссылку на него и собственные правила; существующие `CLAUDE.md` подключают `@AGENTS.md`. Работающий код, Apidog и `.github/CONTRIBUTING.md` остаются владельцами соответствующих фактов и процессов.

**Tech Stack:** Markdown, VitePress, Git/GitHub; без новых зависимостей и изменений продуктового кода.

**Spec:** `docs/superpowers/specs/2026-10-18-project-context-source-of-truth-design.md`.

## Global Constraints

- Охват — все 15 репозиториев `Cringe-Driven-Development-Team`, включая библиотеки и вспомогательные репозитории.
- `docs` хранит общепроектный контекст, но не заменяет код как источник фактического поведения, Apidog как источник API-контракта и `.github/CONTRIBUTING.md` как источник правил задач и PR.
- Текущие разделы `docs` и схемы корня описывают работающий продукт; `site/modules/` — план, `diagrams/frozen-k3s/` заморожен.
- Не копировать топологию продукта в `AGENTS.md` и скиллы; сохранять локальные команды и ограничения.
- Не править учебные копии frontend/backend. Работать с `Cringe-Driven-Development-Team/frontend` и `Cringe-Driven-Development-Team/backend`, проверив текущий `main` перед правкой.
- Это документационное изменение. Новые тесты, зеркалящие текст файлов, не писать; запускать имеющиеся проверки и проверять ссылки/содержание напрямую.

## Review Focus

1. Устаревший локальный клон соседнего репозитория: до правки сверить remote и SHA командного `main` (Task 2–5).
2. План модуля принят за текущую архитектуру: страница явно отделяет `site/modules/` от текущих разделов (Task 1).
3. Ссылка из репозитория ведёт на несуществующую страницу: страница публикуется первой, затем проверяются ссылки в каждом PR (Task 1–5).
4. После переноса `CLAUDE.md` фронтенда пропали локальные правила: сверить список разделов и инструкций до/после (Task 3).
5. Подсказка в одной из 10 вспомогательных реп отличается от остальных: проверить все корневые `AGENTS.md` и ссылки по списку репозиториев (Task 5).

---

### Task 1: Опубликовать навигатор в `docs`

**Files:**
- Create: `docs/site/project-context.md`
- Modify: `docs/README.md`
- Modify: `docs/AGENTS.md`
- Modify: `docs/site/.vitepress/config.mts`

**Interfaces:**
- Consumes: существующие `site/architecture/`, `site/modules/`, `site/security/`, `.github/CONTRIBUTING.md` и README командных репозиториев.
- Produces: постоянный URL `https://docs.cellestial.ru/project-context` и исходник `https://github.com/Cringe-Driven-Development-Team/docs/blob/main/site/project-context.md`, который используют Tasks 2–5.

- [ ] **Step 1: Сверить исходники.** Убедиться, что `docs` worktree основан на актуальном `origin/main`; открыть `README.md`, `AGENTS.md`, `site/.vitepress/config.mts` и существующие страницы архитектуры/модулей. Проверить, что будущая страница не пересказывает топологию и не называет планы работающим продом.
- [ ] **Step 2: Добавить `site/project-context.md`.** Разделы: «Как пользоваться этой страницей», «Где искать сведения» (таблица владельцев из спеки), «Текущее и планируемое» (ссылки на `/architecture/` и `/modules/`), «Если источники расходятся» (проверить SHA, код/стенд, сообщить о расхождении). Ссылки на API-контракт через существующую страницу `contract`, на процесс через `.github/CONTRIBUTING.md`; ни одного нового утверждения о топологии.
- [ ] **Step 3: Сделать страницу доступной.** Добавить ссылку в содержание `README.md`, в `AGENTS.md` и пункт `Контекст проекта` в `themeConfig.nav` сайта. Не менять другие пункты меню.
- [ ] **Step 4: Проверить.** `rg -n 'project-context|architecture|modules|CONTRIBUTING' README.md AGENTS.md site/project-context.md site/.vitepress/config.mts`; `bun run typecheck`, `bun run test`, `bun run build`, `git diff --check`. Ожидается: ссылка во всех трёх входах, команды проходят; если Docker недоступен, сообщить, какой именно шаг сборки не запущен.
- [ ] **Step 5: Коммит и PR.** Коммит по правилам `docs`; PR в `docs/main`, после обязательных проверок опубликовать его раньше PR со ссылками на страницу. PR связан с родительской задачей через `Part of`, чтобы не закрыть её до раскатки по другим репозиториям.

### Task 2: Убрать дублирование из `backend`

**Files:**
- Modify: `backend/AGENTS.md`

**Interfaces:**
- Consumes: URL исходника страницы из Task 1 и текущие backend README/AGENTS/workflows.
- Produces: backend-инструкции без самостоятельной схемы общей топологии, с сохранёнными Go-командами и локальными ограничениями.

- [ ] **Step 1: Открыть актуальный командный репозиторий.** Сверить `git remote -v`, `git rev-parse HEAD` и `origin/main`; не использовать учебную копию как рабочий репозиторий.
- [ ] **Step 2: Править `AGENTS.md`.** Заменить пересказ «одна VPS → Caddy → API → Postgres» и таблицу общих схем короткой ссылкой на `docs/site/project-context.md`. Оставить команды, API-совместимость, факты о backend CI/CD и другие локальные ограничения; сверить их с README и workflow.
- [ ] **Step 3: Проверить.** `rg -n 'project-context|VPS|BFF|Go API|PostgreSQL' AGENTS.md`; визуально сверить сохранённые разделы, `git diff --check`. Ожидается: ссылка есть, топология не пересказывается, локальные инструкции не пропали.
- [ ] **Step 4: Коммит и PR.** Отдельная backend-задача/sub-issue и PR с `Closes #N` по `.github/CONTRIBUTING.md`.

### Task 3: Сделать общие инструкции фронтенда доступными агентам

**Files:**
- Create: `frontend/AGENTS.md`
- Modify: `frontend/CLAUDE.md`

**Interfaces:**
- Consumes: URL исходника страницы из Task 1, существующий `CLAUDE.md`, README и текущую структуру frontend.
- Produces: один набор общих правил в `AGENTS.md`; `CLAUDE.md` содержит `@AGENTS.md` и только особенности Claude Code.

- [ ] **Step 1: Открыть актуальный командный репозиторий.** Сверить remote и `origin/main`; сохранить копию текста текущего `CLAUDE.md` для сравнения разделов, не править учебную копию.
- [ ] **Step 2: Перенести инструкции.** Содержимое действующего `CLAUDE.md`, применимое к любому агенту, перенести без смысловых изменений в `AGENTS.md`; добавить в начале ссылку на `docs/site/project-context.md`. В `CLAUDE.md` оставить `@AGENTS.md` и только инструкции, зависящие от Claude Code. Не переносить продуктовую архитектуру из `docs`.
- [ ] **Step 3: Проверить.** Сравнить разделы и ограничения до/после; `rg -n '^@AGENTS.md$' CLAUDE.md`, `rg -n 'project-context|bun run check|bun run build' AGENTS.md`, `git diff --check`. Запустить существующие проверки репозитория для текстовой правки, если они доступны; новые тесты не добавлять.
- [ ] **Step 4: Коммит и PR.** Отдельная frontend-задача/sub-issue и PR с `Closes #N`; обязательное ревью ментора сохраняется.

### Task 4: Добавить точку входа для `infra`

**Files:**
- Create: `infra/AGENTS.md`

**Interfaces:**
- Consumes: URL исходника страницы из Task 1, локальные `README.md`, `RUNBOOK.md`, `pulumi/README.md`, `ansible/README.md`.
- Produces: маршрут к общему контексту и существующим локальным инструкциям без копии текущей инфраструктуры.

- [ ] **Step 1: Проверить актуальный `infra/main` и наличие корневых инструкций.** Если за время работы появился `AGENTS.md`, дополнить его вместо перезаписи.
- [ ] **Step 2: Создать короткий `AGENTS.md`.** Ссылка на `docs/site/project-context.md`; для фактического состояния — Pulumi/Ansible и стенд; для локальных операций — README/RUNBOOK; задачи и PR — `.github/CONTRIBUTING.md`. Не дублировать список ресурсов Selectel.
- [ ] **Step 3: Проверить.** `rg -n 'project-context|README.md|RUNBOOK.md|CONTRIBUTING' AGENTS.md`, проверить существование локальных файлов и `git diff --check`.
- [ ] **Step 4: Коммит и PR.** Отдельный PR в `infra/main`, связанный с родительской задачей по правилам `.github/CONTRIBUTING.md`.

### Task 5: Раскатить указатель по остальным репозиториям

**Files:**
- Modify: `frontend-packages/AGENTS.md`
- Create: `agent-plugins/AGENTS.md`, `.github/AGENTS.md`, `oxlint-plugin-jsdoc/AGENTS.md`, `openapi-cdd/AGENTS.md`, `static/AGENTS.md`, `zustand-cdd/AGENTS.md`, `react/AGENTS.md`, `openapi-playground/AGENTS.md`, `zustand-playground/AGENTS.md`, `figma/AGENTS.md`

**Interfaces:**
- Consumes: URL исходника страницы из Task 1 и README каждого репозитория.
- Produces: корневой `AGENTS.md` во всех 15 репозиториях организации; существующие локальные правила `frontend-packages` сохранены.

- [ ] **Step 1: Сверить состав репозиториев и их `main`.** `gh repo list Cringe-Driven-Development-Team --limit 100` и наличие корневых `AGENTS.md`/`README.md`; если репозиторий добавился, включить его, если появился `AGENTS.md`, дополнить, не перезаписывать. Работать в отдельных ветках командных репозиториев.
- [ ] **Step 2: Добавить одинаковый минимальный маршрут.** В `frontend-packages/AGENTS.md` добавить только ссылку на `docs/site/project-context.md`. В остальных 10 создать `AGENTS.md`: идентификация репозитория и ссылка на местный README, ссылка на общепроектный контекст, правило проверять факты по коду. Существующие локальные правила, если обнаружены, сохранить; не добавлять пустые `CLAUDE.md`.
- [ ] **Step 3: Проверить каждый репозиторий.** Для всех из списка проверить `rg -n 'project-context|README.md' AGENTS.md`, открыть ссылку на страницу `docs`, `git diff --check`. Сопоставить список `gh repo list` с фактически обновлёнными репозиториями и перечислить исключения, если есть.
- [ ] **Step 4: Коммиты и PR.** По одному небольшому PR на репозиторий; ссылать их на родительскую задачу через `Part of <полная ссылка>`, не использовать `Closes` для родителя до завершения всей раскатки.

### Task 6: Проверить итоговое состояние

**Files:**
- None: только проверки и ссылки в задаче/PR.

**Interfaces:**
- Consumes: слитые PR Tasks 1–5.
- Produces: проверенный список репозиториев с доступным общепроектным контекстом и указанием оставшихся расхождений.

- [ ] **Step 1: Проверить `main` всех 15 репозиториев.** Убедиться, что корневой `AGENTS.md` содержит ссылку на опубликованную страницу; для `frontend`/`backend`/`frontend-packages`/`docs` проверить связку с `CLAUDE.md`.
- [ ] **Step 2: Проверить страницу.** Открыть опубликованный `https://docs.cellestial.ru/project-context`; ссылки на архитектуру, модули и правила задач должны работать, а план не должен называться текущим продом.
- [ ] **Step 3: Зафиксировать результат в родительской задаче.** Ссылки на PR и проверенные SHA `main`; если все приняты — закрыть задачу по правилам команды, иначе оставить перечень недостающих репозиториев.
