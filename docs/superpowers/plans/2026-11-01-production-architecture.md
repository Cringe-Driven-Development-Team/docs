# Обновление архитектуры прода — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Опубликовать проверенную архитектуру с BFF на gateway и Go/PostgreSQL/Redis на VPS2, обновив шесть схем и удалив k3s.

**Architecture:** Существующие JSON eraser-diagrams обновляются на месте, VitePress сохраняет шесть разделов и адреса. Датированный блок свидетельств отделяет размещение и конфигурацию от непроверенных пользовательских сценариев. Удалённые адреса обслуживаются существующим `PAGE_REDIRECTS`.

**Tech Stack:** Bun, TypeScript, bun:test, VitePress/Vue, eraser-diagrams CLI 0.1.0, Docker/Chromium; существующие GitHub Actions Pages.

**Spec:** `docs/superpowers/specs/2026-11-01-production-architecture-design.md` — прочитать целиком до начала работы.

## Global Constraints

- Только репозиторий `Cringe-Driven-Development-Team/docs`; платформа, серверы, cloud, API и backup jobs не меняются.
- «Никаких новых зависимостей». Существующие eraser renderer, zoom/pan, HTML/PNG, тема и цвета зон владения сохраняются.
- Шесть разделов: `deployment`, `ci`, `cd`, `frontend`, `contract`, `infra`; существующие имена JSON, URL и ID `архитектура-mvp` сохраняются.
- Срез 01.11.2026: backend `6e1a0d81bc284e87aa4a9561d7b65eee835a26c3`, BFF revision `baf512e9a7bd7e5452554cdc89baa20e24aa7a32`; digest BFF взять дословно из спеки.
- «Механизм включён; создание, исполнение и удаление runtime-VPS не проверены». `RUNTIME_ENABLED=true` не означает проверку пользовательского сценария.
- Каждую связь сверять с кодом на полном SHA; ссылки на файлы с `#L…`. SHA исходников, выкладка и наблюдение на проде — разные свидетельства.
- «Не выводить реальные IP, CIDR, приватные URL, секреты и полные конфиги». Публичные домены и GitHub-ссылки допустимы.
- «Не переписывать старые спеки, планы и generated `openwiki/`». Модули и схемы `diagrams/modules/2/` сохраняются.
- Не добавлять совместимость старого клиента/API, HA, безостановочную выкладку или канареечный релиз. Новые таймеры и автоматическая генерация wiki отсутствуют.
- Работа в имеющемся `.claude/worktrees/architecture-current-design`, ветка `docs/architecture-current-design`; не использовать workspace другого плана. Исполнитель сначала проверяет состояние, не удаляя чужие файлы.
- Следовать актуальным `AGENTS.md`, `.agents/skills/eraser-diagrams/SKILL.md`, `docs-site`; перед каждым коммитом обязательны `modules:check`, `typecheck`, `test`, `build` по правилам репозитория.

## Review Focus

1. Несовпадение main, выложенного SHA и даты: читатель видит датированное свидетельство и границы проверки, а не обещание актуального main. Тест — Task 1, `production evidence distinguishes configuration from scenarios`.
2. Ошибочная прямая связь browser → Go или размещение БД на gateway: схема ведёт через BFF, Go/БД/Redis находятся на VPS2. Тесты — Task 1 `deployment places backend on VPS2`, Task 2 `browser calls BFF, BFF calls Go`.
3. Старые адреса под `/` и `/branches/architecture-check/`, включая hash: обе ступени переадресации остаются в своей базе. Тест — Task 4 `k3s redirects preserve base and fragments`.
4. Остатки прежнего рендера: чистая сборка содержит пять HTML-заглушек, без k3s PNG и JSON. Тест — Task 4 `k3s sources are gone`; проверка артефактов и переходов в его browser step.
5. Высокие схемы и lazy iframe на мобильном экране: все шесть загружаются, подписи/легенды читаемы, zoom/pan работает, страница не переполняется. Проверки — PNG в Tasks 1–3, browser assertions в Task 4.

