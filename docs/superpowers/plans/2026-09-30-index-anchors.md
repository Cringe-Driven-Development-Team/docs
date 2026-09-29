# Якоря у схем на странице сайта — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** У каждой схемы на `dist/index.html` есть «#»-якорь: клик кладёт `#{name}` в адресную строку, открытие такой ссылки или перезагрузка открывает нужный таб и прокручивает к схеме.

**Architecture:** Всё в `scripts/build-index.ts`: `pngSize`/`pngSizes` читают размеры PNG из IHDR, `renderIndex` получает их опцией `sizes` и ставит `width`/`height` у `<img>`; карточка получает `id` и ссылку-якорь; страница с табами — inline-скрипт, который по `location.hash` отмечает radio таба и прокручивает. Оба вызова `renderIndex` (`build-index.ts`, `build-site.ts`) передают `sizes`.

**Tech Stack:** bun ≥ 1.3 (`bun:test`, `Bun.file`), TypeScript (`strict`, `noUncheckedIndexedAccess`), Docker Desktop для `bun run build`.

**Spec:** `docs/superpowers/specs/2026-09-30-index-anchors-design.md`

## Global Constraints

- Работа в worktree `.claude/worktrees/index-anchors`, ветка `feature/index-anchors`. Все команды — из корня worktree.
- `renderIndex` остаётся чистой функцией: файлы читает только `pngSizes`.
- `id` карточки и якорь — путь схемы без `.json`: `contract`, `bff/ci`, `frozen-k3s/ci`.
- Табы переключаются без JavaScript, как сейчас; скрипт только открывает таб по якорю и есть только на странице с табами.
- Без новых зависимостей в `package.json`.
- Docker Desktop для `bun run build`: если `docker info` не отвечает — запусти `Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"` и жди до ~2 минут; не поднялся — спроси пользователя. Молча на `DIAGRAMS_NATIVE=1` не переходить.
- Коммиты по-русски: `тип(область): что сделано`, в конце строка `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Якорь указывает на id, который не карточка (`#tab-1`, `#panel-0`): скрипт ничего не делает, а не прокручивает к скрытому radio — проверка `classList.contains("card")` в скрипте, тест на её наличие в Task 3, ручная проверка в Task 4.
2. Битый якорь (`#%E0`): `decodeURIComponent` бросает — скрипт молча выходит, консоль без ошибок — тест на `try`/`catch` в Task 3, ручная проверка в Task 4.
3. `tab.names.map(card)` передаёт индекс вторым аргументом — после добавления параметра `size` у `card` карточки получили бы мусор: вызов переписан на `(name) => card(name, sizes[name])`, тест «без `sizes` у `<img>` нет `width`» в Task 2.
4. Файл `.png` короче 24 байт или не PNG (например, пустой после упавшего рендера): `pngSize` → `undefined`, страница собирается без размеров — тесты в Task 1.
5. Главная страница сайта из `build-site.ts` осталась без размеров, потому что правили только `bun run index`: в Task 4 оба вызова и проверка `grep 'width=' dist/index.html` после `bun run build`.

---

### Task 1: `pngSize` и `pngSizes`

**Files:**
- Modify: `scripts/build-index.ts` (импорты и новые функции после `diagramNames`)
- Test: `scripts/build-index.test.ts`

**Interfaces:**
- Consumes: ничего.
- Produces: `export interface ImageSize { width: number; height: number }`; `export async function pngSize(path: string): Promise<ImageSize | undefined>`; `export async function pngSizes(names: readonly string[], dir = "dist"): Promise<Record<string, ImageSize>>`.

- [ ] **Step 1: Напиши падающие тесты**

В `scripts/build-index.test.ts` замени строку импорта и добавь в конец файла:

```ts
import { diagramNames, pngSize, pngSizes, renderIndex } from "./build-index.ts";
```

