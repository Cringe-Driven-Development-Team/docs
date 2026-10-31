# Публичное пространство четырёх OpenWiki — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Публиковать четыре существующие wiki на `/openwiki/` в общем графе и автоматически пересобирать сайт после обновления любой wiki в `main`.

**Architecture:** Сборка фиксирует коммиты трёх платформ, читает wiki как данные и сохраняет повторно используемый локальный снимок. Wiki текущего checkout `docs` добавляется при экспорте; IDs и ссылки объединяются с префиксами репозиториев. Узкая адаптация штатных assets OpenWiki добавляет согласованную навигацию без форка генератора; платформенные workflows вызывают Pages через отдельный credential.

**Tech Stack:** Bun, TypeScript, Git, OpenWiki `0.7.2`, штатные ForceGraph/marked/DOMPurify/Mermaid, GitHub Actions и Pages. Новых production dependencies нет.

**Spec:** [2026-11-01-public-four-wiki-design.md](../specs/2026-11-01-public-four-wiki-design.md).

## Global Constraints

- Только `Cringe-Driven-Development-Team/{docs,frontend,backend,infra}`, только опубликованные `openwiki/`; генерация ручная, сборка не вызывает модель.
- Не выполнять scripts/hooks платформ, не устанавливать их зависимости, не изменять их wiki или локальный `~/.openwiki`.
- Показывать `updatedAt` и `sourceSha` checkpoint; отдельно хранить `repositorySha` прочитанных файлов и дату сборки.
- Формат даты: `16:53 31 октября 2026 г. МСК`; короткий SHA ведёт к полному коммиту владельца.
- Неполный/повреждённый источник останавливает публикацию; stale доступен с предупреждением; неизвестная свежесть не считается fresh.
- Относительные пути assets и `SITE_BASE` должны работать в превью. Только реальные явные wiki-ссылки создают межрепозиторные рёбра.
- Сохранять DOMPurify, Mermaid, light/dark theme, pan/zoom, splitter, скрытие графа, favicon. Не редактировать `node_modules` и не копировать весь native client.
- До реализации пользователь выбирает executing-plans или subagent-driven-development. Выбор для старых планов не переносить на этот.

## Review Focus

1. Одноимённые `quickstart`, относительный `../`, кириллица, `%20` и якоря должны открывать правильную страницу/раздел — тесты задач 2–4.
2. Новая сборка со старой wiki не должна показывать дату сборки как дату генерации; wiki-only commit не означает stale — задача 1.
3. Symlink в wiki, `..`, поддельный GitHub host и исторический ref не должны перенаправлять чтение в чужой источник — задачи 1–2.
4. Фильтрация не должна уничтожать данные master graph или ломать Back/Forward после межрепозиторного перехода — задачи 3–4.
5. Снимок платформ должен переживать Docker/временный checkout превью, но никакой token/path не должен попадать в dist — задачи 4–5.

## Карта файлов и общие контракты

Все пути ниже от корня `docs`, кроме явно указанных платформ.

| Файл | Ответственность |
| --- | --- |
| `scripts/openwiki-sources.ts` + `.test.ts` | Allowlist, получение платформенного снимка, Git/provenance/freshness без исполнения платформенного кода |
| `scripts/openwiki-workspace.ts` + `.test.ts` | Namespaced graph, чистое разрешение wiki-ссылок и route, публичные типы manifest |
| `scripts/openwiki-client-lib.ts` | Чистые функции фильтрации, маршрутов и дат; собирается также для браузера |
| `scripts/openwiki-visualizer.ts` + `.test.ts` | Проверяемая адаптация native assets под workspace, без изменения установленного пакета |
| `scripts/openwiki-workspace-client.js`, `scripts/openwiki-workspace.css` | Только дополнительное browser-поведение и стили; используются адаптером |
| `scripts/export-openwiki.ts` + `.test.ts` | Координация: снимки → общий граф/manifest → адаптированный static export |
| `scripts/openwiki-browser-check.ts` | Проверка настоящего экспортированного интерфейса через имеющийся `playwright-core` |
| `scripts/docker.ts`, `scripts/build-site.ts`, соответствующие тесты | Передача одного снимка в Docker/превью |
| `.github/workflows/{ci,pages}.yml`, `package.json`, `.gitignore`, `README.md` | Подготовка снимка, команды и инструкция публикации |
| `<frontend,backend,infra>/.github/workflows/publish-docs-wiki.yml` | Запуск `docs/pages.yml` после wiki push в main, плюс ручная диагностика |