---

## Карта файлов и границы задач

| Файлы | Ответственность и владелец изменения |
| --- | --- |
| `diagrams/deployment.json`, `diagrams/infra.json` | Размещение, инфраструктура, уровень проверки runtime — Task 1 |
| `diagrams/frontend.json`, `diagrams/contract.json` | Владельцы frontend и контракты — Task 2 |
| `diagrams/ci.json`, `diagrams/cd.json` | Проверки, публикация, доставка выпуска — Task 3 |
| `site/architecture/index.md` | Вводная часть и deployment/infra — Task 1; только свои два раздела в Tasks 2–3 |
| Create `scripts/production-architecture.test.ts` | Семантические проверки схем; создаётся в Task 1, дополняется в Tasks 2–3 |
| `scripts/architecture-page.test.ts` | Свидетельства/порядок — Task 1, удаление требования Frozen — Task 4 |
| `site/.vitepress/diagram-names.ts`, `scripts/build-index.ts`, пять Frozen JSON | Удаление и переадресации — Task 4 |
| `scripts/build-index.test.ts`, `scripts/site-base.test.ts` | Проверки переадресаций и конфигурации папок — Task 4 |
| README, AGENTS/CLAUDE, eraser skill и его копия, sidebar, `site/documentation/index.md` | Согласование инструкций и текущих входящих ссылок — Task 4 |

Задачи выполняются последовательно: они дополняют одну страницу и один test file.
Новые production-функции, библиотеки, реестр схем и общий слой моделей не нужны.
Инструментальные записи/скриншоты хранить в игнорируемом `.superpowers/architecture-2026-11-01/`, не в публичной странице.

## Перед Task 1

- [ ] Проверить `git status`, текущую ветку и SHA базы; прочитать спеку и инструкции в этом worktree. Спеку и план сохранить в ветке первым коммитом после исходных проверок; не считать их уже закоммиченными.
- [ ] Подготовить существующие зависимости через `bun install --frozen-lockfile`, выполнить исходные `bun run modules:check`, `bun run typecheck`, `bun run test`, `bun run wiki:prepare`, `bun run build`. Успех: нулевые коды, без изменений generated wiki; сохранить логи. Ошибку сети или сборки не скрывать.
- [ ] Зафиксировать источники в `.superpowers/architecture-2026-11-01/sources.md`: полный SHA, файл/строки, подтверждаемая подпись/связь и уровень свидетельства. Источники ниже прочитать через GitHub по указанным SHA, без вывода секретных значений. Если наблюдения устарели, сохранить их дату; не заменять их свежим main без новой проверки прода.

Минимальные источники: frontend на BFF revision из Constraints — `apps/client/package.json`, `apps/bff/src/{context.ts,go/fetch.ts}`, `apps/bff/src/session/`, конфиги Orval/экспорта OpenAPI, `.github/workflows/{ci,cd,rollback,sync-to-course}.yml`; backend на SHA из Constraints — `.github/workflows/{ci,cd,contract-drift,sync-to-course}.yml`, транспорт HTTP, миграции и runtime adapters; infra на `0a21f459dc2722d631b11cb9e82af5d3aa1c95ef` — `pulumi/`, `ansible/site.yml`, `deploy-backend.yml`, `inventory/group_vars/`, роли `app`, `caddy`, `hooks`, `restic_backup` и `.github/workflows/infra.yml`.
Для соседних владельцев использовать аудитные snapshots: `frontend-packages@fa65157b5f6957fbf30fa2ebd4b3b75af19cc955` (`packages/`, workflows `ci.yml`, `release.yml`), `static@a0cea30d81d00f2e7d915b7fa0c92a25851b4e87` (`.github/workflows/ci.yml`), `.github@515352beac1a5a3ae98140121ca40e25f9551707` (`services/webhook-alerts/`). Это кодовые snapshots, не новые даты проверки продовых сценариев.

### Task 1: проверенное размещение и инфраструктура

