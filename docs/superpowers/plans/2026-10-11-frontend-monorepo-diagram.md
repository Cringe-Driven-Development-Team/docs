# Схема монорепы фронта и удаление `diagrams/bff/` — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** на странице трека BFF есть eraser-схема монорепы фронта, замороженной папки `diagrams/bff/` нет, её старые адреса переадресуют на актуальные схемы.

**Architecture:** новая схема — `diagrams/modules/2/frontend-monorepo.json` (папка уже в `HIDDEN_FOLDERS`), встраивается
`<Diagram>` в `site/modules/2/tracks/bff.md`. Удаление — файлы `diagrams/bff/*`, `bff` из `HIDDEN_FOLDERS`, пять
записей в `PAGE_REDIRECTS` (`scripts/build-index.ts`), правка текстов.

**Tech Stack:** eraser-diagrams JSON, bun test, VitePress.

**Spec:** `docs/superpowers/specs/2026-10-11-frontend-monorepo-diagram-design.md`

## Global Constraints

- Worktree `cdd-docs/.claude/worktrees/frontend-monorepo-diagram`, ветка `docs/frontend-monorepo-diagram` от `main` `035ba69`.
- Схемы — строго по скиллу `.claude/skills/eraser-diagrams/SKILL.md`: зоны и цвета, легенда из `bun run check`, цикл validate → check → warm → render → осмотр PNG.
- Публичный репозиторий: никаких реальных IP, внутренних адресов, `<uuid>.selstorage.ru` с настоящим uuid.
- Перед каждым коммитом: `bun run typecheck && bun run test`; в конце задачи 2 — ещё `bun run build` (без Docker — `DIAGRAMS_NATIVE=1`).
- Коммиты по-русски: `docs(diagrams): …`. Без `rm -rf`: файлы удалять `git rm`.
- Пять переадресаций — ровно эти:
  `bff/deployment.html` → `../deployment.html`, `bff/ci.html` → `../ci.html`, `bff/cd.html` → `../cd.html`,
  `bff/infra.html` → `../infra.html`, `bff/frontend-monorepo.html` → `../modules/2/frontend-monorepo.html`.

## Review Focus

1. Переадресация с якорем: `/docs/#bff/ci` (старый индекс) → `bff/ci.html` → `ci.html` — цепочка не рвётся. Тест в задаче 2.
2. Цель переадресации указывает на существующую схему: опечатка в имени дала бы 404 после двух прыжков. Тест в задаче 2.
3. Переадресации работают из превью веток (`/docs/branches/<slug>/bff/ci.html`): цели относительные. Тест в задаче 2.
4. VitePress не перезаписывает файлы-переадресации: они в `protectedFiles` через `PAGE_REDIRECTS`. Тест в задаче 2.
5. Схема монорепы не попадает в «Архитектуру» и в индекс схем. Тест в задаче 1.

---

### Задача 1: схема `modules/2/frontend-monorepo` на странице трека BFF

**Files:**
- Create: `diagrams/modules/2/frontend-monorepo.json`
- Create: `scripts/frontend-monorepo-diagram.test.ts`
- Modify: `site/modules/2/tracks/bff.md` (новый раздел после «Как устроен контракт», перед «Было и стало», `:45`)
- Modify: `scripts/bff-pages.test.ts` (тест раздела), `README.md` (раздел «Модуль №2» таблицы схем — строка `modules/2/frontend-monorepo`)

**Interfaces:**
- Produces: имя схемы `modules/2/frontend-monorepo` (файлы `dist/modules/2/frontend-monorepo.html` и `.png`) — цель переадресации в задаче 2.

- [ ] **Шаг 1: падающие тесты.** `scripts/frontend-monorepo-diagram.test.ts` по образцу `scripts/bff-contract-diagram.test.ts`:

