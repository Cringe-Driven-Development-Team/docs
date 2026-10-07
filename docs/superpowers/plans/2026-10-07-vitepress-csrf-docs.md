# VitePress в docs и документация CSRF — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** VitePress — главная `/docs/` с меню «Архитектура» (индекс схем на `/docs/diagrams/`) и «Безопасность» (три страницы про CSRF с mermaid-схемами), превью веток — весь сайт ветки.

**Architecture:** `bun run build:native` после рендера схем строит индекс схем в `dist/diagrams/`, затем VitePress из `site/` во временную папку и переносит его в `dist/` без перезаписи файлов схем. Базовый путь — `SITE_BASE` (по умолчанию `/docs/`); `build-site.ts` передаёт ветке `/docs/branches/<slug>/`. Содержимое страниц CSRF — факты из кода бэка `4094350` и фронта `344ad0b`.

**Tech Stack:** Bun 1.3, TypeScript, VitePress 1.6.4, vitepress-plugin-mermaid 2.0.17, mermaid 11, @mermaid-js/mermaid-cli 11.17.0, Docker-образ из `Dockerfile` (Node, Chromium).

**Spec:** `docs/superpowers/specs/2026-10-07-vitepress-csrf-docs-design.md`

## Global Constraints

- Версии: `vitepress` `1.6.4`, `vitepress-plugin-mermaid` `2.0.17`, `mermaid` `^11`, `@mermaid-js/mermaid-cli` `11.17.0` — devDependencies из публичного npm; `grep -cE 'https?://' bun.lock` → `0` (ставить с `--registry https://registry.npmjs.org/`, если окружение переопределяет реестр).
- Mermaid: `securityLevel: 'strict'`, `sequence: { wrap: true, useMaxWidth: false }`; `sequenceDiagram`, участники с короткими ASCII-алиасами (`participant B as Браузер`), без `;` и `#` в сообщениях, одна схема — одно событие.
- Тексты по-русски; термины в оригинале (`SameSite`, `Origin`, CSRF). Ни значений токенов, ни паролей, ни IP; домен `cellestial.ru` можно.
- Факты о коде — только из исходников на SHA: бэк `4094350` (`~/projects/cdd/backend`, `git show 4094350:<путь>`), фронт `344ad0b` (`~/projects/cdd/frontend`, `git show 344ad0b:<путь>`). Ссылка на код — `https://github.com/go-park-mail-ru/2026_2_Cringe_Driven_Development/blob/4094350/<путь>#L<n>` и `https://github.com/frontend-park-mail-ru/2026_2_Cringe_Driven_Development/blob/344ad0b/<путь>#L<n>`.
- Адреса схем `/docs/<name>.html`, `.png`, `/docs/<папка>/<name>.html` не меняются.
- Коммиты по-русски `тип(область): что сделано`; не пушить.
- Проверка перед коммитом: `bun run typecheck && bun run test && DIAGRAMS_NATIVE=1 bun run build` (Docker выключен; с Docker — `bun run build`).

## Review Focus

1. Превью ветки: страница `/docs/branches/<slug>/security/csrf/` грузит CSS и JS со своего `base`, а не с `/docs/` — проверка в задаче 6, шаг 3.
2. Старый якорь со слешем `/docs/#bff/ci` переносится на `/docs/diagrams/#bff/ci` целиком — тест в задаче 2.
3. Пункт меню «Архитектура» открывает `diagrams/` полной загрузкой, а не роутером VitePress (иначе 404 внутри SPA) — проверка в задаче 6, шаг 2; `check-site` в задаче 2 проверяет, что ссылка ведёт на существующий файл.
4. Прямой заход и F5 на `/docs/security/csrf/scenarios` (без `.html`) на GitHub Pages — задача 6, шаг 2 (локально `vitepress preview` с тем же `base`).
5. Широкая mermaid-схема на 375 px: текст не мельче 12 px, прокрутка внутри блока — задача 6, шаг 2.

---

### Task 1: Индекс схем на `/docs/diagrams/`, `SITE_BASE` для веток

**Files:**
- Modify: `scripts/build-index.ts`, `scripts/build-site.ts`
- Test: `scripts/build-index.test.ts`, `scripts/build-site.test.ts`