**Files:** Modify `diagrams/deployment.json`, `diagrams/infra.json`, `site/architecture/index.md`, `scripts/architecture-page.test.ts`; Create `scripts/production-architecture.test.ts`.

**Interfaces:** Consumes `DiagramDoc` из `scripts/diagram.ts`, `indexById<T extends {id: string}>` из `scripts/colors.ts`, свидетельства спеки. Produces только JSON/Markdown и test-local `readDiagram(name: string): DiagramDoc`, `edgePairs(doc: DiagramDoc): string[]`. В Tasks 2–3 эти функции дополняются в том же test file, не экспортируются.
В `deployment` закрепить IDs: `client`, `gateway`, `caddy`, `bff`, `vps2`, `go-api`, `postgres`, `redis`, `auxiliary`, `cdn-release`, `s3-release`; `caddy`/`bff` непосредственно в `gateway`, Go/БД/Redis непосредственно в `vps2`. В `infra` нужны роли `gateway`, `vps2`, `auxiliary` и Textbox `runtime-status`.

- [ ] **1.1. Добавить RED-тесты** `deployment places backend on VPS2`, `infra separates service roles`, а в page test — `production evidence distinguishes configuration from scenarios`. Assertions:

```ts
const d = readDiagram('deployment'), nodes = indexById(d);
expect(['caddy','bff'].map(id => nodes[id]?.containerId)).toEqual(['gateway','gateway']);
expect(['go-api','postgres','redis'].map(id => nodes[id]?.containerId)).toEqual(['vps2','vps2','vps2']);
expect(edgePairs(d)).toEqual(expect.arrayContaining(['client>caddy','caddy>bff','bff>go-api','go-api>postgres','go-api>redis']));
expect(edgePairs(d)).not.toContain('client>go-api');
expect(['gateway','vps2','auxiliary'].every(id => indexById(readDiagram('infra'))[id])).toBe(true);
```

В page test проверить заголовок/`{#архитектура-mvp}`, дату `01.11.2026`, backend полный SHA, BFF revision/digest из спеки, успешный run `41302004065`, `RUNTIME_ENABLED=true`, явные слова о непроверенных runtime-сессиях и авторизованных сценариях. В `infra separates service roles` проверить `runtime-status.tag === 'Textbox'`, его `text` содержит `RUNTIME_ENABLED=true` и указание «не проверен». Проверку размещения таблицы ограничить вводной частью до `## deployment`, а не случайным совпадением ниже. Сохранить тест порядка шести разделов.

- [ ] **1.2. Запустить RED:** `bun test scripts/production-architecture.test.ts scripts/architecture-page.test.ts`. Ожидается failure новых assertions о VPS2/свидетельстве; импорт и старые тесты должны работать.
- [ ] **1.3. Обновить два JSON** по источникам: gateway/Caddy/BFF → VPS2/Go/БД/Redis, S3/CDN и отдельный auxiliary; infra — Pulumi/state/Ansible, auxiliary integrations/backup, отдельный поток Docs/Pages/OpenWiki. В `runtime-status` отразить включённый флаг и непроверенность пользовательского сценария; аналогичную оговорку дать продуктовым S3-связям. Соблюсти существующие группы владения/легенды; не копировать реальные адреса.
- [ ] **1.4. Переписать вводную часть и два раздела страницы.** Заголовок точно «Архитектура работающего сервиса», явный ID прежний. Добавить таблицу размещения, датированные свидетельства и ограничения, ссылки `/documentation/bff` и `/project-context`, подтверждения source SHA/строк для двух схем. Оставшиеся четыре схемы пока честно оставить историческими; их предупреждения снимут Tasks 2–3. Новых `##` до/между шестью схемами не добавлять.
- [ ] **1.5. GREEN/рендер:** повторить focused tests, `bun run validate`, `bun run check`, `bun run warm`, `bun run render`. Ожидается exit 0. Осмотреть `dist/deployment.png` и `dist/infra.png`: размещение, различимость ролей, читаемые подписи/легенды, отсутствие пересечений с текстом. При исправлении координат повторить цикл, не менять механизм цветов.
- [ ] **1.6. Проверить и закоммитить:** `bun run modules:check`, `bun run typecheck`, `bun run test`, `bun run build` — exit 0; `git diff --check`; затем добавить только Files этой задачи и `git commit -m "docs(architecture): описать размещение сервисов на трёх VPS"`. Подтверждения и PNG-осмотр включить в отчёт задачи.

