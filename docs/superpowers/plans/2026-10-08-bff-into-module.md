# Документация BFF в трек модуля — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Три страницы `/docs/bff/` становятся страницей трека `bff` и двумя его подстраницами в модуле
октября; старые адреса переадресуются; правило «модули — план, остальное — прод» записано.

**Architecture:** Трек получает необязательный список подстраниц `pages` (файлы `tracks/<id>/<page>.md`),
модель и читалка модулей их проверяют, меню и шапка трека их показывают. Старые адреса — статические
страницы-переадресации, которые пишет шаг `index`, как `dist/diagrams/index.html`. Текст переезжает
почти без правок: плашки и ссылки.

**Tech Stack:** Bun 1.3 (`bun:test`), TypeScript 7.0.2, VitePress 1.6.4, Vue 3, gray-matter 4.0.3.

**Spec:** `docs/superpowers/specs/2026-10-08-bff-into-module-design.md`

## Global Constraints

- Работа в worktree `.claude/worktrees/bff-into-module`, ветка `docs/bff-into-module`.
- Перед каждым коммитом: `bun run typecheck && bun run test`. Docker на маке не поднят: сборка —
  `DIAGRAMS_NATIVE=1 bun run build`, ожидаемо `site ok: N pages`.
- Если `bun install` нужен: `NPM_CONFIG_REGISTRY=https://registry.npmjs.org/ BUN_CONFIG_REGISTRY=https://registry.npmjs.org/ bun install --frozen-lockfile`.
- Коммиты по-русски: `тип(область): что сделано`, типы `feat`, `fix`, `docs`, `ci`, `chore`, `refactor`.
- Названия тестов — по-английски, кроме `scripts/bff-pages.test.ts`, где они по-русски (стиль файла).
- Ошибки данных модулей — `ModuleDataError(file, field, problem)`, сообщение `${file}: ${field} — ${problem}`,
  путь от `site/`.
- Публичная репа: никаких IP, CIDR, токенов, внутренних адресов.
- Не трогать: `diagrams/**`, спеку `docs/superpowers/specs/2026-10-08-bff-migration-docs-design.md`,
  содержательный текст «Контракта» и «Авторизации» (только плашки и ссылки).
- Заголовки (`##`, `###`) переезжающих страниц не менять — от них зависят якоря старых ссылок.

## Review Focus

1. Старая ссылка с кириллическим якорем в процентной кодировке (`/docs/bff/auth#%D0%B4…`) — должна
   открыть подстраницу на том же разделе. Покрыто: тест страницы-переадресации проверяет, что `location.hash`
   приклеивается без декодирования (Task 3), и ручная проверка (Task 6).
2. Превью ветки (`/docs/branches/<slug>/bff/auth`) — переадресация не должна уходить на main.
   Покрыто: тест «цели относительные, без `/` в начале» (Task 3).
3. В `tracks/<id>/` лежит не-md файл (картинка к подстранице) — сборка не должна падать. Покрыто: тест
   в Task 2.
4. Трек без `pages` и без каталога — всё как раньше, `pages: []`, меню плоское. Покрыто: Task 1, Task 2.
5. Мобильный экран: меню скрыто, на подстраницу попадают только из шапки трека. Покрыто: строка
   «Документы» (Task 4) и ручная проверка на 375 px (Task 6).

---

### Task 1: Модель — подстраницы трека, `pageRef`, меню модулей

**Files:**
- Modify: `site/.vitepress/modules.ts` (типы рядом с `Track` ~49–61; `parseTrack` ~103–156; `pageRef` ~313–317)
- Test: `scripts/modules.test.ts`, `scripts/modules-graph.test.ts`

**Interfaces:**
- Produces:
  - `export type TrackPage = { id: string; title: string; url: string }`
  - `Track.pages: TrackPage[]` (новое поле, после `hasBody`)
  - `parseTrack(file, moduleId, id, data, body, people, pages: readonly TrackPage[] = [])` — кладёт
    `pages` в трек как есть (копией).
  - `export function trackPages(file: string, moduleId: string, trackId: string, declared: unknown, found: readonly { name: string; title: unknown }[]): TrackPage[]`
    — `file` = путь трека `modules/<m>/tracks/<id>.md`; `declared` = `frontmatter.pages`; `found` =
    md-файлы каталога `tracks/<id>/` (имя без `.md` и `title` из их frontmatter). Возвращает подстраницы
    в порядке `declared`, `url = /modules/<m>/tracks/<id>/<page>`.
  - `pageRef(relativePath): { module: string; track?: string; page?: string } | null`
  - `export type SidebarItem = { text: string; link?: string; collapsed?: boolean; items?: SidebarItem[] }`
  - `export function moduleSidebar(modules: readonly Module[]): SidebarItem[]` — то, что сейчас
    строится в `config.mts` (`{ text: m.title, items: [{ text: 'Граф', link: m.url }, …треки] }`), плюс
    у трека с подстраницами `collapsed: false, items: pages.map(p => ({ text: p.title, link: p.url }))`.