**Interfaces:**
- Produces:
  - `renderIndex(names, options: { previewsHref?: string; sizes?: Record<string, ImageSize>; assetPrefix?: string })` — `assetPrefix` (по умолчанию `""`) ставится перед `${name}.html` и `${name}.png` в ссылках и `img`; якоря `#${name}` без префикса.
  - `export const INDEX_FILE = join("dist", "diagrams", "index.html")` в `build-index.ts`; `main()` пишет туда с `assetPrefix: "../"`.
  - `export function branchSiteBase(slug: string): string` в `build-site.ts` → `/docs/branches/${slug}/`.

- [ ] **Step 1: Тесты.** В `build-index.test.ts`:
  ```ts
  test("renderIndex: assetPrefix goes before html and png links, anchors stay bare", () => {
    const html = renderIndex(["contract", "bff/ci"], { assetPrefix: "../" });
    expect(html).toContain('href="../contract.html"');
    expect(html).toContain('src="../contract.png"');
    expect(html).toContain('href="../bff/ci.png"');
    expect(html).toContain('href="#contract"');
    expect(html).not.toContain('href="contract.html"');
  });
  ```
  В `build-site.test.ts`: `branchSiteBase("docs-vitepress-csrf")` → `"/docs/branches/docs-vitepress-csrf/"`; `renderPreviewsIndex([])` содержит `<a href="../">Сайт main</a>` и не содержит `Диаграммы main`. Старые тесты `renderIndex` без `assetPrefix` не меняются.
- [ ] **Step 2:** `bun test scripts/build-index.test.ts scripts/build-site.test.ts` → FAIL (нет `assetPrefix`, `branchSiteBase`, старый текст ссылки).
- [ ] **Step 3: Реализация.** `renderIndex` — префикс в `card()`. `build-index.ts main()` — `mkdir` и запись в `INDEX_FILE`, лог `dist/diagrams/index.html: N diagrams`. `build-site.ts`: `buildBranch` запускает `bun run build` с `env: { ...process.env, SITE_BASE: branchSiteBase(branch.slug) }`; проверка ветки — по-прежнему `dist/index.html` (VitePress или старый индекс); в конце `main()` индекс `main` пишется в `INDEX_FILE` с `{ previewsHref: "../branches/", assetPrefix: "../", sizes }`; `--main-built` проверяет `INDEX_FILE`. `pngSizes` читает PNG из `dist/` как раньше.
- [ ] **Step 4:** `bun test` → PASS; `bun run typecheck` → без ошибок.
- [ ] **Step 5: Commit** `feat(index): индекс схем в dist/diagrams/, базовый путь ветки в SITE_BASE`.

### Task 2: Каркас VitePress, перенос в `dist/`, `check-site`