Общие типы определить в `openwiki-workspace.ts`; импортировать, не дублировать:

```ts
type WikiId = 'docs' | 'frontend' | 'backend' | 'infra';
type Freshness = 'fresh' | 'stale' | 'unknown';
type WikiSource = {
  id: WikiId; repositorySha: string; sourceSha: string; updatedAt: string;
  freshness: Freshness;
};
type PreparedWiki = { wikiRoot: string; source: WikiSource }; // только сборочная память/снимок
type WorkspaceManifest = { schemaVersion: 1; builtAt: string; sources: WikiSource[] };
type WorkspaceNode = NativeWikiNode & { wiki: WikiId; page: string };
type WorkspaceGraph = Omit<NativeWikiGraph, 'nodes'> & {
  root: 'CDD'; nodes: WorkspaceNode[]; sources: WikiSource[];
};
type WikiRoute = { wiki: WikiId; page: string; section?: string };
```

`NativeWikiNode`/`NativeWikiGraph` — типы установленного `dist/visualize/graph.js`,
а не новое определение всех полей OpenWiki. `page` — путь без `.md` и префикса,
например `architecture/bff`. `id` узла — `frontend/architecture/bff`.
Маршрут в адресе: `?wiki=frontend&page=architecture%2Fbff#section`;
параметры читать/писать через URL/URLSearchParams. Неизвестный явно заданный route
не заменять стартовой страницей. Bare URL → docs/quickstart и фильтр «Все».
Статус активного фильтра — состояние интерфейса; URL страницы важнее фильтра.

## Перед задачами

- [ ] Прочитать спеку, AGENTS четырёх репозиториев и текущие manifests/workflows. `docs` уже изолирован в `.claude/worktrees/openwiki-public-workspace`, ветка `docs/openwiki-public-workspace-design`; не создавать второй docs worktree. Платформенные ветки создать перед задачей 5 по их правилам, рабочие checkout не переключать.
- [ ] Проверить свежий `origin/main`; при его продвижении аккуратно обновить ветку со спекой/планом, не теряя их. Установить зависимости `docs` по frozen lockfile выбранным методом выполнения; до реализации записать baseline typecheck/tests. Не использовать node_modules основного старого checkout: там VitePress 1.6.4, в выбранном main уже 2.0.0-alpha.21.
- [ ] Настроить один из путей сборки (Docker либо native с системным Chromium) по README. Проверки и журнал выполнять по выбранному execution skill. До первого product commit прогнать обязательные проверки AGENTS, сохранить и закоммитить утверждённую спеку и этот план.

### Task 1: фиксированные снимки и честная provenance

**Files:** Create `scripts/openwiki-sources.ts`, `scripts/openwiki-sources.test.ts`; Create общие типы в `scripts/openwiki-workspace.ts`; Modify `package.json`, `.gitignore`.

**Interfaces:**
- `preparePlatformWikis(snapshotDir: string): Promise<PreparedWiki[]>` получает только три allowlisted `main`, записывает `.openwiki-sources/{frontend,backend,infra}/openwiki` и внутренний `snapshot.json` с относительными путями.
- `readPreparedPlatformWikis(snapshotDir: string): Promise<PreparedWiki[]>` читает этот снимок без сети; при пропаже/невалидности ошибка.
- `prepareDocsWiki(root: string): Promise<PreparedWiki>` читает wiki и Git HEAD текущего docs checkout.
- CLI: `bun scripts/openwiki-sources.ts --output <directory>`; команда `wiki:prepare` использует `.openwiki-sources` в корне. Каталог добавить в gitignore. `OPENWIKI_SOURCES_DIR` — абсолютный/относительный путь существующего снимка, разрешаемый от cwd.

