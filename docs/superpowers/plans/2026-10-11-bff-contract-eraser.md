# Схема контракта BFF в eraser — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** на странице трека BFF вместо непонятной mermaid-схемы — eraser-схема `diagrams/modules/2/bff-contract.json` с зонами «Генерация кода», «GitHub» и «Прод».

**Architecture:** сборка схем учится находить JSON на втором уровне вложенности (`diagrams/modules/2/`). Папка `modules/2` попадает в список папок вне раздела «Архитектура» (`HIDDEN_FOLDERS`): схема рендерится в `dist/modules/2/`, но в меню не показывается. Страница трека встраивает её через `<Diagram name="modules/2/bff-contract" />`.

**Tech Stack:** Bun, TypeScript, eraser-diagrams CLI 0.1.0, VitePress 1.6.4.

**Spec:** `docs/superpowers/specs/2026-10-11-bff-contract-eraser-design.md`

## Global Constraints

- Любая правка `diagrams/**/*.json` — по скиллу `.claude/skills/eraser-diagrams/SKILL.md`: цикл validate → check → warm → render → осмотр PNG через Read; координаты кратны 20; цвета групп и стрелок — по разделу «Цвета».
- Подписи схемы обычными словами; на схеме и в `site/modules/2/tracks/bff.md` нет `goZod` и `goApi`.
- Узел пользователя — `"id": "client"`; легенда — `"id": "legend"`, `"width": 340`.
- Репозиторий публичный: никаких реальных IP, токенов, внутренних адресов.
- Без Docker: `DIAGRAMS_NATIVE=1 bun run <скрипт>`.
- Перед каждым коммитом: `bun run typecheck && bun run test`. Перед последним — ещё `DIAGRAMS_NATIVE=1 bun run build`.
- Коммиты по-русски: `тип(область): что сделано`.
- Не трогать: `diagrams/contract.json`, `diagrams/bff/`, `diagrams/frozen-k3s/`, mermaid на `site/modules/2/tracks/bff/contract.md`, раздел «Было и стало» в `bff.md`.

## Review Focus

