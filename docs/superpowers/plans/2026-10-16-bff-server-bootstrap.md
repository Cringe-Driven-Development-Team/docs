# Серверный bootstrap BFF — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить в документацию трека BFF согласованный bootstrap пользователя и согласовать с ним страницы, схемы и проверки.

**Architecture:** BFF подготавливает HTML с `{ user }` через Bun HTMLRewriter и serialize-javascript;
HTML и серверный бандл выпускаются одним образом, ассеты — через S3/CDN. В этой задаче реализуется
документация целевого состояния модуля №2; продуктовый код остаётся задачей студентов.

**Tech Stack:** VitePress, Markdown/Mermaid, eraser-diagrams JSON, Bun и bun:test; описываемый стек —
Hono, tRPC, Orval, Bun workspaces, Turborepo, Vite, Bun build, HTMLRewriter, serialize-javascript.

**Spec:** [2026-10-16-bff-server-bootstrap-design.md](../specs/2026-10-16-bff-server-bootstrap-design.md)

## Global Constraints

- В bootstrap входит только пользователь. Список блокнотов, ячейки, состояние рантайма и остальные данные клиент получает через tRPC.
- Форма данных — `BootstrapData` с единственным полем `user`: DTO текущего пользователя или `null`.
- Тип пользователя совпадает с результатом процедуры `users.me`; отдельная ручная копия модели пользователя не создаётся.
- В JSON нет access/refresh-токенов, сроков токенов, зашифрованной сессии, ключей или служебных ответов Go.
- Одновременные HTML- и RPC-запросы участвуют в одном механизме refresh.
- Если refresh уже успешно завершился, новые токены сохраняются в новой cookie даже на этом ответе: оставлять отозванный старый refresh нельзя.
- Все HTML-ответы bootstrap, включая гостевые, и ответы 503 получают `Cache-Control: private, no-store`.
- Cookie сессии сохраняет имя `__Host-Http-session`, `HttpOnly`, `Secure`, `Path=/`, отсутствие `Domain`, AES-256-GCM и срок по refresh; меняется только `SameSite`: `Strict` → `Lax`.
- Внешний GET страницы допускается без `X-CSRF` и с `Sec-Fetch-Site: cross-site`.
- Упаковка образа — отдельный шаг после обеих сборок. Она не входит в `build` пакета BFF.
- Новая подстраница — `site/modules/2/tracks/bff/bootstrap.md`, `title: Серверный bootstrap`.
- В треке: `pages: [contract, auth, service, bootstrap]`.
- Корневые схемы, описание нынешнего CSRF и `frozen-k3s` не меняются: они описывают прод или историю.
- Продуктовый код, GitHub issues, исполнители, статусы и доска не меняются. Push и готовый к ревью PR пользователь отдельно разрешил после проверок; merge выполняет пользователь.

## Review Focus

1. Refresh успешен, затем запрос пользователя упал: HTML 503 сохраняет именно обновлённую cookie — сценарий и документальный контракт в Task 1.
2. Внешняя навигация и API имеют разные проверки: Lax позволяет HTML GET, но не убирает `X-CSRF`, `Origin` и Fetch Metadata у RPC — проверка сценария и cookie в Task 1.
3. JSON с закрывающим script не становится разметкой: описаны `isJSON: true`, `setInnerContent(..., { html: true })` и разбор `textContent`, а не HTML-экранирование JSON — проверка контракта страницы в Task 1.
4. Удалённая подстраница/битый якорь или повторный bootstrap блок: меню содержит новую страницу, ссылки ведут на заголовки, отказ запуска не маскируется гостем — структурные тесты и сборка в Task 1.
5. Типовой импорт ошибочно изображён как runtime-код или упаковка создаёт цикл: HTML является артефактом сборки, оба build предшествуют упаковке, AppRouter и BootstrapData — только типы — JSON-связи и PNG в Task 2.

## Файлы и ответственность

| Файлы | Ответственность |
| --- | --- |
| `site/modules/2/tracks/bff/bootstrap.md` | Самодостаточный проект HTML bootstrap: контракт, поток, ошибки, инструменты, запуск, разработка, выпуск, приёмка |
| `site/modules/2/tracks/bff.md` | Связь подстраниц, обзор HTML/tRPC, клиентский старт, cookie и переключение |
| `site/modules/2/tracks/bff/{contract,auth,service}.md` | Соответственно типы, общая сессия/CSRF и каркас/образ/маршрутизация |
| `scripts/bff-pages.test.ts`, `scripts/modules-data.test.ts` | Состав страниц, согласованность решений и существование ссылок/заголовков |
| `diagrams/modules/2/{bff-contract,frontend-monorepo}.json` | Только схема плана: HTML bootstrap, типовой контракт и упаковка результатов сборки |
| `scripts/{bff-contract-diagram,frontend-monorepo-diagram}.test.ts` | Существенные узлы и связи обновлённых схем |
| `README.md` | Описания двух существующих схем в таблице |

