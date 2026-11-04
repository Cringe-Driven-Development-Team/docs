# Диаграммы сценариев CSRF — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Добавить семь Eraser-схем к фактическим сценариям CSRF, сохранив точность объяснений и доступность источников для OpenWiki.

**Architecture:** Семь JSON в `diagrams/security/` встраиваются штатным `<Diagram>` после вводного абзаца соответствующего H3. Папка исключается из архитектурного индекса через существующий `HIDDEN_FOLDERS`, но включается в корпус OpenWiki. Рендерер, просмотрщик и тема сайта не меняются.

**Tech Stack:** eraser-diagrams 0.1.0, VitePress/Vue, Bun tests, Docker, установленный Chrome/Puppeteer.

**Spec:** `docs/superpowers/specs/2026-11-04-csrf-scenario-diagrams-design.md` — согласована 04.11.2026.

## Global Constraints

- Схемы: `csrf-client`, `csrf-form`, `csrf-fetch`, `csrf-subdomain`, `csrf-navigation`, `csrf-login`, `csrf-xss`; все в `diagrams/security/`.
- Сохранить семь якорей, таблицы cookie и Content-Type, источники, даты и границы проверки. Текст должен оставаться достаточным для понимания без изображения.
- Существующая Mermaid в разделе «Проверки BFF» остаётся; страница XSS и её Mermaid не меняются.
- Семь схем не дублировать на странице «Архитектура». `ROOT_NAMES` сохраняется. Согласованный тематический каталог расширяет соглашение о размещении, без правок AGENTS.md и скиллов.
- Не меняются приложение, механизмы защиты, планы модуля и конфигурация прода. Генерацию OpenWiki не запускать.
- Цвета, группы, иконки и легенда — существующие соглашения eraser-diagrams. Использовать Node для CLI, Docker для полной сборки; PNG каждого нового/изменённого файла осматривать.
- Временные свидетельства, браузерный скрипт и снимки — в workspace выбранного execution-скилла; не коммитить их. Постоянные тесты проверяют значимые связи/условия, не координаты и литературные формулировки.

## Review Focus

1. CORS: простой GET действительно ушёл, а после отказа OPTIONS основной POST не существует; ни одна стрелка не изображает обратное (Task 2).
2. Поддомен: cross-origin `include` допускает cookie только при выполнении cookie-правил; cookie адресована приложению, не серверу атакующего. Резервные Origin/Fetch Metadata не изображены выполненными после заблокированного preflight (Task 2).
3. Login CSRF и XSS: гипотетическая привязка к аккаунту атакующего отделена от фактического отказа; XSS не требует чтения HttpOnly-cookie и не отменяет авторизацию (Task 3).
4. Внешний GET: гостевая ветвь не обращается в Go; пользовательская может читать блокнот/обновлять токены, без обещания неизменности состояния авторизации (Task 3).
5. Каталог `security` видим wiki, но отсутствует в обзоре архитектуры; вложенная база, lazy iframe и переходы к нижним сценариям не дают пустых схем или потерянных якорей (Tasks 1, 3).

## Карта файлов и общие проверки

- Семь новых `diagrams/security/csrf-*.json` — только данные схем.
- `site/documentation/security/csrf.md` — вставки компонентов; `README.md` — таблица тематических схем и правило каталога.
- `site/.vitepress/diagram-names.ts` — исключение из архитектурного индекса.
- `scripts/openwiki-source-path.ts`, `.openwikiignore`, `openwiki/INSTRUCTIONS.md` — согласованный корпус источников; производные wiki-файлы не меняются.
- `scripts/security-scenario-diagrams.test.ts` — связи и существенные условия новых схем; `scripts/security-pages.test.ts` — соответствие H3/Diagram и сохранение Mermaid.
- `scripts/build-index.test.ts`, `scripts/site-base.test.ts`, `scripts/openwiki-check.test.ts` — каталог, маршруты и граница корпуса.