```ts
test("frontend-monorepo: zones and workspaces", () => {
  expect(["github", "npm", "turbo"].map((id) => byId.get(id)?.color)).toEqual(["purple", "green", "white"]);
  const parents: Record<string, string> = {
    monorepo: "github",
    "ws-client": "monorepo",
    "ws-bff": "monorepo",
    "ws-schemas": "monorepo",
    "pkg-react": "npm",
    "pkg-zustand": "npm",
    "pkg-trpc-client": "npm",
    "t-build": "turbo",
    "t-lint": "turbo",
    "t-typecheck": "turbo",
    "t-test": "turbo",
  };
  for (const [id, parent] of Object.entries(parents)) expect(byId.get(id)?.containerId, id).toBe(parent);
  expect(byId.get("client")).toBeUndefined();
});

test("frontend-monorepo: imports between workspaces", () => {
  const label = (from: string, to: string) => doc.connections.find((c) => c.from === from && c.to === to)?.label;
  expect(label("ws-client", "ws-bff")).toContain("import type AppRouter");
  expect(label("ws-bff", "ws-schemas")).toBeDefined();
  expect(doc.connections.some((c) => c.from === "ws-client" && c.to === "npm")).toBe(true);
});

test("frontend-monorepo: texts name the real packages", () => {
  const text = JSON.stringify(doc);
  for (const s of ["apps/client", "apps/bff", "packages/schemas", "@cdd/schemas", "@cdd-team/react", "@cdd-team/zustand", "@cdd-team/trpc-client", "^build"]) expect(text, s).toContain(s);
  expect(text).not.toMatch(/apps\/web|TanStack|GHCR|@maninthecoat|@iredtea/);
});

test("frontend-monorepo: hidden from the Architecture index", () => {
  expect(indexNames(["ci", "modules/2/frontend-monorepo"])).toEqual(["ci"]);
});
```

В `scripts/bff-pages.test.ts`:

```ts
test("в треке есть схема монорепы фронта", () => {
  const part = section(readFileSync(TRACK, "utf8"), "Монорепа фронта");
  expect(part).toContain('<Diagram name="modules/2/frontend-monorepo" />');
  expect(part).toContain("#как-устроен-контракт");
  expect(part).toContain("frontend/issues/44");
});
```

Порядок разделов: `«Как устроен контракт»` идёт раньше `«Монорепа фронта»`, а она — раньше `«Было и стало»` (проверить по индексам заголовков).

- [ ] **Шаг 2:** `bun test scripts/frontend-monorepo-diagram.test.ts scripts/bff-pages.test.ts` — Expected: FAIL (нет файла схемы, нет раздела).
- [ ] **Шаг 3: схема.** Содержание — спека §3; id — из теста. Группы: `github` (purple) ⊃ `monorepo` (подпись — «Монорепа фронта» и репозиторий `frontend-park-mail-ru/2026_2_Cringe_Driven_Development`) ⊃ `ws-client`, `ws-bff`, `ws-schemas` (plain); `npm` (green) с узлами пакетов; `turbo` (white) с четырьмя `Activity`. Подписи групп workspace: `apps/client — React-приложение`, `apps/bff — Hono, роутер tRPC, клиент к Go (Orval)`, `packages/schemas — @cdd/schemas, zod-схемы`. Порядок `^build` (schemas → bff → client) — подписью группы `turbo` или `Textbox`. Цикл скилла до чистого PNG.
- [ ] **Шаг 4: страница.** Раздел `## Монорепа фронта` в `bff.md`: схема и 2–3 предложения — три workspace, клиент берёт у BFF только типы, Turborepo собирает зависимости первыми; генерация — ссылка `#как-устроен-контракт`; задача — ссылка на `https://github.com/Cringe-Driven-Development-Team/frontend/issues/44`. Строка в README.
- [ ] **Шаг 5:** тесты шага 2 — PASS; `bun run typecheck && bun run test` — зелёное.
- [ ] **Шаг 6:** коммит `docs(diagrams): схема монорепы фронта на странице трека BFF`.

### Задача 2: удалить `diagrams/bff/`, переадресовать старые адреса

**Files:**
- Delete: `diagrams/bff/{cd,ci,deployment,frontend-monorepo,infra}.json` (`git rm`)
- Modify: `site/.vitepress/diagram-names.ts:6`, `scripts/build-index.ts:71-75,128`, `site/architecture/index.md:13-16`
- Modify: `README.md:32-36,50-58,138`, `CLAUDE.md:25`, `.claude/skills/eraser-diagrams/SKILL.md:8-13`
- Test: `scripts/build-index.test.ts`, `scripts/diagram-sizes.test.ts`, `scripts/build-vitepress.test.ts`, `scripts/check-site.test.ts`, `scripts/architecture-page.test.ts`