- [ ] **Step 1: Failing tests в `scripts/modules.test.ts`**

  - в «parses a valid track» ожидание дополняется `pages: []`;
  - `describe("trackPages")`, `const TRACK = "modules/2026-10/tracks/bff.md"`:
    - `"returns pages in declared order with titles and urls"`:
      `trackPages(TRACK, "2026-10", "bff", ["contract", "auth"], [{ name: "auth", title: "Авторизация и CSRF" }, { name: "contract", title: "Контракт" }])`
      → `[{ id: "contract", title: "Контракт", url: "/modules/2026-10/tracks/bff/contract" }, { id: "auth", title: "Авторизация и CSRF", url: "/modules/2026-10/tracks/bff/auth" }]`;
    - `"no pages and no files — empty"`: `trackPages(TRACK, "2026-10", "bff", undefined, [])` → `[]`;
    - `"pages must be a list of ids"`: `"contract"` → toThrow `${TRACK}: pages — нужен список`;
      `[1]` → `${TRACK}: pages[0] — нужна строка`; `["Contract"]` →
      `${TRACK}: pages[0] — Contract: только строчная латиница, цифры и дефис`;
    - `"duplicate page"`: `["auth", "auth"]` с файлом auth → `${TRACK}: pages — auth повторяется`;
    - `"declared page without a file"`: `["contract"]`, found `[]` →
      `${TRACK}: pages — нет файла bff/contract.md`;
    - `"file not in pages"`: declared `undefined`, found `[{ name: "x", title: "X" }]` →
      `modules/2026-10/tracks/bff/x.md: pages — подстраницы нет в pages трека bff.md`;
    - `"page needs a title"`: `["auth"]`, found `[{ name: "auth", title: " " }]` →
      `modules/2026-10/tracks/bff/auth.md: title — нужна непустая строка`;
  - `"parseTrack keeps given pages"`: `parseTrack(FILE, "2026-10", "bff", valid(), "", PEOPLE, [page])`,
    `page = { id: "auth", title: "Авторизация и CSRF", url: "/modules/2026-10/tracks/bff/auth" }` →
    `t.pages` равен `[page]`.
  - `describe("moduleSidebar")`: модуль `{ id: "2026-10", title: "Октябрь", url: "/modules/2026-10/" }`
    с треками `bff` (две подстраницы: «Контракт», «Авторизация и CSRF») и `xss` (без) — меню
    `[{ text: "Октябрь", items: [{ text: "Граф", link: "/modules/2026-10/" }, { text: "BFF", link: "/modules/2026-10/tracks/bff", collapsed: false, items: [{ text: "Контракт", link: "/modules/2026-10/tracks/bff/contract" }, { text: "Авторизация и CSRF", link: "/modules/2026-10/tracks/bff/auth" }] }, { text: "XSS", link: "/modules/2026-10/tracks/xss" }] }]`;
    у трека без подстраниц ключей `items` и `collapsed` нет.

- [ ] **Step 2: Failing test в `scripts/modules-graph.test.ts`**

  В `"pageRef: module and track pages by relative path"` добавить:
  `pageRef("modules/2026-10/tracks/bff/contract.md")` → `{ module: "2026-10", track: "bff", page: "contract" }`;
  `pageRef("modules/2026-10/tracks/bff/a/b.md")` → `null`. Прежние случаи не меняются (у трека ключа `page` нет).

- [ ] **Step 3: Run** `bun test scripts/modules.test.ts scripts/modules-graph.test.ts` — FAIL (нет `trackPages`, `moduleSidebar`, лишнее/нет поле `pages`).

