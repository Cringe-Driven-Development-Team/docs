# Текущая документация и OpenWiki docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать на сайте три понятных входа, описать проверенный прод вне модулей и ограничить wiki `docs` текущими фактами и картой владельцев.

**Architecture:** Рукописные страницы сайта остаются первоисточником; `/modules/` хранит планы, `/documentation/` связывает проверенные текущие страницы, `/openwiki/` публикует производную wiki `docs`. Один классификатор исходных путей определяет свежесть wiki и допустимость обновления; генерация остаётся ручной и выполняется после слияния исходных изменений.

**Tech Stack:** VitePress 1.6, Bun, TypeScript, eraser-diagrams, OpenWiki 0.7.2, GitHub Pages/Actions.

**Spec:** `docs/superpowers/specs/2026-10-25-current-documentation-openwiki-design.md`. Второй самостоятельный план: `docs/superpowers/plans/2026-10-31-platform-openwiki-workspace.md`.

## Global Constraints

- «Как работает сейчас» = поведение, проверенное на `cellestial.ru`; `main`, зелёный CI и загруженный релиз сами по себе этого не доказывают.
- `/modules/` = планы; прогресс фич берётся из GitHub-задач и PR, без дублируемого счётчика в документации.
- Wiki `docs` = проверенный прод и действующая карта владельцев; wiki обновляется только явной локальной командой, отдельным PR, без генерации по таймеру или при каждом PR.
- Старые публичные URL и рабочие якоря сохраняются либо перенаправляются; планы и старый CSRF не выдаются за текущий BFF.
- В публичные документы и сгенерированную wiki не попадают реальные IP, CIDR, токены и внутренние адреса.
- Работа в отдельной ветке/worktree; коммиты по-русски. Перед коммитом в `docs`: `bun run typecheck && bun run test && bun run build && bun run modules:check`.

## Review Focus

1. BFF есть в `main`, но не подтверждён на проде: текущая страница его не утверждает; проверяется свидетельствами в задаче 1.
2. На проде проверена только часть фичи: текст называет лишь эту часть; проверяется сравнением сценариев и страниц в задаче 1.
3. Старые `/security/csrf/` и якоря имеют внешних читателей: сборка и проверка ссылок в задаче 2, ручная проверка старых URL в задаче 1.
4. Изменён только план модуля: wiki остаётся fresh; фикстура `site/modules/2/...` в задаче 4.
5. Изменён `openwiki/INSTRUCTIONS.md` в исходном PR: он делает wiki stale, но не превращает исходный PR в wiki-only PR; тесты и workflow в задаче 4.

## Карта файлов

| Файлы | Ответственность |
| --- | --- |
| `site/documentation/index.md`, `site/documentation/bff.md` | Вход в текущую документацию; BFF-страница создаётся только при проверенном проде. |
| `site/architecture/index.md`, `site/security/csrf/{index,scenarios,checks}.md`, `site/modules/2/tracks/bff.md`, `diagrams/*.json`, `README.md` | Только подтверждённая архитектура/защита, историческая связь с планом, действующие схемы и таблица схем. |
| `site/.vitepress/config.mts`, `site/index.md`, `site/project-context.md` | Три пункта меню, главная, боковая навигация и карта владельцев/пакетов. |
| `scripts/openwiki-source-path.ts`, `scripts/openwiki-check.ts`, `scripts/openwiki-check-pr.ts`, `scripts/openwiki-update-local.ts` | Единое правило источников для свежести и локального обновления; защита wiki PR. |
| `scripts/openwiki-check.test.ts`, `scripts/openwiki-freshness.test.ts`, `scripts/openwiki-update-local.test.ts`, `.github/workflows/openwiki-freshness.yml` | Регрессии классификации, PR и ручного updater. |
| `.openwikiignore`, `openwiki/INSTRUCTIONS.md`, `AGENTS.md`, `scripts/openwiki-pages.test.ts` | Корпус генератора, правила агента и согласованность с ручным циклом. |
| `openwiki/**` (кроме `INSTRUCTIONS.md`) | Сгенерированные страницы/Claims/checkpoint; меняются в отдельном wiki PR после слияния исходников. |