**Interfaces:**
- Consumes: схема `modules/2/frontend-monorepo` из задачи 1.

- [ ] **Шаг 1: падающие тесты.** В `scripts/build-index.test.ts` тест `PAGE_REDIRECTS` ожидает восемь записей: три прежних и пять из Global Constraints, в этом порядке. Плюс:

```ts
test("PAGE_REDIRECTS: frozen bff diagrams lead to existing diagrams", () => {
  for (const { file, target } of PAGE_REDIRECTS.filter((r) => r.target.endsWith(".html"))) {
    expect(target.startsWith("/"), file).toBe(false);
    const name = target.replace(/^(\.\.\/)+/, "").replace(/\.html$/, "");
    expect(existsSync(`diagrams/${name}.json`), file).toBe(true);
  }
});

test("frozen bff folder is gone", () => {
  expect(HIDDEN_FOLDERS).not.toContain("bff");
  expect(existsSync("diagrams/bff")).toBe(false);
});
```

`scripts/architecture-page.test.ts`: страница не содержит `../bff/`, содержит `../frozen-k3s/deployment.html`.
Тесты, где `bff/…` — пример имени схемы скрытой папки (`build-index.test.ts:24,27-28,64-67,90`,
`diagram-sizes.test.ts:28,32`, `build-vitepress.test.ts:8-19`, `check-site.test.ts:27,32`), переходят на
`frozen-k3s/…`. Проверка цепочки якоря: `followRedirect(html, "#frozen-k3s/ci")` → `../frozen-k3s/ci.html`, а
`#bff/ci` по-прежнему ведёт в `../bff/ci.html` — оттуда переадресация `PAGE_REDIRECTS`.

- [ ] **Шаг 2:** `bun test scripts/build-index.test.ts scripts/architecture-page.test.ts` — Expected: FAIL (три записи вместо восьми, `bff` в `HIDDEN_FOLDERS`, ссылки на `../bff/`).
- [ ] **Шаг 3:** `git rm diagrams/bff/*.json`; `HIDDEN_FOLDERS = ["frozen-k3s", "modules/2"]`, комментарий без «замороженные варианты» во множественном — «замороженный вариант k3s и схемы планов модулей»; пять записей в `PAGE_REDIRECTS` с комментарием «схемы замороженного варианта „BFF: две VPS“ удалены (спека 2026-10-11-frontend-monorepo-diagram) — их адреса ведут на актуальные»; сообщение `:128` — «переадресация N старых адресов раздела bff/». Пункт «BFF на двух VPS» убрать со страницы «Архитектура».
- [ ] **Шаг 4: тексты.** README: «Архитектур три» → две (MVP и Frozen: k3s), абзац и таблица «BFF: две VPS» удаляются, пример якоря `#bff/ci` → `#frozen-k3s/ci`. CLAUDE.md и скилл: замороженная папка одна — `diagrams/frozen-k3s/`. Тексты про `diagrams/<папка>/` в описании скилла не трогать.
- [ ] **Шаг 5:** тесты шага 2 — PASS; `bun run typecheck && bun run test && DIAGRAMS_NATIVE=1 bun run build` — зелёное; в `dist/bff/` ровно восемь `.html`-переадресаций и нет `.png`.
- [ ] **Шаг 6:** коммит `docs(diagrams): удалить замороженную bff, старые адреса — на актуальные схемы`.

### Задача 3: PR и проверка на превью

- [ ] **Шаг 1:** push ветки, PR в `main` («Что / Решения / Проверка», ссылка на превью).
- [ ] **Шаг 2:** после сборки Pages (ветка может пропуститься по бюджету времени — тогда проверка на проде после мержа): страница трека BFF показывает схему, «HTML» открывает её; `…/bff/ci.html` уводит на `…/ci.html`, `…/bff/frontend-monorepo.html` — на новую схему; в меню «Архитектура» схемы монорепы нет.
- [ ] **Шаг 3:** после мержа — ссылка на схему в описании frontend#44 (раздел «Цель»).
