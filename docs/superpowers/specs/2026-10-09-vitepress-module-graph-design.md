# Пакет `@tp-prepare/vitepress-module-graph`: граф модулей и доска GitHub для любого сайта VitePress

## 1. Цель

Граф модулей, страницы треков, проверка треков и CLI доски GitHub сейчас живут в коде сайта `docs`. Выносим их в
пакет npm `@tp-prepare/vitepress-module-graph` (репозиторий `TP-Prepare/frontend-packages`, папка
`packages/vitepress-module-graph`), чтобы другой курс подключил граф к своему сайту VitePress без форка.
Затем переводим `docs` на этот пакет.

Одна спека, два плана:

- **План A** — пакет и каркас монорепозитория `frontend-packages` с релизами через release-please.
- **План B** — `docs` на опубликованном пакете; начинается после первой публикации (§6).

Готово, когда:

- `@tp-prepare/vitepress-module-graph@0.1.0` опубликован в npm, следующие версии выходят через release-please;
- сайт подключает граф тремя файлами (§3.2) и папкой с данными (§4), направления, стороны, формат спринта и
  доска задаются в `module-graph.yaml`, люди — в `people.yaml`;
- CLI `module-graph` работает под Node ≥ 22 и bun: `check`, `check --hook`, `board sync`, `board snapshot`;
- `docs` не содержит своего кода графа, а граф на Pages выглядит и работает как до перевода.

## 2. Проверенные факты

`docs`, `main`, коммит `72f0883`.

- Код графа: `site/.vitepress/modules.ts` (491 строка: типы, разбор треков, правила, связи, фильтры),
  `modules-read.ts` (72: чтение папки), `board.ts` (184: разбор снимка доски); компоненты
  `site/.vitepress/theme/components/{ModuleGraph,GraphCanvas,GraphFilters,NodeCard,TrackMeta,TrackList,TaskList,ModuleList}.vue`;
  загрузчик `site/modules/modules.data.ts`; подключение — `site/.vitepress/theme/index.ts` (`doc-before` → `TrackMeta`,
  глобальные `ModuleGraph`, `ModuleList`), меню — `config.mts:31` (`moduleSidebar(readModules(…))`).
- Зашито в коде: `AREAS` (`front, back, devops, fullstack, team`), `SIDES` (`front, back, devops, team`), подписи
  `AREA_LABELS`/`SIDE_LABELS` (`modules.ts:5-24`), правило «у `fullstack` нужны стороны front и back»
  (`checkFullstack`), формат спринта `/^Sprint \d+$/` (`modules.ts:78`), адреса `/modules/<id>/…` (`modules.ts:205,234,282`,
  `TrackMeta.vue:38`), цвета `--cdd-area-*` для светлой и тёмной темы (`custom.css:14-25`).
- Люди — `site/modules/people.ts`: `{ login, name, role, area, mentor? }`, шесть записей.
- CLI доски — `scripts/board.ts` (266): `sync` (пополняет поле «Трек» значениями id треков, описание — `title`) и
  `snapshot <путь>`; настройки из env `GH_TOKEN`, `BOARD_OWNER`, `BOARD_OWNER_KIND`, `BOARD_PROJECT`; поле «Трек» и
  организация доски для `ref` зашиты (`TRACK_FIELD`, `BOARD_ORG`). Вызывается в `pages.yml` (задача `board`).
- Проверка — `scripts/modules-check.ts` (`modules:check`, `--hook` для `PostToolUse`), подключена в
  `.claude/settings.json`, `lefthook.yml`, `ci.yml`.
- Тесты кода графа: `modules.test.ts` (41), `modules-graph.test.ts` (23), `modules-read.test.ts` (17),
  `board-model.test.ts` (26), `board.test.ts` (25), `modules-check.test.ts` (15) — 147. `bff-pages.test.ts` проверяет
  страницы BFF сайта и остаётся в `docs`.
- `TP-Prepare/frontend-packages`: ветка `main`, только `README.md`.
- `TP-Prepare/release-please-playground` — обкатанный образец: bun workspaces, `tsdown`, `typescript 7.0.2`,
  release-please в режиме манифеста с плагином `node-workspace`, публикация `npm publish` с OIDC
  (`id-token: write`, Node 24, npm ≥ 11.5.1) после `releases_created`.
- VitePress подставляет данные `*.data.ts` только при импорте из проекта сайта; компоненты из `node_modules`
  получают их через `provide/inject`.

## 3. Пакет

### 3.1. Входы

