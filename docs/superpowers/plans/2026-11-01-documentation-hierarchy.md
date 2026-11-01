# Иерархия документации Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перенести документацию под `/documentation/`, сохранить единое вложенное меню и показать полный бренд в существующей шапке.

**Architecture:** Физические переносы Markdown и штатный VitePress sidebar; пять относительных PAGE_REDIRECTS и существующий diagramTarget сохраняют старые входы. Небольшой CSS override исправляет перенос названия, существующий Puppeteer-скрипт проверяет поведение. Решения автора и область разрешённых замен зафиксированы в спецификации.

**Tech Stack:** Bun ≥1.3, Node ≥22.22.0, TypeScript, VitePress 2.0.0-alpha.21, Vue, существующие Nolebase/Tabs/Group Icons, Puppeteer.

**Spec:** `docs/superpowers/specs/2026-11-01-documentation-hierarchy-design.md`

## Global Constraints

- VitePress остаётся `2.0.0-alpha.21`; Enhanced Readabilities и Inline Link Preview — `2.21.1`, Tabs — `0.9.1`, Group Icons — `1.8.1`; `package.json` и `bun.lock` не меняются.
- Канонические страницы физически лежат в `site/documentation/`; штатные VitePress `cleanUrls`, sidebar и `PAGE_REDIRECTS` обслуживают маршруты без нового роутера или rewrite-слоя.
- Текст, порядок и ID заголовков, статусы, даты, SHA, code/Mermaid-блоки и имена `<Diagram>` сохраняются; допустимы только согласованные замены внутренних адресов и путей авторинга.
- HTML/PNG корневых схем остаются по прежним адресам; `diagrams/**`, архивные `docs/superpowers/**` и генерируемые `openwiki/**` не редактируются (исключение — документы этой задачи).
- `/modules/` и OpenWiki сохраняют свою навигацию; FullWidth по умолчанию, сохранённый узкий режим, fastdom, Mermaid-прокрутка и Eraser сохраняют поведение.
- Видимый бренд — ровно `Cringe Driven Development`, не более двух естественных строк при прежних размере шрифта, ширине sidebar и высоте navbar; сохраняются ссылка, клавиатурный доступ и tooltip.
- Все новые и старые адреса проверяются при `SITE_BASE=/` и `SITE_BASE=/branches/docs-documentation-hierarchy/`; вложенная база не теряется при переходах, поиске и переадресациях.
- Работа идёт в `docs/documentation-hierarchy`; результат доставки — draft PR в `main` и настоящее превью текущего head, без merge, push в `main`, force-push или публикации пакетов.

## Review Focus

1. Старый deep link с кириллицей/percent-encoding в root и branch сохраняет fragment и показывает прежний заголовок; неизвестный hash индекса схем получает новый fallback — Task 1, redirect/hash tests + `hierarchy` browser.
2. Прямой вход/reload/Back в ребёнка CSRF раскрывает родителя, оставляет всех соседей и не лишает ссылки на обзор; мобильная caret работает с клавиатуры — Task 1, sidebar test + `hierarchy` browser.
3. Полный `textContent` может оставаться за ellipsis: каждый символ бренда реально виден в ≤2 строках на 320…1440 px, без пересечения controls, с сохранённым узким режимом — Task 2, `title` browser Range assertions.
4. Новый путь архитектуры не должен внезапно стать тяжёлым hover-preview; модульная `offline/architecture` остаётся допустимой, корневые HTML/PNG не переезжают — Task 1, preview unit/browser + asset checks.
5. Переезд не меняет исторические свидетельства/ID и не превращает raw OpenWiki href в `/documentation/openwiki/`; поиск находит канонический путь — Task 1, baseline comparison + source tests + browser full-document/search; Task 3 повторяет на обеих базах и опубликованном head.

---

## Исполнение и карта файлов

Пользователь уже выбрал **SDD** и отменил ожидание макета/согласований. Контроллер делает builder/preflight перед реализацией; затем последовательные writers и свежий reviewer на каждую задачу, полный итоговый reviewer после них. Не создавать второй worktree и не начинать параллельную запись общих файлов.

Рабочий каталог: `/home/oleg/2026_H2/docs/.claude/worktrees/docs-readability`. SDD evidence: `.superpowers/sdd/2026-11-01-documentation-hierarchy/`. Для browser всегда задавать `READABILITY_ARTIFACTS_DIR=.superpowers/sdd/2026-11-01-documentation-hierarchy/readability`; fallback обычного запуска — `.superpowers/readability`. Старую SDD-папку не использовать.

