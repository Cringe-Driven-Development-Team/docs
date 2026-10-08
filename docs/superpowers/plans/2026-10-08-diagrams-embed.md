# Схемы внутри VitePress: раздел «Архитектура» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Страница VitePress `/architecture/` с шестью схемами MVP в карточках с масштабом и перетаскиванием вместо белого индекса `/docs/diagrams/`; старые адреса переадресуются.

**Architecture:** Компонент `Diagram.vue` показывает HTML схемы во фрейме в натуральную величину и масштабирует обёртку `@panzoom/panzoom`; размеры — загрузчик данных VitePress из PNG в `dist/`. Чистая логика (масштаб, переадресация) — в TS-модулях с тестами `bun test`; `build-index.ts` пишет вместо индекса страницу-переадресацию.

**Tech Stack:** Bun 1.3, TypeScript, VitePress 1.6.4 (Vue 3), `@panzoom/panzoom` 4.6.2.

**Spec:** `docs/superpowers/specs/2026-10-08-diagrams-embed-design.md`

## Global Constraints

- `@panzoom/panzoom` `4.6.2` в devDependencies из публичного npm (`BUN_CONFIG_REGISTRY=https://registry.npmjs.org/ bun add -d @panzoom/panzoom@4.6.2`); `grep -cE 'https?://' bun.lock` → `0`.
- Натуральный размер холста схемы = PNG / 2 (округление `Math.round`); нет PNG — `{ width: 1600, height: 900 }` и текст «Схема не отрисована: `bun run render`».
- Масштаб: от «вписать» (`min(1, ширина рамки / ширина холста)`) до `4`; шаг кнопок `1.25`; колесо — только с Ctrl или ⌘; щипок и перетаскивание мышью и пальцем.
- iframe: `src="<base><имя>.html"`, `loading="lazy"`, `sandbox=""`, `title="Схема <имя>"`; поверх — прозрачный слой, ловит указатель.
- Высота рамки — `min(70vh, высота холста × масштаб «вписать»)`; холст белый в обеих темах; рамка — `--vp-c-divider`, `--vp-c-bg-soft`; кнопки `<button>` с `aria-label`: «Уменьшить», «Увеличить», «Вписать», «На весь экран».
- Полный экран: `requestFullscreen` у рамки; если его нет — `position: fixed; inset: 0` поверх страницы; `Esc` и кнопка закрывают; при входе и выходе — «вписать».
- Страница: `site/architecture/index.md`, `# Архитектура: MVP`, `aside: false`, разделы `## deployment`, `## ci`, `## cd`, `## frontend`, `## contract`, `## infra` в этом порядке.
- nav: «Архитектура» → `/architecture/`, `activeMatch: '^/architecture/'`, без `target`; «Превью веток» → `/branches/`, `target: '_self'`, только при `SITE_BASE === '/docs/'`.
- Переадресация: `#<схема корня>` → `architecture/#<имя>`; `#<скрытая папка>/<имя>` (папки `HIDDEN_FOLDERS`) → `<папка>/<имя>.html`; иное непустое → `architecture/`; пустой или `#` → `null`.
- Тексты по-русски; коммиты `тип(область): что сделано`; не пушить до последней задачи.
- Проверка перед коммитом: `bun run typecheck && bun run test && DIAGRAMS_NATIVE=1 bun run build` (`CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`).

## Review Focus

1. Колесо без модификатора листает страницу, а не масштабирует схему; Ctrl/⌘ + колесо не масштабирует всю страницу браузера (`preventDefault` только в этом случае) — проверка в задаче 5.
2. Ресайз окна и поворот телефона пересчитывают «вписать», схема не вылезает за рамку — `ResizeObserver`, проверка в задаче 5.
3. Превью ветки: iframe грузит `/docs/branches/<slug>/<имя>.html`, не `/docs/<имя>.html` — `withBase`, проверка в задаче 5.
4. Старые ссылки из README, PR и чатов: `/docs/diagrams/#contract`, `/docs/diagrams/#bff/ci`, `/docs/#ci` ведут куда надо — тест в задаче 1, проверка в задаче 5.
5. iPhone: полноэкранный режим без Fullscreen API открывается и закрывается, страница под ним не прокручивается — проверка в задаче 5 (эмуляция без `requestFullscreen`).

---

### Task 1: Переадресация вместо индекса