Каждый task завершается `bun run typecheck`, `bun run modules:check`, `bun run test`, `bun run build`, `git diff --check`: ожидается код 0. Полная сборка включает validate/colors/warm, HTML/PNG, Mermaid и `site:check`. Для промежуточной раскладки: `bun run validate`, `bun run check`, `bun run warm`, `bun run render`, затем осмотр `dist/security/*.png`; после новой правки повторять затронутые проверки.

Допустим прямой Docker-вызов того же образа из `scripts/docker.ts` с его worktree/node_modules/git-common mounts, подготовленными wiki-входами и `PUPPETEER_SKIP_DOWNLOAD=true`. Для вложенной базы передать **в контейнер** `SITE_BASE=/branches/docs-csrf-scenario-diagrams/`; env на хосте без передачи в контейнер недостаточно. Не менять обёртку ради этой задачи. Проверка исходников и рендера схем не является новой продовой пробой.

### Task 1: Тематический каталог и схема запроса своего клиента

**Files:** Create `diagrams/security/csrf-client.json`, `scripts/security-scenario-diagrams.test.ts`. Modify все файлы из карты, кроме отсутствующих пока шести JSON.

**Interfaces:**
- Consumes: `DiagramDoc` из `scripts/diagram.ts`; `indexNames(names: readonly string[]): string[]`, `diagramTarget` из `site/.vitepress/site.ts`; `isWikiSourcePath(path: string): boolean`; компонент `<Diagram name="security/csrf-client" />`.
- Produces: тематическая папка с работающими HTML/PNG; неизменённый контракт `isWikiSourcePath` с включением непосредственных JSON в `diagrams/security/`. В новом test-файле локальные `read(name: string): DiagramDoc`, `nodeText(doc, id): string`, `edgeText(doc, from, to): string`, `pairs(doc): string[]` по образцу `scripts/bff-csrf-diagrams.test.ts`, без нового общего пакета/экспортов.
- Идентификаторы значимых узлов первой схемы: `app-code`, `client`, `trpc-adapter`, `csrf-check`, `session`, `go-api`, `unauthorized`. `session` обозначает проверку сессии/входа/прав; группы и вспомогательные подписи выбирает исполнитель.

- [x] **Шаг 1. Зафиксировать источники.** Прочитать локальные инструкции и eraser-diagrams. На SHA, указанных в CSRF-странице, проверить контекст, роутеры, HTML, cookie и транспорт BFF; tRPC Content-Type/порядок отказов; публичный маршрут infra. Использовать GitHub permalink/исходники выбранного SHA, не планы модуля как доказательство. Записать в `<workspace>/evidence.md` соответствие будущих семи схем фактам, версиям и ограничениям. Expected: все значимые подписи из таблицы спеки имеют источник; изменения версии/непроверенное отмечены, новых атак на проде нет.

- [x] **Шаг 2. Написать RED-тесты каталога и клиента.** Добавить следующие проверки в соответствующие существующие test-файлы; для `checkOpenWiki` использовать имеющуюся fixture/commit, для ignore — `OpenWikiIgnore.parse`:

```ts
expect(indexNames(['ci', 'security/csrf-client', 'modules/2/bff-contract'])).toEqual(['ci']);
expect(diagramTarget('#security/csrf-client', ROOT_NAMES, [...HIDDEN_FOLDERS, ...LEGACY_FOLDERS])).toBe('security/csrf-client.html');
// Импортировать isWikiSourcePath; rules — существующий parser .openwikiignore.
for (const path of ['diagrams/security/csrf-client.json', 'diagrams/security/csrf-xss.json']) {
  expect(isWikiSourcePath(path)).toBe(true);
  expect(rules.ignores(path)).toBe(false);
}
// Отдельными отрицательными проверками: modules/2/*.json, security/readme.md,
// security/nested/example.json исключены из обоих источников выбора.
// fixture: добавление/изменение, затем удаление security/csrf-client.json
// делает fresh=false и включает именно этот путь в changedPaths.
```