---

### Task 1: Доказать текущие функции и привести рукописные страницы к проду

**Files:** Modify: `site/architecture/index.md`, `site/security/csrf/{index,scenarios,checks}.md`, `README.md`, затронутые `diagrams/*.json`, `site/modules/2/tracks/bff.md`; Create conditionally: `site/documentation/bff.md`. Test: существующие `scripts/architecture-page.test.ts`, `scripts/bff-pages.test.ts`, `scripts/bff-csrf-diagrams.test.ts`, `bun run build`.

**Interfaces:** Produces: ссылки на подтверждённые текущие страницы и доказательства для входной страницы задачи 2. No new software API.

- [ ] **Step 1: Зафиксировать свидетельства.** Сверить SHA фактически выкаченных frontend/backend/infra по deployment/release источникам и проверить публичные браузерные сценарии на `cellestial.ru` с датой; для закрытого сценария запросить проверяемое свидетельство владельца. Список подтверждённых возможностей и пробелов приложить к PR. Не переносить неподтверждённую часть в текущий раздел.
- [ ] **Step 2: Переписать текущие описания по свидетельствам.** На `site/architecture/index.md` и в затронутых `site/security/csrf/*.md` описать действующий маршрут, защиту и границы; точные утверждения о коде снабдить ссылками на организационные репозитории с полным SHA и строкой. Если BFF подтверждён, создать `site/documentation/bff.md` с маршрутом браузер → BFF → Go и ссылками на frontend/Go/локальные инструкции; если нет — не создавать страницу «текущий BFF» и обозначить пробел в текущих страницах.
- [ ] **Step 3: Согласовать схемы и историю модуля.** Обновить только схемы корня `diagrams/*.json`, которые противоречат проверенному состоянию, и соответствующие подписи `README.md`; оставить `diagrams/modules/2/**` историческим планом. У подтверждённой части BFF-трека добавить плашку/ссылку «Как работает сейчас» без переписывания плана. Сохранить адреса и якоря CSRF или добавить штатные редиректы в `scripts/build-index.ts` при переносе.
- [ ] **Step 4: Проверить документы.** Обновить устаревшие содержательные проверки в `scripts/bff-pages.test.ts` только там, где новые факты это требуют. Выполнить `bun run modules:check`, `bun run test`, `bun run build` (включает `site:check`), открыть собранные страницы/схемы и старые CSRF URL; все проверки успешны.
- [ ] **Step 5: Коммит.** `git add site/ diagrams/ README.md scripts/bff-pages.test.ts && git commit -m 'docs(состояние): описать проверенный прод'` (добавить лишь реально изменённые пути).

### Task 2: Дать сайту три входа

**Files:** Create: `site/documentation/index.md`. Modify: `site/.vitepress/config.mts`, `site/index.md`. Test: `bun run build`, собранные `dist/documentation/index.html`, `scripts/check-site.ts`.

**Interfaces:** Consumes: ссылки на текущие страницы задачи 1. Produces: `/documentation/` и меню `OpenWiki`, `Документация`, `Модули`.

