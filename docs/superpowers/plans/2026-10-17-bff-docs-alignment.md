# Актуализация документации BFF — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Согласовать сайт и две схемы с официальным tRPC в MVP, собственными клиентом/сервером в модуле №3 и уточнёнными ТЗ BFF.

**Architecture:** Три последовательные задачи: контракт и данные модулей; объяснения безопасности/выпуска и обрезка Mermaid; две Eraser-схемы. Существующие адреса и политики сохраняются. Проверки документации актуализируются вместе с содержимым, продуктовый код не пишется.

**Tech Stack:** VitePress, module-graph, Markdown/YAML, TypeScript/Bun test, eraser-diagrams JSON, Chrome.

**Spec:** `docs/superpowers/specs/2026-10-17-bff-docs-alignment-design.md` (binding authority).

## Global Constraints

- Модуль №2 использует официальные `@trpc/server`, `@trpc/client` и `zod`.
- В модуле №3 пишутся **собственные клиент и сервер tRPC**, а не только клиент; свой Zod и свой React Hook Form уже относятся к этому модулю.
- Новые автотесты приложения в MVP не требуются: показанные примеры тестов клиента надо убрать.
- MVP выпускается с коротким окном недоступности; канарейка — отдельный следующий этап.
- Это работа в репозитории `docs`. Она описывает будущую реализацию BFF и не объявляет её работающим продом.
- Сохранить существующий адрес `/modules/2/tracks/trpc-client`, id `trpc-client`, `part_of: bff` и владельца `iRedTea`.
- Issue #46 остаётся во втором модуле и не переносится в новый трек. Новые issue не создаются.
- Старые спеки/планы не переписываются. Не меняются GitHub-назначения/поля/связи задач, root/frozen-схемы и `/security/csrf/`.
- Не менять политику cookie или три уже опубликованных CSRF-подраздела/схемы.
- Упаковка образа — отдельный шаг после обеих сборок, вне `build` пакета BFF.
- Общую логику масштаба/панорамирования Eraser-просмотрщика не менять.
- Локальный сервер для чтения пользователя не останавливается (существующий PID 3607, порт 4173).

## Review Focus

1. «Свой tRPC» может ошибочно остаться во втором модуле или оказаться только клиентом в третьем — Task 1 закрепляет модуль, обе части, официальные импорты и отсутствие переноса #46.
2. Читатель может принять Hono-ручку или генерацию SDK за добавление tRPC-процедуры — Task 1 закрепляет флоу, общий адаптер и вывод `AppRouter`.
3. Объяснение SameSite может обещать гость/авторизацию без учёта инициатора либо ослабить CSRF — Task 2 закрепляет Strict/Lax и сохраняет правила/якоря.
4. Читатель может принять reload Caddy за готовую канарейку или принять mTLS за уже внедрённый — Task 2 закрепляет MVP/будущий этап, ограничения refresh и взаимные сертификаты.
5. Исправление подписи или npm-блока может потерять содержимое на рендере — Task 3 закрепляет связи/группы, оба исполнителя смотрят сборку/изображения, контроллер проверяет страницу браузером.

---

## Карта файлов

| Ответственность | Файлы |
| --- | --- |
| Task 1: контракт, официальный клиент, модуль №3 | `site/modules/2/tracks/bff.md`, `bff/contract.md`, `trpc-client.md`; `site/modules/3/tracks/trpc.md` (новый), `zod.md`; `scripts/bff-pages.test.ts`, `modules-data.test.ts` |
| Task 2: безопасность, выпуск, Mermaid | `site/modules/2/tracks/bff.md`, `bff/auth.md`, `bff/service.md`, `bff/bootstrap.md`; `scripts/bff-pages.test.ts`; `site/.vitepress/theme/custom.css` только при подтверждённой причине обрезки |
| Task 3: Eraser и таблица | `diagrams/modules/2/frontend-monorepo.json`, `bff-contract.json`; `scripts/frontend-monorepo-diagram.test.ts`, `bff-contract-diagram.test.ts`; `README.md` |

Общие файлы меняются последовательно. При правке `bff-pages.test.ts` сохранять проверки другой задачи и корректность старых якорей. Чужие правки не откатывать.

### Task 1: Официальный tRPC и новый трек собственных клиента/сервера

**Files:** все семь путей Task 1 из карты.

**Interfaces:**
- Consumes: spec §4/5; действующие module-graph и `section`/`subsection` в тестах.
- Produces: URL `/modules/3/tracks/trpc`, title «Свой tRPC: клиент и сервер», label «tRPC», `area: front`, `do: { iRedTea: front }`, `mentors: [YarikMix]`, `related` на `zod` с объяснением. `part_of` отсутствует.
- Produces: раздел `## Как добавить процедуру` в contract после `## Роутер`; остальные существующие заголовки сохраняются.
- Produces: прежний `trpc-client` модуля №2 с `part_of: bff`, прежним do, label «tRPC (client)», новым title про официальный клиент и без старого related front-libs. Ссылки на #46 и новый трек.
- Main BFF Task 1 меняет вводный текст, официальный клиент/модули и карту задач; «Переключение», «Две VPS» и Mermaid принадлежат Task 2.