Файлы сгруппированы по ответственности в Tasks ниже. Переносы, sidebar, redirects, ссылки и необходимые тесты составляют **один атомарный коммит** Task 1; следующий исполнитель получает рабочий head. Архивные планы, произвольные тестовые fixture-адреса и generated OpenWiki не подвергаются массовой замене.

### Task 1: Атомарно перенести namespace, дерево и всех потребителей

**Files:**
- Move: пять Markdown-пар из таблицы спецификации; старые исходники удалить переносом, не оставлять копий.
- Modify: `site/.vitepress/config.mts`, `site/.vitepress/site.ts`, `site/.vitepress/link-preview.ts`, `scripts/build-index.ts`.
- Modify: `site/documentation/index.md`, `site/documentation/bff.md`, перенесённые страницы; только адреса в `site/modules/2/tracks/bff/auth.md`, `site/modules/2/tracks/bff/migration.md`, `site/modules/2/tracks/front-harness/service-context.md`.
- Modify: `README.md`, `AGENTS.md`, `.agents/skills/docs-site/SKILL.md`; sync: `.claude/skills/docs-site/SKILL.md`.
- Test/Modify: `scripts/architecture-page.test.ts`, `scripts/build-index.test.ts`, `scripts/site-base.test.ts`, `scripts/bff-pages.test.ts`, `scripts/openwiki-pages.test.ts`, `scripts/readability-links.test.ts`, `scripts/check-openwiki-navigation.ts`, `scripts/check-readability.ts`.
- Inspect/preserve: `site/.vitepress/theme/index.ts` (использует общий diagramTarget без изменения сигнатуры), `scripts/build-vitepress.ts`, `.openwikiignore`, `scripts/openwiki-source-path.ts`, `scripts/openwiki-check.test.ts`.

**Interfaces:**
- Consumes: `diagramTarget(hash: string, rootNames: readonly string[], hiddenFolders: readonly string[]): string | null`, `renderRedirect(rootNames: readonly string[]): string`, `renderPageRedirect(target: string): string`, `PAGE_REDIRECTS: readonly { file: string; target: string }[]`.
- Consumes/preserves: `canPreviewDocLink(href: string, currentHref: string, siteBase: string): boolean`; сигнатуры не меняются.
- Produces: пять канонических маршрутов и redirect-пары из спецификации; одно `themeConfig.sidebar['/documentation/']` и `activeMatch: '^/documentation/'`.
- Produces: `check-readability.ts` принимает секцию `hierarchy` наряду с `scroll|pages|plugins`; `async function checkHierarchy(browser: Browser, url: (path: string) => string): Promise<void>` использует имеющиеся server/observe/artifacts. Без аргументов исполняются все секции.
- Produces: baseline-файлы `baseline-head.txt`, `baseline-headings.json` (`Record<string, string[]>`, ключ — старый route), `baseline-sources.json` (`Record<string, { sha256: string; text: string }>`, ключ — исходный sourcePath), `baseline-header.json` (`Array<{ route: string; viewport: number; mode: number | null; fontSize: string; navHeight: number; sidebarWidth: number }>`) в SDD-каталоге для Task 2/3 и review; они не коммитятся.

- [ ] **Step 1: Зафиксировать исходное состояние до изменений.** Проверить `git status`, head/ветку, прочитать spec; построить исходный head командой `CHROMIUM_PATH=/opt/google/chrome/chrome DIAGRAMS_NATIVE=1 bun run build`, exit 0. Если окружение требует `wiki:prepare`, выполнить существующую команду, не обновление wiki. Сохранить SHA всех пяти исходников, их полный текст, реальные `h1…h6[id]` из `.vp-doc` пяти HTML, размеры шапки/шрифт/sidebar на ширинах и страницах из Task 2 (для переносимых страниц — их старый route), с чистым storage и mode `3`. Сохранить исходные снимки 390/960/1440 и git tree IDs `diagrams/`, `openwiki/`. Не объявлять существующий dist свежим baseline без этой сборки.