### Task 2: frontend, владельцы пакетов и контракты

**Files:** Modify `diagrams/frontend.json`, `diagrams/contract.json`, только разделы `## frontend`/`## contract` в `site/architecture/index.md`, `scripts/production-architecture.test.ts`.

**Interfaces:** Consumes test-local `readDiagram`, `edgePairs` из Task 1. Produces два актуальных JSON и их пояснения; для frontend IDs `client`, `bff`, `go-api`, `repo-frontend`, `repo-packages`, `bff-plugin`; для contract IDs `apidog`, `orval`, `oapi-codegen`, `bff-go-client`, `zod-schemas`, `bff-router`, `go-api`, `client`.

- [ ] **2.1. Добавить RED-тесты** `browser calls BFF, BFF calls Go` и `contract separates tRPC and OpenAPI`. Assertions: frontend `client>bff`, `bff>go-api` есть, `client>go-api` нет; label связи с браузером содержит `/api/trpc`, upstream содержит `/api/v1`. `bff-plugin.containerId === 'repo-packages'`; JSON содержит `@cdd-team/react`, `@cdd-team/router`, `@cdd-team/zustand`. В contract связи включают `apidog>orval`, `apidog>oapi-codegen`, `orval>bff-go-client`, `orval>zod-schemas`, `client>bff-router`, `bff-router>bff-go-client`, `bff-go-client>go-api`.
- [ ] **2.2. Проверить RED:** `bun test scripts/production-architecture.test.ts` — новые тесты падают на старом прямом API/`@my/openapi`, тесты Task 1 проходят.
- [ ] **2.3. Обновить JSON**: `apps/client`, `apps/bff`, schemas; командные UI-библиотеки, внешний владелец npm/Vite plugin, HTML/template/bootstrap и CDN JS/CSS; Apidog/OpenAPI → Go/oapi-codegen и BFF/Orval/Zod, browser → tRPC. Подпись `apidog>generator` обозначает экспортированный OpenAPI snapshot, а не runtime-вызов. Не вводить прямую выдачу HTML из S3, npm-пакет `@my/openapi`, TanStack Router или отсутствующий frontend drift workflow.
- [ ] **2.4. Обновить два раздела Markdown**: краткий вопрос/пояснение, ссылки на соответствующие файлы/строки на зафиксированных SHA, граница реализации и проверенного сценария. Убрать исторические пометки только у этих двух схем. Модульные BFF-схемы и их тесты не править.
- [ ] **2.5. GREEN и PNG:** focused tests + validate/check/warm/render, exit 0; осмотреть `dist/frontend.png`, `dist/contract.png`. Проверить, что браузерный и upstream-контракты не смешаны, кодогенерация не изображена выкладкой, подписи читаемы.
- [ ] **2.6. Обязательные modules/typecheck/test/build и diff-check**, exit 0; commit только Files этой задачи: `docs(architecture): актуализировать frontend и контракты BFF`.

### Task 3: CI, публикация артефактов и CD

**Files:** Modify `diagrams/ci.json`, `diagrams/cd.json`, только разделы `## ci`/`## cd` и общую историческую плашку в `site/architecture/index.md`, `scripts/production-architecture.test.ts`.

**Interfaces:** Consumes helpers Task 1 и источники workflows. Produces последнюю пару актуальных схем и страницу без предупреждения о корневых схемах до BFF; блок Frozen остаётся до Task 4.
В CI закрепить IDs `frontend-ci`, `frontend-release`, `backend-ci`, `backend-image`, `frontend-course-sync`, `backend-course-sync`, `packages-release`, `npm`, `static-upload`, `docs-pages`. В CD — `operator`, `frontend-cd`, `frontend-rollback`, `backend-image`, `backend-cd`, `gateway`, `vps2`, `infra-apply`.