| Вход | Что внутри | Где работает |
|---|---|---|
| `@tp-prepare/vitepress-module-graph` | модель: типы, настройки по умолчанию, разбор треков и людей, правила, связи графа, фильтры, разбор снимка доски; без файлов и DOM | везде |
| `…/node` | `loadModuleDir`, `readModules`, `moduleSidebar`, `createModulesLoader` | конфиг и загрузчик VitePress, CLI |
| `…/theme` | компоненты `.vue`, `installModuleGraph(app, data)`, `trackHeader` | тема VitePress |
| `…/style.css` | переменные `--mg-area-*` по умолчанию (`DEFAULT_CONFIG`); стили компонентов — в самих `.vue` | тема |
| bin `module-graph` | §5 | терминал, CI, хуки |

### 3.2. Подключение на сайте

```ts
// site/modules/modules.data.ts — папка этого файла и есть папка модулей
import type { ModuleGraphData } from '@tp-prepare/vitepress-module-graph';
import { createModulesLoader } from '@tp-prepare/vitepress-module-graph/node';
declare const data: ModuleGraphData;   // подстановка VitePress; объявление — для tsc
export { data };
export default createModulesLoader(import.meta.url);
```

```ts
// site/.vitepress/config.mts
import { moduleSidebar, readModules } from '@tp-prepare/vitepress-module-graph/node';
// themeConfig.sidebar:
'/modules/': moduleSidebar(readModules('site/modules')),
// пакет отдаёт .vue как есть — Vite сайта собирает их и для SSR:
vite: { ssr: { noExternal: ['@tp-prepare/vitepress-module-graph'] } },
```

```ts
// site/.vitepress/theme/index.ts
import { installModuleGraph, trackHeader } from '@tp-prepare/vitepress-module-graph/theme';
import '@tp-prepare/vitepress-module-graph/style.css';
import { data } from '../../modules/modules.data';
// Layout: () => h(DefaultTheme.Layout, null, { 'doc-before': trackHeader }),
// enhanceApp({ app }) { installModuleGraph(app, data) }  — <ModuleGraph/>, <ModuleList/> и provide данных
```

- `createModulesLoader(url)` возвращает `{ watch, load }` загрузчика VitePress; `watch` — `index.md` модулей, файлы
  треков, `people.yaml`, `module-graph.yaml`, `board.json`.
- `trackHeader` — шапка трека (сейчас `TrackMeta`): на странице не трека ничего не рисует.
- Переменные цветов `--mg-area-<ключ>` из `module-graph.yaml` рисует `<style>` в корне графа, архива и шапки трека:
  `:where(:root)` и `:where(html.dark)`, то есть с нулевой специфичностью — сайт переопределяет их обычным `:root { … }`.

### 3.3. Сборка и зависимости

- `tsdown`: `src/index.ts`, `src/node/index.ts`, `src/theme/index.ts`, `src/cli.ts` → `dist/*.mjs` и `.d.mts`. Файлы
  `.vue` и `style.css` копируются в `dist/theme/` без изменений — их компилирует Vite сайта.
- `bin: { "module-graph": "dist/cli.mjs" }`, `engines.node: ">=22"`, `files: ["dist"]`,
  `publishConfig.access: public`, `type: module`, `sideEffects: ["*.css", "*.vue"]`.
- Зависимости: `force-graph`, `gray-matter`, `js-yaml`; `peerDependencies`: `vitepress ^1.6`, `vue ^3.5`.
- Проверка типов: `tsc` и `vue-tsc`.
- `README.md` пакета на русском: подключение (§3.2), форматы трёх файлов (§4) и формат трека, команды CLI (§5).
- Подписи интерфейса — русские, как сейчас; переводы не входят.

## 4. Папка модулей

```
<папка модулей>/            по умолчанию site/modules
  index.md                  страница архива (<ModuleList/>)
  module-graph.yaml         настройки, необязательный
  people.yaml               люди, обязательный
  board.json                снимок доски, необязательный
  <номер>/index.md          модуль: title, sprints, <ModuleGraph/>
  <номер>/tracks/<id>.md    трек: frontmatter как сейчас
```

### 4.1. `module-graph.yaml`

Значения по умолчанию — нынешние зашитые; раздела `board` по умолчанию нет.

