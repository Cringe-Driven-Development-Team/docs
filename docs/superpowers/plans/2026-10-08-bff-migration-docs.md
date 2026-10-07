# Раздел «Миграция на BFF» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Раздел сайта «BFF» из трёх страниц — «Обзор», «Контракт», «Авторизация и CSRF» — с mermaid-схемами; описывает целевое состояние трека миграции и помечен как проект.

**Architecture:** Только содержимое VitePress в `site/bff/` и пункты меню в `site/.vitepress/config.mts`; сборка и проверки сайта не меняются. Тест-страж `scripts/bff-pages.test.ts` читает markdown и конфиг и держит требования спеки §5 и §6.3 (плашки, меню, число сценариев). Факты о текущем коде — по SHA из спеки §2, решения — из спеки §3–§4.

**Tech Stack:** Bun 1.3, TypeScript, VitePress 1.6.4, vitepress-plugin-mermaid 2.0.17, @mermaid-js/mermaid-cli 11.17.0, `openapi-format` 1.33.7 (только для проверки примера overlay, в зависимости не ставится).

**Spec:** `docs/superpowers/specs/2026-10-08-bff-migration-docs-design.md`

## Global Constraints

- На каждой странице `site/bff/*.md` сразу после заголовка `#` — блок `::: warning` с текстом «Проект трека миграции на BFF, ещё не внедрено. Как работает сейчас — раздел [CSRF](/security/csrf/).»
- На трёх страницах `site/security/csrf/*.md` сразу после заголовка `#` — блок `::: tip` с текстом «Это текущая реализация; при переезде на BFF её заменяет [Авторизация и CSRF в BFF](/bff/auth).»
- Значения из спеки дословно: cookie `__Host-Http-session` (`HttpOnly`, `Secure`, `Path=/`, `SameSite=Strict`, без `Domain`, `Max-Age` = `refresh_expires_in`); AES-256-GCM, `SESSION_KEY` 32 байта, `base64url(iv ‖ шифротекст ‖ тег)`, JSON `{ access, refresh, accessExp, refreshExp }`, AAD — имя cookie; refresh заранее, если до `accessExp` меньше 30 с; объединение refresh по SHA-256 refresh-токена, результат 10 с; заголовок `X-CSRF: 1`; `Origin` = `APP_ORIGIN`, `Sec-Fetch-Site` = `same-origin`; ошибки `401 unauthorized`, `403 csrf_invalid`, `404 not_found`; Caddy `/api/v1/*` → `bff:3000`, BFF → `http://api:8080/api/v1`; `TokenPair` = `access_token`, `access_expires_in`, `refresh_token`, `refresh_expires_in`; `spec/openapi.json`, `spec/bff.overlay.yaml`, `spec/openapi.public.json`; схемы `sessionCookie` и `csrfHeader`.
- Ссылки на код — на SHA спеки §2: `https://github.com/go-park-mail-ru/2026_2_Cringe_Driven_Development/blob/4094350/<путь>#L<n>`, `https://github.com/frontend-park-mail-ru/2026_2_Cringe_Driven_Development/blob/344ad0b/<путь>#L<n>`, `https://github.com/Cringe-Driven-Development-Team/infra/blob/2f97437/<путь>#L<n>`. Номер строки сверять `git -C ~/projects/cdd/<repo> show <sha>:<путь> | grep -n …`.
- Ссылки на RFC — `https://www.rfc-editor.org/rfc/rfc10017#section-<n>` (якоря вида `section-6.1.3.3` проверены); цитаты — дословно, по-английски в кавычках «».
- Mermaid: `sequenceDiagram`, участники `F as Фронт`, `B as Браузер`, `P as BFF`, `A as Go API`, `E as Чужой сайт` (только нужные схеме); без `;` и `#` в сообщениях; flowchart — `flowchart LR`.
- Тексты по-русски, термины в оригинале. Никаких значений токенов и ключей, IP и внутренних адресов, кроме имён сервисов compose (`api:8080`, `bff:3000`); домен `cellestial.ru` можно.
- Код BFF, фронта, Go и infra не пишется; примеры кода на странице — короткие и помечены как пример.
- Коммиты по-русски `тип(область): что сделано`; не пушить до задачи 4.
- Проверка перед коммитом: `bun run typecheck && bun run test && bun run mermaid && DIAGRAMS_NATIVE=1 bun run build` (с Docker — `bun run build`; для `mermaid` без Docker — `CHROMIUM_PATH` на Chrome хоста).