**Files:**
- Modify: `site/.vitepress/site.ts`, `site/.vitepress/theme/index.ts:42-52`, `scripts/build-index.ts`, `scripts/build-site.ts:8,250-254`, `scripts/build-index.test.ts`, `scripts/site-base.test.ts`, `scripts/check-site.ts:65-77`, `scripts/check-site.test.ts`

**Interfaces:**
- Produces: `site/.vitepress/site.ts`: `export function diagramTarget(hash: string, rootNames: readonly string[], hiddenFolders: readonly string[]): string | null` — путь от корня сайта без базы; `diagramsRedirect` удаляется.
- Produces: `scripts/build-index.ts`: `export function renderRedirect(rootNames: readonly string[]): string` — HTML переадресации; `renderIndex`, `indexTabs`, `ROOT_TAB`, карточки и стили табов удаляются; `indexNames`, `HIDDEN_FOLDERS`, `diagramNames`, `pngSize`, `pngSizes`, `INDEX_FILE` остаются.
- Produces: theme `index.ts` вызывает `diagramTarget(location.hash, ROOT_NAMES, HIDDEN_FOLDERS)` с `ROOT_NAMES` из нового файла `site/.vitepress/diagram-names.ts` (`export const ROOT_NAMES = ["cd", "ci", "contract", "deployment", "frontend", "infra"]`, `export const HIDDEN_FOLDERS = ["bff", "frozen-k3s"]`), а `build-index.ts` реэкспортирует `HIDDEN_FOLDERS` оттуда; тест сверяет `ROOT_NAMES` с `indexNames(diagramNames())`.

- [ ] **Step 1: Тесты**
  - `site-base.test.ts`, `test("diagramTarget: anchors of root diagrams go to architecture/, hidden folders to the diagram HTML")`: `diagramTarget("#ci", ["ci"], ["bff"])` → `"architecture/#ci"`; `("#bff/ci", ["ci"], ["bff"])` → `"bff/ci.html"`; `("#nope", …)` → `"architecture/"`; `("#other/ci", …)` → `"architecture/"`; `("", …)` и `("#", …)` → `null`; `("#%D1%86", …)` декодируется и даёт `"architecture/"`.
  - `build-index.test.ts`: удалить тесты `renderIndex`/`indexTabs`; `test("renderRedirect: noindex, link to architecture/ and a script that follows diagramTarget")` — HTML содержит `<meta name="robots" content="noindex">`, `<a href="../architecture/">`, JSON имён; выполнить встроенный скрипт через `new Function("location", script)` с `{ hash: "#ci", replace(u) {…} }` → `replace` вызван с `"../architecture/#ci"`; с `#bff/ci` → `"../bff/ci.html"`; с пустым hash → `"../architecture/"`.
  - `diagram-names` тест (в `build-index.test.ts`): `test("ROOT_NAMES matches the root diagrams")` — `ROOT_NAMES` равен `indexNames(diagramNames())`.
  - `check-site.test.ts`: `test("checkSite: iframe src must exist, links into branches/ are skipped")` — фикстура с `<iframe src="/docs/x.html">` без файла → проблема; с файлом — нет; `<a href="/docs/branches/">` → без проблем.
- [ ] **Step 2:** `bun test scripts/site-base.test.ts scripts/build-index.test.ts scripts/check-site.test.ts` → FAIL на новых тестах.
- [ ] **Step 3: Реализация.** `diagramTarget` в `site.ts`; `renderRedirect` встраивает `String(diagramTarget)` и JSON `ROOT_NAMES`/`HIDDEN_FOLDERS`, вызывает `location.replace("../" + (target ?? "architecture/"))`. `main` в `build-index.ts` пишет `renderRedirect(ROOT_NAMES)` в `INDEX_FILE`; `build-site.ts:250-254` пишет то же (без `previewsHref`, без `pngSizes`). Theme: если `location.pathname === base`, `diagramTarget(...)` не `null` → `location.replace(base + target)`. `check-site.ts`: в `referencesOf` добавить `iframe` (атрибут `src`, вид `link`); в проверке ссылок пропускать путь, начинающийся с `<base>branches/`.
- [ ] **Step 4:** те же тесты → PASS; полная проверка из Global Constraints → зелёная (временно nav «Архитектура» ещё ведёт на `/diagrams/`, переадресация уводит на несуществующую `/architecture/` — `site:check` не ходит по скриптам, поэтому зелёный).
- [ ] **Step 5: Commit** `feat(site): переадресация старого индекса схем на /architecture/`.