- [ ] **1.1. Написать failing tests** с четырьмя маленькими временными Git fixtures и внедрённым transport для трёх платформ. Зафиксировать assertions:

```ts
expect(snapshot.map(x => x.source.id)).toEqual(['frontend', 'backend', 'infra']);
expect(snapshot[0]!.source.repositorySha).toBe(wikiCommit);
expect(snapshot[0]!.source.sourceSha).toBe(sourceCommit);
expect(snapshot[0]!.source.updatedAt).toBe('2026-10-31T13:53:00.000Z');
expect(snapshot[0]!.source.freshness).toBe('fresh'); // commit меняет только generated wiki
```

Добавить реальные изменения разрешённых исходников → stale; исключённые paths → fresh;
непроверяемая ancestry → unknown с диагностикой, отсутствие source объекта после
неудачного получения обязательных данных не скрывается как успешный снимок.
Отсутствующий quickstart, неверная дата/40-char SHA/status, symlink wiki-файл,
ошибка одного fetch → reject; не возвращается частичный массив. Проверить, что
подставленный fixture hook/script не запускается.

- [ ] **1.2. Запустить** `bun test scripts/openwiki-sources.test.ts`; ожидать FAIL на отсутствующих exports/поведении.
- [ ] **1.3. Реализовать снимок.** Использовать Git без checkout/hooks (`init --bare`, fetch allowlisted main, `rev-parse`, `ls-tree -rz`, чтение blob) во временном каталоге, затем атомарно публиковать готовый snapshot. Учитывать режимы дерева: только обычные файлы допустимы для wiki/metadata; не разыменовывать symlink/submodule. Скачивать Markdown и checkpoint, не Claims/логи/секреты. Source SHA проверять как commit; для freshness получать ancestry и diff `--name-only -z --no-renames`.
- [ ] **1.4. Реализовать freshness без запуска чужого TS.** Для docs использовать собственный `isWikiSourcePath`. Для платформ переиспользовать trusted OpenWiki `OpenWikiIgnore.parse` над данными `.openwikiignore`, исключая весь lifecycle `openwiki/**`, кроме `openwiki/INSTRUCTIONS.md`. Классификация должна соответствовать corpus существующих checkers. Добавить parity cases из актуальных `scripts/openwiki-check.test.ts`: generated API, mocks/env, обычный code, workflows, infra inventory и безопасный `agent.env.j2`. Если появляется несовпадение, уточнить data matcher в этом модуле и закрепить тестом; импортировать/выполнять код платформ для обхода не разрешается.
- [ ] **1.5. Запустить тест задачи и typecheck.** После PASS проверить readPrepared roundtrip и отсутствие абсолютных путей в публичных `WikiSource`. Snapshot приватный и может содержать внутренние сведения; публичные данные сериализуются позже выборочно.
- [ ] **1.6. Commit:** `feat(openwiki): подготовить снимки платформенных wiki`.

### Task 2: общий граф, ссылки и route

**Files:** Modify `scripts/openwiki-workspace.ts`; Create `scripts/openwiki-workspace.test.ts`, `scripts/openwiki-client-lib.ts`.