## Review Focus

1. Ссылка `/bff/auth#<якорь>` со страниц «Обзор» и «Контракт» ведёт на существующий заголовок (default slugify VitePress заменяет `й` на `и`) — `site:check` в каждой задаче; якоря брать из собранного HTML, не угадывать.
2. Пример `bff.overlay.yaml` на странице «Контракт» применяется `openapi-format` 1.33.7 к нынешнему `spec/openapi.json` фронта без ошибок для действий, чьи цели уже есть, — шаг в задаче 2.
3. Сценарий «Две вкладки» показывает один вызов refresh в Go и одинаковые новые токены в обоих ответах, а не два refresh — проверка содержимого в задаче 3, шаг 1.
4. Пункт меню «BFF» подсвечивается на всех трёх страницах раздела и не подсвечивается на страницах CSRF — `activeMatch: '^/bff/'`, проверка в браузере в задаче 4.
5. Схемы на 375 px читаются, широкие прокручиваются внутри блока — задача 4.

---

### Task 1: Тест-страж, меню, «Обзор», плашки на CSRF

**Files:**
- Create: `scripts/bff-pages.test.ts`, `site/bff/index.md`
- Modify: `site/.vitepress/config.mts`, `site/security/csrf/index.md`, `site/security/csrf/scenarios.md`, `site/security/csrf/checks.md`

**Interfaces:**
- Produces: `scripts/bff-pages.test.ts` — константы `BFF_PAGES = ["site/bff/index.md", "site/bff/contract.md", "site/bff/auth.md"]`, `CSRF_PAGES` (три файла CSRF), `WARNING`, `TIP` (тексты из Global Constraints); хелпер `firstBlockAfterTitle(md: string): string` — текст первого блока `:::` после строки `# `. Задачи 2 и 3 дописывают в этот файл свои `test(...)`.
- Produces: config — nav `{ text: 'BFF', link: '/bff/', activeMatch: '^/bff/' }` после «Безопасность»; sidebar `'/bff/'`: группа «Миграция на BFF» с пунктами «Обзор» `/bff/`, «Контракт» `/bff/contract`, «Авторизация и CSRF» `/bff/auth`.

- [ ] **Step 1: Тесты** в `scripts/bff-pages.test.ts`:
  - `test("каждая существующая страница BFF начинается с плашки «проект»")` — для каждого файла из `BFF_PAGES`, который существует, `firstBlockAfterTitle` начинается с `::: warning` и содержит `WARNING`; плюс `expect(existsSync("site/bff/index.md")).toBe(true)`;
  - `test("страницы CSRF ссылаются на раздел BFF")` — для каждого из `CSRF_PAGES` первый блок — `::: tip` с `TIP`;
  - `test("в меню есть BFF")` — текст `config.mts` содержит `text: 'BFF'`, `activeMatch: '^/bff/'` и три ссылки `'/bff/'`, `'/bff/contract'`, `'/bff/auth'`.