**Files:**
- Create: `site/.vitepress/config.mts`, `site/.vitepress/site.ts`, `site/.vitepress/theme/index.ts`, `site/index.md`, `site/security/csrf/index.md` (заглушка «Раздел в работе» до задачи 3), `scripts/build-vitepress.ts`, `scripts/build-vitepress.test.ts`, `scripts/check-site.ts`, `scripts/check-site.test.ts`, `scripts/site-base.test.ts`
- Modify: `package.json`, `tsconfig.json` (включить `site/.vitepress/*.ts`), `.gitignore` (`site/.vitepress/dist/`, `site/.vitepress/cache/`), `README.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: `INDEX_FILE`, `diagramNames()` из задачи 1 и `build-index.ts`.
- Produces:
  - `site/.vitepress/site.ts`: `export const SITE_BASE: string` (`process.env.SITE_BASE ?? "/docs/"`, всегда с `/` в начале и конце); `export function diagramsRedirect(hash: string, base: string): string | null`.
  - `scripts/build-vitepress.ts`: `export function mergeConflicts(built: readonly string[], existing: readonly string[]): string[]`; `main()` — `vitepress build site`, перенос `site/.vitepress/dist/**` в `dist/`, выход 1 со списком конфликтов.
  - `scripts/check-site.ts`: `export function htmlPages(dist: string, skip: readonly string[]): string[]`; `main()` проверяет ссылки, якоря, картинки страниц VitePress и `diagrams/index.html` в `dist/` (пропуская `branches/**` и HTML схем из `diagramNames()`).
  - `package.json`: `site:dev` = `vitepress dev site`, `site:vitepress` = `bun scripts/build-vitepress.ts`, `site:check` = `bun scripts/check-site.ts`; `build:native` = `… && bun run index && bun run site:vitepress && bun run site:check`.

- [ ] **Step 1: Тесты.**
  ```ts
  // site-base.test.ts
  expect(diagramsRedirect("", "/docs/")).toBeNull();
  expect(diagramsRedirect("#contract", "/docs/")).toBe("/docs/diagrams/#contract");
  expect(diagramsRedirect("#bff/ci", "/docs/branches/x/")).toBe("/docs/branches/x/diagrams/#bff/ci");
  // build-vitepress.test.ts
  expect(mergeConflicts(["index.html", "assets/a.js", "security/csrf/index.html"], ["contract.html", "diagrams/index.html"])).toEqual([]);
  expect(mergeConflicts(["index.html", "contract.html"], ["contract.html"])).toEqual(["contract.html"]);
  // check-site.test.ts — по образцу гайдлайнов: htmlPages пропускает 404.html, branches/** и переданные skip;
  // битая ссылка, отсутствующий якорь и картинка дают по одной проблеме; ссылка на diagrams/ (каталог с index.html) — не проблема.
  ```
  Образец `check-site.ts` и его тестов — `TP-Prepare/technopark-guidelines`, `scripts/check-site.ts` на `origin/main` (`git -C ~/projects/technopark-guidelines show origin/main:scripts/check-site.ts`): перенести разбор ссылок и якорей, заменить корень на `dist/` и `SITE_BASE` из `site/.vitepress/site.ts`.
- [ ] **Step 2:** `bun test scripts/site-base.test.ts scripts/build-vitepress.test.ts scripts/check-site.test.ts` → FAIL (нет модулей).
- [ ] **Step 3: Реализация.**
  - `bun add -d vitepress@1.6.4 vitepress-plugin-mermaid@2.0.17 mermaid@^11` (публичный реестр).
  - `config.mts`: `withMermaid(defineConfig({ base: SITE_BASE, lang: 'ru-RU', title: 'Cringe Driven Development', description: 'Документация команды', cleanUrls: true, srcExclude: [], themeConfig: { nav: [{ text: 'Архитектура', link: '<SITE_BASE>diagrams/', target: '_self' }, { text: 'Безопасность', link: '/security/csrf/' }], sidebar: { '/security/csrf/': [{ text: 'CSRF', items: [{ text: 'Как устроено', link: '/security/csrf/' }] }] }, search: { provider: 'local' }, outline: { label: 'На странице' }, docFooter: { prev: 'Назад', next: 'Дальше' }, darkModeSwitchLabel: 'Тема', sidebarMenuLabel: 'Меню', returnToTopLabel: 'Наверх' } }), mermaid: { securityLevel: 'strict', sequence: { wrap: true, useMaxWidth: false } })`. Ссылка «Архитектура» — абсолютная с `base` и `target: '_self'`, чтобы роутер VitePress её не перехватывал. Пункты sidebar «Сценарии» (`/security/csrf/scenarios`) и «Проверка и ограничения» (`/security/csrf/checks`) добавляют задачи 4 и 5 вместе со страницами, иначе `check-site` найдёт битые ссылки.
  - `theme/index.ts`: тема по умолчанию; в `enhanceApp` на клиенте при пути, равном `SITE_BASE`, — `diagramsRedirect(location.hash, SITE_BASE)` и `location.replace`. Стиль `.mermaid { overflow-x: auto }`.
  - `site/index.md`: `layout: home`, hero «Документация команды», две карточки features со ссылками «Архитектура» (`diagrams/`, полная загрузка) и «Безопасность: CSRF».
  - `build-vitepress.ts`: `vitepress build site` через `node` (бинарь из `node_modules/vitepress/bin`), список файлов `site/.vitepress/dist` и `dist/`, `mergeConflicts`, при конфликтах — выход 1 и список, иначе `cpSync`.
  - README: раздел «Сайт» (VitePress в `site/`, главная `/docs/`, схемы в `/docs/diagrams/`, `bun run site:dev`, новая страница — в sidebar `config.mts`); CLAUDE.md — то же одной строкой в «Сборка».
- [ ] **Step 4:** `bun test` → PASS; `bun run typecheck` → без ошибок; `DIAGRAMS_NATIVE=1 bun run build` → в `dist/` есть `index.html` (VitePress), `diagrams/index.html`, `contract.html`, `security/csrf/index.html`; `site:check` печатает `site ok`.
- [ ] **Step 5: Commit** `feat(site): VitePress на главной, индекс схем в меню «Архитектура»`.

### Task 3: «Как устроено» и проверка mermaid

**Files:**
- Modify: `site/security/csrf/index.md`, `package.json`
- Create: `scripts/check-mermaid.ts`, `scripts/check-mermaid.test.ts`

**Interfaces:**
- Produces: `scripts/check-mermaid.ts`: `export function mermaidFiles(root = "site"): string[]` (все `*.md` с блоком ` ```mermaid `), `main()` — `mmdc` из `@mermaid-js/mermaid-cli` под `node` с puppeteer-конфигом `{ executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox"] }`, вывод во временную папку, выход 1 при ошибке. `package.json`: `mermaid` = `bun scripts/check-mermaid.ts`, добавить в `build:native` перед `site:vitepress`. Образец — `git -C ~/projects/technopark-guidelines show origin/main:scripts/check-mermaid.ts`.

- [ ] **Step 1: Тест** `mermaidFiles` на временной папке: файл с блоком ` ```mermaid ` попадает, без блока — нет, вложенные папки обходятся. FAIL → реализация → PASS.
- [ ] **Step 2: Страница** по спеке §6.1. Разделы (`##`): «Три cookie» (таблица: имя, `Path`, срок, `HttpOnly`, `Secure`, `SameSite`, кто ставит), «Когда приходит `__Host-csrf`» (анонимная и подписанная, на ответах с ошибкой, `Cache-Control: no-store`), «Порядок middleware» (mermaid `flowchart LR`: RequestID → Logging → Recover → CORS → CSRF → Authenticate → обработчик), «Что проверяется на какой ручке» (таблица: login/register/refresh — `Origin` и совпадение; остальные изменяющие — совпадение и подпись; `GET`, `OPTIONS` — без проверки), «Формат токена», «Когда токен меняется» (login, register, refresh, logout; почему не на каждый запрос: параллельные запросы, вкладки, OWASP — токен на сессию), «Что делает фронт» (`setCsrfHeader`, повтор входа и регистрации, refresh после 401). Каждое утверждение — со ссылкой на файл и строку по Global Constraints; факты сверить с кодом, перечень — спека §2.
- [ ] **Step 3:** `bun run mermaid` (с `CHROMIUM_PATH` на Chrome хоста, если без Docker) → без ошибок; `bun run typecheck && bun run test && DIAGRAMS_NATIVE=1 bun run build` → зелёная.
- [ ] **Step 4: Commit** `docs(site): CSRF — как устроено, проверка mermaid`.

### Task 4: «Сценарии»

**Files:**
- Create: `site/security/csrf/scenarios.md`
- Modify: `site/.vitepress/config.mts` (пункт sidebar «Сценарии»)

- [ ] **Step 1: Страница** по спеке §6.2: 15 сценариев, каждый — `##` с названием (якорь из него), 1–3 предложения, mermaid `sequenceDiagram` (участники `F as Фронт`, `B as Браузер`, `A as API`, при необходимости `E as evil.example`, `D as БД`) и строка курсивом «Проверено на проде 07.10.2026» (сценарии 1–8, 10–15) или «Только по коду» (9). Коды ответов и `Set-Cookie` — как в спеке §6.2 и таблице curl в спеке §6.3; в 13 и 14 — ссылки на frontend#34 и backend#12.
- [ ] **Step 2:** `bun run mermaid` → без ошибок; полная проверка из Global Constraints → зелёная; `site:check` видит 15 якорей.
- [ ] **Step 3: Commit** `docs(site): CSRF — сценарии`.

### Task 5: «Проверка и ограничения»

**Files:**
- Create: `site/security/csrf/checks.md`
- Modify: `site/.vitepress/config.mts` (пункт sidebar «Проверка и ограничения»)

- [ ] **Step 1: Страница** по спеке §6.3: «Как проверить curl'ом» — шаблон с cookie-файлом (`cookie_jar=$(mktemp)`, `csrf_token()` через `awk`, как в README бэка; адрес `https://cellestial.ru/api/v1`; тестовый логин — заглушка `<логин>`); таблица 27 случаев (№, запрос, ожидаемый код и `code`, какие cookie в ответе) — значения из таблицы ниже; «Известные ограничения» — сценарий 13 → frontend#34, сценарий 14 → backend#12, подпись привязана к пользователю (ТЗ backend#4; гайдлайн РК1 `rk1/csrf.md` называет привязку к пользователю допустимой, но более слабой).

  | № | Запрос | Итог |
  |---|---|---|
  | 1 | `OPTIONS` preflight register | `204`, cookie нет |
  | 2 | гость `GET /users/me` без cookie | `401 unauthorized`, анонимная `__Host-csrf` |
  | 3 | register без заголовка | `403 csrf_invalid` |
  | 4 | register, заголовок не равен cookie | `403 csrf_invalid` |
  | 5 | register, заголовок без cookie | `403 csrf_invalid`, новая `__Host-csrf` |
  | 6 | register, `Origin: https://evil.example` | `403 csrf_invalid` |
  | 7 | register формой `x-www-form-urlencoded` с токеном | `400 validation_error` |
  | 8 | register корректно | `201`, `access_token`, `refresh_token`, подписанная `__Host-csrf` |
  | 9 | `GET /users/me` после регистрации | `200` |
  | 10 | refresh со старым анонимным токеном | `403 csrf_invalid` |
  | 11 | refresh корректно | `204`, три новые cookie |
  | 12 | refresh, заголовок от прошлой ротации | `403 csrf_invalid` |
  | 13 | вторая сессия: `GET /users/me` с анонимной cookie | `401`, cookie не ставится |
  | 14 | вторая сессия: login корректно | `200`, три cookie |
  | 15 | вторая сессия с токеном первой сессии того же пользователя | `204` (подпись — на пользователя) |
  | 16 | login с неверным паролем | `401 invalid_credentials` |
  | 17 | logout без заголовка | `403 csrf_invalid` |
  | 18 | logout корректно | `204`, cookie входа стёрты, анонимная `__Host-csrf` |
  | 19 | `GET /users/me` после logout | `401` |
  | 20 | refresh после logout | `401` |
  | 21 | logout второй сессии | `204` |
  | 22 | пользователь Б с подписанным токеном пользователя А, refresh | `403 csrf_invalid` |
  | 23 | то же, logout | `403 csrf_invalid` |
  | 24 | вошёл, анонимный токен в cookie и заголовке, refresh | `403 csrf_invalid`, в ответе подписанная `__Host-csrf` |
  | 25 | то же, logout | `403 csrf_invalid` |
  | 26 | повтор после 24 с новой cookie | `204` |
  | 27 | два refresh одновременно с одной cookie | `204` и `401` (backend#12) |
- [ ] **Step 2:** полная проверка из Global Constraints → зелёная.
- [ ] **Step 3: Commit** `docs(site): CSRF — проверка и ограничения`.

### Task 6: Приёмка в браузере, PR (контроллер)

- [ ] **Step 1:** Сборка сайта целиком: из основного клона (не worktree — правило `CLAUDE.md`) или нативно `DIAGRAMS_NATIVE=1 bun run site` после пуша ветки; `npx vitepress preview`-эквивалент — статический сервер `dist/` под путём `/docs/` (например, `bunx serve`-аналог на `Bun.serve` в scratchpad).
- [ ] **Step 2:** В агентском Chrome: главная, меню, переход «Архитектура» (полная загрузка, индекс с картинками), `/docs/#contract` → `/docs/diagrams/#contract`, `/docs/#bff/ci`, `/docs/contract.html`; три страницы CSRF; F5 на `/docs/security/csrf/scenarios`; mermaid читается, широкая схема прокручивается; поиск «csrf»; светлая и тёмная тема; 375 px.
- [ ] **Step 3:** Превью ветки: `dist/branches/<slug>/security/csrf/` — стили и скрипты грузятся с `/docs/branches/<slug>/`.
- [ ] **Step 4:** Скриншоты для PR; пуш, PR с разделами «Что», «Решения», «Проверка» и ссылкой на превью ветки; CI зелёный. Мерж — владелец.