**Interfaces:**
- `buildWorkspaceGraph(wikis: readonly PreparedWiki[], builtAt: string): Promise<WorkspaceGraph>` использует native `buildGraph(wikiRoot)`.
- `resolveWikiLink(from: WikiRoute, href: string, sources: readonly WikiSource[]): WikiRoute | null` — общая чистая функция в client-lib; `null` значит обычная внешняя ссылка, не новая загрузка источника.
- `readWikiRoute(url: URL): WikiRoute | null`, `writeWikiRoute(url: URL, route: WikiRoute): URL`; `null` от read только для bare URL, ошибочный явно заданный маршрут обрабатывается отдельно как not-found.
- `filterWorkspaceGraph(graph: WorkspaceGraph, wiki: WikiId | null): WorkspaceGraph` возвращает новый граф с видимыми nodes/edges, не мутирует master graph. `formatWikiDate(iso: string): string` выдаёт согласованный формат МСК.

- [ ] **2.1. Написать failing tests.** Четыре fixture wiki с одинаковыми `quickstart` и `architecture/a`, относительной ссылкой `../quickstart.md#начало`, GitHub wiki-ссылками, исходным кодом и разделом с пробелом/кириллицей.

```ts
expect(graph.nodes.filter(n => n.page === 'quickstart')).toHaveLength(4);
expect(new Set(graph.nodes.map(n => n.id)).size).toBe(graph.nodes.length);
expect(resolveWikiLink(from, '../quickstart.md#начало', sources))
  .toEqual({wiki: 'frontend', page: 'quickstart', section: 'начало'});
expect(formatWikiDate('2026-10-31T13:53:00.000Z')).toBe('16:53 31 октября 2026 г. МСК');
expect(filtered.edges.every(e => ids.has(e.source) && ids.has(e.target))).toBe(true);
expect(graph.nodes).toHaveLength(originalCount);
```

Проверить cross-link на main и repositorySha → internal; иной ref, похожий hostname,
другую org и code source → external. Выход `../../` за wiki, ошибочный percent-escape,
scheme `javascript:` не становится внутренним route. Якорь-only ссылка остаётся
в выбранной странице. Кодовые `.md` строки не создают ложных рёбер.
Route encode/decode сохраняет кириллицу/пробелы/section; некорректный wiki/path
даёт not-found, а не page другой wiki.

- [ ] **2.2. Запустить** `bun test scripts/openwiki-workspace.test.ts`; ожидать FAIL.
- [ ] **2.3. Реализовать граф и чистые функции.** Сначала native graph каждого источника, затем namespace всех IDs/links/backlinks/edges. Для явных межwiki Markdown-ссылок использовать уже установленный Markdown lexer (`marked`, доступен в дереве зависимостей OpenWiki) либо узкий существующий parser; не искать ссылку внутри fenced/inline code. Один resolver используется при построении рёбер и в браузере. Пересчитать backlinks, убрать дубли и self-links. Не перезаписывать body или type страницы и не добавлять семантические связи.
- [ ] **2.4. Запустить тесты задач 1–2 и typecheck.** Проверить deterministic сортировку sources/IDs/edges и root `CDD`, отсутствие wikiRoot в JSON.stringify(graph).
- [ ] **2.5. Commit:** `feat(openwiki): объединить графы с владельцами и переходами`.

### Task 3: адаптация штатного визуализатора

**Files:** Create `scripts/openwiki-visualizer.ts`, `scripts/openwiki-visualizer.test.ts`, `scripts/openwiki-workspace-client.js`, `scripts/openwiki-workspace.css`; Modify client-lib при необходимости.

**Interfaces:**
- `adaptWorkspaceAssets(native: {html: string; css: string; clientJs: string}, version: string): {html: string; css: string; clientJs: string}` не пишет файлы и не меняет node_modules.
- Дополнительный JS работает в lexical context native client; чистые shared helpers импортируются из скомпилированного `workspace-lib.js`.
- Одна master graph, фильтр `WikiId | null`, текущий route. CSS использует native semantic tokens для обеих тем.