- [ ] **Step 1: Написать входную страницу.** В `site/documentation/index.md` перечислить каждую возможность из подтверждённого в задаче 1 списка с датой/свидетельством и ссылкой на подробную текущую страницу либо кратким описанием прямо здесь; дать ссылки на архитектуру, безопасность, эксплуатацию и владельцев сведений. Пояснить, что планы находятся в `/modules/`, а публичная OpenWiki — производная.
- [ ] **Step 2: Обновить навигацию.** В `themeConfig.nav` оставить ровно три согласованных пункта; добавить боковую навигацию `/documentation/`, сохранив URL `/architecture/`, `/project-context` и `/security/csrf/`. На `site/index.md` заменить рекламу старого CSRF на три пути.
- [ ] **Step 3: Проверить.** Выполнить `bun run build` и проверить в собранном HTML три пункта, новый вход и старые адреса; `site:check` должен вывести `site ok`.
- [ ] **Step 4: Коммит.** `git add site/documentation/index.md site/.vitepress/config.mts site/index.md && git commit -m 'docs(сайт): разделить документацию и модули'`.

### Task 3: Заполнить карту владельцев и правила агента

**Files:** Modify: `site/project-context.md`, `AGENTS.md`, `README.md`, `scripts/openwiki-pages.test.ts`. Test: `bun run test scripts/openwiki-pages.test.ts`, `bun run build`.

**Interfaces:** Produces: канонический маршрут к `frontend-packages` и правила, по которым агент отличает план, код и проверенный прод.

- [ ] **Step 1: Сверить владельцев.** На актуальном SHA `frontend` проверить зависимости `@cdd-team/*`, в `frontend-packages` — каталоги пакетов и release workflow. Занести в `/project-context` краткие маршруты к владельцам `@cdd-team/react`, `@cdd-team/vite-plugin-bff-html` и других реально используемых командных пакетов, с ссылками на исходники и процесс выпуска. Подробности пакетов оставить у владельца.
- [ ] **Step 2: Уточнить правила.** В `AGENTS.md` и README явно разделить свидетельство продовой работы, состояние кода и план; исправить правило «достаточно проверки по коду». В управляемом OpenWiki-блоке `AGENTS.md` заменить неверную строку о scheduled workflow правилом ручного обновления; в `scripts/openwiki-pages.test.ts` закрепить отсутствие scheduled обещания, затем убедиться, что OpenWiki update не меняет блок обратно. Добавить условное правило для локального workspace из четырёх wiki и Markdown fallback, которое верно и до появления платформенных wiki.
- [ ] **Step 3: Проверить.** `bun run test scripts/openwiki-pages.test.ts`, `bun run build`; открыть ссылки к пакету и release workflow.
- [ ] **Step 4: Коммит.** `git add site/project-context.md AGENTS.md README.md scripts/openwiki-pages.test.ts && git commit -m 'docs(контекст): указать владельцев пакетов'`.

### Task 4: Ограничить корпус wiki docs и согласовать проверку свежести

**Files:** Create: `scripts/openwiki-source-path.ts`. Modify: `scripts/openwiki-check.ts`, `scripts/openwiki-check-pr.ts`, `scripts/openwiki-update-local.ts`, `scripts/openwiki-check.test.ts`, `scripts/openwiki-freshness.test.ts`, `scripts/openwiki-update-local.test.ts`, `.github/workflows/openwiki-freshness.yml`, `.openwikiignore`, `openwiki/INSTRUCTIONS.md`.

**Interfaces:** Produces: `isWikiSourcePath(path: string): boolean`; `checkOpenWiki(root, targetSha)` сохраняет прежний контракт `{ sourceSha, targetSha, changedPaths, fresh }`. Поздний план платформенных wiki использует этот контракт, но свои правила исходников.