```ts
// Минимальный заголовок PNG: сигнатура, длина и тип чанка IHDR, ширина, высота.
function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

test("pngSize: width and height from the IHDR chunk", async () => {
  const dir = mkdtempSync(join(tmpdir(), "index-"));
  tempDirs.push(dir);
  await Bun.write(join(dir, "ci.png"), pngHeader(3744, 3064));
  expect(await pngSize(join(dir, "ci.png"))).toEqual({ width: 3744, height: 3064 });
});

test("pngSize: undefined for a missing file, a short file and a non-PNG", async () => {
  const dir = mkdtempSync(join(tmpdir(), "index-"));
  tempDirs.push(dir);
  await Bun.write(join(dir, "short.png"), pngHeader(1, 1).slice(0, 20));
  await Bun.write(join(dir, "text.png"), "not a png at all, just some text");
  await Bun.write(join(dir, "empty.png"), "");
  expect(await pngSize(join(dir, "missing.png"))).toBeUndefined();
  expect(await pngSize(join(dir, "short.png"))).toBeUndefined();
  expect(await pngSize(join(dir, "text.png"))).toBeUndefined();
  expect(await pngSize(join(dir, "empty.png"))).toBeUndefined();
});

test("pngSizes: sizes only for diagrams whose PNG exists, subfolder names keep the slash", async () => {
  const dir = mkdtempSync(join(tmpdir(), "index-"));
  tempDirs.push(dir);
  await Bun.write(join(dir, "ci.png"), pngHeader(10, 20));
  await Bun.write(join(dir, "bff", "cd.png"), pngHeader(30, 40));
  expect(await pngSizes(["ci", "bff/cd", "contract"], dir)).toEqual({
    ci: { width: 10, height: 20 },
    "bff/cd": { width: 30, height: 40 },
  });
});
```

- [ ] **Step 2: Убедись, что тесты падают**

Run: `bun test scripts/build-index.test.ts`
Expected: FAIL — `SyntaxError: Export named 'pngSize' not found` (или аналогичная ошибка импорта).

- [ ] **Step 3: Реализуй**

В `scripts/build-index.ts` после функции `diagramNames` добавь:

```ts
export interface ImageSize {
  width: number;
  height: number;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// Размер PNG из чанка IHDR: ширина — байты 16–19, высота — 20–23, big-endian.
// Нет файла, короче 24 байт или не PNG — undefined.
export async function pngSize(path: string): Promise<ImageSize | undefined> {
  const file = Bun.file(path);
  if (!(await file.exists())) return undefined;
  const head = await file.slice(0, 24).bytes();
  if (head.length < 24 || PNG_SIGNATURE.some((byte, i) => head[i] !== byte)) return undefined;
  const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

// Размеры PNG схем из dir (по умолчанию dist/), только для найденных файлов.
export async function pngSizes(names: readonly string[], dir = "dist"): Promise<Record<string, ImageSize>> {
  const sizes: Record<string, ImageSize> = {};
  for (const name of names) {
    const size = await pngSize(join(dir, `${name}.png`));
    if (size) sizes[name] = size;
  }
  return sizes;
}
```

- [ ] **Step 4: Убедись, что тесты проходят**

Run: `bun test scripts/build-index.test.ts && bun run typecheck`
Expected: все тесты файла PASS, typecheck без ошибок.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-index.ts scripts/build-index.test.ts
git commit -m "feat(index): pngSize и pngSizes читают размеры PNG из IHDR

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Карточка с `id`, «#»-ссылкой и размерами картинки

**Files:**
- Modify: `scripts/build-index.ts` (`card`, `tabbedBody`, `renderIndex`, CSS)
- Test: `scripts/build-index.test.ts`

**Interfaces:**
- Consumes: `ImageSize` из Task 1.
- Produces: `renderIndex(names: readonly string[], options: { previewsHref?: string; sizes?: Record<string, ImageSize> } = {}): string`; карточка `<section class="card" id="{name}">` с `<a class="anchor" href="#{name}" aria-label="Ссылка на {name}">#</a>` в `h2`.

- [ ] **Step 1: Напиши падающие тесты и поправь старые**

В `scripts/build-index.test.ts`:

в тесте `renderIndex: one card per diagram with html link, png link and preview` замени
`expect(html).toMatch(/<h2>deployment<\/h2>/);` на `expect(html).toMatch(/#<\/a>deployment<\/h2>/);`
и `expect(html).toMatch(/<h2>ci<\/h2>/);` на `expect(html).toMatch(/#<\/a>ci<\/h2>/);`;