- [ ] **Step 4: Implement in `site/.vitepress/modules.ts`**

  `trackPages` использует существующие `strings`, `TRACK_ID`, `requireTitle`; порядок проверок:
  тип списка и элементов → формат id → повтор → файл для каждого id → лишние файлы → `title`.
  `pageRef` — регулярка `^modules\/([^/]+)\/(?:index\.md|tracks\/([^/]+?)(?:\/([^/]+))?\.md)$`,
  ключ `page` только если есть третья группа. `moduleSidebar` без импорта типов VitePress.

- [ ] **Step 5: Run** `bun test scripts/modules.test.ts scripts/modules-graph.test.ts && bun run typecheck` — PASS.

- [ ] **Step 6: Commit**

```bash
git add site/.vitepress/modules.ts scripts/modules.test.ts scripts/modules-graph.test.ts
git commit -m "feat(modules): подстраницы трека, pageRef подстраницы и меню модулей"
```

### Task 2: Читалка — каталоги подстраниц

**Files:**
- Modify: `site/.vitepress/modules-read.ts` (`readModules`)
- Test: `scripts/modules-read.test.ts`

**Interfaces:**
- Consumes: `trackPages`, `parseTrack(…, pages)` из Task 1.
- Produces: `readModules` возвращает треки с заполненным `pages`; ошибки §5.2 спеки с путями от `site/`.

- [ ] **Step 1: Failing tests в `scripts/modules-read.test.ts`** (helper `write`, константа `BFF` уже есть;
  `BFF_PAGES = BFF.replace("---\n\n", "pages: [contract, auth]\n---\n\n")`):

  - `"reads track subpages"`: `2026-10/tracks/bff.md` = `BFF_PAGES`, `bff/contract.md` =
    `"---\ntitle: Контракт\n---\n# x\n"`, `bff/auth.md` = `"---\ntitle: Авторизация и CSRF\n---\n# y\n"`,
    `bff/scheme.png` = `"png"` → `tracks[0].pages.map((p) => [p.id, p.title])` =
    `[["contract", "Контракт"], ["auth", "Авторизация и CSRF"]]`;
  - `"subpage without pages entry"`: `bff.md` = `BFF`, файл `bff/x.md` с title →
    toThrow `modules/2026-10/tracks/bff/x.md: pages — подстраницы нет в pages трека bff.md`;
  - `"subpage directory without a track"`: только `tracks/ghost/a.md` с title (и `bff.md`) →
    toThrow `modules/2026-10/tracks/ghost/a.md: pages — подстраницы нет в pages трека ghost.md`;
  - `"missing subpage file"`: `bff.md` = `BFF_PAGES`, только `bff/auth.md` →
    toThrow `modules/2026-10/tracks/bff.md: pages — нет файла bff/contract.md`;
  - `"subpage YAML error names the file"`: `bff/auth.md` = `"---\ntitle: [x\n---\n"` →
    toThrow `modules/2026-10/tracks/bff/auth.md: frontmatter — `;
  - в `"real site/modules is valid"` — пока без изменений (подстраницы появятся в Task 4).

- [ ] **Step 2: Run** `bun test scripts/modules-read.test.ts` — FAIL.

- [ ] **Step 3: Implement in `readModules`**

  Для каждого `tracks/*.md` — если есть каталог `tracks/<id>/`, прочитать его `*.md` через `readPage`
  (путь `modules/<m>/tracks/<id>/<name>.md`), собрать `found`, вызвать `trackPages`, передать в
  `parseTrack`. Подкаталог `tracks/<dir>/` без `<dir>.md` — ошибка на его первом md-файле (по алфавиту)
  тем же сообщением «подстраницы нет в pages трека <dir>.md». Не-md файлы игнорируются.

- [ ] **Step 4: Run** `bun test scripts/modules-read.test.ts && bun run typecheck` — PASS.

- [ ] **Step 5: Commit**

```bash
git add site/.vitepress/modules-read.ts scripts/modules-read.test.ts
git commit -m "feat(modules): читалка находит подстраницы трека и проверяет их"
```

### Task 3: Переадресация старых адресов `/docs/bff/`

**Files:**
- Modify: `scripts/build-index.ts`, `scripts/build-vitepress.ts` (`protectedFiles`), `scripts/build-site.ts:262`
- Test: `scripts/build-index.test.ts`, `scripts/build-vitepress.test.ts`