- [ ] **Step 1: Написать тесты классификатора и PR.** В `scripts/openwiki-check.test.ts` зафиксировать: `site/modules/2/tracks/bff.md` и `docs/superpowers/**` не делают wiki stale; `site/documentation/index.md`, `site/project-context.md`, корневая схема, `.openwikiignore` и `openwiki/INSTRUCTIONS.md` делают; удаление/перенос текущей страницы и путь с переводом строки остаются видимыми. В `scripts/openwiki-freshness.test.ts` зафиксировать исходный PR с `openwiki/INSTRUCTIONS.md` и wiki-only PR с устаревшим checkpoint. В `scripts/openwiki-update-local.test.ts` зафиксировать отказ от правки `INSTRUCTIONS.md` генератором.
- [ ] **Step 2: Увидеть красный результат.** `bun test scripts/openwiki-check.test.ts scripts/openwiki-freshness.test.ts scripts/openwiki-update-local.test.ts` падает на новых сценариях.
- [ ] **Step 3: Реализовать правило путей.** `isWikiSourcePath(path: string): boolean` в `scripts/openwiki-source-path.ts` допускает `site/index.md`, `site/documentation/**`, `site/project-context.md`, `site/architecture/**`, `site/security/**`, корневые действующие `diagrams/*.json`, `.openwikiignore`, `openwiki/INSTRUCTIONS.md` и `AGENTS.md`; исключает generated wiki, замороженные/модульные схемы, `README.md` с инструкциями сборки и спеки. Использовать его в `openwiki-check.ts` и решении updater о запуске, не меняя валидацию SHA/ancestry/NUL-delimited diff.
- [ ] **Step 4: Развести исходный и wiki PR.** `openwiki-check-pr.ts` запрещает смешивать сгенерированные страницы/Claims с исходниками и считать `openwiki/INSTRUCTIONS.md` сгенерированной страницей; updater отвергает изменение `INSTRUCTIONS.md` моделью. В workflow исключить PR, меняющий лишь `openwiki/INSTRUCTIONS.md` вместе с источниками, из wiki-only gate; wiki PR со сгенерированными страницами должен по-прежнему проходить gate и проверку checkpoint.
- [ ] **Step 5: Ограничить генератор.** В `.openwikiignore` исключить `README.md`, `site/modules/**`, `docs/superpowers/**`, `diagrams/modules/**`, `diagrams/frozen-k3s/**` и прочие не входящие в корпус деревья; в `openwiki/INSTRUCTIONS.md` оставить только текущие темы и карту владельцев, без планов как фактов.
- [ ] **Step 6: Увидеть зелёный результат.** Запустить новые тесты, затем `bun run typecheck`, `bun run test`, `bun run build`, `bun run modules:check`; изменение только модуля даёт fresh, а текущего источника — stale.
- [ ] **Step 7: Коммит и исходный PR.** Коммит `fix(openwiki): ограничить источники текущими фактами`; PR объединяет задачи 1–4, не содержит изменений сгенерированных страниц/Claims.

### Task 5: Вручную обновить и опубликовать wiki docs

**Files:** Generated only: `openwiki/**` кроме `openwiki/INSTRUCTIONS.md`; existing `README.md` описывает порядок. Test: `bun run wiki:check --against <полный SHA origin/main>`, `.github/workflows/openwiki-freshness.yml`, `bun run build` после wiki PR.

**Interfaces:** Consumes: опубликованные исходники задач 1–4 и их SHA. Produces: свежая wiki `docs` и публичная страница `/openwiki/` после Pages.

- [ ] **Step 1: После слияния исходного PR явно запустить** `cd docs && bun run wiki:update-local` с локальным Codex/OpenWiki; команда выбирает актуальный `origin/main`, создаёт wiki-only PR, сообщает прогресс и SHA.
- [ ] **Step 2: Проверить wiki PR.** Убедиться, что `openwiki_finish` завершён, checkpoint равен исходному SHA, страницы о планах и процедуре сборки удалены/исправлены вместе с Claims, а quickstart ведёт к проверенному текущему состоянию и карте владельцев. Выполнить `bun run wiki:check --against <актуальный полный SHA docs/main>`; при продвижении источников пересоздать PR вручную по выбранному моменту.
- [ ] **Step 3: Опубликовать и проверить.** После проверки и слияния wiki PR дождаться Pages и открыть `/openwiki/`; сверить дату/SHA, несколько ссылок и отсутствие утверждений о непроверенных фичах. Записать URL PR и результат в итог исполнения плана.