- [ ] **Step 2:** `bun test scripts/bff-pages.test.ts` → FAIL на всех трёх тестах (файла нет, плашек нет, меню нет).
- [ ] **Step 3: Меню и плашки** — config по Interfaces; `::: tip` на трёх страницах CSRF.
- [ ] **Step 4: Страница «Обзор»** по спеке §6.1, разделы `##`:
  - «Было и стало» — два `flowchart LR`: сейчас `Браузер → Caddy → Go API` (подписи: cookie `access_token`, `refresh_token`, `__Host-csrf`); потом `Браузер → Caddy → BFF → Go API` (подписи: `__Host-Http-session` и `X-CSRF: 1`; `/api/v1/*` → `bff:3000`; `http://api:8080/api/v1`, `Authorization: Bearer`). Строка под схемой: клиент по-прежнему ходит на `/api/v1`, пути не меняются. Ссылки на `Caddyfile.j2` и `compose.yml.j2` на `2f97437`.
  - «Cookie до и после» — таблица: имя, `Path`, `HttpOnly`, `SameSite`, кто читает; строки трёх нынешних cookie и `__Host-Http-session`.
  - «Почему BFF» — цитаты RFC §6 («presented in decreasing order of security») и §6.1.4.3 («strongly recommended …»); одна строка, что токены не попадают в браузер.
  - «Что меняется» — четыре подраздела `###` Фронт, BFF, Go API, Infra по спеке §4.5; у Go — ссылка на `internal/middleware/authenticate.go#L19` на `4094350` (сейчас читает cookie, контракт уже говорит Bearer); у фронта — `src/api/client.ts` на `344ad0b`; что frontend#34 станет не нужна, backend#12 решается в BFF при одном экземпляре.
  - «Переключение» — спека §4.6 дословно по смыслу: одна выкатка, окно до промоута клиента, стирание трёх старых cookie с их `Path`, один повторный вход.
  - «Ограничения» — один экземпляр BFF; смена `SESSION_KEY` разлогинивает всех; Go закрыт только сетью compose, без S2S-ключа.
  - Ссылки на «Контракт» и «Авторизация и CSRF» — на страницы целиком (якоря появятся в задачах 2–3).
- [ ] **Step 5:** `bun test scripts/bff-pages.test.ts` → PASS (3 теста); полная проверка из Global Constraints → зелёная, `site:check` без битых ссылок.
- [ ] **Step 6: Commit** `docs(site): BFF — обзор, пункт меню, ссылки со страниц CSRF`.

### Task 2: «Контракт»

**Files:**
- Create: `site/bff/contract.md`
- Modify: `scripts/bff-pages.test.ts`

**Interfaces:**
- Consumes: `BFF_PAGES`, `firstBlockAfterTitle`, sidebar-пункт `/bff/contract` (задача 1).

- [ ] **Step 1: Тест** `test("страница «Контракт» описывает overlay")`: `site/bff/contract.md` существует и содержит `spec/bff.overlay.yaml`, `spec/openapi.public.json`, `openapi-format`, `--overlayFile`, `sessionCookie`, `csrfHeader`, `TokenPair`, и ровно один блок ` ```yaml ` с `overlay: 1.0.0`.
- [ ] **Step 2:** `bun test scripts/bff-pages.test.ts` → FAIL на новом тесте.
- [ ] **Step 3: Страница** по спеке §6.2 и §4.2, разделы `##`:
  - «Один источник» — `flowchart LR`: Apidog → `spec/openapi.json` → (Go: `oapi-codegen`; BFF: типы вызовов Go) и `spec/openapi.json` + `spec/bff.overlay.yaml` → `openapi-format` → `spec/openapi.public.json` → (клиент: `openapi-cdd`; BFF: типы своих ручек). Почему не два контракта — строка из спеки §3.
  - «Что меняется в контракте Go» — список спеки §4.2 с `TokenPair`; отметка, что контракт уже требует `bearerAuth`, а бэк читает cookie (ссылка из задачи 1).
  - «Overlay» — пример `spec/bff.overlay.yaml` (Overlay 1.0.0, `extends: openapi.json`) с действиями: `remove` `$.paths['/auth/refresh']`; `update`/`remove` ответов `/auth/register` (`201`) и `/auth/login` (`200`) → схема `User` и заголовок `Set-Cookie`; `/auth/logout` без `requestBody`, `204` + `Set-Cookie`; `remove` `$.components.securitySchemes.bearerAuth` и `update` `$.components.securitySchemes` с `sessionCookie` (`type: apiKey`, `in: cookie`, `name: __Host-Http-session`) и `csrfHeader` (`type: apiKey`, `in: header`, `name: X-CSRF`); `security` ручек данных и `logout` — оба, `register`/`login` — `csrfHeader`; ответы `401`/`403` со схемой `Error` у ручек данных. Подпись: «Пример; точные пути зависят от выгрузки Apidog».
  - «Команды» — `bun run sync` = `apidog` → `overlay` → `generate`, команда `openapi-format` из спеки §4.2 дословно; какой файл кто генерирует.
  - «Проверки в CI» — оба условия спеки §4.2 и зачем первое (правка в Apidog молча ломает overlay).
  - «Какие запросы BFF пропускает» — allowlist из пар «шаблон пути + метод» публичного контракта, цитата RFC §6.1.3.6 (MUST allowlist); пример: `DELETE /api/v1/notebooks/{id}` вне контракта → `404 not_found`, в Go не уходит.