В новом test-файле проверить связи клиента `app-code>client`, `client>trpc-adapter`, `trpc-adapter>csrf-check`, `csrf-check>session`, `session>go-api`, `session>unauthorized`; отсутствие прямого `client>go-api`. Терминальный `unauthorized` содержит `401` и не имеет исходящих связей. Существенные условия диаграммы: JSON POST `/api/trpc/notebooks.create`, `X-CSRF: 1`, `same-origin`, Origin/Fetch Metadata, доступная cookie; серверная связь помечена HTTP. Не закреплять весь текст/координаты. В `security-pages.test.ts` снять общий запрет `<Diagram>` только для CSRF; заменить его проверкой компонента после первого абзаца H3 `наш-клиент`, сохранив одну Mermaid на каждой странице и отсутствие Eraser в XSS.

- [x] **Шаг 3. Запустить RED.** `bun test scripts/security-scenario-diagrams.test.ts scripts/security-pages.test.ts scripts/build-index.test.ts scripts/site-base.test.ts scripts/openwiki-check.test.ts`. Expected: отказы именно из-за отсутствия новой схемы/включения каталога, не синтаксиса теста.

- [x] **Шаг 4. Реализовать каталог и первую схему.** Добавить `security` в `HIDDEN_FOLDERS` и уточнить комментарий про тематические папки. Включить только непосредственные `diagrams/security/*.json` в classifier, ignore (разрешить также родительскую папку) и INSTRUCTIONS. Создать схему по спеке с `client` как id браузера, едиными зонами и легендой. Вставить компонент после вводного абзаца сценария, добавить в README описание каталога и первую строку таблицы. Expected: текущий запрос и ветвь `401` объяснимы, не появляется новый раздел архитектуры или генерация wiki.

- [x] **Шаг 5. Проверить GREEN и рендер.** Повторить команду шага 3; выполнить общие проверки выше. Открыть `dist/security/csrf-client.png`: короткие читаемые подписи, место отказа и серверный вызов различимы. Expected: все команды успешны, ROOT_NAMES/старые схемы не изменены. При необходимости поправить раскладку и повторить цикл.

- [x] **Шаг 6. Коммит.** Добавить только перечисленные файлы и согласованный план; `git commit -m 'docs(security): добавить каталог схем и путь запроса клиента'`. Expected: рабочий продукт содержит одну схему нового каталога и достаточную поддержку остальных, без лишних заготовок.

### Task 2: Форма, fetch и захваченный поддомен

**Files:** Create `diagrams/security/csrf-form.json`, `csrf-fetch.json`, `csrf-subdomain.json`. Modify `scripts/security-scenario-diagrams.test.ts`, `scripts/security-pages.test.ts`, `site/documentation/security/csrf.md`, `README.md`.

**Interfaces:** Consumes каталог, локальные test helpers и evidence Task 1. Produces имена `security/csrf-form`, `security/csrf-fetch`, `security/csrf-subdomain` в H3 `чужая-форма`, `чужой-fetch`, `захваченный-поддомен`.

- [ ] **Шаг 1. Написать RED-тесты развилок.** В новом test-файле добавить три теста с ожидаемыми значимыми связями:

```ts
// form: client>trpc-adapter; trpc-adapter>form-415;
// trpc-adapter>csrf-check; csrf-check>csrf-403.
// fetch: client>csrf-check; csrf-check>simple-403;
// client>preflight-response; preflight-response>browser-blocked.
// subdomain: attack-code>client; client>trpc-adapter;
// trpc-adapter>form-415; trpc-adapter>csrf-check; csrf-check>csrf-403;
// client>preflight-response; preflight-response>browser-blocked.
for (const name of ['form', 'fetch', 'subdomain']) {
  expect(read(name).entities.some(node => node.id === 'go-api')).toBe(false);
}
// Терминалы form-415/csrf-403/simple-403/browser-blocked не имеют исходящих связей.
```