1. Файл VitePress в `dist/modules/2/` совпал по имени со схемой: `build-vitepress.ts` должен уронить сборку, а не затереть файл. Сейчас имён `bff-contract.*` у VitePress нет. Проверяет полная сборка в задаче 3.
2. `check-site`: iframe карточки ссылается на `/docs/modules/2/bff-contract.html`, файл должен существовать, а сама страница схемы — пропускаться при проверке ссылок. Проверяет полная сборка в задаче 3 (`site ok`).
3. Превью ветки (`/docs/branches/<slug>/`): `Diagram.vue` строит адрес через `withBase`, вложенный путь работает так же. Проверяет осмотр превью в задаче 3.
4. Третий уровень вложенности (`diagrams/a/b/c/x.json`) по-прежнему не находится, чтобы случайные файлы не попали в рендер. Тест в задаче 1.
5. Пути на Windows: новый glob возвращает `\` — `listDiagrams` уже заменяет их на `/`. Тест задачи 1 сравнивает с `/`.

---

### Task 1: схемы на втором уровне и папка `modules/2` вне меню

**Files:**
- Modify: `scripts/eraser.ts:23-28` (`listDiagrams` и комментарий над ним)
- Modify: `site/.vitepress/diagram-names.ts:4-5`
- Modify: `site/.vitepress/theme/diagrams.data.ts:20-21` (экспорт `names`)
- Test: `scripts/eraser.test.ts`, `scripts/diagram-sizes.test.ts`, `scripts/build-index.test.ts`

**Interfaces:**
- Produces: `listDiagrams(dir?: string): string[]` — корень, `*/*.json` и `*/*/*.json`, отсортировано, разделитель `/`; `HIDDEN_FOLDERS = ["bff", "frozen-k3s", "modules/2"]`; `export function names(dist: string): string[]` в `diagrams.data.ts`.

- [ ] **Step 1: Тесты**

В `scripts/eraser.test.ts` заменить тест `listDiagrams returns *.json from the root and one level of subfolders…` на:

```ts
test("listDiagrams returns *.json from the root and two levels of subfolders, sorted, with / separators", async () => {
  // те же a.json, b.json, notes.md, frozen/a.json, frozen/deep/c.json, плюс:
  await Bun.write(join(dir, "frozen", "deep", "deeper", "d.json"), "{}");
  expect(listDiagrams(dir)).toEqual([`${prefix}/a.json`, `${prefix}/b.json`, `${prefix}/frozen/a.json`, `${prefix}/frozen/deep/c.json`]);
});
```

В том же файле:

```ts
test("renderBatches: a two-level folder goes into dist/<folder>/<sub>", () => {
  expect(renderBatches(["diagrams/modules/2/bff-contract.json"])).toEqual([
    { outDir: "dist/modules/2", files: ["diagrams/modules/2/bff-contract.json"] },
  ]);
});
```

В `scripts/diagram-sizes.test.ts`, во временной папке:

```ts
test("names: root diagrams plus PNGs of every hidden folder, including modules/2", async () => {
  // dist/modules/2/bff-contract.png и dist/bff/ci.png во временном каталоге
  expect(names(dir)).toEqual([...ROOT_NAMES, "bff/ci", "modules/2/bff-contract"]);
});
```

В `scripts/build-index.test.ts`:

```ts
test("indexNames drops diagrams of modules/2", () => {
  expect(indexNames(["ci", "modules/2/bff-contract", "bff/ci"])).toEqual(["ci"]);
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `bun test scripts/eraser.test.ts scripts/diagram-sizes.test.ts scripts/build-index.test.ts`
Expected: FAIL — `listDiagrams` без `frozen/deep/c.json`; `names` не экспортирован; `indexNames` оставляет `modules/2/bff-contract`. Тест `renderBatches` может пройти сразу (спека §7: `dirname` уже даёт `dist/a/b`) — это фиксация поведения, записать в отчёт.

- [ ] **Step 3: Реализация**

- `listDiagrams`: добавить `new Bun.Glob("*/*/*.json").scanSync(dir)`; комментарий — «Корень и два уровня подпапок (`diagrams/modules/<N>/`)».
- `diagram-names.ts`: `HIDDEN_FOLDERS = ["bff", "frozen-k3s", "modules/2"]`; комментарий: «Папки вне раздела «Архитектура»: замороженные варианты и схемы планов модулей. Схемы открываются по прямому адресу и встраиваются в страницы через `<Diagram>`».
- `diagrams.data.ts`: `export function names`.

- [ ] **Step 4: Тесты проходят**

Run: `bun run typecheck && bun run test`
Expected: всё PASS, включая `ROOT_NAMES matches the root diagrams`.

- [ ] **Step 5: Коммит**

```bash
git add scripts/eraser.ts scripts/eraser.test.ts site/.vitepress/diagram-names.ts site/.vitepress/theme/diagrams.data.ts scripts/diagram-sizes.test.ts scripts/build-index.test.ts
git commit -m "feat(diagrams): схемы во вложенной папке diagrams/modules/2 вне меню «Архитектура»"
```

### Task 2: eraser-схема `diagrams/modules/2/bff-contract.json` и документация

**Files:**
- Create: `diagrams/modules/2/bff-contract.json`
- Create: `scripts/bff-contract-diagram.test.ts`
- Modify: `README.md` (абзац «Исходники в …» в начале и таблицы схем), `CLAUDE.md` (раздел «Схемы»), `.claude/skills/eraser-diagrams/SKILL.md:9-12`

**Interfaces:**
- Consumes: из задачи 1 — `listDiagrams` находит файл, `HIDDEN_FOLDERS` содержит `modules/2`.
- Produces: схема с именем `modules/2/bff-contract` → `dist/modules/2/bff-contract.html` и `.png`.

Содержание (спека §3). id и тексты фиксированы, координаты и иконки — по скиллу:

| id | tag | Где | Текст |
|---|---|---|---|
| `apidog` | Group `green` | — | «Apidog» |
| `apidog-contract` | Icon | `apidog` | «Контракт Go» |
| `laptop` | Group `white` | — | «Генерация кода: ноут или CI» |
| `fe-sync` | Group `plain` | `laptop` | «bun run sync (монорепа фронта)» |
| `fe-export` | Activity | `fe-sync` | «apidog: выгрузка контракта» |
| `fe-spec` | Icon | `fe-sync` | «spec/openapi.json» |
| `fe-orval` | Activity | `fe-sync` | «Orval — генератор кода» |
| `be-generate` | Group `plain` | `laptop` | «make generate (бэк)» |
| `be-export` | Activity | `be-generate` | «cmd/apidog» |
| `be-codegen` | Activity | `be-generate` | «oapi-codegen» |
| `github` | Group `purple` | — | «GitHub» |
| `repo-frontend` | Group `plain` | `github` | «Монорепа фронта» |
| `gen-go-client` | Icon | `repo-frontend` | «apps/bff/src/go/client.ts: клиент к Go» |
| `gen-schemas` | Icon | `repo-frontend` | «packages/schemas/src/zod.ts: @cdd/schemas» |
| `repo-backend` | Group `plain` | `github` | «Бэкенд» |
| `gen-go-server` | Icon | `repo-backend` | «api.gen.go» |
| `vps` | Group `blue` | — | «Прод: VPS в Selectel» |
| `bff` | Group `plain` | `vps` | «BFF» |
| `bff-router` | Icon | `bff` | «Роутер tRPC: проверяет вход zod-схемами» |
| `bff-go-client` | Icon | `bff` | «Клиент к Go» |
| `go-api` | Icon | `vps` | «Go API» |
| `client` | Icon | — | «Браузер: формы и свой tRPC-клиент» |
| `legend` | Legend | — | массив из `bun run check` |

Стрелки (`from → to`, подпись):

- `apidog-contract → fe-export`, `apidog-contract → be-export`;
- `fe-export → fe-spec`, `fe-spec → fe-orval`, `fe-orval → gen-go-client`, `fe-orval → gen-schemas`;
- `be-export → be-codegen`, `be-codegen → gen-go-server`;
- `gen-go-client → bff-go-client` «в сборку», `gen-schemas → bff-router` «в сборку», `gen-go-server → go-api` «в сборку»;
- `client → bff-router` «/api/trpc», `bff-router → bff-go-client`, `bff-go-client → go-api` «/api/v1».

- [ ] **Step 1: Тест схемы** — `scripts/bff-contract-diagram.test.ts`:

```ts
test("bff-contract: zones, nodes and links from the spec, no goZod/goApi", () => {
  const doc = JSON.parse(readFileSync("diagrams/modules/2/bff-contract.json", "utf8"));
  const byId = new Map(doc.entities.map((e) => [e.id, e]));
  // цвета верхних групп
  expect(["apidog", "laptop", "github", "vps"].map((id) => byId.get(id)?.color)).toEqual(["green", "white", "purple", "blue"]);
  // все id из таблицы задачи 2 существуют; client и legend на месте
  // pairs = connections.map(c => `${c.from}>${c.to}`) содержит все 14 стрелок из списка задачи 2
  const text = JSON.stringify(doc);
  for (const needle of ["Orval", "@cdd/schemas", "Go API", "/api/trpc", "/api/v1", "в сборку"]) expect(text, needle).toContain(needle);
  expect(text).not.toMatch(/goZod|goApi/);
});
```

Плюс в `scripts/architecture-page.test.ts`, рядом с `docs tell to add a new root diagram…`:

```ts
test("docs tell where module plan diagrams live", () => {
  for (const file of ["README.md", "CLAUDE.md", ".claude/skills/eraser-diagrams/SKILL.md"]) {
    expect(readFileSync(file, "utf8"), file).toContain("diagrams/modules/");
  }
});
```

- [ ] **Step 2: Тесты падают**

Run: `bun test scripts/bff-contract-diagram.test.ts scripts/architecture-page.test.ts`
Expected: FAIL — файла схемы нет (ENOENT), строки `diagrams/modules/` в документах нет.

- [ ] **Step 3: Схема по циклу скилла**

Написать JSON, затем: `bun run validate` → `bun run check` (скопировать `entries` легенды из вывода) → `bun run warm` → `DIAGRAMS_NATIVE=1 bun run render` → Read `dist/modules/2/bff-contract.png`. Проверить: узлы не накладываются, всё внутри своих групп, подписи читаемы, легенда ничего не перекрывает. Раскладка — слева направо: Apidog, Генерация, GitHub, Прод; `client` — над или под зоной «Прод» рядом с BFF. Повторять до чистого PNG.

- [ ] **Step 4: Документация**

- README: в абзаце про исходники — «и `diagrams/modules/<N>/*.json`: схемы плана модуля, в „Архитектуру“ не попадают, встраиваются в страницы модуля»; новая таблица «Модуль №2 (`diagrams/modules/2/`)» со строкой `[bff-contract](https://cringe-driven-development-team.github.io/docs/modules/2/bff-contract.html)` | «Контракт BFF: генерация кода, что коммитится, что работает в проде».
- CLAUDE.md, раздел «Схемы», после строки про `diagrams/bff/`: «Схемы плана модуля — в `diagrams/modules/<N>/`, папка в `HIDDEN_FOLDERS`, на страницу — `<Diagram name="modules/<N>/<имя>" />`».
- Скилл, строки 9-12: «Новые схемы кладутся в корень `diagrams/`, схемы плана модуля — в `diagrams/modules/<N>/`».

- [ ] **Step 5: Тесты проходят**

Run: `bun run typecheck && bun run test`
Expected: PASS.

- [ ] **Step 6: Коммит**

```bash
git add diagrams/modules/2/bff-contract.json scripts/bff-contract-diagram.test.ts scripts/architecture-page.test.ts README.md CLAUDE.md .claude/skills/eraser-diagrams/SKILL.md
git commit -m "feat(diagrams): схема контракта BFF — генерация, GitHub и прод"
```

### Task 3: схема на странице трека BFF

**Files:**
- Modify: `site/modules/2/tracks/bff.md:24-57` (раздел «Как устроен контракт»)
- Test: `scripts/bff-pages.test.ts:290-302` (тест `в треке есть схема контракта…`)

**Interfaces:**
- Consumes: схема `modules/2/bff-contract` из задачи 2; компонент `<Diagram name="…" />` (`site/.vitepress/theme/Diagram.vue`).

- [ ] **Step 1: Тест** — заменить тело теста `в треке есть схема контракта: генерация, BFF и клиент`:

```ts
const md = readFileSync(TRACK, "utf8");
const part = section(md, "Как устроен контракт");
expect(part).toContain('<Diagram name="modules/2/bff-contract" />');
expect(part).not.toContain("```mermaid");
expect(md).not.toMatch(/goZod|goApi/);
expect(part).toContain("/modules/3/");
expect(part).toContain("./bff/contract");
expect(part).toContain("@cdd/schemas");
```

- [ ] **Step 2: Тест падает**

Run: `bun test scripts/bff-pages.test.ts`
Expected: FAIL — в разделе ещё mermaid, нет `<Diagram`.

- [ ] **Step 3: Страница**

Mermaid-блок и легенду о пунктирных и сплошных стрелках заменить на `<Diagram name="modules/2/bff-contract" />` и абзац: «Слева — то, что делается до выкатки: Orval — генератор кода, он запускается командой `bun run sync` и пишет файлы в репозиторий. В проде его нет. Справа — то, что работает в проде. Между ними — сгенерированные файлы: они попадают в сборку BFF и Go». Буллеты «Генерация / BFF / Клиент» оставить по смыслу, но без `goZod` и `goApi`: «клиент к Go» и «zod-схемы (`@cdd/schemas`)». Абзац про модуль №3 и ссылка `./bff/contract` остаются. Добавить строку, что типы процедур клиент берёт из роутера при сборке (`import type { AppRouter }`): на схеме этой связи нет.

- [ ] **Step 4: Тесты и полная сборка**

Run: `bun run typecheck && bun run test && DIAGRAMS_NATIVE=1 bun run build`
Expected: всё PASS; в выводе `mermaid ok` (в `bff.md` остаются схемы «Было и стало»), `site ok`; нет `conflicts` от `build-vitepress`; есть `dist/modules/2/bff-contract.html`.

- [ ] **Step 5: Осмотр**

`bunx vitepress preview site --port 5199` из папки с собранным `dist/`, или превью ветки после push. Открыть `/docs/modules/2/tracks/bff` в Chrome агентов. Проверить:

- карточка схемы видна;
- кнопки масштаба и «HTML» работают;
- в меню «Архитектура» схемы нет.

Скриншот прочитать, вкладку закрыть.

- [ ] **Step 6: Коммит**

```bash
git add site/modules/2/tracks/bff.md scripts/bff-pages.test.ts
git commit -m "docs(modules): на странице BFF — eraser-схема контракта вместо mermaid"
```
