# MVP on Docker Compose and Frozen k3s Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Пайплайн схем понимает подпапки, пять k3s-схем переезжают в `diagrams/frozen-k3s/` без изменений, в `diagrams/` появляются четыре схемы MVP на Docker Compose, README и скилл описывают новую раскладку.

**Architecture:** Схема это `diagrams/<name>.json` или `diagrams/<folder>/<name>.json` в формате eraser-diagrams. Скрипты на bun и TypeScript в `scripts/`, рендер через `@eraserlabs/diagrams-cli` под Node. Сначала пайплайн учится подпапкам (TDD, `bun test`), потом схемы переезжают, потом пишутся новые. Проверка каждой схемы: `bun run validate`, `bun run check`, `bun run render`, осмотр PNG. Весь код и все JSON плана прогнаны 2026-09-16 на копии репозитория: `bun run typecheck`, `bun test` (55 pass), `bun run build` (`colors ok: 9 diagrams`), PNG четырёх схем MVP осмотрены.

**Tech Stack:** bun ≥ 1.3 (скрипты, `bun test`), TypeScript strict, `@eraserlabs/diagrams-cli@0.1.0`, рендер под Node ≥ 22.12 и Chrome.

**Spec:** `docs/superpowers/specs/2026-09-16-mvp-compose-design.md`. Схемы §8, пайплайн §9, приёмка §11. Правила правки схем: `.claude/skills/eraser-diagrams/SKILL.md`.

## Global Constraints

- Репозиторий `Cringe-Driven-Development-Team/docs`, ветка `feature/frontend-monorepo`. Коммит после каждой задачи, push не делать.
- Каждый коммит заканчивается строкой `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Файлы в `diagrams/frozen-k3s/` после переноса не правятся: ни байта.
- Имена иконок только из `icons.txt`; `caddy` и `ghcr` в каталоге нет, для них `server` и `docker` с названием в подписи.
- Узел браузера всегда `"id": "client"`, узел Telegram всегда `"id": "telegram"`; стрелки красятся по конвенции `scripts/colors.ts`, легенду проверяет `bun run check`.
- Плейсхолдеры в подписях в фигурных скобках: `{sha}`, никогда `<sha>` (санитайзер CLI).
- Рендер требует настоящего Node в PATH и Chrome; если автопоиск не находит Chrome, задать `CHROMIUM_PATH`.
- Перед каждым коммитом со схемами или скриптами: `bun run typecheck`, `bun run test`, `bun run build` проходят.

---

## File Structure

| Файл | Ответственность | Изменение |
| --- | --- | --- |
| `scripts/eraser.ts` | список схем (корень и один уровень подпапок), пачки рендера по папкам, запуск CLI | правка |
| `scripts/eraser.test.ts` | тесты `listDiagrams`, `renderBatches` | правка |
| `scripts/build-index.ts` | имена схем с подпапкой, `dist/index.html` с секциями | правка |
| `scripts/build-index.test.ts` | тесты `diagramNames`, `renderIndex` | правка |
| `scripts/check-colors.ts` | обход всех схем через `listDiagrams` | правка |
| `diagrams/frozen-k3s/*.json` | пять k3s-схем, frozen | перенос `git mv` |
| `diagrams/deployment.json`, `ci.json`, `cd.json`, `frontend-monorepo.json` | схемы MVP | новые файлы |
| `README.md` | таблица схем MVP и Frozen, подпапки | правка |
| `.claude/skills/eraser-diagrams/SKILL.md` | подпапки, frozen не правится | правка |
| `docs/superpowers/specs/2026-09-15-frontend-monorepo-design.md`, `docs/superpowers/plans/2026-09-15-frontend-monorepo.md` | пометка frozen | правка шапки |

`scripts/build-site.ts` не меняется: он использует `diagramNames` и `renderIndex`, а `dist/` копирует рекурсивно. Workflows `.github/workflows/*.yml` не меняются.

---

### Task 1: listDiagrams и renderBatches в `scripts/eraser.ts`

**Files:**
- Modify: `scripts/eraser.ts`
- Test: `scripts/eraser.test.ts`

**Interfaces:**
- Produces: `listDiagrams(dir = "diagrams"): string[]` возвращает пути `diagrams/<name>.json` и `diagrams/<folder>/<name>.json`, разделитель всегда `/`, отсортированные; `renderBatches(files, dir = "diagrams", distDir = "dist"): { outDir: string; files: string[] }[]`; константы `DIAGRAMS_DIR`, `DIST_DIR`. Задачи 2 и 3 импортируют `listDiagrams` и `DIAGRAMS_DIR`.

- [ ] **Step 1: Write the failing tests**

В `scripts/eraser.test.ts` заменить импорт и тест `listDiagrams` на:

```ts
import { buildArgs, cliEntry, listDiagrams, nodeProbeVerdict, renderBatches, rendererCommand, spawnError } from "./eraser.ts";
```

```ts
test("listDiagrams returns *.json from the root and one level of subfolders, sorted, with / separators", async () => {
  const dir = mkdtempSync(join(tmpdir(), "eraser-"));
  tempDirs.push(dir);
  await Bun.write(join(dir, "b.json"), "{}");
  await Bun.write(join(dir, "a.json"), "{}");
  await Bun.write(join(dir, "notes.md"), "");
  await Bun.write(join(dir, "frozen", "a.json"), "{}");
  await Bun.write(join(dir, "frozen", "deep", "c.json"), "{}");
  const prefix = dir.replaceAll("\\", "/");
  expect(listDiagrams(dir)).toEqual([`${prefix}/a.json`, `${prefix}/b.json`, `${prefix}/frozen/a.json`]);
});

test("renderBatches groups files by folder: root into dist, a subfolder into dist/<folder>", () => {
  const files = ["diagrams/ci.json", "diagrams/frozen-k3s/cd.json", "diagrams/cd.json", "diagrams/frozen-k3s/ci.json"];
  expect(renderBatches(files)).toEqual([
    { outDir: "dist", files: ["diagrams/ci.json", "diagrams/cd.json"] },
    { outDir: "dist/frozen-k3s", files: ["diagrams/frozen-k3s/cd.json", "diagrams/frozen-k3s/ci.json"] },
  ]);
});

test("renderBatches without subfolders is a single batch into dist", () => {
  expect(renderBatches(["diagrams/ci.json"])).toEqual([{ outDir: "dist", files: ["diagrams/ci.json"] }]);
});
```

Старый тест `listDiagrams returns only *.json, sorted, with dir prefix` удалить: он ожидал `join(dir, ...)` с платформенным разделителем.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test scripts/eraser.test.ts`
Expected: FAIL, `renderBatches` is not exported; тест `listDiagrams` падает на отсутствующем `frozen/a.json` в результате.

- [ ] **Step 3: Implement listDiagrams and renderBatches**

В `scripts/eraser.ts` заменить шапку и `listDiagrams`:

```ts
// Обёртка над eraser-diagrams CLI. Подставляет diagrams/*.json вместо glob,
// потому что cmd.exe на Windows glob не раскрывает, а CLI сам этого не делает.
// CLI запускается под node: под bun запуск Chrome зависает
// (docs/superpowers/specs/2026-09-13-diagram-colors-and-bun-design.md §2.1).
// Схемы лежат в diagrams/ и в одном уровне подпапок (diagrams/frozen-k3s/). CLI именует
// выход по basename входа, поэтому render вызывается по разу на папку со своим --out-dir
// (docs/superpowers/specs/2026-09-16-mvp-compose-design.md §2, §9.2).
// Использование: bun scripts/eraser.ts <command> [cli options...]
import { dirname, join, relative } from "node:path";

export const DIAGRAMS_DIR = "diagrams";
export const DIST_DIR = "dist";
```

```ts
// Корень и один уровень подпапок. Пути с "/" на любой платформе: они попадают
// в аргументы CLI, сообщения и HTML.
export function listDiagrams(dir = DIAGRAMS_DIR): string[] {
  const names = [...new Bun.Glob("*.json").scanSync(dir), ...new Bun.Glob("*/*.json").scanSync(dir)];
  return names.map((name) => `${dir}/${name}`.replaceAll("\\", "/")).sort();
}