- [ ] **Step 2: Написать красные тесты контракта и поведения.** В `architecture-page.test.ts` тестом `documentation sidebar is a linked collapsed tree` заменить проверку двух равных sidebar на структуру одного дерева с пятью ссылками в точном порядке; у CSRF assert `collapsed === true`, `link === '/documentation/csrf/'`, ровно два ребёнка, нет обзорного дубля и старых sidebar-ключей. Сохранить проверки статуса, дат, SHA и схем. В `build-index.test.ts` тестом `documentation redirects preserve base and hashes` добавить пять точных redirect-пар и выполнить их JS через существующий VM helper; для каждой пары и баз `/`, `/branches/docs-documentation-hierarchy/` assert `new URL(actual, oldUrl).pathname === canonicalPathWithBase` и неизменный hash. В `site-base.test.ts` тест `diagramTarget uses documentation namespace`: assert `diagramTarget('#ci', ['ci'], ['bff']) === 'documentation/architecture/#ci'`, unknown/malformed → `documentation/architecture/`, пустой → `null`, скрытая схема → прежний HTML. Проверить и fallback `<a>` в `renderRedirect`.

- [ ] **Step 3: Закрепить Review Focus 4–5 тестами в том же цикле.** В `readability-links.test.ts` тест `preview respects documentation routes` для обеих баз: assert false для `${base}documentation/architecture/`, `${base}documentation/architecture/index.html`, `${base}architecture/` и `${base}architecture/index.html`; assert true для новых CSRF/контекста/BFF и относительной `./architecture` из offline/theory; существующие cross-base/asset/wiki assertions сохранить. В тестах реальных страниц обновить пути `PAGE`, `CSRF_PAGES` и чтение контекста; `openwiki-pages.test.ts` ожидает `href="../openwiki/"`. Ссылка `.../architecture/#contract` проверяется парой ссылка/целевой заголовок в `architecture-page.test.ts`. Подготовить `hierarchy` browser-проверки Step 6 до продуктовых правок, обновить пути существующих checks и env артефактов; выполнить `bun test scripts/architecture-page.test.ts scripts/build-index.test.ts scripts/site-base.test.ts scripts/bff-pages.test.ts scripts/openwiki-pages.test.ts scripts/readability-links.test.ts` и browser `hierarchy` командой Step 6, записать ожидаемые FAIL из-за отсутствующих новых путей/дерева. Нельзя принимать missing dependency как содержательный RED.

- [ ] **Step 4: Реализовать единую миграцию.** `git mv` по таблице; поставить дерево/activeMatch из spec; добавить redirects; поменять только корневые назначения/fallback diagramTarget и renderRedirect. Обновить канонические ссылки, README/AGENTS/repo docs-site и raw wiki href, выполнить `bun run skills:sync`. В preview predicate исключить оба архитектурных namespace, не затрагивая module architecture. Сохранить source selectors OpenWiki для обнаружения удалений. В `check-readability.ts` использовать `process.env.READABILITY_ARTIFACTS_DIR || '.superpowers/readability'`; обновить все реальные route/selector/screenshot regex references и CLI whitelist для `hierarchy`. Нового продуктового состояния/фреймворка нет.

- [ ] **Step 5: Проверить полноту переноса и сохранение содержания.** `rg` по прежним путям в `site scripts README.md AGENTS.md .agents/skills .claude/skills`; каждый остаток классифицировать как redirect/test старого входа, source selector либо независимая fixture/чужой URL. Сравнить пять текстов с baseline после только разрешённых замен URL; code/Mermaid и `<Diagram>` должны совпасть побайтово. Деревья diagrams/wiki и архивные планы неизменны. Обновлённые skills-копии совпадают. `bun run typecheck && bun run test && bun run modules:check` → exit 0.