- [ ] **3.1. Написать failing tests адаптера** на настоящих assets установленного `openwiki@0.7.2`: встроены фильтры и provenance-контейнер, DOMPurify остаётся, импорт shared helpers относительный; неподдержанная версия или отсутствующий/повторный ожидаемый anchor → понятный throw. Строки с кавычками/HTML в title/metadata экранируются, inline injection данных не используется.
- [ ] **3.2. Запустить** `bun test scripts/openwiki-visualizer.test.ts`; ожидать FAIL.
- [ ] **3.3. Реализовать ограниченную адаптацию.** Применять только проверяемые точечные вставки/замены функций native `load`, `buildSidebar`, `buildLegend`, `buildGraphData`, `selectNode`, `rewriteLinks` и reader-decoration. Каждая замена имеет ровно один ожидаемый anchor/диапазон и отклоняет неизвестный шаблон. Проверять pinned package version; не переписывать canvas renderer, theme, splitter, sanitizer или Mermaid.
- [ ] **3.4. Добавить поведение согласованного макета.** Фильтры Все/docs/frontend/backend/infra; четыре блока updatedAt/sourceSha со ссылками; sidebar группируется по repo; repo palette `docs #4FA8F0`, `frontend #A97FE0`, `backend #3FBFA0`, `infra #E0A63E`. Hidden nodes/edges действительно отсутствуют в payload ForceGraph выбранного фильтра. При filter-change сохранять выбранную страницу того же repo либо открывать его quickstart, «Все» сохраняет выбор. Master graph не мутируется ForceGraph: payload создаётся отдельно.
- [ ] **3.5. Добавить reader и URL.** Отображать wiki/path, дату/SHA, ссылку на Markdown на repositorySha, маркировку code/prod и stale/unknown. Resolver из задачи 2 перехватывает только поддержанные wiki-ссылки. После sanitize/render назначать заголовкам стабильные IDs (алгоритм учитывает повторяющиеся заголовки) и прокручивать к section. Обрабатывать загрузку URL, popstate/hashchange, not-found. Отсутствующий section оставляет страницу и понятное сообщение, не открывает другую страницу. Контролы — кнопки с focus/aria-pressed; на 390 px нет горизонтального переполнения, граф можно скрыть.
- [ ] **3.6. Запустить тесты задач 1–3 и typecheck.** JS дополнительного клиента проверяется парсингом при сборке и браузерной проверкой задачи 4; глобальный `allowJs` ради одного файла не включать.
- [ ] **3.7. Commit:** `feat(openwiki): добавить навигацию по четырём wiki`.

### Task 4: экспорт, локальная сборка и превью

**Files:** Modify `scripts/export-openwiki.ts`, `.test.ts`, `scripts/docker.ts`, `.test.ts`, `scripts/build-site.ts`, `.test.ts`, `package.json`, `.github/workflows/{ci,pages}.yml`, `README.md`; Create `scripts/openwiki-browser-check.ts`.

**Interfaces:**
- `exportWikiVisualizer(root: string, options?: {snapshotDir?: string}): Promise<void>` заменяет старый test-only callback; injectable deps в тестах обновить явно, все callers найти через rg.
- Output: native пять assets плюс `workspace-lib.js` и `manifest.json`; `graph.json` содержит `WorkspaceGraph`, manifest — только `WorkspaceManifest`.
- `bun run wiki:export` использует `OPENWIKI_SOURCES_DIR`, иначе подготавливает свежий снимок в `.openwiki-sources`; переданный, но повреждённый snapshot не заменяется silent fetch.
- `bun run site`/Pages заранее готовят снимок один раз; build каждой preview получает один абсолютный `OPENWIKI_SOURCES_DIR`. Сам docs source всегда берётся из соответствующего checkout.