## Выполнение и завершение

Рабочая копия: `.claude/worktrees/bff-server-bootstrap`, ветка `docs/bff-server-bootstrap`.
Пользователь поручил после составления плана сразу выполнить его через SDD, коммитить, пушить
и открыть PR, не дожидаясь его возвращения. Повторное согласование плана пропускается по этой инструкции.

Каждая задача исполняется отдельным субагентом последовательно, затем проверяется отдельным ревьюером.
После обеих задач контроллер проводит итоговое ревью относительно спеки и всей ветки, прогоняет
`bun run modules:check`, `bun run typecheck`, `bun run test`, полную сборку и смотрит собранный сайт.
После push проверяет PR/CI и точный адрес превью ветки; описание PR — «Что», «Решения», «Проверка».
PR в `Cringe-Driven-Development-Team/docs` создаётся сразу готовым к ревью, без Draft.
Worktree и служебные файлы не удаляются: правила пользователя запрещают `rm -rf` и оставляют удаление ему.

Окружение уже подготовлено: установлены зависимости, кеш иконок и собранный `dist/`.
Нативная сборка: `DIAGRAMS_NATIVE=1 CHROMIUM_PATH="/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta" bun run build`.
Для запуска Chrome в этом окружении требуется разрешение инструмента на выполнение вне песочницы;
успешная полная сборка уже подтверждена на исходной спеке. Не менять скрипты из-за ограничения песочницы.

---

### Task 1: Страница bootstrap и согласованная документация BFF

**Files:**
- Create: `site/modules/2/tracks/bff/bootstrap.md`.
- Modify: `site/modules/2/tracks/bff.md`.
- Modify: `site/modules/2/tracks/bff/contract.md`.
- Modify: `site/modules/2/tracks/bff/auth.md`.
- Modify: `site/modules/2/tracks/bff/service.md`.
- Test: `scripts/bff-pages.test.ts`, `scripts/modules-data.test.ts`.

**Interfaces:**
- Consumes: спека `docs/superpowers/specs/2026-10-16-bff-server-bootstrap-design.md` целиком; существующие разделы BFF и ссылки на них.
- Produces: `/modules/2/tracks/bff/bootstrap`, `BootstrapData = { user: CurrentUser | null }`, script `id="bootstrap"`, `type="application/json"`; согласованное описание Lax, HTML 503, общей сессии и общего образа. `CurrentUser` означает тип результата `users.me`, не новую независимую DTO-модель.
- Produces: список `pages: [contract, auth, service, bootstrap]`; существующие заголовки/адреса соседних страниц сохраняются.
- Scope: только перечисленные документы и их проверки. Диаграммы и README принадлежат Task 2.

- [ ] **Step 1: Обновить структурные тесты страницы и меню, закрепляющие новый контракт.**

В `modules-data.test.ts` существующее ожидание заголовков BFF получает четвёртый элемент
`Серверный bootstrap`; числа треков и нагрузка не меняются. В `bff-pages.test.ts` добавить
`BOOTSTRAP` и включить новую страницу в подходящие проверки без секретов/старых адресов;
SERVICE по-прежнему отдельно из-за допустимого loopback в healthcheck.
Новые проверки читают документы через существующие `section`/`subsection`, не запускают
продуктовые примеры. Основные утверждения:

```ts
expect(track).toContain('pages: [contract, auth, service, bootstrap]');
expect(bootstrap).toContain('title: Серверный bootstrap');
expect(bootstrap).toContain('<script id="bootstrap" type="application/json"></script>');
for (const value of ['HTMLRewriter', 'serialize-javascript', 'isJSON: true', 'html: true', 'textContent', 'JSON.parse']) {
  expect(bootstrap, value).toContain(value);
}
expect(section(auth, 'Cookie сессии')).toContain('| `SameSite` | `Lax` |');
expect(section(contract, 'Роутер')).toContain('users.me');
```