export interface RenderBatch {
  outDir: string;
  files: string[];
}

// Одна пачка на папку: корень diagrams/ рендерится в dist/, diagrams/<sub>/ в dist/<sub>/.
export function renderBatches(files: readonly string[], dir = DIAGRAMS_DIR, distDir = DIST_DIR): RenderBatch[] {
  const byFolder = new Map<string, string[]>();
  for (const file of files) {
    const folder = dirname(relative(dir, file)).replaceAll("\\", "/");
    const outDir = folder === "." ? distDir : `${distDir}/${folder}`;
    byFolder.set(outDir, [...(byFolder.get(outDir) ?? []), file]);
  }
  return [...byFolder].map(([outDir, batch]) => ({ outDir, files: batch }));
}
```

`Bun.Glob` не раскрывает фигурные скобки с `/` внутри (`{*,*/*}.json` даёт пустой список, проверено), поэтому два скана. На Windows `scanSync` отдаёт `\`, отсюда `replaceAll`.

В `main` заменить блок запуска CLI (от `const { cmd, args } = await rendererCommand(...)` до конца функции) на:

```ts
  const batches = command === "render" ? renderBatches(files) : [{ outDir: DIST_DIR, files }];
  for (const batch of batches) {
    const batchExtra = command === "render" ? [...extra, "--out-dir", batch.outDir] : extra;
    const { cmd, args } = await rendererCommand(command, batch.files, batchExtra);
    try {
      const result = Bun.spawnSync([cmd, ...args], { stdio: ["inherit", "inherit", "inherit"] });
      if (result.exitCode !== 0) return result.exitCode ?? 1;
    } catch (error) {
      const { code, message } = spawnError(error);
      if (code === "ENOENT") {
        console.error("node not found on PATH: the eraser-diagrams renderer needs Node >= 22.12");
        return 2;
      }
      console.error(message);
      return 1;
    }
  }
  return 0;
}
```

`validate` идёт одним вызовом со всеми файлами: выхода у него нет, коллизий имён нет. `--out-dir` из аргументов перекрывает `outDir` конфига, для корня это те же `./dist`.

- [ ] **Step 4: Run the tests and typecheck**

Run: `bun run typecheck && bun test scripts/eraser.test.ts`
Expected: tsc без ошибок, все тесты файла PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/eraser.ts scripts/eraser.test.ts
git commit -m "eraser: list one level of diagram subfolders, render each folder into its own dist dir

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Индекс с секциями в `scripts/build-index.ts`

**Files:**
- Modify: `scripts/build-index.ts`
- Test: `scripts/build-index.test.ts`

**Interfaces:**
- Consumes: `listDiagrams`, `DIAGRAMS_DIR` из `scripts/eraser.ts` (Task 1).
- Produces: `diagramNames(dir = "diagrams"): string[]` даёт `"ci"`, `"frozen-k3s/ci"`; `renderIndex(names, options)` та же сигнатура, что была. `scripts/build-site.ts` их использует без изменений.

- [ ] **Step 1: Write the failing tests**

В `scripts/build-index.test.ts` заменить тест `diagramNames` и добавить тест секции:

```ts
test("diagramNames: names of *.json relative to the dir without extension, subfolders with /, sorted", async () => {
  const dir = mkdtempSync(join(tmpdir(), "index-"));
  tempDirs.push(dir);
  await Bun.write(join(dir, "cd.json"), "{}");
  await Bun.write(join(dir, "ci.json"), "{}");
  await Bun.write(join(dir, "README.md"), "");
  await Bun.write(join(dir, "frozen-k3s", "ci.json"), "{}");
  expect(diagramNames(dir)).toEqual(["cd", "ci", "frozen-k3s/ci"]);
});

test("renderIndex: a subfolder becomes its own section with h3 cards linking into the folder", () => {
  const html = renderIndex(["ci", "frozen-k3s/cd", "frozen-k3s/ci"]);
  expect(html).toMatch(/<h2>ci<\/h2>/);
  expect(html).toMatch(/<h2 class="folder">frozen-k3s\/<\/h2>/);
  expect(html).toMatch(/<h3>cd<\/h3>/);
  expect(html).toMatch(/href="frozen-k3s\/cd\.html"/);
  expect(html).toMatch(/<img src="frozen-k3s\/cd\.png" alt="frozen-k3s\/cd"/);
  expect(html.indexOf("<h2>ci</h2>")).toBeLessThan(html.indexOf('<h2 class="folder">'));
  expect(html).not.toMatch(/<h2>frozen-k3s\/ci<\/h2>/);
});
```

Остальные тесты файла (карточка с html, png и превью; ссылка на превью веток) не меняются и должны остаться зелёными.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test scripts/build-index.test.ts`
Expected: FAIL: `diagramNames` не видит `frozen-k3s/ci`, в HTML нет `class="folder"`.

- [ ] **Step 3: Implement**

В `scripts/build-index.ts` заменить всё от первой строки до `const previews = ...` на:

```ts
// Собирает dist/index.html: заголовок, ссылки на <name>.html и <name>.png,
// превью PNG. Схемы корня diagrams/ идут карточками, каждая подпапка
// (diagrams/frozen-k3s/) отдельной секцией с именем папки.
// Один статичный файл, CSS встроен, зависимостей нет.
// Использование: bun scripts/build-index.ts
import { join } from "node:path";
import { DIAGRAMS_DIR, listDiagrams } from "./eraser.ts";

// Имена схем относительно diagrams/, без .json: "ci", "frozen-k3s/ci".
export function diagramNames(dir = DIAGRAMS_DIR): string[] {
  return listDiagrams(dir).map((file) => file.slice(dir.length + 1, -".json".length));
}

function card(name: string, heading: "h2" | "h3"): string {
  const title = name.slice(name.lastIndexOf("/") + 1);
  return `    <section class="card">
      <${heading}>${title}</${heading}>
      <p><a href="${name}.html">HTML</a> · <a href="${name}.png">PNG</a></p>
      <a href="${name}.html"><img src="${name}.png" alt="${name}"></a>
    </section>`;
}

export function renderIndex(names: readonly string[], options: { previewsHref?: string } = {}): string {
  const rootCards = names.filter((name) => !name.includes("/")).map((name) => card(name, "h2"));
  const folders = [...new Set(names.filter((name) => name.includes("/")).map((name) => name.slice(0, name.indexOf("/"))))];
  const folderSections = folders.map((folder) =>
    [`    <h2 class="folder">${folder}/</h2>`, ...names.filter((name) => name.startsWith(`${folder}/`)).map((name) => card(name, "h3"))].join("\n"),
  );
  const cards = [...rootCards, ...folderSections].join("\n");
```

`diagramNames(dir)` режет `dir.length + 1`: `listDiagrams` возвращает `${dir}/...` с `/`, поэтому это верно и для абсолютного `dir` из теста.

В CSS внутри шаблона заменить строку `.card h2 { margin: 0 0 8px; font-size: 20px; }` на:

```css
    .card h2, .card h3 { margin: 0 0 8px; font-size: 20px; }
    h2.folder { margin: 40px 0 16px; }
```

- [ ] **Step 4: Run the tests and typecheck**

Run: `bun run typecheck && bun test scripts/build-index.test.ts scripts/build-site.test.ts`
Expected: PASS, включая тесты `build-site` (они импортируют `build-index`).

- [ ] **Step 5: Commit**

```bash
git add scripts/build-index.ts scripts/build-index.test.ts
git commit -m "build-index: diagram names with subfolders, one index section per folder

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `scripts/check-colors.ts` обходит подпапки

**Files:**
- Modify: `scripts/check-colors.ts`

**Interfaces:**
- Consumes: `listDiagrams` из `scripts/eraser.ts` (Task 1).
- Produces: вывод `colors ok: N diagrams`, где N считает схемы во всех папках; сообщения о проблемах начинаются с пути `diagrams/<folder>/<name>.json`.

`checkDiagram` и его тесты не меняются: обход файлов в `main` не покрыт unit-тестами, его проверяет `bun run check` в Task 4.

- [ ] **Step 1: Replace the file walk**

Заменить шапку файла:

```ts
// Проверяет цветовую конвенцию во всех схемах diagrams/, включая подпапки.
// Спека: docs/superpowers/specs/2026-09-13-diagram-colors-and-bun-design.md §4.5.
// Использование: bun scripts/check-colors.ts
import { FLOW_BY_KEY, ZONES, expectedLegend, flowOf, indexById } from "./colors.ts";
import { listDiagrams } from "./eraser.ts";
import type { DiagramDoc, Entity, GroupEntity } from "./diagram.ts";
```

Импорт `join` из `node:path` удалить. Заменить `main`:

```ts
async function main(): Promise<number> {
  const files = listDiagrams();
  let failures = 0;
  for (const file of files) {
    const doc = (await Bun.file(file).json()) as DiagramDoc;
    for (const problem of checkDiagram(doc)) {
      console.error(`${file} ${problem}`);
      failures += 1;
    }
  }
  if (failures > 0) return 1;
  console.log(`colors ok: ${files.length} diagrams`);
  return 0;
}
```

- [ ] **Step 2: Verify**

Run: `bun run typecheck && bun test && bun run check`
Expected: tsc чисто, 55 tests pass, `colors ok: 5 diagrams` (схемы ещё в корне).

- [ ] **Step 3: Commit**

```bash
git add scripts/check-colors.ts
git commit -m "check-colors: walk diagram subfolders through listDiagrams

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Перенос k3s-схем в `diagrams/frozen-k3s/`

**Files:**
- Move: `diagrams/cd.json`, `diagrams/ci.json`, `diagrams/deployment.json`, `diagrams/frontend-monorepo.json`, `diagrams/integrations.json` → `diagrams/frozen-k3s/`

**Interfaces:**
- Produces: `diagrams/frozen-k3s/` с пятью файлами; корень `diagrams/` пустой до Task 5. Содержимое файлов байт в байт прежнее.

- [ ] **Step 1: Move with git**

`git mv` в несуществующую папку падает с `destination 'diagrams/frozen-k3s/' is not a directory`, поэтому сначала `mkdir`:

```bash
mkdir diagrams/frozen-k3s
git mv diagrams/cd.json diagrams/ci.json diagrams/deployment.json diagrams/frontend-monorepo.json diagrams/integrations.json diagrams/frozen-k3s/
git status --short
```

Expected: пять строк `R  diagrams/<name>.json -> diagrams/frozen-k3s/<name>.json`.

- [ ] **Step 2: Verify the pipeline sees the subfolder**

Run: `bun run validate && bun run check`
Expected: validate печатает `ok    diagrams/frozen-k3s/<name>.json` для пяти файлов, check печатает `colors ok: 5 diagrams`.

Run: `bun run build`
Expected: рендер кладёт `dist/frozen-k3s/<name>.html` и `.png` для пяти схем, `dist/index.html: 5 diagrams`. Проверить: `ls dist/frozen-k3s` показывает 10 файлов, `grep -c 'class="folder"' dist/index.html` даёт 1.

- [ ] **Step 3: Commit**

```bash
git add -A diagrams
git commit -m "Freeze the k3s diagrams under diagrams/frozen-k3s/

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Схема `diagrams/deployment.json`

**Files:**
- Create: `diagrams/deployment.json`

**Interfaces:**
- Produces: схема по спеке §8.1. Ids `client`, `selectel`, `vps1`, `vps1-caddy`, `vps1-bff`, `vps2`, `vps2-go`, `vps2-postgres`, `s3`, `cdn`, `domain`, `legend`.

- [ ] **Step 1: Write the file**

```json
{
  "entities": [
    { "tag": "Icon", "id": "client", "x": 60, "y": 200, "icon": "chrome", "texts": [{ "text": "Client (браузер)" }] },

    { "tag": "Group", "id": "selectel", "color": "blue", "x": 300, "y": 0, "width": 720, "height": 460, "isContainer": true, "title": { "text": "Selectel", "icon": "cloud" } },

    { "tag": "Group", "id": "vps1", "color": "blue", "styleMode": "plain", "x": 320, "y": 40, "width": 300, "height": 160, "containerId": "selectel", "isContainer": true, "title": { "text": "VPS 1 · Docker Compose", "icon": "docker" } },
    { "tag": "Icon", "id": "vps1-caddy", "x": 340, "y": 80, "containerId": "vps1", "icon": "server", "texts": [{ "text": "Caddy" }] },
    { "tag": "Icon", "id": "vps1-bff", "x": 480, "y": 80, "containerId": "vps1", "icon": "hono", "texts": [{ "text": "BFF (Hono · bun)" }] },

    { "tag": "Group", "id": "vps2", "color": "blue", "styleMode": "plain", "x": 660, "y": 40, "width": 300, "height": 160, "containerId": "selectel", "isContainer": true, "title": { "text": "VPS 2 · Docker Compose", "icon": "docker" } },
    { "tag": "Icon", "id": "vps2-go", "x": 680, "y": 80, "containerId": "vps2", "icon": "go", "texts": [{ "text": "Go API" }] },
    { "tag": "Icon", "id": "vps2-postgres", "x": 820, "y": 80, "containerId": "vps2", "icon": "postgres", "texts": [{ "text": "Postgres" }] },

    { "tag": "Icon", "id": "s3", "x": 760, "y": 300, "containerId": "selectel", "icon": "database", "texts": [{ "text": "S3: releases/{sha}/, current.json" }] },
    { "tag": "Icon", "id": "cdn", "x": 340, "y": 300, "containerId": "selectel", "icon": "cloud", "texts": [{ "text": "CDN static.site.ru" }] },
    { "tag": "Icon", "id": "domain", "x": 900, "y": 300, "containerId": "selectel", "icon": "globe", "texts": [{ "text": "site.ru" }] },

    { "tag": "Legend", "id": "legend", "x": 1080, "y": 0, "width": 340, "entries": [{ "text": "Наша инфраструктура", "color": "#2866c4" }, { "text": "Пользовательский трафик", "color": "#c38424" }, { "text": "Прочие связи", "color": "#1c1c1c" }] }
  ],
  "connections": [
    { "tag": "Relationship", "from": "client", "to": "vps1-caddy", "label": "https://site.ru: HTML, /api/trpc", "color": "orange", "lineStyle": "solid" },
    { "tag": "Relationship", "from": "client", "to": "cdn", "label": "https://static.site.ru", "color": "orange", "lineStyle": "solid" },

    { "tag": "Relationship", "from": "vps1-caddy", "to": "vps1-bff" },
    { "tag": "Relationship", "from": "vps1-bff", "to": "vps2-go", "label": "S2S: сессия, данные" },
    { "tag": "Relationship", "from": "vps1-bff", "to": "s3", "label": "index.html, current.json" },
    { "tag": "Relationship", "from": "s3", "to": "cdn", "label": "static" },
    { "tag": "Relationship", "from": "vps2-go", "to": "vps2-postgres" }
  ]
}
```

Раскладка проверена рендером: CDN слева, S3 под VPS 2, чтобы стрелка BFF → S3 имела горизонтальный ход и подпись «index.html, current.json» не рвалась по буквам, а стрелка Client → CDN не проходила через S3.

- [ ] **Step 2: Validate, check, render, inspect**

Run: `bun run validate && bun run check && bun run render`
Expected: `ok    diagrams/deployment.json`, `colors ok: 6 diagrams`, `dist/deployment.png` создан.

Открыть `dist/deployment.png` через Read. Ожидаемая картинка: Client слева с двумя оранжевыми стрелками (в Caddy и в CDN), в группе Selectel сверху VPS 1 (Caddy → BFF) и VPS 2 (Go API → Postgres), снизу CDN, S3, site.ru; подписи «S2S: сессия, данные» и «index.html, current.json» читаемы целиком, ничего не накладывается.

- [ ] **Step 3: Commit**

```bash
git add diagrams/deployment.json
git commit -m "deployment: MVP on two VPS with Docker Compose and Caddy

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Схема `diagrams/ci.json`

**Files:**
- Create: `diagrams/ci.json`

**Interfaces:**
- Produces: схема по спеке §8.2. Группы `github`, `repo-react`, `repo-frontend`, `repo-backend`, `repo-static`, `repo-deployments`, `npm-registry`, `ghcr`; узлы `s3`, `telegram`, `legend`.

- [ ] **Step 1: Write the file**

```json
{
  "entities": [
    { "tag": "Group", "id": "github", "color": "purple", "x": 0, "y": 0, "width": 1200, "height": 1140, "isContainer": true, "title": { "text": "GitHub", "icon": "github" } },

    { "tag": "Group", "id": "repo-react", "color": "purple", "styleMode": "plain", "x": 20, "y": 40, "width": 840, "height": 180, "containerId": "github", "isContainer": true, "title": { "text": "React repo", "icon": "react" } },
    { "tag": "Group", "id": "react-release", "color": "purple", "styleMode": "plain", "x": 40, "y": 80, "width": 800, "height": 120, "containerId": "repo-react", "isContainer": true, "title": { "text": "React release" } },
    { "tag": "Activity", "id": "react-install", "x": 60, "y": 120, "width": 120, "height": 60, "containerId": "react-release", "texts": [{ "text": "Install deps" }] },
    { "tag": "Activity", "id": "react-lint", "x": 220, "y": 120, "width": 120, "height": 60, "containerId": "react-release", "texts": [{ "text": "Lint" }] },
    { "tag": "Activity", "id": "react-build", "x": 380, "y": 120, "width": 120, "height": 60, "containerId": "react-release", "texts": [{ "text": "Build" }] },
    { "tag": "Activity", "id": "react-deploy-npm", "x": 540, "y": 120, "width": 120, "height": 60, "containerId": "react-release", "texts": [{ "text": "Deploy to NPM" }] },
    { "tag": "Activity", "id": "react-tg", "x": 700, "y": 120, "width": 120, "height": 60, "containerId": "react-release", "texts": [{ "text": "Send to tg" }] },

    { "tag": "Group", "id": "repo-frontend", "color": "purple", "styleMode": "plain", "x": 20, "y": 240, "width": 1000, "height": 280, "containerId": "github", "isContainer": true, "title": { "text": "Frontend monorepo · bun workspaces · Turborepo", "icon": "react" } },
    { "tag": "Group", "id": "fe-ci", "color": "purple", "styleMode": "plain", "x": 40, "y": 280, "width": 960, "height": 220, "containerId": "repo-frontend", "isContainer": true, "title": { "text": "CI" } },
    { "tag": "Activity", "id": "fe-install", "x": 60, "y": 320, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "bun install" }] },
    { "tag": "Activity", "id": "fe-check", "x": 220, "y": 320, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "turbo: lint · typecheck · test" }] },
    { "tag": "Activity", "id": "fe-vite-build", "x": 380, "y": 320, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "vite build" }] },
    { "tag": "Activity", "id": "fe-upload-release", "x": 540, "y": 320, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "Upload release (main)" }] },
    { "tag": "Activity", "id": "fe-tg", "x": 860, "y": 320, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "Send to tg" }] },
    { "tag": "Activity", "id": "fe-bff-compile", "x": 380, "y": 420, "width": 140, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "bun build --compile" }] },
    { "tag": "Activity", "id": "fe-build-image", "x": 540, "y": 420, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "Build image" }] },
    { "tag": "Activity", "id": "fe-push-image", "x": 700, "y": 420, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "Push image (main)" }] },

    { "tag": "Group", "id": "repo-backend", "color": "purple", "styleMode": "plain", "x": 20, "y": 540, "width": 1000, "height": 180, "containerId": "github", "isContainer": true, "title": { "text": "Backend repo", "icon": "go" } },
    { "tag": "Group", "id": "be-ci", "color": "purple", "styleMode": "plain", "x": 40, "y": 580, "width": 960, "height": 120, "containerId": "repo-backend", "isContainer": true, "title": { "text": "CI" } },
    { "tag": "Activity", "id": "be-build", "x": 60, "y": 620, "width": 120, "height": 60, "containerId": "be-ci", "texts": [{ "text": "Build" }] },
    { "tag": "Activity", "id": "be-units", "x": 220, "y": 620, "width": 120, "height": 60, "containerId": "be-ci", "texts": [{ "text": "Units" }] },
    { "tag": "Activity", "id": "be-lint", "x": 380, "y": 620, "width": 120, "height": 60, "containerId": "be-ci", "texts": [{ "text": "Lint" }] },
    { "tag": "Activity", "id": "be-build-image", "x": 540, "y": 620, "width": 120, "height": 60, "containerId": "be-ci", "texts": [{ "text": "Build image" }] },
    { "tag": "Activity", "id": "be-push-image", "x": 700, "y": 620, "width": 120, "height": 60, "containerId": "be-ci", "texts": [{ "text": "Push image (main)" }] },
    { "tag": "Activity", "id": "be-tg", "x": 860, "y": 620, "width": 120, "height": 60, "containerId": "be-ci", "texts": [{ "text": "Send to tg" }] },

    { "tag": "Group", "id": "repo-static", "color": "purple", "styleMode": "plain", "x": 20, "y": 740, "width": 360, "height": 180, "containerId": "github", "isContainer": true, "title": { "text": "Static repo", "icon": "box" } },
    { "tag": "Group", "id": "static-pipeline", "color": "purple", "styleMode": "plain", "x": 40, "y": 780, "width": 320, "height": 120, "containerId": "repo-static", "isContainer": true, "title": { "text": "Static" } },
    { "tag": "Activity", "id": "static-deploy-s3", "x": 60, "y": 820, "width": 120, "height": 60, "containerId": "static-pipeline", "texts": [{ "text": "Deploy to S3" }] },
    { "tag": "Activity", "id": "static-tg", "x": 220, "y": 820, "width": 120, "height": 60, "containerId": "static-pipeline", "texts": [{ "text": "Send to tg" }] },

    { "tag": "Group", "id": "repo-deployments", "color": "purple", "styleMode": "plain", "x": 20, "y": 940, "width": 740, "height": 160, "containerId": "github", "isContainer": true, "title": { "text": "Deployments repo", "icon": "ansible" } },
    { "tag": "Icon", "id": "dep-pulumi", "x": 40, "y": 980, "containerId": "repo-deployments", "icon": "pulumi", "texts": [{ "text": "Pulumi configs" }] },
    { "tag": "Icon", "id": "dep-ansible", "x": 180, "y": 980, "containerId": "repo-deployments", "icon": "ansible", "texts": [{ "text": "ansible roles / playbooks" }] },
    { "tag": "Icon", "id": "dep-vault", "x": 320, "y": 980, "containerId": "repo-deployments", "icon": "ansible", "texts": [{ "text": "ansible vault" }] },
    { "tag": "Icon", "id": "dep-compose", "x": 460, "y": 980, "containerId": "repo-deployments", "icon": "docker", "texts": [{ "text": "docker-compose.yml" }] },
    { "tag": "Icon", "id": "dep-caddyfile", "x": 600, "y": 980, "containerId": "repo-deployments", "icon": "server", "texts": [{ "text": "Caddyfile" }] },

    { "tag": "Group", "id": "npm-registry", "color": "green", "x": 1300, "y": 40, "width": 200, "height": 160, "isContainer": true, "title": { "text": "NPM Registry", "icon": "npm" } },
    { "tag": "Icon", "id": "npm-react", "x": 1320, "y": 80, "containerId": "npm-registry", "icon": "npm", "texts": [{ "text": "@my/react" }] },
    { "tag": "Group", "id": "ghcr", "color": "green", "x": 1300, "y": 540, "width": 320, "height": 160, "isContainer": true, "title": { "text": "GHCR", "icon": "docker" } },
    { "tag": "Icon", "id": "reg-bff", "x": 1320, "y": 580, "containerId": "ghcr", "icon": "docker", "texts": [{ "text": "bff:{sha}" }] },
    { "tag": "Icon", "id": "reg-backend", "x": 1460, "y": 580, "containerId": "ghcr", "icon": "docker", "texts": [{ "text": "backend:{sha}" }] },
    { "tag": "Icon", "id": "s3", "x": 1320, "y": 820, "icon": "database", "texts": [{ "text": "S3" }] },
    { "tag": "Icon", "id": "telegram", "x": 1320, "y": 1000, "icon": "telegram", "texts": [{ "text": "Telegram" }] },
    { "tag": "Legend", "id": "legend", "x": 1680, "y": 0, "width": 340, "entries": [{ "text": "GitHub", "color": "#c43dcf" }, { "text": "Внешние сервисы", "color": "#30a050" }, { "text": "Пайплайн и внешние системы, пунктир", "color": "#3a3a3a" }, { "text": "Алерты и уведомления, точки", "color": "#bd413a" }, { "text": "Прочие связи", "color": "#1c1c1c" }] }
  ],
  "connections": [
    { "tag": "Relationship", "from": "react-install", "to": "react-lint" },
    { "tag": "Relationship", "from": "react-lint", "to": "react-build" },
    { "tag": "Relationship", "from": "react-build", "to": "react-deploy-npm" },
    { "tag": "Relationship", "from": "react-deploy-npm", "to": "react-tg" },

    { "tag": "Relationship", "from": "fe-install", "to": "fe-check" },
    { "tag": "Relationship", "from": "fe-check", "to": "fe-vite-build" },
    { "tag": "Relationship", "from": "fe-vite-build", "to": "fe-upload-release" },
    { "tag": "Relationship", "from": "fe-upload-release", "to": "fe-tg" },
    { "tag": "Relationship", "from": "fe-check", "to": "fe-bff-compile" },
    { "tag": "Relationship", "from": "fe-bff-compile", "to": "fe-build-image" },
    { "tag": "Relationship", "from": "fe-build-image", "to": "fe-push-image" },
    { "tag": "Relationship", "from": "fe-push-image", "to": "fe-tg" },

    { "tag": "Relationship", "from": "be-build", "to": "be-units" },
    { "tag": "Relationship", "from": "be-units", "to": "be-lint" },
    { "tag": "Relationship", "from": "be-lint", "to": "be-build-image" },
    { "tag": "Relationship", "from": "be-build-image", "to": "be-push-image" },
    { "tag": "Relationship", "from": "be-push-image", "to": "be-tg" },

    { "tag": "Relationship", "from": "static-deploy-s3", "to": "static-tg" },

    { "tag": "Relationship", "from": "react-deploy-npm", "to": "npm-react", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "fe-upload-release", "to": "s3", "label": "releases/{sha}/", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "fe-push-image", "to": "reg-bff", "label": "tags: {sha}, main", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "be-push-image", "to": "reg-backend", "label": "tags: {sha}, main", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "static-deploy-s3", "to": "s3", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "github", "to": "telegram", "label": "Send to tg", "color": "red", "lineStyle": "dotted" }
  ]
}
```

- [ ] **Step 2: Validate, check, render, inspect**

Run: `bun run validate && bun run check && bun run render`
Expected: `ok    diagrams/ci.json`, `colors ok: 7 diagrams`.

Открыть `dist/ci.png`. Ожидаемо: пять реп сверху вниз (React, Frontend monorepo с двумя рядами шагов, Backend, Static, Deployments с пятью иконками), справа NPM Registry, GHCR с двумя образами, S3, Telegram; пунктирные стрелки в NPM, GHCR и S3, красная точечная от группы GitHub в Telegram. Обе ветки монорепы сходятся в «Send to tg».

- [ ] **Step 3: Commit**

```bash
git add diagrams/ci.json
git commit -m "ci: MVP repositories, GHCR instead of a private registry, ansible in Deployments repo

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Схема `diagrams/cd.json`

**Files:**
- Create: `diagrams/cd.json`

**Interfaces:**
- Produces: схема по спеке §8.3. VPS показаны узлами `Icon` (`vps1`, `vps2`) внутри группы `selectel`, а не вложенными группами: стрелки к узлам читаются, у пустой группы нечего показывать. Ids групп `actions`, `monorepo-cd`, `monorepo-rollback`, `backend-cd`, `selectel`; узлы `deployments-repo`, `s3`, `ghcr`, `telegram`, `legend`.

- [ ] **Step 1: Write the file**

```json
{
  "entities": [
    { "tag": "Group", "id": "actions", "color": "purple", "x": 0, "y": 0, "width": 1000, "height": 460, "isContainer": true, "title": { "text": "GitHub Actions", "icon": "github-actions" } },

    { "tag": "Group", "id": "monorepo-cd", "color": "purple", "styleMode": "plain", "x": 20, "y": 40, "width": 960, "height": 120, "containerId": "actions", "isContainer": true, "title": { "text": "Monorepo CD" } },
    { "tag": "Activity", "id": "md-playbook", "x": 40, "y": 80, "width": 120, "height": 60, "containerId": "monorepo-cd", "texts": [{ "text": "Run ansible playbook" }] },
    { "tag": "Activity", "id": "md-health-bff", "x": 200, "y": 80, "width": 120, "height": 60, "containerId": "monorepo-cd", "texts": [{ "text": "Health check BFF" }] },
    { "tag": "Activity", "id": "md-promote", "x": 360, "y": 80, "width": 120, "height": 60, "containerId": "monorepo-cd", "texts": [{ "text": "Promote to stable" }] },
    { "tag": "Activity", "id": "md-health", "x": 520, "y": 80, "width": 120, "height": 60, "containerId": "monorepo-cd", "texts": [{ "text": "Health check" }] },
    { "tag": "Activity", "id": "md-retention", "x": 680, "y": 80, "width": 120, "height": 60, "containerId": "monorepo-cd", "texts": [{ "text": "Retention: 5 релизов" }] },
    { "tag": "Activity", "id": "md-tg", "x": 840, "y": 80, "width": 120, "height": 60, "containerId": "monorepo-cd", "texts": [{ "text": "Send to tg" }] },

    { "tag": "Group", "id": "monorepo-rollback", "color": "purple", "styleMode": "plain", "x": 20, "y": 180, "width": 800, "height": 120, "containerId": "actions", "isContainer": true, "title": { "text": "Monorepo Rollback" } },
    { "tag": "Activity", "id": "mr-switch", "x": 40, "y": 220, "width": 120, "height": 60, "containerId": "monorepo-rollback", "texts": [{ "text": "Switch release pointer" }] },
    { "tag": "Activity", "id": "mr-health", "x": 200, "y": 220, "width": 120, "height": 60, "containerId": "monorepo-rollback", "texts": [{ "text": "Health check" }] },
    { "tag": "Activity", "id": "mr-playbook", "x": 360, "y": 220, "width": 120, "height": 60, "containerId": "monorepo-rollback", "texts": [{ "text": "Run ansible playbook" }] },
    { "tag": "Activity", "id": "mr-health-bff", "x": 520, "y": 220, "width": 120, "height": 60, "containerId": "monorepo-rollback", "texts": [{ "text": "Health check BFF" }] },
    { "tag": "Activity", "id": "mr-tg", "x": 680, "y": 220, "width": 120, "height": 60, "containerId": "monorepo-rollback", "texts": [{ "text": "Send to tg" }] },

    { "tag": "Group", "id": "backend-cd", "color": "purple", "styleMode": "plain", "x": 20, "y": 320, "width": 640, "height": 120, "containerId": "actions", "isContainer": true, "title": { "text": "Backend CD" } },
    { "tag": "Activity", "id": "be-playbook", "x": 40, "y": 360, "width": 120, "height": 60, "containerId": "backend-cd", "texts": [{ "text": "Run ansible playbook" }] },
    { "tag": "Activity", "id": "be-migrate", "x": 200, "y": 360, "width": 120, "height": 60, "containerId": "backend-cd", "texts": [{ "text": "Run migrations" }] },
    { "tag": "Activity", "id": "be-health", "x": 360, "y": 360, "width": 120, "height": 60, "containerId": "backend-cd", "texts": [{ "text": "Health check" }] },
    { "tag": "Activity", "id": "be-tg", "x": 520, "y": 360, "width": 120, "height": 60, "containerId": "backend-cd", "texts": [{ "text": "Send to tg" }] },

    { "tag": "Icon", "id": "deployments-repo", "x": 1200, "y": 60, "icon": "ansible", "texts": [{ "text": "Deployments repo" }] },

    { "tag": "Group", "id": "selectel", "color": "blue", "x": 1180, "y": 200, "width": 180, "height": 400, "isContainer": true, "title": { "text": "Selectel", "icon": "cloud" } },
    { "tag": "Icon", "id": "vps1", "x": 1200, "y": 240, "containerId": "selectel", "icon": "docker", "texts": [{ "text": "VPS 1 · Docker Compose" }] },
    { "tag": "Icon", "id": "vps2", "x": 1200, "y": 360, "containerId": "selectel", "icon": "docker", "texts": [{ "text": "VPS 2 · Docker Compose" }] },
    { "tag": "Icon", "id": "s3", "x": 1200, "y": 480, "containerId": "selectel", "icon": "database", "texts": [{ "text": "S3" }] },

    { "tag": "Icon", "id": "ghcr", "x": 1480, "y": 300, "icon": "docker", "texts": [{ "text": "GHCR" }] },
    { "tag": "Icon", "id": "telegram", "x": 1200, "y": 700, "icon": "telegram", "texts": [{ "text": "Telegram" }] },

    { "tag": "Legend", "id": "legend", "x": 1700, "y": 0, "width": 340, "entries": [{ "text": "Наша инфраструктура", "color": "#2866c4" }, { "text": "GitHub", "color": "#c43dcf" }, { "text": "Пайплайн и внешние системы, пунктир", "color": "#3a3a3a" }, { "text": "Алерты и уведомления, точки", "color": "#bd413a" }, { "text": "Прочие связи", "color": "#1c1c1c" }] }
  ],
  "connections": [
    { "tag": "Relationship", "from": "md-playbook", "to": "md-health-bff" },
    { "tag": "Relationship", "from": "md-health-bff", "to": "md-promote" },
    { "tag": "Relationship", "from": "md-promote", "to": "md-health" },
    { "tag": "Relationship", "from": "md-health", "to": "md-retention" },
    { "tag": "Relationship", "from": "md-retention", "to": "md-tg" },

    { "tag": "Relationship", "from": "mr-switch", "to": "mr-health" },
    { "tag": "Relationship", "from": "mr-health", "to": "mr-playbook" },
    { "tag": "Relationship", "from": "mr-playbook", "to": "mr-health-bff" },
    { "tag": "Relationship", "from": "mr-health-bff", "to": "mr-tg" },

    { "tag": "Relationship", "from": "be-playbook", "to": "be-migrate" },
    { "tag": "Relationship", "from": "be-migrate", "to": "be-health" },
    { "tag": "Relationship", "from": "be-health", "to": "be-tg" },

    { "tag": "Relationship", "from": "md-playbook", "to": "deployments-repo", "label": "playbook, vault", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "md-playbook", "to": "vps1", "label": "ssh: pull bff:{sha}, compose up", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "mr-playbook", "to": "vps1", "label": "ssh: prev tag", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "be-playbook", "to": "vps2", "label": "ssh: pull backend:{sha}, compose up", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "vps1", "to": "ghcr", "label": "pull" },
    { "tag": "Relationship", "from": "vps2", "to": "ghcr", "label": "pull" },
    { "tag": "Relationship", "from": "md-promote", "to": "s3", "label": "current.json", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "md-retention", "to": "s3", "label": "releases/", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "mr-switch", "to": "s3", "label": "current.json", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "actions", "to": "telegram", "label": "Send to tg", "color": "red", "lineStyle": "dotted" }
  ]
}
```

Selectel сделан столбиком (VPS 1, VPS 2, S3 друг под другом) с отступом 180 от группы Actions: при трёх узлах в ряд шесть пунктирных стрелок из пайплайнов путались, столбик разводит их по высоте (проверено рендером).

- [ ] **Step 2: Validate, check, render, inspect**

Run: `bun run validate && bun run check && bun run render`
Expected: `ok    diagrams/cd.json`, `colors ok: 8 diagrams`.

Открыть `dist/cd.png`. Ожидаемо: три ряда шагов в GitHub Actions, справа Deployments repo, столбик Selectel с VPS 1, VPS 2, S3, правее GHCR с двумя стрелками «pull», внизу Telegram. Подписи «ssh: pull bff:{sha}, compose up», «ssh: prev tag», «ssh: pull backend:{sha}, compose up», «current.json», «releases/» читаемы. Две подписи «current.json» рядом у S3 допустимы, если каждая читается целиком.

- [ ] **Step 3: Commit**

```bash
git add diagrams/cd.json
git commit -m "cd: Monorepo CD, Rollback and Backend CD through ansible-playbook from GitHub Actions

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Схема `diagrams/frontend-monorepo.json`

**Files:**
- Create: `diagrams/frontend-monorepo.json`

**Interfaces:**
- Produces: схема по спеке §8.4. Ids как в frozen-версии минус `t-contract`, `unleash`, `gateway`; вместо `registry` группа `ghcr`, вместо `gateway` узел `caddy`.

- [ ] **Step 1: Write the file**

```json
{
  "entities": [
    { "tag": "Group", "id": "github", "color": "purple", "x": 0, "y": 0, "width": 1200, "height": 540, "isContainer": true, "title": { "text": "GitHub", "icon": "github" } },
    { "tag": "Group", "id": "monorepo", "color": "purple", "styleMode": "plain", "x": 20, "y": 40, "width": 1160, "height": 480, "containerId": "github", "isContainer": true, "title": { "text": "Frontend monorepo · bun workspaces · Turborepo", "icon": "react" } },

    { "tag": "Group", "id": "ws-client", "color": "purple", "styleMode": "plain", "x": 40, "y": 80, "width": 420, "height": 160, "containerId": "monorepo", "isContainer": true, "title": { "text": "apps/client", "icon": "vite" } },
    { "tag": "Icon", "id": "client-react", "x": 60, "y": 120, "containerId": "ws-client", "icon": "react", "texts": [{ "text": "React" }] },
    { "tag": "Icon", "id": "client-tanstack", "x": 200, "y": 120, "containerId": "ws-client", "icon": "layers", "texts": [{ "text": "TanStack Router · Query" }] },
    { "tag": "Icon", "id": "client-zustand", "x": 340, "y": 120, "containerId": "ws-client", "icon": "package", "texts": [{ "text": "zustand" }] },

    { "tag": "Group", "id": "ws-bff", "color": "purple", "styleMode": "plain", "x": 740, "y": 80, "width": 420, "height": 160, "containerId": "monorepo", "isContainer": true, "title": { "text": "apps/bff", "icon": "bun" } },
    { "tag": "Icon", "id": "bff-hono", "x": 760, "y": 120, "containerId": "ws-bff", "icon": "hono", "texts": [{ "text": "Hono" }] },
    { "tag": "Icon", "id": "bff-trpc", "x": 900, "y": 120, "containerId": "ws-bff", "icon": "trpc", "texts": [{ "text": "tRPC · AppRouter" }] },
    { "tag": "Icon", "id": "bff-bootstrap", "x": 1040, "y": 120, "containerId": "ws-bff", "icon": "file-code", "texts": [{ "text": "HTML bootstrap" }] },

    { "tag": "Group", "id": "turbo-pipeline", "color": "purple", "styleMode": "plain", "x": 40, "y": 280, "width": 680, "height": 220, "containerId": "monorepo", "isContainer": true, "title": { "text": "turbo run --affected" } },
    { "tag": "Activity", "id": "t-install", "x": 60, "y": 320, "width": 120, "height": 60, "containerId": "turbo-pipeline", "texts": [{ "text": "bun install" }] },
    { "tag": "Activity", "id": "t-check", "x": 220, "y": 320, "width": 120, "height": 60, "containerId": "turbo-pipeline", "texts": [{ "text": "lint · typecheck · test" }] },
    { "tag": "Activity", "id": "t-vite-build", "x": 380, "y": 320, "width": 120, "height": 60, "containerId": "turbo-pipeline", "texts": [{ "text": "vite build" }] },
    { "tag": "Activity", "id": "t-bff-compile", "x": 380, "y": 420, "width": 140, "height": 60, "containerId": "turbo-pipeline", "texts": [{ "text": "bun build --compile" }] },
    { "tag": "Activity", "id": "t-image", "x": 540, "y": 420, "width": 120, "height": 60, "containerId": "turbo-pipeline", "texts": [{ "text": "Build image" }] },

    { "tag": "Group", "id": "ghcr", "color": "green", "x": 1260, "y": 280, "width": 200, "height": 160, "isContainer": true, "title": { "text": "GHCR", "icon": "docker" } },
    { "tag": "Icon", "id": "reg-bff", "x": 1280, "y": 320, "containerId": "ghcr", "icon": "docker", "texts": [{ "text": "bff:{sha}" }] },

    { "tag": "Icon", "id": "client", "x": 0, "y": 920, "icon": "chrome", "texts": [{ "text": "Client (браузер)" }] },

    { "tag": "Group", "id": "ours", "color": "blue", "x": 360, "y": 700, "width": 1040, "height": 360, "isContainer": true, "title": { "text": "Наша инфраструктура (Selectel)", "icon": "cloud" } },
    { "tag": "Icon", "id": "cdn", "x": 400, "y": 740, "containerId": "ours", "icon": "cloud", "texts": [{ "text": "CDN static.site.ru" }] },
    { "tag": "Icon", "id": "s3", "x": 960, "y": 740, "containerId": "ours", "icon": "database", "texts": [{ "text": "S3: releases/{sha}/, current.json" }] },
    { "tag": "Group", "id": "vps1", "color": "blue", "styleMode": "plain", "x": 380, "y": 880, "width": 420, "height": 160, "containerId": "ours", "isContainer": true, "title": { "text": "VPS 1 · Docker Compose", "icon": "docker" } },
    { "tag": "Icon", "id": "caddy", "x": 400, "y": 920, "containerId": "vps1", "icon": "server", "texts": [{ "text": "Caddy" }] },
    { "tag": "Icon", "id": "bff", "x": 680, "y": 920, "containerId": "vps1", "icon": "hono", "texts": [{ "text": "BFF (Hono · bun)" }] },
    { "tag": "Group", "id": "vps2", "color": "blue", "styleMode": "plain", "x": 1080, "y": 880, "width": 300, "height": 160, "containerId": "ours", "isContainer": true, "title": { "text": "VPS 2 · Docker Compose", "icon": "docker" } },
    { "tag": "Icon", "id": "go-api", "x": 1180, "y": 920, "containerId": "vps2", "icon": "go", "texts": [{ "text": "Go API" }] },

    { "tag": "Textbox", "id": "rules", "x": 1460, "y": 700, "width": 480, "text": "**Правила выкатки**\n\n1. BFF N+1 выкатывается первым, клиент после health check BFF\n2. BFF N+1 обслуживает клиентов N и N+1, проверка на ревью\n3. Ответ BFF несёт x-release; при ошибке контракта перезагрузка сразу, иначе мягко, не чаще раза в 10 минут\n4. В S3 последние 5 релизов, stable и previous не удаляются\n5. Откат: stable ← previous, потом BFF прежним тегом" },

    { "tag": "Legend", "id": "legend", "x": 1900, "y": 0, "width": 340, "entries": [{ "text": "Наша инфраструктура", "color": "#2866c4" }, { "text": "GitHub", "color": "#c43dcf" }, { "text": "Внешние сервисы", "color": "#30a050" }, { "text": "Пользовательский трафик", "color": "#c38424" }, { "text": "Пайплайн и внешние системы, пунктир", "color": "#3a3a3a" }, { "text": "Прочие связи", "color": "#1c1c1c" }] }
  ],
  "connections": [
    { "tag": "Relationship", "from": "ws-client", "to": "ws-bff", "label": "import type AppRouter, BootstrapData" },

    { "tag": "Relationship", "from": "t-install", "to": "t-check" },
    { "tag": "Relationship", "from": "t-check", "to": "t-vite-build" },
    { "tag": "Relationship", "from": "t-check", "to": "t-bff-compile" },
    { "tag": "Relationship", "from": "t-bff-compile", "to": "t-image" },

    { "tag": "Relationship", "from": "t-vite-build", "to": "s3", "label": "releases/{sha}/ (main)", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "t-image", "to": "reg-bff", "color": "black", "lineStyle": "dashed" },

    { "tag": "Relationship", "from": "client", "to": "caddy", "label": "https://site.ru: HTML, /api/trpc", "color": "orange", "lineStyle": "solid" },
    { "tag": "Relationship", "from": "client", "to": "cdn", "label": "https://static.site.ru", "color": "orange", "lineStyle": "solid" },
    { "tag": "Relationship", "from": "s3", "to": "cdn", "label": "static" },
    { "tag": "Relationship", "from": "caddy", "to": "bff" },
    { "tag": "Relationship", "from": "bff", "to": "go-api", "label": "S2S: сессия, данные" },
    { "tag": "Relationship", "from": "bff", "to": "s3", "label": "index.html, current.json" }
  ]
}
```

Группа `vps2` шириной 300 (не 200, как во frozen-версии): при 200 заголовок «VPS 2 · Docker Compose» переносился на две строки. Группа `ours` поэтому 1040 в ширину, текстбокс сдвинут на 1460.

- [ ] **Step 2: Validate, check, render, inspect**

Run: `bun run validate && bun run check && bun run render`
Expected: `ok    diagrams/frontend-monorepo.json`, `colors ok: 9 diagrams`.

Открыть `dist/frontend-monorepo.png`. Ожидаемо: сверху монорепа с `apps/client`, `apps/bff` и пайплайном из пяти шагов, справа GHCR; снизу Client, Selectel с CDN, S3, VPS 1 (Caddy → BFF) и VPS 2 (Go API), правее текстбокс с пятью правилами. Заголовки групп в одну строку, подпись «index.html, current.json» целиком.

- [ ] **Step 3: Commit**

```bash
git add diagrams/frontend-monorepo.json
git commit -m "frontend-monorepo: MVP without contract check, canary and Unleash

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: README, скилл и пометка frozen

**Files:**
- Modify: `README.md`
- Modify: `.claude/skills/eraser-diagrams/SKILL.md`
- Modify: `docs/superpowers/specs/2026-09-15-frontend-monorepo-design.md`
- Modify: `docs/superpowers/plans/2026-09-15-frontend-monorepo.md`

- [ ] **Step 1: README, раздел «Диаграммы»**

Заменить абзац с `diagrams/*.json` в начале раздела:

```markdown
Архитектурные схемы как код. Исходники в `diagrams/*.json` и
`diagrams/<папка>/*.json` в формате
[eraser-diagrams](https://github.com/eraserlabs/eraser-diagrams), рендер
в HTML и PNG, публикация на GitHub Pages:
**https://cringe-driven-development-team.github.io/docs/**
```

Заменить таблицу схем и абзац «Таблица ведётся вручную» на:

```markdown
Архитектур две. **MVP на Docker Compose** это рабочая, с ней идёт вся
текущая работа. **Frozen: k3s** заморожена в `diagrams/frozen-k3s/`, её
схемы не правятся; дизайн в
`docs/superpowers/specs/2026-09-15-frontend-monorepo-design.md`.

MVP (`diagrams/`):

| Схема | Что показывает |
| --- | --- |
| [deployment](https://cringe-driven-development-team.github.io/docs/deployment.html) | Два VPS в Selectel с Docker Compose, S3/CDN, клиент |
| [ci](https://cringe-driven-development-team.github.io/docs/ci.html) | GitHub-репозитории, CI-пайплайны, GHCR, S3 |
| [cd](https://cringe-driven-development-team.github.io/docs/cd.html) | CD и откат через ansible-playbook из GitHub Actions |
| [frontend-monorepo](https://cringe-driven-development-team.github.io/docs/frontend-monorepo.html) | Монорепа клиента и BFF, контракт tRPC, модель релизов |

Frozen: k3s (`diagrams/frozen-k3s/`):

| Схема | Что показывает |
| --- | --- |
| [deployment](https://cringe-driven-development-team.github.io/docs/frozen-k3s/deployment.html) | VPS в Selectel, k3s, S3/CDN, клиент |
| [ci](https://cringe-driven-development-team.github.io/docs/frozen-k3s/ci.html) | GitHub-репозитории, CI-пайплайны и их цели |
| [cd](https://cringe-driven-development-team.github.io/docs/frozen-k3s/cd.html) | CD через Argo CD, канарейка, превью на Coolify |
| [integrations](https://cringe-driven-development-team.github.io/docs/frozen-k3s/integrations.html) | Внешние сервисы и кто с ними говорит |
| [frontend-monorepo](https://cringe-driven-development-team.github.io/docs/frozen-k3s/frontend-monorepo.html) | Монорепа клиента и BFF, Contract check, канарейка |

Таблицы ведутся вручную: добавил файл в `diagrams/`, добавь строку сюда.
`dist/index.html` собирается автоматически: схемы корня карточками, каждая
подпапка отдельной секцией. Схема из подпапки рендерится в
`dist/<папка>/<name>.html` и `.png`.
```

В строке «Дизайн:» в конце раздела добавить `docs/superpowers/specs/2026-09-16-mvp-compose-design.md` последним пунктом:

```markdown
Дизайн: `docs/superpowers/specs/2026-09-12-eraser-diagrams-pipeline-design.md`,
`docs/superpowers/specs/2026-09-13-diagram-colors-and-bun-design.md`,
`docs/superpowers/specs/2026-09-13-branch-previews-design.md`,
`docs/superpowers/specs/2026-09-16-mvp-compose-design.md`.
```

- [ ] **Step 2: SKILL.md**

Заменить первый абзац раздела «Правка диаграмм eraser-diagrams»:

```markdown
Применяй при любой правке `diagrams/*.json` и `diagrams/<папка>/*.json`.
Один файл = одна диаграмма = одна страница на GitHub Pages. Схемы не
сливать. Новые схемы кладутся в корень `diagrams/`. Папка
`diagrams/frozen-k3s/` заморожена: файлы в ней не правятся, для новой
архитектуры на её основе заводится новая схема в корне.
```

В разделе «Цикл правки» заменить пункт 4:

```markdown
4. `bun run render` — `dist/<name>.html` и `dist/<name>.png`, для схемы из
   подпапки `dist/<папка>/<name>.html` и `.png`; рендерер
   запускается под Node ≥ 22.12 из PATH (под bun Chrome не стартует); нужен
   Chrome или другой Chromium; если автопоиск не находит его, задай
   переменную `CHROMIUM_PATH`.
```

- [ ] **Step 3: Пометка frozen в спеке и плане k3s**

В `docs/superpowers/specs/2026-09-15-frontend-monorepo-design.md` заменить строки 4–5:

```markdown
Статус: frozen. Архитектура k3s заморожена спекой
`docs/superpowers/specs/2026-09-16-mvp-compose-design.md`, схемы лежат в
`diagrams/frozen-k3s/` и не правятся. Была утверждена и реализована в
схемах по плану `docs/superpowers/plans/2026-09-15-frontend-monorepo.md`.
```

В `docs/superpowers/plans/2026-09-15-frontend-monorepo.md` после заголовка (строка 1) и пустой строки вставить перед блоком «For agentic workers»:

```markdown
> **Frozen.** План выполнен 2026-09-15. Архитектура k3s заморожена спекой
> `docs/superpowers/specs/2026-09-16-mvp-compose-design.md`, его схемы лежат
> в `diagrams/frozen-k3s/`. Повторно не выполнять.

```

- [ ] **Step 4: Full verification**

Run: `bun run typecheck && bun run test && bun run build`
Expected: tsc чисто, 55 tests pass, `colors ok: 9 diagrams`, `dist/index.html: 9 diagrams`. `ls dist` показывает четыре схемы MVP и папку `frozen-k3s`, `ls dist/frozen-k3s` десять файлов.

Открыть `dist/index.html` в браузере или проверить grep:

```bash
grep -c '<h2>' dist/index.html      # 4: карточки MVP; заголовок секции это <h2 class="folder">, он сюда не входит
grep -c '<h3>' dist/index.html      # 5: пять карточек frozen
```

- [ ] **Step 5: Commit**

```bash
git add README.md .claude/skills/eraser-diagrams/SKILL.md docs/superpowers/specs/2026-09-15-frontend-monorepo-design.md docs/superpowers/plans/2026-09-15-frontend-monorepo.md
git commit -m "Docs: MVP and frozen diagram tables, subfolders in the skill, k3s spec marked frozen

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Приёмка плана

По спеке §11, после Task 9:

- `diagrams/` содержит `deployment.json`, `ci.json`, `cd.json`, `frontend-monorepo.json` и `frozen-k3s/` с пятью прежними файлами; `git log --follow diagrams/frozen-k3s/ci.json` показывает историю до переноса.
- `bun run typecheck`, `bun run test`, `bun run build` проходят; `bun run check` печатает `colors ok: 9 diagrams`.
- `dist/` содержит четыре схемы MVP в корне и пять в `frozen-k3s/`, `dist/index.html` показывает обе секции.
- PNG четырёх схем MVP осмотрены в Tasks 5–8.
- README и SKILL.md обновлены, спека и план k3s помечены frozen.
- После push ветки превью на Pages собирается: `https://cringe-driven-development-team.github.io/docs/branches/feature-frontend-monorepo/` показывает обе секции.