- [ ] **3.1. Добавить RED-тесты** `CI separates checks and publishing` и `CD separates manual frontend from automatic backend`. CI: связи `frontend-ci>frontend-release`, `backend-ci>backend-image`, `packages-release>npm`; присутствуют оба course-sync, static и docs узлы; нет старой группы `fe-drift`. CD: `operator>frontend-cd` с label `workflow_dispatch`, `backend-image>backend-cd`, `backend-cd>vps2` через обозначенный SSH gateway, `frontend-cd>gateway`; отсутствует `frontend-ci>frontend-cd`. Тексты CD поясняют потребление BFF digest и связанных ассетов, выбор существующего выпуска при rollback и отдельные миграции Go. Для отсутствия старых механизмов проверять только два JSON, а не всю историю repo: нет `current.json`, `Argo`, `Coolify`.
- [ ] **3.2. Проверить RED:** focused production tests — новые тесты падают на старой модели выпуска, предыдущие проходят.
- [ ] **3.3. Обновить CI JSON** по реальным workflows: проверки отдельно от публикации; GHCR/S3/npm, frontend/backend course-sync; infra apply и Pages; соседние `frontend-packages` и `static` с правильными владельцами. События PR/push main/manual указывать на соответствующих связях, а не считать любой зелёный CI выкладкой.
- [ ] **3.4. Обновить CD JSON**: ручной frontend CD и rollback, проверка BFF digest/asset SHA и результата; backend main → image → автоматический Ansible CD → приватная VPS2 через gateway → health, при `PRODUCTION_ENABLED=true`; infra Pulumi/Ansible отдельно. Если артефакт передаётся в ручной CD, стрелку подписать «артефакт», не выдавая её за автоматический триггер.
- [ ] **3.5. Обновить два раздела и снять общую историческую плашку**, поскольку актуальны уже все шесть схем. Датированные оговорки об авторизованных сценариях/runtime/backup сохранить. Дать source links для CI/CD; не связывать описание последней выкладки Go с обещанием неизменного main.
- [ ] **3.6. GREEN и PNG:** focused tests + validate/check/warm/render, exit 0; осмотреть `dist/ci.png`, `dist/cd.png`, различимость триггеров и потоков артефактов. Затем modules/typecheck/test/build и diff-check, commit: `docs(architecture): разделить CI и выкладку актуальных релизов`.

### Task 4: удалить k3s, согласовать входы и проверить публикацию

**Files:** Delete `diagrams/frozen-k3s/{deployment,ci,cd,integrations,frontend-monorepo}.json` (пять файлов); Modify `site/.vitepress/diagram-names.ts`, `scripts/build-index.ts`, `scripts/build-index.test.ts`, `scripts/site-base.test.ts`, `scripts/architecture-page.test.ts`, `site/architecture/index.md`, `site/.vitepress/config.mts`, `site/documentation/index.md`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `.agents/skills/eraser-diagrams/SKILL.md`, `.claude/skills/eraser-diagrams/SKILL.md`. В `scripts/eraser.ts` заменить только пример удалённой папки в комментарии, если он остался; runtime-логику не менять.

**Interfaces:** Existing `PAGE_REDIRECTS: readonly {file: string; target: string}[]`, `renderPageRedirect(target: string): string`, `renderRedirect(rootNames: readonly string[]): string`, `diagramTarget(hash: string, rootNames: readonly string[], hiddenFolders: readonly string[]): string | null`. Сигнатуры сохраняются. `HIDDEN_FOLDERS = ['modules/2']`, `LEGACY_FOLDERS = ['bff','frozen-k3s']`, `ROOT_NAMES` без изменений.