- [ ] **Step 1: Актуализировать тесты контракта и модулей.**

Заменить старый тест «клиент tRPC — пакет @cdd-team/trpc-client…» и добавить именованные проверки:
- `MVP uses official tRPC`: contract содержит `@trpc/client`, `createTRPCClient<AppRouter>`, `httpBatchLink`, `maxURLLength: 2000`, `TRPCClientError`, `X-CSRF: 1`, `same-origin`; нет старого import/createClient и двух `test(` примеров/требования писать тесты.
- `procedure flow uses AppRouter without SDK generation`: новый раздел находится между «Роутер» и «Процедуры экранов», содержит согласование входа/результата/ошибок, общий Hono-адаптер, Orval при изменении Go и вывод типов без кодогенерации клиента; пример согласует серверную процедуру и вызов.
- В main BFF/подтреке нет требования делать собственный клиент во втором модуле, но есть ссылки на модуль №3. Новые якорные ссылки получают проверки реальной цели.
- В modules-data третий модуль содержит `react-hook-form`, `trpc`, `zod`; проверить точные do/mentors/title/related нового трека и обе части его текста. Второй модуль сохраняет trpc-client/part_of/do, без old related. #46 не появляется в данных нового трека.

Assertions опираются на семантические короткие фрагменты и разобранные данные; целые абзацы и координаты не копировать. Остальные тесты сессии/CSRF сохраняются.

- [ ] **Step 2: RED.** `bun test scripts/bff-pages.test.ts scripts/modules-data.test.ts` должен упасть из-за старого клиента/отсутствующего трека. Сохранить лог и причины.
- [ ] **Step 3: Переписать пять страниц по spec §4/5.** Официальный клиент настраивается один раз; ошибки читаются из `data`. Сохранить ручные формы до своего Zod. Дать шесть шагов процедуры и короткий пример существующей операции; будущий views.notebook не выдавать за готовый. Новый трек описывает клиент, сервер и интеграцию без выдуманных версий/полного API будущей библиотеки. Добавить последовательность #44 → #45 → #2 → #46 → #5 → #4 и границы ответственности.
- [ ] **Step 4: GREEN и интеграционная проверка.** Целевой тест, `bun run modules:check`, `bun run typecheck`, `bun run test`; затем native build с Chrome Beta. Ожидается 0 failures, третий трек модуля №3 появляется в собранном меню, новая страница и ссылки существуют. Сохранить логи.
- [ ] **Step 5: Self-review по spec и коммит.** Проверить именно все требования §4/5, `git diff --check`, затем commit `docs(bff): согласованы официальный tRPC и треки модулей`. Только ownership-файлы; push не выполнять.

### Task 2: SameSite, S2S, выпуск и читаемая Mermaid

**Files:** пять обязательных путей Task 2 из карты; CSS — условный, с evidence причины.

**Interfaces:**
- Consumes: официальный MVP/будущий свой tRPC и карта задач Task 1, неизменные URL страниц.
- Produces: сохранённые «Было и стало», «Переключение», «Две VPS», «Ограничения» и все старые заголовки auth/bootstrap/service; короткая подпись BFF → Go и текст с полным адресом рядом.
- Produces: понятные объяснения spec §6/7, без изменения криптографии, CSRF, bootstrap и выпуска.
- Task 1 части `bff.md` сохраняются. Эту задачу не расширять до новой системы канарейки или готовой инфраструктурной задачи.

- [ ] **Step 1: Дополнить тесты bff-pages.**

Добавить именованные проверки:
- `SameSite explains direct and external navigation`: таблица/текст в auth различают прямой ввод/закладку и GitHub; Strict не отправляет cookie первоначально, Lax отправляет; cookie не удаляется; последующий запрос возможен, у нас нет стартового users.me; запрет предметных изменений GET/logout остаётся.
- `S2S is readable and mTLS is future`: отдельные смысловые подпункты описывают ключ, проверку до Bearer, s2s_forbidden/502/503, сохранение сессии, ротацию; mTLS объясняет сертификаты обеих сторон/шифрование и не объявлен требованием MVP. Точные существующие статусы и коды сохраняются.
- `MVP release differs from future canary`: явно есть один экземпляр, короткое окно, health/liveness, graceful shutdown/конечный срок, совместный SHA/CDN/rollback; для будущей канарейки — стабильный сегмент HTML/RPC, совместимость cookie/API/открытых вкладок, shared refresh/совместимость БД. In-memory single-flight не назван межпроцессным.
- `migration arrow label is short`: строка Mermaid P → A не содержит длинного буквального адреса Go; `GO_API_URL` и `Authorization: Bearer` раскрыты подписью/соседним текстом.

Содержательные checks охватывают все пять страниц. Не проверять точные переносы каждой строки, не дублировать существующие CSRF-тесты.