- [ ] **Step 6: Построить и доказать маршруты реальным браузером.** Повторить native build и сравнить все heading IDs с baseline (порядок, уникальность), затем `CHROMIUM_PATH=/opt/google/chrome/chrome READABILITY_ARTIFACTS_DIR=.superpowers/sdd/2026-11-01-documentation-hierarchy/readability bun scripts/check-readability.ts hierarchy` → exit 0. `checkHierarchy` проверяет:
  - На 1440/390: все семь канонических страниц раздела имеют то же дерево; заход из Документации в CSRF/scenarios, reload, переход на checks и Back оставляют родителя/соседей и active link. Начальное `aria-expanded=false` вне CSRF, `true` после прямого входа в ребёнка; caret посредством Enter/Space меняет `aria-expanded`, ссылка родителя открывает обзор. На mobile открыть «Меню», Escape возвращает focus инициатору. SPA доказывается window-marker; headings остаются в outline.
  - Для пяти старых URL прямой вход и hash: `#архитектура-mvp`, `#владельцы-командных-пакетов`, `#три-cookie`, `#первыи-заход-в-чистом-браузере`, `#известные-ограничения`; проверить исходную и percent-encoded формы, конечные pathname/hash и видимый целевой heading после Mermaid. Сверить ID со свежим baseline; не вычислять их из заголовков самостоятельно.
  - `/#contract`, `/diagrams/#contract`, malformed/unknown diagram hash, `#frozen-k3s/ci`; все конечные пути/файлы из spec. У архитектурной карточки `contract` iframe/link остаётся `${SITE_BASE}contract.html`, PNG — `${SITE_BASE}contract.png`, HTTP 200.
  - С документа контекста реальный click OpenWiki создаёт новый document (marker исчез), URL `${SITE_BASE}openwiki/`, есть статическая provenance. Сохранить отдельный `check-openwiki-navigation.ts` с новым source path.
  - Открыть штатный поиск, найти уникальный заголовок «CSRF: сценарии», перейти в результат; URL имеет `${SITE_BASE}documentation/csrf/scenarios`, активный родитель виден. Hover архитектуры не создаёт preview iframe, hover разрешённой текстовой ссылки создаёт правильный iframe в текущей базе. Ошибок наблюдателя нет.

- [ ] **Step 7: Зафиксировать атомарный результат и пройти gate задачи.** Проверить diff и `git diff --check`, закоммитить только перечисленные продуктовые/тестовые/авторские файлы: `feat(документация): собрать страницы в единое дерево`. Передать контроллеру коммит, RED/GREEN, baseline и остатки `rg`; свежий reviewer проверяет всю миграцию до Task 2.

### Task 2: Показать полное название без изменения размеров шапки

**Files:**
- Modify: `site/.vitepress/theme/custom.css`.
- Test/Modify: `scripts/check-readability.ts`.

**Interfaces:**
- Consumes: рабочие маршруты Task 1, baseline-header/sources и общий server/observe/artifacts скрипта.
- Produces: CSS для `.VPNavBarTitle .title > span`; нативные `<a>`/tooltip/markup остаются.
- Produces: CLI-секция `title`, `async function checkTitle(browser: Browser, url: (path: string) => string): Promise<void>`, также вызываемая запуском без аргументов.

- [ ] **Step 1: Добавить красную браузерную проверку Review Focus 3.** `checkTitle` открывает `/`, `/documentation/`, `/documentation/csrf/scenarios`, `/modules/2/tracks/bff` на 320/390/768/960/1280/1440 px в обеих темах, с чистым storage и сохранённым Nolebase mode `3` (`LayoutMode.Original`, узкий режим). Для `.VPNavBarTitle .title > span` получить `Range.getClientRects()` каждого непустого символа: каждый rect находится внутри видимой области span, ссылки и navbar с допуском 1 px; число уникальных строк ≤2, ни один символ не пересекает controls. Assert точного бренда, `title` ссылки, ожидаемого href главной с базой; записать fontSize/navHeight/sidebarWidth для отдельного сравнения с baseline. Коммитируемый browser-скрипт самодостаточен и не читает временные baseline-файлы SDD; геометрию исходной шапки сравнивает исполнитель по JSON до коммита. Убедиться в отсутствии горизонтального overflow; через Tab сфокусировать ссылку и Enter перейти домой. Проверить resize 1440→390→1440 с тем же storage. Сохранить JSON измерений и screenshots 390/960/1440. `textContent`, screenshot или CSS string отдельно не считаются доказательством.

- [ ] **Step 2: Выполнить RED на собранном Task 1.** Запустить `CHROMIUM_PATH=/opt/google/chrome/chrome READABILITY_ARTIFACTS_DIR=.superpowers/sdd/2026-11-01-documentation-hierarchy/readability bun scripts/check-readability.ts title`; сохранить конкретные FAIL clipped range, не ослаблять проверку до счётчика строк.

- [ ] **Step 3: Добавить минимальный CSS override.** Разрешить естественный перенос span, устранить ellipsis/обрезание и подобрать line-height, чтобы две строки помещались при прежней высоте. Не менять ширину sidebar, font-size, бренд, HTML компонентов и размеры controls. Сверить rendered результат с reference lock спецификации.

- [ ] **Step 4: Проверить GREEN и обязательные проверки.** `bun run typecheck && bun run test && bun run modules:check`; native build той же командой, затем browser `title hierarchy`, все exit 0. Вручную осмотреть новые 390/960/1440 screenshots; baseline размеры сохранены, никаких пересечений/обрезания. Коммит `fix(документация): показать полное название сайта`; контроллер направляет свежему reviewer измерения и diff до Task 3.