**Interfaces:**
- Produces (в `scripts/build-index.ts`):
  - `export const PAGE_REDIRECTS: readonly { file: string; target: string }[]` — ровно:
    `{ file: "bff/index.html", target: "../modules/2026-10/tracks/bff" }`,
    `{ file: "bff/contract.html", target: "../modules/2026-10/tracks/bff/contract" }`,
    `{ file: "bff/auth.html", target: "../modules/2026-10/tracks/bff/auth" }`;
  - `export function renderPageRedirect(target: string): string` — HTML как у `renderRedirect`:
    `<meta name="robots" content="noindex">`, `<title>Страница переехала</title>`,
    `<p>Страница переехала: <a href="${target}">новый адрес</a>.</p>`,
    скрипт `location.replace(${JSON.stringify(target)} + location.hash);`;
  - `export async function writePageRedirects(dist = "dist"): Promise<void>` — пишет каждую в `join(dist, file)`.
  - `protectedFiles` возвращает ещё `PAGE_REDIRECTS.map((r) => r.file)`.

- [ ] **Step 1: Failing tests**

  `scripts/build-index.test.ts`:
  - `"PAGE_REDIRECTS: old BFF pages to the track, relative targets"` — `files` и `targets` ровно как
    выше; ни одна цель не начинается с `/`;
  - `"PAGE_REDIRECTS do not collide with frozen bff diagrams"` — ни один `file` не входит в
    `diagramNames().filter((n) => n.startsWith("bff/")).map((n) => n + ".html")`;
  - `"renderPageRedirect keeps the hash and is not indexed"` — результат содержит
    `noindex`, `href="../modules/2026-10/tracks/bff/auth"`,
    `location.replace("../modules/2026-10/tracks/bff/auth" + location.hash)`; не содержит `decodeURIComponent`;
  - `"writePageRedirects writes three files"` — во временный каталог, проверить три файла.

  `scripts/build-vitepress.test.ts`: `protectedFiles([])` содержит `bff/index.html`, `bff/contract.html`, `bff/auth.html`.

- [ ] **Step 2: Run** `bun test scripts/build-index.test.ts scripts/build-vitepress.test.ts` — FAIL.

- [ ] **Step 3: Implement**; вызвать `writePageRedirects()` в `import.meta.main` `build-index.ts`
  (после `INDEX_FILE`) и в `build-site.ts` рядом с `Bun.write(INDEX_FILE, …)`.

- [ ] **Step 4: Run** `bun test scripts/build-index.test.ts scripts/build-vitepress.test.ts && bun run typecheck` — PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-index.ts scripts/build-vitepress.ts scripts/build-site.ts scripts/build-index.test.ts scripts/build-vitepress.test.ts
git commit -m "feat(index): переадресация старых страниц BFF на трек модуля"
```

### Task 4: Переезд страниц BFF в трек, меню и шапка трека

**Files:**
- Create: `site/modules/2026-10/tracks/bff/contract.md` (из `site/bff/contract.md`, `git mv`),
  `site/modules/2026-10/tracks/bff/auth.md` (из `site/bff/auth.md`, `git mv`)
- Modify: `site/modules/2026-10/tracks/bff.md`, `site/security/csrf/{index,scenarios,checks}.md` (строка 4),
  `site/.vitepress/config.mts`, `site/.vitepress/theme/components/TrackMeta.vue`
- Delete: `site/bff/index.md` (текст уходит в `bff.md`), каталог `site/bff/`
- Test: `scripts/bff-pages.test.ts`, `scripts/modules-read.test.ts` («real site/modules is valid»)

**Interfaces:**
- Consumes: `moduleSidebar`, `pageRef(...).page`, `Track.pages` (Task 1–2).

Точный текст (копировать дословно):

- плашка `TRPC_WARNING` (на трёх страницах; `<ссылка>` — `#trpc` в `bff.md`, `../bff#trpc` на подстраницах):
  ```
  ::: warning
  Решение по tRPC меняет участок клиент → BFF: где в тексте прокси `/api/v1` и список разрешённых маршрутов — это отвергнутый вариант, см. [tRPC](<ссылка>).
  :::
  ```