Проверить существенные значения: форма разделяет `application/x-www-form-urlencoded`/`text/plain` и `multipart/form-data`; простой fetch — GET `/api/trpc/users.me` с `403`, ответ недоступен чужому JS; preflight — OPTIONS без cookie и отсутствие основного запроса. Поддомен содержит `same-site`, другой origin и условие `include`; cookie адресована приложению. Резервная проверка Origin/Sec-Fetch-Site — отдельная подпись `fallback-policy` без соединения из `browser-blocked`. Для трёх H3 проверить соответствующий `<Diagram>` между вводным и следующим абзацами. Expected: тесты фиксируют именно Review Focus 1–2 и связь схем с разделами.

- [ ] **Шаг 2. Запустить RED.** `bun test scripts/security-scenario-diagrams.test.ts scripts/security-pages.test.ts`. Expected: недостающие три схемы/компонента, существующие проверки Task 1 проходят.

- [ ] **Шаг 3. Создать три схемы и вставки.** Использовать сценарии и evidence; исходник модуля `bff-csrf-foreign.json` служит ориентиром, а не копируется целиком трижды. Отделить две дорожки fetch; в поддомене не рисовать состоявшийся основной POST после отказа preflight. У формы и простого запроса подписать отсутствие cookie на cross-site; у поддомена — условия same-site/credentials. Добавить три строки README. Expected: статья сохраняет объяснения и таблицу, схема каждого H3 раскрывает только его сценарий.

- [ ] **Шаг 4. GREEN, рендер, осмотр.** Повторить тесты шага 2 и общие проверки. Осмотреть три PNG в `dist/security/`; пройти пальцем путь простого запроса и preflight, затем путь формы с поддомена. Expected: нет ложного вызова Go, ложной передачи cookie поддомену или неоднозначного места отказа; линии не закрывают подписи. Исправления раскладки — с повторным рендером и осмотром.

- [ ] **Шаг 5. Коммит.** `git add` только четыре перечисленных изменённых файла и три JSON; `git commit -m 'docs(security): показать отказы формы fetch и поддомена'`. Expected: четыре сценария со схемами, остальные три текстовых сценария сохранены.

### Task 3: Навигация, login CSRF, XSS и браузерная приёмка

**Files:** Create `diagrams/security/csrf-navigation.json`, `csrf-login.json`, `csrf-xss.json`. Modify `scripts/security-scenario-diagrams.test.ts`, `scripts/security-pages.test.ts`, `site/documentation/security/csrf.md`, `README.md`. Temporary `<workspace>/csrf-diagrams.browser.ts`, screenshots/logs.

**Interfaces:** Consumes четыре схемы/каталог и test helpers Tasks 1–2. Produces все семь `<Diagram>` на прежних якорях; iframe и footer-ссылки `/<base>/security/csrf-*.{html,png}` через штатный `withBase`.

- [ ] **Шаг 1. Написать RED-тесты оставшихся сценариев.** Навигация: связи `client>caddy`, `caddy>html-handler`, `html-handler>session`, `session>go-api`, `session>guest`, возвращение результата к HTML/браузеру; запрет `guest>go-api`. Условия: top-level GET, доступная Lax-cookie, `refresh`, пользователь и возможный `notebook` в bootstrap; нет ограничения bootstrap только пользователем. Login: реальные форма/preflight имеют те же терминальные отказы, что Task 2, пути к Go нет. Изолированный `unprotected-case` описывает цель «сессия атакующего» с явной гипотезой; никакие связи не смешивают его с фактическими терминалами. В XSS: `attack-code>client>trpc-adapter>csrf-check>session>go-api`, отдельный `session>unauthorized`, ответ Go возвращается браузеру/скрипту; HttpOnly запрещает чтение cookie, а не сам запрос, auth gate сохраняется. Проверить в статье ровно семь Eraser в соответствующих H3 и сохранение одной Mermaid. Expected: Review Focus 3–4 покрыт структурой и важными условиями, не снимком всего текста.