### Task 3: Проверить обе базы и доставить draft PR с настоящим превью

**Files:**
- Product: новых файлов не требуется; обнаруженный дефект исправляется минимально в файле владельца и получает соответствующий повтор тестов/review.
- Evidence: `.superpowers/sdd/2026-11-01-documentation-hierarchy/verification.md`, browser logs/screenshots, CI/run URLs, head/SHA preview.

**Interfaces:**
- Consumes: завершённые Task 1/2 и их review, `check-readability.ts [scroll|pages|plugins|hierarchy|title ...]`, `READABILITY_ARTIFACTS_DIR`, обе SITE_BASE из Global Constraints.
- Produces: свежий head, draft PR URL, Actions build/deploy URLs и подтверждённый preview URL/SHA; однозначные результаты проверок без подмены CI локальной сборкой.

- [ ] **Step 1: Интегрировать актуальный main.** Сначала чистый status, затем `git fetch origin main`; сравнить с merge-base и при новых коммитах влить `origin/main` в текущую ветку без force. Разрешать конфликты по spec, сохраняя соседние OpenWiki/readability/sidebar изменения. Зафиксировать итоговый head и любые поправки; если код изменился, повторить относящиеся к нему RED/GREEN и review. Не менять wiki checkpoint ради зелёного статуса.

- [ ] **Step 2: Выполнить root acceptance.** `bun run typecheck && bun run test && bun run modules:check`, native build, затем полный `CHROMIUM_PATH=/opt/google/chrome/chrome READABILITY_ARTIFACTS_DIR=.superpowers/sdd/2026-11-01-documentation-hierarchy/readability bun scripts/check-readability.ts` и `CHROMIUM_PATH=/opt/google/chrome/chrome bun scripts/check-openwiki-navigation.ts`. Ожидание: exit 0, все 44 Mermaid, плагины/сохранённые режимы/модули, hierarchy/title. Повторно сравнить baseline ID/содержание и git diff неизменяемых деревьев; не переписывать старые планы/генерируемую wiki.

- [ ] **Step 3: Выполнить nested acceptance.** Собрать с `SITE_BASE=/branches/docs-documentation-hierarchy/ CHROMIUM_PATH=/opt/google/chrome/chrome DIAGRAMS_NATIVE=1 bun run build`; повторить обе browser-команды Step 2 с тем же `SITE_BASE`. Все direct/reload/SPA/search/old redirect/asset/OpenWiki переходы остаются внутри базы; все exit 0. В evidence отдельно назвать native-build и browser, а не Docker CI.

- [ ] **Step 4: Проверить ветку и открыть draft PR.** После локальных проверок и проверки diff/head push только `docs/documentation-hierarchy`; создать draft PR в `main`, разделы «Что», «Решения», «Проверка», ссылка на `/branches/docs-documentation-hierarchy/documentation/`. Использовать конкретный slug из фактического списка веток, если произошла коллизия. PR не вливать.

- [ ] **Step 5: Подтвердить настоящее превью текущего head.** Дождаться branch `dispatch`, затем связанного Pages run на `main`, проверить его Docker build и deploy, состояние ветки в `/branches/` и совпадение SHA с draft PR head. Проверить на опубликованной базе дерево/CSRF deep link+reload, старые пять redirects с hash, полный title на 390/960/1440, поиск, исключение тяжёлого preview и OpenWiki full navigation. Не считать 200 старого preview или зелёный dispatch успехом. При сбое ветки исправить его и повторить; при time budget/сервисной ошибке получить свежий запуск и явно записать результат, без merge как обхода проблемы.

- [ ] **Step 6: Завершить evidence и handoff.** В `verification.md` перечислить head, команды/exit codes, CI и preview SHA, ссылки на RED/GREEN/screenshots/review rulings и оставшиеся ограничения. Контроллер проводит свежий review Task 3, затем strongest whole-branch review; замечания исправляются с повтором проверок, push и свежим CI/preview для изменённого head. После зафиксированных решений review контроллер архивирует отчёт и доказательства вне удаляемого SDD-каталога; только после этого удаляет этот SDD workspace. Ветка/worktree/draft PR остаются для просмотра. Финальный ответ содержит результат, PR/preview и честно названные непроверенные условия.