```yaml
route: /modules/
areas:                                   # порядок = порядок в фильтре и легенде
  front:     { label: Фронт,               color: "#2c6bd4", dark: "#5f95f1" }
  back:      { label: Бэк,                 color: "#13886b", dark: "#3fbc9c" }
  devops:    { label: DevOps,              color: "#b07710", dark: "#e1a740" }
  fullstack: { label: Фронт + бэк,         color: "#c9445a", dark: "#e47584", needs: [front, back] }
  team:      { label: Инструменты команды, color: "#6b7c1c", dark: "#a9ba5c" }
sides: { front: фронт, back: бэк, devops: devops, team: команда }
sprint: "Sprint {n}"
board: { owner: Cringe-Driven-Development-Team, project: 1, field: Трек }
```

- `route` — адрес папки модулей на сайте, с `/` в начале и в конце; ссылки на модули, треки и подстраницы строятся от
  него.
- `areas` и `sides`, если заданы, заменяют значения по умолчанию целиком. Ключи — строчная латиница,
  цифры и дефис, первая — буква (`^[a-z][a-z0-9]*(-[a-z0-9]+)*$`): у ключа-числа JavaScript меняет порядок, а порядок
  направлений — порядок в фильтре. `color` и `dark` — `#rrggbb`.
- `needs` — стороны из `sides`; у трека с этим направлением исполнители (с подтреками, как `doersOf`) закрывают все
  перечисленные стороны. Ошибка: `<файл трека>: do — у трека «<label>» нужны исполнители со сторон <стороны>`.
  Заменяет `checkFullstack`.
- `sprint` — шаблон с одним `{n}`: `n` — целое число.
- `board.owner` — организация или пользователь GitHub (тип определяет `board` запросом), `board.project` — номер
  проекта, `board.field` — имя поля с одиночным выбором. Задачи из репозиториев `owner` в снимке — `репо#N`,
  остальные — `владелец/репо#N`.
- Неизвестный ключ на любом уровне — ошибка (опечатка не должна молча откатываться на значение по умолчанию).

### 4.2. `people.yaml`

```yaml
- login: YarikMix
  name: Ярослав
  role: ментор фронта
  area: front
  mentor: true
```

Список, порядок — порядок на графе. `login`, `name`, `role`, `area` — непустые строки, `area` — ключ из `areas`,
`mentor` — только `true`. Логины не повторяются.

### 4.3. Ошибки

- Все нынешние правила треков и модулей остаются с теми же текстами, кроме тех, что зависят от настроек: списки
  допустимых направлений, сторон и формат спринта берутся из `module-graph.yaml`.
- Формат один: `<файл от родителя папки модулей>: <поле> — <что не так>`. Примеры:
  - `modules/people.yaml: [2].area — неизвестное направление qa; допустимо: front, back, devops, fullstack, team`
  - `modules/module-graph.yaml: areas.fullstack.needs — нет стороны frontend; допустимо: front, back, devops, team`
  - `modules/people.yaml: строка 4 — сломан YAML: <сообщение парсера>`
- Сломанный YAML и frontmatter — с файлом и строкой, без стека.

### 4.4. Чтение

`loadModuleDir(dir: string): { config, people, modules, board }` — единственный путь чтения папки. Через него
работают `createModulesLoader`, `readModules`, `module-graph check` и `board sync`. `board` — `null`, если
`board.json` нет.

## 5. CLI `module-graph`

Папка модулей — `site/modules` от текущего каталога или `--dir <путь>`.

| Команда | Что делает | Вывод и код |
|---|---|---|
| `check` | `loadModuleDir` | `modules ok: <N> модул…, <M> трек…`, 0; ошибка — одна строка в stderr, 1 |
| `check --hook` | stdin `PostToolUse`: `tool_input.file_path`; путь внутри папки модулей — проверка этой папки | молча 0; ошибка — stderr, 2 |
| `board sync` | пополняет поле `board.field` id треков, описание — `title` из самого нового модуля | `sync: добавлено N значений «<field>»` |
| `board snapshot <файл>` | снимок доски в JSON | `snapshot: N задач` |