### Task 2: Размеры схем и логика масштаба

**Files:**
- Create: `site/.vitepress/theme/diagrams.data.ts`, `site/.vitepress/theme/diagram-scale.ts`, `scripts/diagram-scale.test.ts`, `scripts/diagram-sizes.test.ts`

**Interfaces:**
- Consumes: `pngSize(path)` из `scripts/build-index.ts`, `ROOT_NAMES` из `site/.vitepress/diagram-names.ts`.
- Produces: `diagrams.data.ts`: `export interface DiagramSize { width: number; height: number; rendered: boolean }`; `export function canvasSize(png: { width: number; height: number } | undefined): DiagramSize` (PNG / 2 c `Math.round`, нет PNG → `{ 1600, 900, rendered: false }`); `export default { async load(): Promise<Record<string, DiagramSize>> }` — для всех `diagramNames()` читает `dist/<имя>.png`.
- Produces: `diagram-scale.ts`: `export const MAX_SCALE = 4`, `export const STEP = 1.25`; `export function fitScale(frameWidth: number, canvasWidth: number): number` (`min(1, frameWidth / canvasWidth)`); `export function frameHeight(canvasHeight: number, fit: number, viewportHeight: number): number` (`min(0.7 × viewportHeight, canvasHeight × fit)`); `export function stepScale(current: number, direction: 1 | -1, min: number): number` (умножить/разделить на `STEP`, зажать в `[min, MAX_SCALE]`).

- [ ] **Step 1: Тесты** `diagram-scale.test.ts`: `fitScale(800, 1636)` ≈ `0.489`; `fitScale(2000, 1636)` → `1`; `frameHeight(732, 0.5, 1000)` → `366`; `frameHeight(2264, 0.5, 1000)` → `700`; `stepScale(1, 1, 0.4)` → `1.25`; `stepScale(3.5, 1, 0.4)` → `4`; `stepScale(0.45, -1, 0.4)` → `0.4`. `diagram-sizes.test.ts`: `canvasSize({ width: 3272, height: 1464 })` → `{ width: 1636, height: 732, rendered: true }`; `canvasSize(undefined)` → `{ width: 1600, height: 900, rendered: false }`; `test("PNG / 2 equals the root canvas of every root diagram HTML")` — если `dist/deployment.png` нет, `test.skip` с причиной «dist не собран»; иначе для каждого из `ROOT_NAMES` первое `position: relative; width: (\d+)px; height: (\d+)px` в `dist/<имя>.html` равно `canvasSize(pngSize(...))`.
- [ ] **Step 2:** `bun test scripts/diagram-scale.test.ts scripts/diagram-sizes.test.ts` → FAIL (модулей нет).
- [ ] **Step 3: Реализация** по Interfaces. Загрузчик — `defineLoader` из `vitepress`; путь к `dist/` — от корня репозитория (`process.cwd()`).
- [ ] **Step 4:** те же тесты → PASS (тест размеров после `DIAGRAMS_NATIVE=1 bun run build` — без skip); полная проверка → зелёная.
- [ ] **Step 5: Commit** `feat(site): размеры схем и логика масштаба`.

### Task 3: Компонент `Diagram`

**Files:**
- Create: `site/.vitepress/theme/Diagram.vue`
- Modify: `site/.vitepress/theme/index.ts` (регистрация `app.component('Diagram', Diagram)` в `enhanceApp`), `site/.vitepress/theme/custom.css`, `package.json`, `bun.lock`

**Interfaces:**
- Consumes: `data` из `diagrams.data.ts`, `fitScale`, `frameHeight`, `stepScale`, `MAX_SCALE` (задача 2).
- Produces: глобальный компонент `<Diagram name="<имя>" />`, проп `name: string`.