- [ ] **4.1. Написать failing tests экспорта.** Fixtures готового platform snapshot + docs checkout. Assertions: 4 sources, правильные source/repository SHA, 4 quickstarts, manifest не содержит wikiRoot, очищены старые output assets, соседние dist файлы сохранены. Отсутствующий источник/неполный native export/unsupported native assets → reject до выпуска нового output. Экспорт строится во временной папке и переносится после успешной проверки.
- [ ] **4.2. Написать failing tests Docker/preview.** Проверить `OPENWIKI_SOURCES_DIR` передаётся и каталог смонтирован read-only по стабильному container path; не интерполировать shell-unsafe host path. Branch worktree получает тот же snapshot, свой docs/quickstart и свой `SITE_BASE`; вызов не повторяет fetch. Token из env источника не передаётся в контейнер и dist.
- [ ] **4.3. Запустить focused tests** `bun test scripts/export-openwiki.test.ts scripts/docker.test.ts scripts/build-site.test.ts`; ожидать FAIL на новых contracts.
- [ ] **4.4. Подключить сборку.** Переиспользовать native `exportStaticVisualizer`/assets и `buildWorkspaceGraph`, заменить только generated graph, применить адаптер. Shared TS helpers собрать `Bun.build({target:'browser'})` в workspace-lib.js; не добавлять bundler/dependency. Сначала manifest/sources валидируются, затем output создаётся. В CI/Pages до полного build выполнить wiki:prepare и передать путь снимка в оба docker run. Никаких dispatch token в build env. Local Docker entrypoint также подготавливает snapshot один раз, монтирует его ro; CI `DIAGRAMS_IN_CONTAINER=1` не должен повторно оборачивать Docker.
- [ ] **4.5. Добавить browser check на fixtures.** CLI `bun scripts/openwiki-browser-check.ts <dist-directory>` использует имеющийся `playwright-core` и `CHROMIUM_PATH`, временный static server, закрывает ресурсы finally. На настоящем экспортированном клиенте проверить: bare docs/quickstart; frontend filter и переход на backend; Back/Forward/reload; относительную ссылку и section; not-found; malicious Markdown без выполнения скрипта; theme toggle и скрытие/показ графа; desktop и 390 px без overflow. Собрать dedicated fixture export для этой проверки в обычном bun test либо отдельной команде в CI, без GitHub fetch. Отсутствие браузерных CDN при сетевом сбое сообщается как сбой проверки, не PASS.
- [ ] **4.6. Обновить README**: ручная генерация/автопубликация различаются; команды `wiki:prepare`, `wiki:export`; provenance/freshness; настройка credential; локальный workspace MCP независим. Указать, что граф может иметь четыре компоненты без явных crosslinks.
- [ ] **4.7. Запустить** `bun run modules:check`, `bun run typecheck`, `bun run test`, `bun run build` (Docker либо `DIAGRAMS_NATIVE=1` по доступному окружению), browser check на fixture и реальном export. Результат — нулевые коды; реальные wiki могут быть stale, но все четыре присутствуют и не потеряли provenance. Осмотреть screenshots desktop/mobile/light/dark против согласованного макета.
- [ ] **4.8. Commit:** `feat(openwiki): публиковать общий визуализатор в Pages`.

### Task 5: три запуска Pages и credential

**Files:** Create `<frontend,backend,infra>/.github/workflows/publish-docs-wiki.yml`; минимально Modify их README/инструкцию CI, если нужны ссылки. Проверки workflow держать в имеющемся test tooling соответствующего repo; не вносить Go/Bun библиотеки ради проверки YAML.

**Interfaces:** Одинаковый workflow `Publish docs wiki`: `push.branches: [main]`, `push.paths: ['openwiki/**']`, `workflow_dispatch` для диагностики. `permissions: {}`; checkout не нужен. Job использует только `secrets.DOCS_PAGES_TOKEN`, фиксированную команду `gh workflow run pages.yml --ref main --repo Cringe-Driven-Development-Team/docs`, timeout 5 минут. Нет произвольных inputs/repo/ref/команд. Missing token или nonzero gh → явный failure.