- [ ] **Step 4: Проверка примера overlay** (Review Focus 2): сохранить пример в scratchpad, `git -C ~/projects/cdd/frontend show 344ad0b:spec/openapi.json > <scratch>/openapi.json`, `bunx openapi-format@1.33.7 <scratch>/openapi.json --overlayFile <scratch>/bff.overlay.yaml -o <scratch>/public.json` → без ошибок; в `public.json` нет `/auth/refresh` и `bearerAuth`, есть `sessionCookie` и `csrfHeader`. Действия, которые падают только потому, что их цели появятся в новом Go-контракте (`TokenPair`), — перечислить в отчёте задачи; остальные чинить в примере.
- [ ] **Step 5:** `bun test scripts/bff-pages.test.ts` → PASS (4 теста); полная проверка из Global Constraints → зелёная.
- [ ] **Step 6: Commit** `docs(site): BFF — контракт и overlay`.

### Task 3: «Авторизация и CSRF»

**Files:**
- Create: `site/bff/auth.md`
- Modify: `scripts/bff-pages.test.ts`, `site/bff/index.md`, `site/bff/contract.md` (ссылки на якоря сценариев, где к месту)

**Interfaces:**
- Consumes: `BFF_PAGES`, `firstBlockAfterTitle` (задача 1).
- Produces: якоря сценариев в `site/bff/auth.md` — заголовки `###` из Step 3; ссылки на них из других страниц берутся из собранного HTML.