- `--hook`: папка модулей — ближайшая папка-предок файла, в которой есть `people.yaml` (так работает при любом `route`);
  `\` нормализуется в `/`. Не JSON, нет `file_path`, нет такой папки — 0 молча.
- `board …` без раздела `board` — `modules/module-graph.yaml: board — нет раздела; нужен { owner, project, field }`,
  код 1. Токен — только `GH_TOKEN`; в тексте ошибки токен заменяется на `***`; строка итога и ошибки дописываются в
  `GITHUB_STEP_SUMMARY`, если он задан. Переменные `BOARD_*` уходят.
- Неизвестная команда — использование в stderr, код 1.
- Установки git-хуков, lefthook и переадресаций старых адресов в CLI нет — это сайт.

## 6. Каркас `frontend-packages` и релизы

Как в `release-please-playground`:

- корень: `package.json` (`private`, `workspaces: ["packages/*"]`, скрипты `build`, `typecheck`, `test` через
  `bun run --filter '*'`), `tsconfig.base.json`, `.gitignore`, `bun.lock`;
- `release-please-config.json`: `release-type: node`, `include-component-in-tag: true`, плагин `node-workspace`,
  пакет `packages/vitepress-module-graph` с `component: vitepress-module-graph`; `.release-please-manifest.json`:
  `"packages/vitepress-module-graph": "0.1.0"`;
- `.github/workflows/ci.yml` (PR): `bun install --frozen-lockfile`, `build`, `typecheck`, `test`;
- `.github/workflows/release.yml` (push в `main`): release-please, затем `npm publish` из `paths_released` с OIDC.

Руками, после мержа плана A (без этого план B не начинается):

1. Организация `tp-prepare` на npmjs.com.
2. Первая публикация `0.1.0` вручную: `npm publish` из `packages/vitepress-module-graph` после `bun run build`.
3. Trusted publisher пакета: `TP-Prepare/frontend-packages`, workflow `release.yml`.

## 7. Перевод `docs` (план B)

- Удалить `site/.vitepress/{modules,modules-read,board}.ts`, компоненты графа, `scripts/board.ts`,
  `scripts/modules-check.ts` и их тесты (§2).
- `site/modules/people.ts` → `people.yaml`; добавить `module-graph.yaml` со всеми разделами явно, включая `board`.
- Подключение — §3.2; `--cdd-area-*` из `custom.css` убрать.
- `package.json`: `@tp-prepare/vitepress-module-graph` точной версией, `modules:check` → `module-graph check`.
- `pages.yml`, задача `board`: `./node_modules/.bin/module-graph board sync` и `./node_modules/.bin/module-graph board snapshot board.json`; поток
  артефакта прежний (`board.json` → `site/modules` в задаче `build`); `BOARD_*` не передаются.
- `.claude/settings.json`: `bun node_modules/@tp-prepare/vitepress-module-graph/dist/cli.mjs check --hook`. Решение: хук и задача `board` вызывают только установленный CLI (не `bunx`): существует посторонний нескоупленный npm-пакет `module-graph`, и `bunx` скачал бы его при отсутствии локального bin; хук молча пропускается, если пакет не установлен. Файл `cli.mjs` запускается через bun, потому что на Windows `.bin` содержит shim-ы `.exe`/`.bunx`. `lefthook.yml` и `ci.yml` вызывают `bun run modules:check`
  и не меняются.
- README: раздел про треки — файлы `people.yaml` и `module-graph.yaml`, ссылка на README пакета. Тест «пример из
  README разбирается» остаётся и разбирает пример через пакет.
- Переадресации `MODULE_MOVES`, `PAGE_REDIRECTS` и `bff-pages.test.ts` остаются.

## 8. Проверка

План A:

- 147 тестов кода графа переезжают в пакет и проходят.
- Новые тесты: значения по умолчанию `module-graph.yaml`; замена `areas`/`sides` целиком; `needs` (в том числе через
  подтреки); `sprint` по шаблону; `route` в адресах трека, подстраницы и модуля; неизвестный ключ; ошибки каждого поля
  `people.yaml`; сломанный YAML с номером строки без стека; `board` без раздела; `--hook` с иным `route`.
- Фикстура — копия данных `docs` на `72f0883`: 1 модуль, 35 треков, та же нагрузка людей, что в
  `modules-read.test.ts`.
- Дымовой тест: собранный `dist/cli.mjs` под `node` — `check` на фикстуре, код 0 и строка `modules ok`.
- CI репозитория зелёный.

План B:

- `bun run typecheck && bun run test && DIAGRAMS_NATIVE=1 bun run build` — `site ok`.
- Chrome на локальной сборке под `/docs/`: граф `/docs/modules/2/` (фильтры, карточка, менторы, подтреки, прогресс по
  подложенному `board.json`), шапка трека, архив `/docs/modules/`, переадресация `/docs/modules/2026-10/`; снимки
  экрана до и после перевода совпадают по цветам и расположению.
- CI на PR зелёный; после мержа задача `board` в `pages.yml` проходит.

## 9. Не входит

- Jira — вторая спека.
- Подключение пакета в других репозиториях курса.
- Переводы интерфейса, настройка подписей интерфейса помимо направлений и сторон.
- Отложенные мелочи #46 про lefthook (удаление файлов, индекс вместо рабочего дерева, `core.hooksPath`).