в тесте `renderIndex: each tab panel holds only its own cards, all with h2 titles and folder paths in links` замени
`expect(rootPanel).toContain("<h2>ci</h2>");` на `expect(rootPanel).toContain("#</a>ci</h2>");`
и `expect(folderPanel).toContain("<h2>cd</h2>");` на `expect(folderPanel).toContain("#</a>cd</h2>");`.

Добавь в конец файла:

```ts
test("renderIndex: each card has its path as id and a # link to it", () => {
  const html = renderIndex(["contract", "frozen-k3s/ci"]);
  expect(html).toContain('<section class="card" id="contract">');
  expect(html).toContain('<h2><a class="anchor" href="#contract" aria-label="Ссылка на contract">#</a>contract</h2>');
  expect(html).toContain('<section class="card" id="frozen-k3s/ci">');
  expect(html).toContain('<h2><a class="anchor" href="#frozen-k3s/ci" aria-label="Ссылка на frozen-k3s/ci">#</a>ci</h2>');
});

test("renderIndex: img gets width and height only for diagrams with a known size", () => {
  const html = renderIndex(["ci", "frozen-k3s/cd"], { sizes: { ci: { width: 3744, height: 3064 } } });
  expect(html).toContain('<img src="ci.png" width="3744" height="3064" alt="ci">');
  expect(html).toContain('<img src="frozen-k3s/cd.png" alt="frozen-k3s/cd">');
  expect(renderIndex(["ci", "frozen-k3s/cd"])).not.toMatch(/width="/);
});

test("renderIndex: anchor styles, scroll margin and always-visible # without hover", () => {
  const html = renderIndex(["ci"]);
  expect(html).toContain("scroll-margin-top: 16px;");
  expect(html).toContain(".card:hover .anchor, .anchor:focus-visible { opacity: 1; }");
  expect(html).toContain("@media (hover: none) { .anchor { opacity: 1; } }");
});
```

- [ ] **Step 2: Убедись, что тесты падают**

Run: `bun test scripts/build-index.test.ts`
Expected: FAIL в тестах про `h2`, `id`, `width` и CSS — разметка пока старая.

- [ ] **Step 3: Реализуй**

В `scripts/build-index.ts` замени функцию `card`:

```ts
function card(name: string, size?: ImageSize): string {
  const title = name.slice(name.lastIndexOf("/") + 1);
  const dimensions = size ? ` width="${size.width}" height="${size.height}"` : "";
  return `    <section class="card" id="${name}">
      <h2><a class="anchor" href="#${name}" aria-label="Ссылка на ${name}">#</a>${title}</h2>
      <p><a href="${name}.html">HTML</a> · <a href="${name}.png">PNG</a></p>
      <a href="${name}.html"><img src="${name}.png"${dimensions} alt="${name}"></a>
    </section>`;
}
```

В `tabbedBody` добавь параметр `sizes` и передавай размер явно (не `map(card)` — `map` передал бы индекс вторым аргументом):

```ts
function tabbedBody(tabs: readonly IndexTab[], previewsLink: string, sizes: Record<string, ImageSize>): { css: string; body: string } {
```

```ts
  const panels = tabs.map((tab, i) => [`  <div class="panel" id="panel-${i}">`, ...tab.names.map((name) => card(name, sizes[name])), "  </div>"].join("\n"));
```

В `renderIndex` замени сигнатуру и выбор тела:

```ts
export function renderIndex(
  names: readonly string[],
  options: { previewsHref?: string; sizes?: Record<string, ImageSize> } = {},
): string {
  const tabs = indexTabs(names);
  const sizes = options.sizes ?? {};
  const previewsLink = options.previewsHref ? `<a href="${options.previewsHref}">Превью веток</a>` : "";
  const { css, body } =
    tabs.length > 1
      ? tabbedBody(tabs, previewsLink, sizes)
      : { css: "", body: [...names.map((name) => card(name, sizes[name])), ...(previewsLink ? [`  <p>${previewsLink}</p>`] : [])].join("\n") };
```

В базовом CSS внутри `renderIndex` замени строку `.card { … }` и добавь стили якоря после строки `.card h2 { … }`:

```css
    .card { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-bottom: 24px; scroll-margin-top: 16px; }
    .card h2 { margin: 0 0 8px; font-size: 20px; }
    .anchor { margin-right: 8px; color: #999; text-decoration: none; opacity: 0; }
    .card:hover .anchor, .anchor:focus-visible { opacity: 1; }
    @media (hover: none) { .anchor { opacity: 1; } }
```

- [ ] **Step 4: Убедись, что тесты проходят**

Run: `bun test scripts/build-index.test.ts && bun run typecheck`
Expected: все тесты файла PASS, typecheck без ошибок.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-index.ts scripts/build-index.test.ts
git commit -m "feat(index): якорь и id у карточки схемы, размеры картинки

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Скрипт, открывающий таб по якорю

**Files:**
- Modify: `scripts/build-index.ts` (шапка-комментарий, константа `ANCHOR_SCRIPT`, `tabbedBody`)
- Test: `scripts/build-index.test.ts`

**Interfaces:**
- Consumes: `tabbedBody(tabs, previewsLink, sizes)` из Task 2.
- Produces: страница с табами заканчивается `<script>` с функцией `openAnchor`; страница без табов — без `<script>`.

- [ ] **Step 1: Напиши падающие тесты и поправь старый**

В тесте `renderIndex: root diagrams and each subfolder become tabs, the root tab first and checked` замени
`expect(html).not.toMatch(/<script|<link/);` на `expect(html).not.toMatch(/<link/);`.

Добавь в конец файла:

```ts
test("renderIndex: the tabbed page opens the tab of the anchored card with an inline script after the tab bar", () => {
  const html = renderIndex(["ci", "frozen-k3s/cd"]);
  const script = html.slice(html.indexOf("<script>"), html.indexOf("</script>"));
  expect(html.indexOf("</nav>")).toBeLessThan(html.indexOf("<script>"));
  expect(script).toContain("decodeURIComponent(location.hash.slice(1))");
  expect(script).toContain("catch { return; }");
  expect(script).toContain('if (!card || !card.classList.contains("card")) return;');
  expect(script).toContain('card.closest(".panel")');
  expect(script).toContain('addEventListener("hashchange", openAnchor);');
  expect(script).toContain("card.scrollIntoView();");
});

test("renderIndex: the page without tabs has no script", () => {
  expect(renderIndex(["deployment", "ci"])).not.toMatch(/<script/);
});
```

- [ ] **Step 2: Убедись, что тесты падают**

Run: `bun test scripts/build-index.test.ts`
Expected: FAIL в тесте про скрипт — `<script>` на странице нет.

- [ ] **Step 3: Реализуй**

В `scripts/build-index.ts` замени строку шапки
`// активен. Табы без JavaScript: radio + label + :checked. Без подпапок табов`
на
`// активен. Табы без JavaScript: radio + label + :checked; JS только открывает таб по якорю. Без подпапок табов`
и после `const TAB_BAR_CSS = …;` добавь:

```ts
// Якорь #{name} в адресе: открыть таб карточки и прокрутить к ней. Битый якорь,
// неизвестный id или id не карточки (tab-0, panel-1) — ничего не делать.
const ANCHOR_SCRIPT = `  <script>
    function openAnchor() {
      let card;
      try { card = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { return; }
      if (!card || !card.classList.contains("card")) return;
      const panel = card.closest(".panel");
      if (panel) document.getElementById("tab-" + panel.id.slice("panel-".length)).checked = true;
      card.scrollIntoView();
    }
    addEventListener("hashchange", openAnchor);
    openAnchor();
  </script>`;
```

В `tabbedBody` замени возврат:

```ts
  return { css: TAB_BAR_CSS + perTabCss, body: [...radios, ...panels, ...nav, ANCHOR_SCRIPT].join("\n") };
```

- [ ] **Step 4: Убедись, что тесты проходят**

Run: `bun test scripts/build-index.test.ts && bun run typecheck`
Expected: все тесты файла PASS, typecheck без ошибок.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-index.ts scripts/build-index.test.ts
git commit -m "feat(index): скрипт открывает таб схемы по якорю

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Размеры в обоих вызовах, сборка, ручная проверка, PR

**Files:**
- Modify: `scripts/build-index.ts` (блок `if (import.meta.main)`)
- Modify: `scripts/build-site.ts:8` (импорт) и `scripts/build-site.ts:242`

**Interfaces:**
- Consumes: `pngSizes`, `renderIndex(names, { previewsHref, sizes })` из Task 1–2.
- Produces: `dist/index.html` с якорями, размерами картинок и скриптом; ветка на origin и PR.

- [ ] **Step 1: Передай размеры в `build-index.ts`**

Замени блок в конце `scripts/build-index.ts`:

```ts
if (import.meta.main) {
  const names = diagramNames();
  await Bun.write(join("dist", "index.html"), renderIndex(names, { sizes: await pngSizes(names) }));
  console.error(`dist/index.html: ${names.length} diagrams`);
}
```

- [ ] **Step 2: Передай размеры в `build-site.ts`**

Строка 8:

```ts
import { diagramNames, pngSizes, renderIndex } from "./build-index.ts";
```

Строка 242:

```ts
  const names = diagramNames();
  await Bun.write(join("dist", "index.html"), renderIndex(names, { previewsHref: "branches/", sizes: await pngSizes(names) }));
```

- [ ] **Step 3: Полная проверка, как в CI**

Сначала `docker info`; если движок не отвечает — запусти Docker Desktop по Global Constraints.

Run: `bun run typecheck && bun run test && bun run build`
Expected: всё зелёное; `bun run build` пишет `dist/index.html: 16 diagrams`.

- [ ] **Step 4: Разметка собранной страницы**

Run: `grep -c 'class="anchor"' dist/index.html; grep -o '<img src="bff/ci.png" width="[0-9]*" height="[0-9]*"' dist/index.html; grep -c '<script>' dist/index.html`
Expected: `16`; строка `<img src="bff/ci.png" width="…" height="…"`; `1`.

- [ ] **Step 5: Ручная проверка в браузере**

Открой `dist/index.html` через chrome-devtools MCP (`new_page` с `file:///F:/Github/2026_H2/docs/.claude/worktrees/index-anchors/dist/index.html`). Проверь по очереди, после каждого — `take_screenshot` и `list_console_messages`:
1. Наведи на карточку `contract` — слева от названия виден «#»; клик — в адресе `#contract`, карточка вверху окна.
2. Перейди на `…/index.html#bff/ci` и перезагрузи — открыт таб `bff`, карточка `ci` вверху окна.
3. `…/index.html#tab-1` и `…/index.html#%E0` — открыт таб `mvp`, прокрутки нет, в консоли нет ошибок.
4. На странице с `#bff/ci` кликни таб `mvp` — таб переключается.

При расхождении — исправь по superpowers:systematic-debugging, добавь тест, повтори шаги 3–5.

- [ ] **Step 6: Commit**

```bash
git add scripts/build-index.ts scripts/build-site.ts
git commit -m "feat(index): размеры картинок на странице сайта и превью

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Push и PR (только с согласия пользователя)**

Спроси пользователя, можно ли пушить. После согласия:

```bash
git push -u origin feature/index-anchors
gh pr create --base main --title "Якоря у схем на странице сайта" --body-file - <<'BODY'
## Что

- У заголовка каждой схемы на странице сайта «#»: клик кладёт `#{путь схемы}` в адрес (`#contract`, `#bff/ci`).
- Открытие такой ссылки или перезагрузка открывает нужный таб и прокручивает к схеме.
- У картинок `width`/`height` из заголовка PNG: раскладка не прыгает, пока догружаются картинки.

## Решения

Спека: `docs/superpowers/specs/2026-09-30-index-anchors-design.md`. Табы по-прежнему без JavaScript; небольшой inline-скрипт только открывает таб по якорю. Чистый CSS через `:has(:target)` отвергнут: `:target` залипает и мешает переключать табы.

## Проверка

- `bun run typecheck && bun run test && bun run build` зелёные.
- В браузере: якорь у схемы `mvp` и у схемы из `bff`, перезагрузка, битый и чужой якорь.
- Превью: https://cringe-driven-development-team.github.io/docs/branches/feature-index-anchors/

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
```

Expected: ссылка на PR.