- раздел в `bff.md` (после «## Ограничения»):
  ```
  ## tRPC

  Решено: между клиентом и BFF всё ходит через tRPC — процедуры в `apps/bff`, клиент получает типы
  импортом из монорепы. Клиент переключается разом: проект учебный, реальных пользователей нет.
  Прокси `/api/v1` и список разрешённых маршрутов в документах трека — отвергнутый вариант; «Контракт»
  и «Авторизация и CSRF» переработаем под tRPC отдельным PR. Безопасность сессии и CSRF не меняется:
  клиент tRPC ставит `X-CSRF: 1`, Go получает Bearer.
  ```
- `TIP` на страницах CSRF:
  `Это текущая реализация; при переезде на BFF её заменяет [Авторизация и CSRF в BFF](/modules/2026-10/tracks/bff/auth).`

- [ ] **Step 1: Переписать `scripts/bff-pages.test.ts` под новые пути (тесты падают)**

  - `BFF_PAGES = ["site/modules/2026-10/tracks/bff.md", "site/modules/2026-10/tracks/bff/contract.md", "site/modules/2026-10/tracks/bff/auth.md"]`;
    `TRACK = BFF_PAGES[0]`, `CONTRACT`, `AUTH` — константы; все `site/bff/...` в файле заменить ими;
  - `firstBlockAfterTitle` → `firstBlock(md)`: срезать frontmatter (`---…---`), если есть строка `# ` —
    брать текст после неё, вернуть первый блок `:::`;
  - `"каждая страница трека начинается с плашки про tRPC"`: на всех трёх `firstBlock` начинается с
    `::: warning`, содержит `Решение по tRPC меняет участок клиент → BFF`; в `TRACK` — `(#trpc)`, на
    подстраницах — `(../bff#trpc)`; нигде нет `Проект трека миграции на BFF, ещё не внедрено`;
  - `"в треке есть раздел tRPC и подстраницы"`: `TRACK` содержит `## tRPC`, `pages: [contract, auth]`,
    `- "tRPC"`; нет строки, начинающейся с `# `;
  - `"в меню нет раздела BFF"` (вместо «в меню есть BFF»): `config.mts` не содержит `text: 'BFF'`,
    `'/bff/'`; содержит `moduleSidebar(`;
  - `"старого раздела нет"`: `existsSync("site/bff")` — false;
  - `"ссылок на /bff/ не осталось"`: ни в одном `site/**/*.md` нет `](/bff/`;
  - `"страницы CSRF ссылаются на трек"`: `TIP` — новый текст;
  - сценарии, «Две вкладки», «Контракт описывает overlay», `openapi-cdd`, «Две VPS» — без изменений
    логики, только пути.

  В `scripts/modules-read.test.ts` («real site/modules is valid»): у трека `bff` —
  `pages.map((p) => p.title)` = `["Контракт", "Авторизация и CSRF"]`.

- [ ] **Step 2: Run** `bun test scripts/bff-pages.test.ts scripts/modules-read.test.ts` — FAIL.

- [ ] **Step 3: Перенести текст**

  - `git mv site/bff/contract.md site/modules/2026-10/tracks/bff/contract.md`, то же для `auth.md`;
    в начало каждой — frontmatter `title: Контракт` / `title: Авторизация и CSRF`; старую плашку
    заменить на `TRPC_WARNING`; ссылки: `(/bff/)`, `(./)` → `(../bff)`; `(/bff/contract…)`,
    `(./contract…)` → `(./contract…)`; `(/bff/auth…)`, `(./auth…)` → `(./auth…)`; `(/bff/#…)` → `(../bff#…)`;
  - `site/modules/2026-10/tracks/bff.md`: frontmatter + `pages: [contract, auth]`; тело —
    `TRPC_WARNING`, строка «Подзадачи — со стороны фронта (Денис).», текст `site/bff/index.md` без h1 и
    без старой плашки, ссылки `(/bff/contract…)` → `(./bff/contract…)`, `(/bff/auth…)` → `(./bff/auth…)`,
    `(/bff/#…)` → `(#…)`; в конце — раздел `## tRPC`;
  - `git rm site/bff/index.md`;
  - CSRF: строка 4 трёх страниц — новый `TIP`.

- [ ] **Step 4: Меню и шапка**

  - `config.mts`: убрать `{ text: 'BFF', … }` из `nav` и `'/bff/'` из `sidebar`;
    `'/modules/': moduleSidebar(modules)`;
  - `TrackMeta.vue`: `found` различает трек и подстраницу (`ref.page`). Для трека с `pages.length` —
    в `dl` строка `<dt>Документы</dt>` и `<dd>` со ссылками `withBase(p.url)` через запятую. Для
    подстраницы — вместо шапки `<p class="eyebrow track-crumb">Трек <a>{{ track.title }}</a> · <a>{{ module.title }}</a></p>`
    (ссылки `withBase(track.url)`, `withBase(module.url)`), без h1, «Делают», задач и плашки
    «Описание ещё не написано».

- [ ] **Step 5: Run** `bun run typecheck && bun run test` — PASS.

- [ ] **Step 6: Commit**

```bash
git add -A site scripts/bff-pages.test.ts scripts/modules-read.test.ts
git commit -m "feat(site): документация BFF — в треке модуля, раздел /bff/ убран"
```

### Task 5: Правило «модули — план, остальное — прод» в документации

**Files:**
- Modify: `CLAUDE.md`, `README.md` (раздел «### Модули»), `site/modules/index.md`
- Test: `scripts/bff-pages.test.ts`

- [ ] **Step 1: Failing test в `scripts/bff-pages.test.ts`** — `"правило модулей записано"`:
  `CLAUDE.md` содержит `## Что где лежит`, `Схемы корня описывают прод`, `tracks/<id>/<page>.md`;
  не содержит `Схемы описывают целевое состояние`; `README.md` содержит `pages: [`;
  `site/modules/index.md` содержит `Здесь план`.

- [ ] **Step 2: Run** `bun test scripts/bff-pages.test.ts` — FAIL.

- [ ] **Step 3: Написать текст**

  - `CLAUDE.md`: после «## Проект» — «## Что где лежит» тремя пунктами из спеки §4 (модули — план;
    остальные разделы и схемы корня — прод, утверждения о коде со ссылкой на SHA; трек сделан — страницы
    не правятся, сверху `::: info` «Сделано. Как работает сейчас — [раздел]», прод описывается вне
    модулей). В «Схемах»: «Схемы описывают целевое состояние.» → «Схемы корня описывают прод.».
    Строка про модули в «Сборке» дополняется: подстраницы — `tracks/<id>/<page>.md` и список `pages`
    во frontmatter трека, формат — `docs/superpowers/specs/2026-10-08-bff-into-module-design.md` §5.
  - `README.md`, «### Модули»: абзац с правилом; в описании трека — подстраницы и пример
    `pages: [contract, auth]` в блоке frontmatter.
  - `site/modules/index.md` под вводной фразой: «Здесь план: что ещё будет сделано. Как работает прод —
    [Архитектура](/architecture/) и [Безопасность](/security/csrf/).»

- [ ] **Step 4: Run** `bun run typecheck && bun run test` — PASS.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md README.md site/modules/index.md scripts/bff-pages.test.ts
git commit -m "docs: модули — план, остальное — прод; подстраницы трека"
```

### Task 6: Сборка и приёмка в браузере

**Files:** без изменений кода, если проверка ничего не нашла.

- [ ] **Step 1: Сборка** `DIAGRAMS_NATIVE=1 bun run build` — без ошибок, `site ok: N pages`; N не
  меньше, чем у той же команды на `origin/main` (три страницы `/bff/` заменены тремя переадресациями,
  подстраницы переехали). `ls dist/bff/` — `index.html`, `contract.html`, `auth.html` (переадресации) и схемы
  `cd/ci/deployment/frontend-monorepo/infra.html|.png`.
- [ ] **Step 2: Локальный сервер** из `dist/` под `/docs/` (как в прошлых сессиях: порт 8793), агентский
  Chrome (chrome-devtools MCP):
  - `/docs/modules/2026-10/tracks/bff` — шапка трека со строкой «Документы», плашка tRPC, раздел
    «tRPC», меню слева «BFF → Контракт, Авторизация и CSRF»;
  - `/docs/modules/2026-10/tracks/bff/auth` — строка «Трек BFF · Модуль октября 2026» над h1, большой
    шапки нет, mermaid нарисованы;
  - `/docs/bff/auth#две-вкладки` → адрес подстраницы с `#две-вкладки`, раздел у верхнего края;
  - `/docs/bff/#две-vps` → страница трека на разделе «Две VPS»;
  - верхнее меню без «BFF»; плашка на `/docs/security/csrf/` ведёт на подстраницу;
  - 375 px и тёмная тема на треке и подстранице.
- [ ] **Step 3:** найденное — исправить с тестом и отдельным коммитом `fix(...)`; повторить Step 1–2.