Добавить проверки разделов bootstrap: ошибки различают гостя/503 и сохранение новой cookie
после refresh; кеширование распространяется на гостевой HTML; повреждённый bootstrap — ошибка запуска;
публикация ассетов предшествует выкладке образа. Ожидания привязывать к смысловым разделам,
не закреплять каждый абзац и количество слов. Для каждого нового внутреннего якоря добавить
пару «ссылка присутствует / целевой заголовок существует», как в существующем тесте service.
Существующие ожидания о трёх подстраницах и tRPC-only входе в Go обновить на новый контракт.

- [ ] **Step 2: Выполнить RED.**

Run: `bun test scripts/bff-pages.test.ts scripts/modules-data.test.ts`.
Expected: падение на отсутствующей четвёртой странице/старом Strict; сохранить точные команды и
существенный вывод в отчёте задачи. Отсутствие зависимостей не считается RED.

- [ ] **Step 3: Написать страницу `bootstrap.md` как проект реализации для студентов.**

Разделы `##`: «Контракт», «HTML-запрос», «Вставка данных», «Старт клиента», «Ошибки»,
«Кеширование», «Разработка», «Выпуск и откат», «Проверка».
Все решения и крайние случаи из §4–8, §10 спеки распределить по этим разделам.
Особенно: общий слой refresh без внутреннего HTTP-вызова tRPC; cookie до отправки HTML;
обновлённая cookie даже при последующем 503; конечный таймаут общего клиента Go; отдельные
пути API/public/health/HTML; HEAD без тела; same-origin dev с Vite и HTTPS; исключение HTML из PWA-кеша.
Примеры TypeScript — короткие и самосогласованные, с явным статусом примера. Если показывается
реализация преобразователя, он использует готовый Bun HTMLRewriter, serialize-javascript только
на сервере и проверенный единственный slot; не вводить недоопределённые функции вместо описания.
Клиентский пример использует только JSON.parse и свой стор, не добавляет внешних runtime-библиотек.
Сценарии приложения помечаются «Проект: проверить после внедрения»; не выдавать их за выполненные тесты.

- [ ] **Step 4: Согласовать четыре существующих страницы.**

`bff.md`: дополнить вступление/`pages`, импорт BootstrapData, поток HTML в «Было и стало»,
Lax, старт из HTML, единый выпуск и переключение без отдельного promote клиента.
`contract.md`: в «Источниках правды» описать второй контракт BootstrapData; в разделе о допустимых
вызовах Go учесть HTML-хендлер со строго заданным users/me, не только процедуры. Девять RPC,
Orval и таблица RPC-ошибок сохраняются; users.me остаётся для явного обновления.
`auth.md`: общую сессию вынести концептуально из tRPC-транспорта, сохранить CSRF первым для RPC,
обновить Lax и все относящиеся к нему сценарии, включая внешний переход и первый вход. Цитата RFC
про SHOULD Strict может остаться с объяснением принятого отступления. SSE/WebSocket не перерабатывать.
`service.md`: добавить HTML-маршрут и проверку шаблона в каркасе, обработку HTML 503, описание
серверного бандла и копирования HTML при отдельной упаковке; контекст Docker — корень монорепы.
В Caddy `/health` остаётся внутренним; API и public не поглощаются SPA fallback. Старые якоря сохранить.

- [ ] **Step 5: Проверить GREEN и собранные страницы.**

Run: `bun test scripts/bff-pages.test.ts scripts/modules-data.test.ts` → 0 failures.
Run: `bun run modules:check` → 2 модуля, 40 треков.
Run: `bun run typecheck && bun run test` → 0 failures.
Run: `DIAGRAMS_NATIVE=1 CHROMIUM_PATH="/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta" bun run build` → `site ok`.
Проверить собранный `dist/modules/2/tracks/bff/bootstrap.html`: есть не только карточка,
но и основной текст, примеры JSON/script не исчезли, меню содержит четвёртую подстраницу.
Ссылки/якоря проверяет site:check. В отчёт включить фактические результаты, а не только команды.

- [ ] **Step 6: Самопроверка и отдельный коммит.**

Сверить со всей спекой, записать в отчёт невыполненное, если есть; чужие изменения не откатывать.
Коммитить только файлы задачи: `docs(bff): добавлен проект серверного bootstrap`.
Push, PR и отдельные ревью выполняет контроллер; субагентов не запускать.

### Task 2: Схемы bootstrap и упаковки общего образа

**Files:**
- Modify: `diagrams/modules/2/bff-contract.json`.
- Modify: `diagrams/modules/2/frontend-monorepo.json`.
- Modify: `README.md` — только описания этих двух существующих схем.
- Test: `scripts/bff-contract-diagram.test.ts`, `scripts/frontend-monorepo-diagram.test.ts`.