- [ ] **5.1. Проверить доступный credential без чтения/вывода значений.** Требуется fine-grained token только для docs с Actions write, secret доступен трём repo. Если его нет — подготовить точные настройки и попросить владельца создать/установить `DOCS_PAGES_TOKEN` в GitHub. Не брать локальный gh token и не менять scope общего `ADD_TO_PROJECT_PAT`. Пока ответа нет, реализовать/проверить остальные файлы автономно, интеграционную приёмку оставить pending.
- [ ] **5.2. Добавить failing workflow check** в каждом repo существующим способом: main + openwiki path filter, dispatch main/docs, secret name, отсутствие checkout/модели/schedule, ошибки не подавляются. Дополнительно прогнать имеющийся `actionlint`, если доступен; не вводить обязательную новую dependency в проект.
- [ ] **5.3. Реализовать три workflow** с передачей token через env шага, не через cmdline/log. При пустом значении — диагностическое сообщение, exit 1; `gh` код не подавлять. Добавить короткую ссылку на общий README. Не трогать deploy workflows компонентов.
- [ ] **5.4. Запустить workflow checks и обязательные проверки изменённых repo по их AGENTS.** Выполнить safe dry-run с подставным `gh`, который записывает args и может вернуть nonzero; проверить передачу ошибки. В журналах и patch нет token value.
- [ ] **5.5. Commit в каждом repo:** `ci(openwiki): запускать публикацию wiki в docs`.

### Task 6: интеграция и проверка опубликованного сайта

**Files:** Новых product files нет; исправления только по выявленным проблемам и в пределах задач выше. Отчёт проверки — в журнале выбранного execution skill/PR.

**Interfaces:** Завершённые commits/PR четырёх repo, настроенный `DOCS_PAGES_TOKEN`, работающие CI и Pages. Создание PR/слияние выполнять согласно действующим полномочиям пользователя и навыкам CDD; не трактовать выбор метода реализации как отдельный приказ влить все PR.

- [ ] **6.1. Провести whole-branch review** относительно спеки; при SDD дополнительно сохранить отдельные review каждой предыдущей задачи. Провести self-review diff, crossrepo source provenance и отсутствие неожиданных файлов.
- [ ] **6.2. Выполнить финальные обязательные проверки на итоговых head** и подготовить reviewable PR. В docs PR — ссылка на preview `/branches/<slug>/openwiki/`, перечень 4 source SHA, проверенные переходы и статус token/dispatch. Не выдавать scheduled Pages за доказательство crossrepo dispatch.
- [ ] **6.3. После разрешённого слияния docs** проверить успешный Pages и публичные `/openwiki/{graph,manifest}.json`: четыре repo, expected repositorySha/checkpoint, ни token, ни локальных путей. Проверить страницу браузером.
- [ ] **6.4. После разрешённого слияния workflows платформ** проверить ручной запуск Publish docs wiki из всех трёх repo и соответствующие новые Pages runs. В одной платформе использовать ближайший реальный wiki-only PR, который нужен по fresh-check, для проверки push trigger. Не править generated wiki руками ради события; обновлять только явной локальной командой с lifecycle, если это отдельно разрешено. Если реального wiki merge пока нет, пометить именно push-trigger end-to-end pending; не объявлять всю приёмку законченной.
- [ ] **6.5. Итог владельцу:** опубликованный URL, 4 checkpoint даты/SHA, доказательство dispatch/Pages, оставшиеся stale wiki и незавершённые проверки. Никакой автогенерации или таймеров не появилось.

## Самопроверка плана

- Контракты source SHA / repository SHA и запрет частичной публикации — задачи 1, 4.
- Namespace, относительные/межрепозиторные ссылки, исторические ref и anchors — задачи 2–4.
- Согласованный макет, фильтры, color по repo, темы и доступность — задачи 3–4.
- Docker, CI, единый snapshot для превью, локальная команда и README — задача 4.
- Автопубликация и минимальный credential без изменения генерации — задача 5.
- Реальные Pages/dispatch и честная граница незавершённой приёмки — задача 6.
- Все пять классов Review Focus имеют assertions в owning tasks; типов/функций, используемых последующими задачами без определения контракта, нет.