- [ ] **4.1. Добавить RED-тесты** `k3s sources are gone`, `k3s redirects preserve base and fragments`. Заменить page test «keeps frozen k3s» требованием отсутствия блока/ссылок Frozen. В build-index test расширить существующий полный expected `PAGE_REDIRECTS` пятью парами из спеки; все старые BFF-записи сохранить. Новые пары:

```ts
const k3s = [
  {file:'frozen-k3s/deployment.html',target:'../deployment.html'},
  {file:'frozen-k3s/ci.html',target:'../ci.html'},
  {file:'frozen-k3s/cd.html',target:'../cd.html'},
  {file:'frozen-k3s/integrations.html',target:'../infra.html'},
  {file:'frozen-k3s/frontend-monorepo.html',target:'../frontend.html'},
];
expect(PAGE_REDIRECTS.filter(r => r.file.startsWith('frozen-k3s/'))).toEqual(k3s);
expect(existsSync('diagrams/frozen-k3s')).toBe(false);
```

В существующем `followRedirect` test прогнать каждую пару под `https://site.invalid/` и `https://site.invalid/branches/architecture-check/`: получить первый переход `renderRedirect(ROOT_NAMES)` для `#frozen-k3s/<имя>`, затем `renderPageRedirect(target)`, разрешить оба через `new URL` и ожидать `<base><корневая схема>.html`. Для прямого старого HTML проверить сохранение `#%D1%86` второй ступенью. В `site-base.test.ts` проверить `diagramTarget` со списком `[...HIDDEN_FOLDERS,...LEGACY_FOLDERS]`: обычный/encoded `#frozen-k3s%2Fci` → `frozen-k3s/ci.html`, неизвестный `#nope` → `architecture/`.

- [ ] **4.2. Запустить RED:** `bun test scripts/build-index.test.ts scripts/site-base.test.ts scripts/architecture-page.test.ts` — новые assertions о папке/редиректах падают, runtime-ошибок импорта нет.
- [ ] **4.3. Удалить пять исходников, добавить пять переадресаций, перенести папку в LEGACY.** Удалить ссылки Frozen со страницы. В `indexNames` не добавлять специальную фильтрацию legacy: он работает по `HIDDEN_FOLDERS`, удалённых исходников больше нет. Обновить его старые synthetic expectations; общие fixtures подкаталогов для renderer/pngSize/label-slack и исторические планы не требуют механической замены слова frozen-k3s.
- [ ] **4.4. Согласовать текущие входы и инструкции:** sidebar «Архитектура»; ссылка из документации описывает текущие схемы; README — шесть актуальных описаний, без Frozen-таблицы и тезиса «одна VPS» для прода, актуальный пример hash-перехода. В AGENTS/CLAUDE убрать правило Frozen, сохранив правила модулей и проверенного прода. Eraser skill править в `.agents/skills/`, выполнить `bun run skills:sync`; AGENTS/CLAUDE синхронизировать вручную, скрипт их не обслуживает. Проверить текущие ссылки поиском `rg`, не редактировать историю/OpenWiki. Нейтральный текст `site/project-context.md` о датах и исторических материалах сохраняет смысл и не требует переписывания.
- [ ] **4.5. GREEN:** повторить focused tests и production tests. Успех: нет Frozen JSON, все пять целей существуют, ROOT_NAMES совпадает с корнем, шесть секций/вставок сохраняются, копии skills совпадают.
- [ ] **4.6. Проверить чистую сборку:** в этом изолированном worktree удалить только свой generated `dist/`, если он существует; исходники и `.openwiki-sources` не трогать. Выполнить `bun run modules:check`, `bun run validate`, `bun run check`, `bun run typecheck`, `bun run test`, `bun run wiki:prepare`, `bun run build` — exit 0. В `dist/frozen-k3s/` ровно пять HTML-переадресаций, нет PNG; в `dist/` есть все шесть пар HTML/PNG. `bun run site:check` не находит битых ссылок/якорей.
- [ ] **4.7. Локальная browser-проверка собранного сайта.** Существующим browser tool или установленным Playwright/Chromium, без новой зависимости, открыть статическую сборку. Проверить четыре комбинации ширины `1440`/`390` и light/dark. Дождаться загрузки каждой lazy iframe после прокрутки к ней; в отчёт сохранить assertions:

```ts
expect(iframeTitles).toEqual(['Схема deployment','Схема ci','Схема cd','Схема frontend','Схема contract','Схема infra']);
expect(failedDiagramRequests).toEqual([]);
expect(documentScrollWidth <= viewportWidth + 1).toBe(true);
expect(pageErrors).toEqual([]);
```

Проверить кликами «Увеличить», «Уменьшить», «Вписать» и pan: transform меняется, reset возвращает вписанный размер. Осмотреть шесть PNG и страницу; screenshots в ignored evidence. Для базы `/` проверить в браузере все пять старых HTML и hash-входов, конечные страницы со схемой возвращают `200`. Вторую базу проверяет следующее действие после push; не считать размещение root-сборки под префиксом полноценной проверкой `SITE_BASE`.
- [ ] **4.8. Commit после проверок:** `git diff --check`, staged diff только Files задачи, commit `docs(architecture): удалить k3s и обновить ссылки раздела`. Не коммитить скриншоты, dist, wiki snapshot или generated OpenWiki.
- [ ] **4.9. Проверить preview после push своей ветки.** Дождаться Pages, найти фактический slug в `/branches/` и сверить SHA превью с текущим commit. В `/branches/<slug>/architecture/` повторить browser assertions 4.7 и все пять старых HTML/hash-переходов: конечный URL остаётся внутри этой базы, диаграмма отвечает `200`. Если hosted preview не построен, записать точную причину и статус pending; для проверки базы локально использовать `bun run site:vitepress` с `SITE_BASE=/branches/architecture-check/` и существующие `bun run index`/`site:check` в том же окружении, сохранив предварительно root `dist/` отдельной копией. Под Docker передавать `SITE_BASE` процессу внутри контейнера, существующий host wrapper не переносит эту переменную автоматически. Root и preview artifacts хранить отдельно; до следующего commit восстановить root-сборку. Такой fallback подтверждает базу, но не успешность hosted preview.
- [ ] **4.10. Итоговое whole-branch review** против спеки и пяти Review Focus, проверка отсутствия реальных адресов/секретов в изменённых публичных файлах; сохранить замечания и их разрешение. Подготовить PR по правилам docs/cdd-tasks с превью и реальными результатами проверок. Этот план не является отдельным разрешением на merge: если разрешение уже получено в сессии именно для этой работы, использовать его; иначе оставить reviewable PR.
- [ ] **4.11. После разрешённого слияния:** дождаться успешных Pages, открыть публичный `/architecture/`, шесть HTML/PNG и пять старых HTML/hash-переходов. Убедиться, что дата/SHA/границы проверки сохранились. Если публикация ещё не разрешена или Pages не завершён, пометить только эту часть приёмки pending, не заявлять новый раздел опубликованным. Отдельное ручное обновление wiki владельцем остаётся отдельной операцией.

## Самопроверка плана

- Покрытие спеки: размещение/свидетельства/ограничения — Task 1; frontend/контракты — Task 2; CI/CD — Task 3; удаление/инструкции/адреса/браузер/Pages — Task 4. Все восемь критериев приёмки имеют владельца.
- Шаги: каждый RED/GREEN, изменение пары схем, изменение разделов, визуальный осмотр и commit имеют наблюдаемый результат; общая подготовка не выделена в фиктивную продуктовую задачу.
- Типы: единственная схема данных — существующий `DiagramDoc`; два test-local helper принадлежат Task 1. Redirect API и списки папок используют текущие имена, новых production exports нет.
- Review Focus: все пять условий привязаны к именованному тесту или точной проверке артефактов/браузера; публичный deploy не подменяется локальной сборкой.
- Пропорция: четыре задачи для шести JSON и удаления; кодовые блоки содержат assertions, а не реализацию renderer/сайта. Координаты и краткие подписи остаются исполнителю.