**Interfaces:**
- Consumes: типовой контракт Task 1 — `AppRouter`, `BootstrapData`, payload только `{ user }`, HTML-шаблон из образа BFF, Vite + Bun build и упаковка после обоих build.
- Produces: те же имена `<Diagram name="modules/2/bff-contract" />` и `<Diagram name="modules/2/frontend-monorepo" />`; их адреса не меняются.
- Produces: различимые на схеме HTML bootstrap и RPC, артефакт index.html из клиентской сборки в общем образе, type-only связь BootstrapData. Новые связи описывают только согласованный план.
- Scope: только перечисленные схемы/README/тесты; страницы Task 1 не менять без сообщения контроллеру.

- [ ] **Step 1: Прочитать eraser-diagrams и закрепить существенные новые связи тестами.**

В `bff-contract-diagram.test.ts` расширить модель при необходимости, сохранить прежние
генерационные связи Apidog/Orval/Go и добавить требования к HTML bootstrap. Предлагаемые id:
`bff-bootstrap` и `html-template`, оба внутри `bff`. Обязательные связи:

```ts
expect(byId.get('bff-bootstrap')?.containerId).toBe('bff');
expect(byId.get('html-template')?.containerId).toBe('bff');
for (const pair of ['client>bff-bootstrap', 'html-template>bff-bootstrap', 'bff-bootstrap>bff-go-client', 'bff-bootstrap>client']) {
  expect(pairs).toContain(pair);
}
```

Подписи различают GET HTML, шаблон из образа и HTML с `{ user }`; существующие `/api/trpc` и
`/api/v1` остаются. Не изображать запрос шаблона к S3 на пользовательский HTML-запрос.
В `frontend-monorepo-diagram.test.ts` существующий type-only импорт должен содержать
`AppRouter` и `BootstrapData`; проверить артефакт клиентского HTML, образ BFF + index.html и
связь результатов обоих build с отдельной упаковкой. Имена новых упаковочных узлов выбрать
осмысленные, закрепить их реальные parent/edge связи тестом. Не закреплять точные координаты.

- [ ] **Step 2: Выполнить RED.**

Run: `bun test scripts/bff-contract-diagram.test.ts scripts/frontend-monorepo-diagram.test.ts`.
Expected: падения на отсутствующих bootstrap/HTML/упаковочных узлах и BootstrapData.

- [ ] **Step 3: Обновить оба JSON по согласованным потокам.**

На bff-contract сохранить различие генерации, коммита, сборки и runtime. Внутри BFF разместить
bootstrap-хендлер и локальный шаблон, показать запрос/ответ HTML и вызов общего клиента Go.
На frontend-monorepo сохранить workspace, npm-пакеты и граф ^build; добавить артефакты
Vite index.html и Bun-бандла, отдельную упаковку после них. Образ как результат упаковки
не превращать в четвёртый workspace или новый runtime-сервис. CDN-ассеты можно пояснить
подписью артефакта/выноской; не добавлять несвязанные CI/CD-системы.
Раскладку подобрать осмотром PNG, координаты кратны 20, легенда справа; существующие
группы сохраняют зоны владения. «Браузер» — id `client`; цвета связей — по scripts/colors.ts.
Легенду пересчитать при появлении нового типа потока. Обновить описания двух схем в таблице README.

- [ ] **Step 4: Выполнить цикл схем и осмотр PNG.**

Run: `bun run validate && bun run check && bun run warm`.
Run: `DIAGRAMS_NATIVE=1 CHROMIUM_PATH="/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta" bun run render`.
Открыть оба `dist/modules/2/*.png` через view_image; проверить читаемость подписей,
расположение узлов/границ и маршруты стрелок. После исправления координат повторить цикл.
В отчёт записать пути просмотренных изображений и результат осмотра.

- [ ] **Step 5: Проверить GREEN и весь сайт перед коммитом.**

Run: `bun test scripts/bff-contract-diagram.test.ts scripts/frontend-monorepo-diagram.test.ts` → 0 failures.
Run: `bun run modules:check && bun run typecheck && bun run test` → 0 failures.
Run: `DIAGRAMS_NATIVE=1 CHROMIUM_PATH="/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta" bun run build` → `site ok`.
Проверить включение обновлённых схем на странице BFF, при этом root/frozen схемы не изменены.

- [ ] **Step 6: Самопроверка и отдельный коммит.**

Сверить обе схемы с новой страницей bootstrap и спекой. Коммитить только файлы задачи:
`docs(bff): показан bootstrap и общий образ на схемах`.
Не пушить и не открывать PR; передать контроллеру отчёт с проверками и осмотром PNG.