- [ ] **Шаг 2. Запустить RED.** `bun test scripts/security-scenario-diagrams.test.ts scripts/security-pages.test.ts`. Expected: отсутствуют последние три схемы; существующие четыре и проверки корпуса проходят.

- [ ] **Шаг 3. Создать схемы и завершить страницу/README.** Схема навигации адаптирует идею модульной, но отражает актуальный bootstrap и различие обновления токенов/предметных данных. Для login гипотеза — отдельный компактный текстовый блок, не дополнительные псевдозоны инфраструктуры. Для XSS обозначить предположение об уже исполняющемся JS; не изображать доказанную уязвимость приложения. Вставить три компонента после вводных абзацев. Expected: все семь соответствуют таблице согласованной спеки; старые модульные JSON побайтово сохранены.

- [ ] **Шаг 4. GREEN и визуальный осмотр.** Повторить тесты шага 2 и общие проверки. Открыть последние три PNG и сравнить все семь по именам участников и направлению связей. Expected: ни одна подпись/стрелка не противоречит тексту, легенды соответствуют существующим цветам, нет неосмотренных финальных рендеров.

- [ ] **Шаг 5. Браузер корня.** Создать временный Puppeteer-скрипт по серверу/наблюдателю из `scripts/check-readability.ts`, без правок общего CLI. Запуск: `CHROMIUM_PATH=/usr/bin/google-chrome SITE_BASE=/ bun <workspace>/csrf-diagrams.browser.ts`. На 1440 и 390 px в светлой/тёмной темах: прямой переход и переход внутри SPA к семи H3; прокрутка ко всем lazy iframe с ожиданием загрузки сцены; отсутствие pageerror/HTTP404/ошибок Mermaid с document-start, общее scrollWidth ≤ viewport. Проверить HTML и PNG всех семи схем, доступность масштабирования/перемещения/выхода из fullscreen, возврат на страницу. Сохранить и осмотреть снимки каждого сценария на desktop и mobile. Expected: текст/таблицы доступны, семь схем загружены, якорь не скрыт шапкой и не уехал после lazy загрузки, все footer URL ведут к нужным артефактам.

- [ ] **Шаг 6. Браузер вложенной базы.** Полная сборка с `SITE_BASE=/branches/docs-csrf-scenario-diagrams/` внутри контейнера; тот же временный скрипт с таким `SITE_BASE`. Повторить матрицу шага 5, включая прямые iframe/footer URL и Back/SPA. Expected: не происходит выхода на корень сайта, нет пустых схем, ошибок/переполнения. Сохранить артефакты с другим префиксом; остановить собственный сервер/браузер в finally. Весь посторонний browser suite не повторять.

- [ ] **Шаг 7. Финальная сверка корпуса и изменений.** `bun run typecheck`, `bun run modules:check`, `bun run test`, `git diff --check`; проверить `git diff --name-only` и соответствие семи JSON/компонентов. Expected: только файлы карты/план/спека; `ROOT_NAMES`, исходники модуля, XSS/CSP и производная wiki не менялись; тесты включения/исключения и stale проходят. Зафиксировать команды/результаты и осмотренные PNG в журнале исполнения.

- [ ] **Шаг 8. Коммит и ревью.** `git add` семь файлов этого task (три JSON, два теста, страница и README); `git commit -m 'docs(security): визуализировать навигацию login CSRF и XSS'`. Expected: согласованный результат полностью в коммитах. Далее выполнить завершение задач, независимые ревью и завершение ветки по выбранному execution-скиллу; не пропускать per-task review, если выбран SDD.

## Самопроверка плана

Охват спеки: семь схем — Tasks 1–3; размещение/корпус — Task 1; неизменность текста и Mermaid — тесты страницы во всех задачах; PNG и browser root/base — Task 3; источники — evidence Task 1 с уточнениями при последующих схемах. Общие интерфейсы используют существующие типы и компоненты. Пять Review Focus привязаны к тестам и браузерной приёмке. Новые библиотеки, runtime приложения и генерация wiki не требуются.