- [ ] **Step 1: Зависимость** `@panzoom/panzoom@4.6.2` (Global Constraints); `grep -cE 'https?://' bun.lock` → `0`.
- [ ] **Step 2: Компонент** по спеке §4.1 и Global Constraints: рамка (`ref`), обёртка размером с холст, iframe (`withBase(`/${name}.html`)`), прозрачный слой; `Panzoom(обёртка, { minScale: fit, maxScale: MAX_SCALE, contain: 'outside', cursor: 'grab' })` на `onMounted` (динамический `import('@panzoom/panzoom')` — только в браузере); `wheel` на рамке: при `ctrlKey || metaKey` — `preventDefault()` и `panzoom.zoomWithWheel(e)`, иначе ничего; `ResizeObserver` на рамку → новый `fit`, `setOptions({ minScale: fit })`, «вписать»; кнопки −/+ через `stepScale`, «Вписать» — `zoom(fit)` + `pan(0, 0)`; «На весь экран» — `requestFullscreen` или класс `diagram--overlay` (`position: fixed; inset: 0; z-index: 100`, `overflow: hidden` на `body`), `keydown Escape` закрывает, `fullscreenchange` → «вписать». `rendered: false` — вместо фрейма текст из Global Constraints. Ссылки «HTML» и «PNG» под рамкой.
- [ ] **Step 3:** `bun run typecheck` и `bun run site:vitepress` → сборка без ошибок (временная страница не нужна: компонент проверяется в задаче 4 и 5).
- [ ] **Step 4: Commit** `feat(site): компонент Diagram — схема в рамке с масштабом`.

### Task 4: Страница `/architecture/`, меню, документация

**Files:**
- Create: `site/architecture/index.md`, `scripts/architecture-page.test.ts`
- Modify: `site/.vitepress/config.mts`, `site/index.md`, `README.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: `<Diagram>` (задача 3), `ROOT_NAMES`, `HIDDEN_FOLDERS`, `SITE_BASE`.

- [ ] **Step 1: Тест** `architecture-page.test.ts`, `test("every root diagram is on /architecture/ with a heading and a Diagram")`: для каждого `indexNames(diagramNames())` файл `site/architecture/index.md` содержит строку `## <имя>` и `<Diagram name="<имя>"`; порядок заголовков — как в Global Constraints; `test("config: Architecture goes to /architecture/ without target, branch previews only on main")` — `config.mts` содержит `link: '/architecture/'`, `activeMatch: '^/architecture/'`, `'/branches/'` под условием `SITE_BASE === '/docs/'`, и не содержит `link: '/diagrams/'`.
- [ ] **Step 2:** `bun test scripts/architecture-page.test.ts` → FAIL.
- [ ] **Step 3: Страница и меню** по спеке §4.2: описания — из таблицы README «MVP» (одно-два предложения на схему); вверху строка про замороженные варианты со ссылками на `/bff/<имя>.html` и `/frozen-k3s/<имя>.html` (список имён из README, ссылки с `target="_self"`); nav и главная по Global Constraints. README: абзац про индекс и табы заменить правилом из спеки §4.5, ссылки таблиц оставить; CLAUDE.md, «Схемы»: «Новая схема корня — раздел с `<Diagram>` на `site/architecture/index.md` (тест-страж)».
- [ ] **Step 4:** тест → PASS; полная проверка → зелёная, `site:check` видит `architecture/index.html` и шесть iframe.
- [ ] **Step 5: Commit** `feat(site): страница «Архитектура» со схемами MVP`.

### Task 5: Приёмка в браузере, PR (контроллер)

- [ ] **Step 1:** Сборка `DIAGRAMS_NATIVE=1 bun run build`; статический сервер `dist/` под `/docs/` (как `scratchpad/bff-serve/server.ts`, другой порт).
- [ ] **Step 2:** В агентском Chrome по спеке §5 и Review Focus 1–5: меню «Архитектура» без перезагрузки; шесть схем вписаны; −/+/«Вписать»; Ctrl + колесо масштабирует схему к указателю, а не страницу; колесо без модификатора листает страницу; перетаскивание; полный экран и `Esc`; ресайз окна пересчитывает «вписать»; 375 px с касаниями — щипок, перетаскивание, оверлей без Fullscreen API (в `initScript` удалить `Element.prototype.requestFullscreen`), страница под оверлеем не прокручивается; тёмная тема; `/docs/diagrams/#ci`, `/docs/diagrams/#bff/ci`, `/docs/#ci`, `/docs/diagrams/` — по Global Constraints.
- [ ] **Step 3:** Превью ветки: сборка с `SITE_BASE=/docs/branches/test/` — iframe грузит `/docs/branches/test/<имя>.html`; пункта «Превью веток» нет.
- [ ] **Step 4:** Скриншоты; пуш ветки `docs/diagrams-embed`, PR с разделами «Что», «Решения», «Проверка» и ссылкой на превью; CI зелёный. Мерж — владелец.