- [ ] **Step 1: Тест** `test("в «Авторизация и CSRF» десять сценариев со схемой и пометкой")`: в разделе `## Сценарии` (до следующего `## ` или конца файла) ровно 10 заголовков `### `; в каждом подразделе ровно один блок ` ```mermaid ` с `sequenceDiagram` и строка `*Проект: проверить после внедрения.*`. Второй тест `test("сценарий двух вкладок — один refresh в Go")`: в подразделе «Две вкладки» строк-сообщений к `A` (регулярка `/^\s*\w+-+>>[+-]?A:/`), содержащих `/auth/refresh`, ровно одна.
- [ ] **Step 2:** `bun test scripts/bff-pages.test.ts` → FAIL на двух новых тестах.
- [ ] **Step 3: Страница** по спеке §6.3, §4.3, §4.4, разделы `##`:
  - «Cookie сессии» — атрибуты, шифрование, состав JSON, `Max-Age`; цитаты RFC §6.1.3.2 (MUST `Secure`, `HttpOnly`; SHOULD `SameSite=Strict`, префикс `__Host-Http-`, шифрование) и §6.1.2.3; почему не Redis и не память — строка из спеки §3.
  - «Как BFF проксирует запрос» — шаги спеки §4.3 нумерованным списком; какие заголовки уходят в Go; `Set-Cookie` от Go не пропускается.
  - «CSRF» — три правила спеки §4.4; цитата RFC §6.1.3.3.2 про статичный заголовок и §6.1.3.3.3 «not necessarily recommended over the CORS approach»; что фронту больше не нужно (чтение cookie, повтор после `403`, refresh на `401`).
  - «Сценарии» — 10 подразделов `###` в порядке спеки §6.3: «Вход», «Запрос данных», «Access истёк», «Две вкладки», «Выход», «Сессия кончилась», «Атака с чужого сайта», «Запрос с поддомена», «Переход по внешней ссылке», «Первый вход после переезда». В каждом 1–3 предложения, `sequenceDiagram`, `*Проект: проверить после внедрения.*`. Обязательное содержимое:
    - «Вход»: `F→B` `POST /api/v1/auth/login`, `X-CSRF: 1`; `P` проверяет заголовок и `Origin`; `P→A` login; `A→P` `200 { user, tokens }`; `P→B` `200 User`, `Set-Cookie __Host-Http-session` и стирание трёх старых cookie.
    - «Запрос данных»: `P` расшифровывает cookie, `P→A` `Authorization: Bearer`.
    - «Access истёк»: `P` видит, что до `accessExp` меньше 30 с → `P→A` refresh → новый `TokenPair` → исходный запрос → ответ с новой cookie; фронт делает один запрос.
    - «Две вкладки»: два запроса со старой cookie; `P→A` один `POST /api/v1/auth/refresh`; оба ответа с одной новой cookie; `Note` про 10 с и про один экземпляр BFF.
    - «Выход»: `P→A` logout с Bearer и `{ refresh_token }`; `P→B` `204`, `Max-Age=0`; `Note`: `204` и при `401` от Go.
    - «Сессия кончилась»: refresh → `A` `401` → `P` стирает cookie → `401 unauthorized` → фронт показывает вход.
    - «Атака с чужого сайта»: форма `POST` без `X-CSRF` → `403 csrf_invalid`, в Go не уходит; `fetch` с `X-CSRF` → `OPTIONS` → без разрешения CORS → основной запрос не отправлен; `Note` про `SameSite=Strict`.
    - «Запрос с поддомена»: same-site, cookie `Strict` уходит, но `Origin` чужой → `403 csrf_invalid`; цитата RFC §6.1.3.3.1 про поддомены.
    - «Переход по внешней ссылке»: переход с чужого сайта → HTML от Caddy без cookie; затем `fetch` страницы `GET /api/v1/users/me` с cookie и `X-CSRF: 1` → `200`.
    - «Первый вход после переезда»: в браузере старые cookie; `GET /api/v1/users/me` без `__Host-Http-session` → `401`; вход → новая cookie, три старые стёрты.
  - Ссылки из «Обзора» и «Контракта» на нужные сценарии — по якорям из собранного HTML (Review Focus 1).
- [ ] **Step 4:** `bun test scripts/bff-pages.test.ts` → PASS (6 тестов); `bun run mermaid` → без ошибок; полная проверка из Global Constraints → зелёная, `site:check` без битых якорей.
- [ ] **Step 5: Commit** `docs(site): BFF — авторизация, CSRF и сценарии`.

### Task 4: Приёмка в браузере, PR (контроллер)

- [ ] **Step 1:** Собрать сайт нативно (`DIAGRAMS_NATIVE=1 bun run build`) и раздать `dist/` под `/docs/` статическим сервером из scratchpad.
- [ ] **Step 2:** В агентском Chrome: пункт «BFF» в меню и его подсветка на трёх страницах раздела, без подсветки на CSRF; плашки warning и tip; все схемы отрисованы; переходы по якорям сценариев со страниц «Обзор» и «Контракт» открывают нужный сценарий после отрисовки схем; поиск «BFF»; светлая и тёмная тема; 375 px.
- [ ] **Step 3:** Ссылки на код и RFC: каждая `https://` ссылка из `site/bff/*.md` отвечает `200` (`curl -s -o /dev/null -w '%{http_code}'`), номер строки указывает на названный код.
- [ ] **Step 4:** Скриншоты для PR; пуш ветки `docs/bff-auth-contract`, PR с разделами «Что», «Решения», «Проверка» и ссылкой на превью ветки; CI зелёный; превью `/docs/branches/docs-bff-auth-contract/bff/` открывается со стилями (до мержа превью собирает сборка `main`, см. PR #22). Мерж — владелец.