- [ ] **Step 2: RED.** `bun test scripts/bff-pages.test.ts` — ожидаемые провалы новых объяснений/старой подписи; лог.
- [ ] **Step 3: Переформатировать страницы по spec §6/7/8.** Strict/Lax объяснить в auth, в bootstrap дать короткое пояснение/ссылку. S2S — короткие подпункты без потери поведения. ProxyJump/SSH/firewall — части переноса Go/Postgres на VPS2; задачи ещё требуют оформления. Выпуск — последовательность с ручным откатом и отдельным будущим этапом канарейки. Не ссылаться на несуществующие issue. Сократить Mermaid.
- [ ] **Step 4: GREEN, сборка, проверка обрезки.** Целевые/full tests, modules/typecheck/native build. При необходимости временный preview только на 4174 (не занимать/останавливать 4173). Через свой Chrome tab проверить фактический Mermaid и отсутствие обрезки. CSS менять только при подтверждённой причине; если изменён, проверить остальные Mermaid и указать evidence. Свою вкладку закрыть, сервер 4174 при передаче контроллеру указать с PID/логом. Контроллер может продолжить smoke.
- [ ] **Step 5: Self-review и commit.** Проверить сохранность трёх CSRF-подразделов, семи сценариев сессии, политики bootstrap/cookie и Task 1; `git diff --check`. Commit `docs(bff): объяснены SameSite S2S и этапы выпуска`. Только ownership-файлы, без push.

### Task 3: Официальные пакеты на двух Eraser-схемах

**Files:** пять путей Task 3 из карты.

**Interfaces:**
- Consumes: официальные пакеты/модули Task 1; политики/выпуск Task 2.
- Produces: прежние имена diagrams `modules/2/frontend-monorepo`, `modules/2/bff-contract`, существующие семантические связи и адреса HTML/PNG.
- Monorepo: `npm` — командные react/zustand; удалить `pkg-trpc-client` и `t-test`. Добавить отдельную green-группу `official-npm` и понятные узлы/выноску официальных `@trpc/client`, `@trpc/server`, `zod`; связи отражают потребителей, не новый codegen. Конкретную компоновку/иконки выбрать по PNG, координаты не фиксировать.
- BFF contract: подписи клиентского tRPC/серверного роутера явно официальные для модуля №2; прежняя генерация, общий Go-клиент и local HTML template сохраняются.

- [ ] **Step 1: Обновить structural tests двух схем.**

В monorepo проверить отсутствие двух удалённых узлов, две отдельные npm-группы, react/zustand под командным scope, официальные названия под official-npm, клиентские и серверные зависимости. Сохранить type-only AppRouter/BootstrapData, три workspace, ^build, две сборки/артефакта и упаковку; не фиксировать coords/иконки. В contract проверить официальные подписи конкретных runtime-узлов и неизменность путей Orval → Go-client/schemas → runtime. Никакого генератора SDK фронта.

- [ ] **Step 2: RED.** `bun test scripts/frontend-monorepo-diagram.test.ts scripts/bff-contract-diagram.test.ts` — старые узлы/подписи должны вызвать failure; лог.
- [ ] **Step 3: Править JSON и README.** Прочитать eraser-diagrams skill. Сохранить owner-color convention/legend и формат, убрать неоднозначность командных/официальных пакетов. Не трогать root/frozen/CSRF/bootstrap JSON. В README уточнить описания двух изменённых схем; новых имён в ROOT_NAMES не добавлять.
- [ ] **Step 4: GREEN и цикл Eraser.** Целевые tests → validate → check → warm/render → view_image обоих PNG; исправления повторяют цикл. Затем modules/typecheck/full test/native build, `git diff --check`. Сохранить evidence читаемости и артефактов.
- [ ] **Step 5: Self-review и commit.** Сверить spec §8/9 и страницы, commit `docs(bff): обновлены схемы официальных зависимостей`. Только ownership-файлы, без push.

## Доставка контроллером

Native проверки: `DIAGRAMS_NATIVE=1 CHROMIUM_PATH="/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta" bun run build` (Chrome вне sandbox). Зависимости и icons cache уже подготовлены; baseline спеки проверен, 228 уникальных tests прошли с отдельным артефактным прогоном после сборки. Известное Vite chunk-size warning записать в evidence, не скрывать.

После task reviews — whole-branch review от merge base `fbfd73b4bd8e9bb9ed3b1b6b4e2b59110280ca2e` по полной spec, browser smoke меню/страниц/Mermaid/двух схем/консоли и ссылок. Проверить scoped ссылки/плановый статус, старые якоря и отсутствие новых product-test требований. При необходимости переиспользовать свой 4174, пользовательский 4173 оставить работающим.

Пользователь явно разрешил план → SDD → commits → push → ready PR, не ждать его. Push в `docs/bff-docs-alignment`; новый PR в main с разделами «Что», «Решения», «Проверка», ссылка на preview `https://docs.cellestial.ru/branches/docs-bff-docs-alignment/modules/2/tracks/bff`. Не мержить. Проверить CI и фактически опубликованное preview (Pages dispatch лишь запускает отдельный main run). Worktree/SDD workspace не удалять: пользователь запрещает удаление рабочих папок. Production-ссылки в финале ясно помечаются «после мержа».
