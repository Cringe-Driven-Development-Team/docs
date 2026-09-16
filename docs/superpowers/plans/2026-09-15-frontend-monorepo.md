# Frontend Monorepo Diagrams Implementation Plan

> **Frozen.** План выполнен 2026-09-15. Архитектура k3s заморожена спекой
> `docs/superpowers/specs/2026-09-16-mvp-compose-design.md`, её схемы лежат
> в `diagrams/frozen-k3s/`. Повторно не выполнять.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Схемы показывают монорепу клиента и BFF, её CI, CD с GitOps и модель релизов: новая схема `frontend-monorepo` и правки `ci`, `cd`, `deployment`, `integrations`.

**Architecture:** Каждая схема это отдельный `diagrams/<name>.json` в формате eraser-diagrams. Правки делаются точечными заменами строк (Edit), сдвиги координат большими блоками делает одноразовый скрипт вне репозитория. Проверка каждой схемы: `bun run validate` (схема и иконки), `bun run check` (цветовая конвенция и легенда), `bun run render` и осмотр PNG. Все JSON-фрагменты плана прогнаны на копиях схем 2026-09-15: validate ok, check ok, PNG осмотрены.

**Tech Stack:** bun (скрипты, `bun test`), `@eraserlabs/diagrams-cli@0.1.0`, рендер под Node ≥ 22.12 и Chrome.

**Spec:** `docs/superpowers/specs/2026-09-15-frontend-monorepo-design.md`, §8 (схемы) и §10 (приёмка). Правила правки схем: `.claude/skills/eraser-diagrams/SKILL.md`.

## Global Constraints

- Работа в ветке `feature/frontend-monorepo`, спека уже закоммичена в ней.
- Координаты абсолютные, кратны 20, даже у детей с `containerId`.
- Цвета: верхняя группа `blue` (наша инфраструктура), `purple` (GitHub), `green` (внешние сервисы); вложенная группа берёт цвет родителя и `"styleMode": "plain"`; у `Icon`, `Activity`, `Textbox` поля `color` нет.
- Стрелки по концам: `to` = `telegram` → `"color": "red", "lineStyle": "dotted"`; `from` = `client` → `"color": "orange", "lineStyle": "solid"`; ровно один конец `Activity` → `"color": "black", "lineStyle": "dashed"`; иначе без `color` и `lineStyle`.
- Узел браузера всегда `"id": "client"`, других узлов с этим id нет.
- В текстах и подписях нет `<` и `>`: санитайзер CLI их вырезает. Плейсхолдеры пишутся `{sha}`.
- Легенду каждой схемы задаёт `bun run check`; тексты и hex легенды берутся из его вывода, не придумываются.
- Одноразовые скрипты лежат вне репозитория и не коммитятся.
- Коммит-сообщения через Bash heredoc `git commit -F - <<'EOF'`; последняя строка — `Co-Authored-By:` строка модели, которая писала коммит.
- Ничего не пушить и не открывать PR без явного разрешения пользователя (Task 5).

---

## File Structure

| Файл | Что меняется |
| --- | --- |
| `diagrams/frontend-monorepo.json` | новая схема: монорепа, пайплайн Turborepo, наша инфраструктура, registry, правила выкатки |
| `README.md` | строка новой схемы в таблице |
| `diagrams/ci.json` | CI монорепы в два ряда шагов, новые стрелки в S3 и registry, сдвиг нижних групп на 100 |
| `diagrams/cd.json` | Monorepo CD и Monorepo Rollback вместо трёх групп, GitHub и Argo CD справа, превью монорепы, подъём E2E и VPS 7 на 200 |
| `diagrams/deployment.json` | Traefik вместо Caddy на VPS 1, VPS 1 и VPS 2 на k3s, Caddy VPS 2 удалён, стрелки превью |
| `diagrams/integrations.json` | Traefik (VPS 1) вместо Caddy (VPS 1) |

Вне репозитория (scratchpad сессии или системный temp): `shift-y.ts`, `set-height.ts` из Task 0.

---

### Task 0: Одноразовые скрипты координат

Не коммитятся. Нужны в Task 2 и Task 3.

**Files:**
- Create (вне репозитория): `<tmp>/shift-y.ts`
- Create (вне репозитория): `<tmp>/set-height.ts`

`<tmp>` это scratchpad-директория сессии или любой каталог вне `F:/Github/cringe-driven-development-team/docs`.

**Interfaces:**
- Produces: `bun <tmp>/shift-y.ts <path.json> <dy> <id> [id...]` сдвигает `y` у сущностей с перечисленными `id` на `dy`, печатает `shifted N entities by dy`, падает, если какого-то `id` нет. `bun <tmp>/set-height.ts <path.json> <id> <height>` меняет `height` одной сущности, печатает `<id>: height <height>`.

- [ ] **Step 1: Создать `<tmp>/shift-y.ts`**

```ts
// Одноразовый сдвиг по y для перечисленных id в схеме, формат строк сохраняется.
// Запуск: bun shift-y.ts <path.json> <dy> <id> [id...]
const [path, dyArg, ...ids] = process.argv.slice(2);
if (!path || !dyArg || ids.length === 0) throw new Error("usage: bun shift-y.ts <path.json> <dy> <id> [id...]");
const dy = Number(dyArg);
const wanted = new Set(ids);
const found = new Set<string>();
const text = await Bun.file(path).text();
const out = text
  .split("\n")
  .map((line) => {
    const id = line.match(/"id": "([^"]+)"/)?.[1];
    if (id === undefined || !wanted.has(id)) return line;
    found.add(id);
    return line.replace(/"y": (\d+)/, (_, y: string) => `"y": ${Number(y) + dy}`);
  })
  .join("\n");
const missing = [...wanted].filter((id) => !found.has(id));
if (missing.length > 0) throw new Error(`ids not found: ${missing.join(", ")}`);
await Bun.write(path, out);
console.log(`shifted ${found.size} entities by ${dy}`);
```

- [ ] **Step 2: Создать `<tmp>/set-height.ts`**

```ts
// Одноразовая замена height у одной сущности. Запуск: bun set-height.ts <path.json> <id> <height>
const [path, id, heightArg] = process.argv.slice(2);
if (!path || !id || !heightArg) throw new Error("usage: bun set-height.ts <path.json> <id> <height>");
const text = await Bun.file(path).text();
let hits = 0;
const out = text
  .split("\n")
  .map((line) => {
    if (line.match(/"id": "([^"]+)"/)?.[1] !== id) return line;
    hits += 1;
    return line.replace(/"height": \d+/, `"height": ${Number(heightArg)}`);
  })
  .join("\n");
if (hits !== 1) throw new Error(`expected one line with id ${id}, got ${hits}`);
await Bun.write(path, out);
console.log(`${id}: height ${heightArg}`);
```

- [ ] **Step 3: Проверить базу**

Run (из корня репозитория): `bun run check`
Expected: `colors ok: 4 diagrams`

---

### Task 1: Новая схема `frontend-monorepo` и строка в README

**Files:**
- Create: `diagrams/frontend-monorepo.json`
- Modify: `README.md` (таблица схем)

**Interfaces:**
- Produces: страница `dist/frontend-monorepo.html` и `dist/frontend-monorepo.png`; `bun run check` печатает `colors ok: 5 diagrams`.

- [ ] **Step 1: Создать `diagrams/frontend-monorepo.json` с пустой легендой**

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
    { "tag": "Icon", "id": "bff-bootstrap", "x": 1040, "y": 120, "containerId": "ws-bff", "icon": "file-code", "texts": [{ "text": "HTML bootstrap · SEO" }] },

    { "tag": "Group", "id": "turbo-pipeline", "color": "purple", "styleMode": "plain", "x": 40, "y": 280, "width": 800, "height": 220, "containerId": "monorepo", "isContainer": true, "title": { "text": "turbo run --affected" } },
    { "tag": "Activity", "id": "t-install", "x": 60, "y": 320, "width": 120, "height": 60, "containerId": "turbo-pipeline", "texts": [{ "text": "bun install" }] },
    { "tag": "Activity", "id": "t-check", "x": 220, "y": 320, "width": 120, "height": 60, "containerId": "turbo-pipeline", "texts": [{ "text": "lint · typecheck · test" }] },
    { "tag": "Activity", "id": "t-contract", "x": 380, "y": 320, "width": 120, "height": 60, "containerId": "turbo-pipeline", "texts": [{ "text": "Contract check" }] },
    { "tag": "Activity", "id": "t-vite-build", "x": 540, "y": 320, "width": 120, "height": 60, "containerId": "turbo-pipeline", "texts": [{ "text": "vite build" }] },
    { "tag": "Activity", "id": "t-bff-compile", "x": 540, "y": 420, "width": 140, "height": 60, "containerId": "turbo-pipeline", "texts": [{ "text": "bun build --compile" }] },
    { "tag": "Activity", "id": "t-image", "x": 700, "y": 420, "width": 120, "height": 60, "containerId": "turbo-pipeline", "texts": [{ "text": "Build image" }] },

    { "tag": "Group", "id": "registry", "color": "green", "x": 1260, "y": 280, "width": 280, "height": 160, "isContainer": true, "title": { "text": "Docker Registry", "icon": "docker" } },
    { "tag": "Icon", "id": "reg-bff", "x": 1280, "y": 320, "containerId": "registry", "icon": "docker", "texts": [{ "text": "bff:{sha}" }] },

    { "tag": "Icon", "id": "client", "x": 0, "y": 920, "icon": "chrome", "texts": [{ "text": "Client (браузер)" }] },

    { "tag": "Group", "id": "ours", "color": "blue", "x": 360, "y": 700, "width": 940, "height": 500, "isContainer": true, "title": { "text": "Наша инфраструктура (Selectel)", "icon": "cloud" } },
    { "tag": "Icon", "id": "cdn", "x": 400, "y": 740, "containerId": "ours", "icon": "cloud", "texts": [{ "text": "CDN static.site.ru" }] },
    { "tag": "Icon", "id": "s3", "x": 960, "y": 740, "containerId": "ours", "icon": "database", "texts": [{ "text": "S3: releases/{sha}/, current.json" }] },
    { "tag": "Group", "id": "vps1", "color": "blue", "styleMode": "plain", "x": 380, "y": 880, "width": 420, "height": 160, "containerId": "ours", "isContainer": true, "title": { "text": "VPS 1 · k3s", "icon": "kubernetes" } },
    { "tag": "Icon", "id": "gateway", "x": 400, "y": 920, "containerId": "vps1", "icon": "traefik", "texts": [{ "text": "Traefik · Gateway API" }] },
    { "tag": "Icon", "id": "bff", "x": 680, "y": 920, "containerId": "vps1", "icon": "hono", "texts": [{ "text": "BFF (Hono · bun)" }] },
    { "tag": "Group", "id": "vps2", "color": "blue", "styleMode": "plain", "x": 1080, "y": 880, "width": 200, "height": 160, "containerId": "ours", "isContainer": true, "title": { "text": "VPS 2 · k3s", "icon": "kubernetes" } },
    { "tag": "Icon", "id": "go-api", "x": 1100, "y": 920, "containerId": "vps2", "icon": "go", "texts": [{ "text": "Go API" }] },
    { "tag": "Icon", "id": "unleash", "x": 1100, "y": 1080, "containerId": "ours", "icon": "package", "texts": [{ "text": "Unleash" }] },

    { "tag": "Textbox", "id": "rules", "x": 1360, "y": 700, "width": 480, "text": "**Правила выкатки**\n\n1. BFF N+1 выкатывается первым, клиент N+1 после Healthy\n2. BFF N+1 обслуживает клиентов N и N+1\n3. Contract check: stable-клиент против новых AppRouter и BootstrapData\n4. Ответ BFF несёт x-release, при несовпадении клиент перезагружается\n5. Канарейка липкая по userId или sessionId\n6. В S3 последние 5 релизов, откат: сначала клиент, потом BFF" },

    { "tag": "Legend", "id": "legend", "x": 1900, "y": 0, "width": 340, "entries": [] }
  ],
  "connections": [
    { "tag": "Relationship", "from": "ws-client", "to": "ws-bff", "label": "import type AppRouter, BootstrapData" },

    { "tag": "Relationship", "from": "t-install", "to": "t-check" },
    { "tag": "Relationship", "from": "t-check", "to": "t-contract" },
    { "tag": "Relationship", "from": "t-contract", "to": "t-vite-build" },
    { "tag": "Relationship", "from": "t-contract", "to": "t-bff-compile" },
    { "tag": "Relationship", "from": "t-bff-compile", "to": "t-image" },

    { "tag": "Relationship", "from": "t-contract", "to": "s3", "label": "current.json: stable sha", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "t-vite-build", "to": "s3", "label": "releases/{sha}/", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "t-image", "to": "reg-bff", "color": "black", "lineStyle": "dashed" },

    { "tag": "Relationship", "from": "client", "to": "gateway", "label": "https://site.ru: HTML, /api/trpc", "color": "orange", "lineStyle": "solid" },
    { "tag": "Relationship", "from": "client", "to": "cdn", "label": "https://static.site.ru", "color": "orange", "lineStyle": "solid" },
    { "tag": "Relationship", "from": "s3", "to": "cdn", "label": "static" },
    { "tag": "Relationship", "from": "gateway", "to": "bff" },
    { "tag": "Relationship", "from": "bff", "to": "go-api", "label": "S2S: сессия, данные, sitemap" },
    { "tag": "Relationship", "from": "bff", "to": "s3", "label": "index.html, current.json" },
    { "tag": "Relationship", "from": "bff", "to": "unleash", "label": "SDK: флаги, канарейка" }
  ]
}
```

- [ ] **Step 2: Проверить схему и иконки**

Run: `bun run validate`
Expected: пять строк `ok`, среди них `diagrams/frontend-monorepo.json` (на Windows с `\`), exit 0.

- [ ] **Step 3: Убедиться, что проверка легенды падает**

Run: `bun run check`
Expected: exit 1 и ровно одна строка:
```
diagrams/frontend-monorepo.json legend: entries must be [{"text":"Наша инфраструктура","color":"#2866c4"},{"text":"GitHub","color":"#c43dcf"},{"text":"Внешние сервисы","color":"#30a050"},{"text":"Пользовательский трафик","color":"#c38424"},{"text":"Пайплайн и внешние системы, пунктир","color":"#3a3a3a"},{"text":"Прочие связи","color":"#1c1c1c"}]
```
Если строк больше, это ошибка в цветах групп или стрелок: исправить по тексту сообщения, не трогая легенду.

- [ ] **Step 4: Заполнить легенду**

Edit в `diagrams/frontend-monorepo.json`, заменить
```
"entries": [] }
```
на
```
"entries": [{ "text": "Наша инфраструктура", "color": "#2866c4" }, { "text": "GitHub", "color": "#c43dcf" }, { "text": "Внешние сервисы", "color": "#30a050" }, { "text": "Пользовательский трафик", "color": "#c38424" }, { "text": "Пайплайн и внешние системы, пунктир", "color": "#3a3a3a" }, { "text": "Прочие связи", "color": "#1c1c1c" }] }
```

- [ ] **Step 5: Проверка проходит**

Run: `bun run check`
Expected: `colors ok: 5 diagrams`

- [ ] **Step 6: Отрендерить и осмотреть**

Run: `bun run render`
Expected: десять строк `ok` (HTML и PNG пяти схем).

Открыть `dist/frontend-monorepo.png` через Read и проверить:
- наверху фиолетовая группа GitHub: внутри `apps/client` (React, TanStack Router · Query, zustand) и `apps/bff` (Hono, tRPC · AppRouter, HTML bootstrap · SEO), между ними стрелка с подписью `import type AppRouter, BootstrapData`;
- ниже в группе `turbo run --affected` шаги bun install → lint · typecheck · test → Contract check, затем две ветки: vite build и bun build --compile → Build image;
- пунктир Build image → зелёная группа Docker Registry справа;
- внизу синяя группа: сверху CDN и S3, под ними VPS 1 (Traefik, BFF) и VPS 2 (Go API), ниже Unleash; две пунктирные стрелки из пайплайна приходят в S3 с подписями `current.json: stable sha` и `releases/{sha}/` в промежутке между группами;
- слева Client с оранжевыми стрелками в Traefik и CDN;
- справа от синей группы блок «Правила выкатки» из шести пунктов, в правом верхнем углу легенда из шести строк;
- узлы не накладываются, подписи читаемы.

Допустимо: пунктир из пайплайна пересекает заголовок синей группы (роутер не обходит заголовки), подпись шага `bun build --compile` переносится после `--`.

Если что-то налезает, сдвинуть координаты на кратное 20 и повторить Step 2, Step 5, Step 6.

- [ ] **Step 7: Строка в README**

Edit в `README.md`, заменить
```
| [integrations](https://cringe-driven-development-team.github.io/docs/integrations.html) | Внешние сервисы и кто с ними говорит |
```
на
```
| [integrations](https://cringe-driven-development-team.github.io/docs/integrations.html) | Внешние сервисы и кто с ними говорит |
| [frontend-monorepo](https://cringe-driven-development-team.github.io/docs/frontend-monorepo.html) | Монорепа клиента и BFF, контракт tRPC, модель релизов |
```

- [ ] **Step 8: Коммит**

```bash
git add diagrams/frontend-monorepo.json README.md
git commit -q -F - <<'EOF'
Add frontend-monorepo diagram

Monorepo workspaces with the AppRouter type import, the Turborepo
pipeline with the contract check, artifacts in S3 and the registry,
the request path through Traefik and BFF, and the release rules.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: CI монорепы в `ci.json`

**Files:**
- Modify: `diagrams/ci.json` (группа `repo-frontend` и её шаги, связи `fe-*`, координаты нижних групп и правой колонки, высота `github`)

**Interfaces:**
- Consumes: `<tmp>/shift-y.ts`, `<tmp>/set-height.ts` из Task 0.
- Produces: шаги с id `fe-install`, `fe-check`, `fe-contract`, `fe-vite-build`, `fe-bundle-stats`, `fe-upload-release`, `fe-tg`, `fe-bff-compile`, `fe-build-image`, `fe-push-image`. Легенда `ci.json` не меняется.

- [ ] **Step 1: Сдвинуть всё ниже монорепы и правую колонку на 100**

Run:
```bash
bun <tmp>/shift-y.ts diagrams/ci.json 100 repo-backend be-ci be-build be-units be-lint be-build-image be-tg repo-static static-pipeline static-deploy-s3 static-tg repo-e2e e2e-tests repo-deployments dep-pulumi dep-caddy dep-compose dep-monitoring dep-ansible dep-vault docker-registry reg-bff reg-backend s3 telegram
bun <tmp>/set-height.ts diagrams/ci.json github 1640
```
Expected: `shifted 25 entities by 100` и `github: height 1640`.

- [ ] **Step 2: Заменить группу монорепы и её шаги**

Edit в `diagrams/ci.json`, заменить
```
    { "tag": "Group", "id": "repo-frontend", "color": "purple", "styleMode": "plain", "x": 20, "y": 580, "width": 1160, "height": 180, "containerId": "github", "isContainer": true, "title": { "text": "Frontend monorepo (client + BFF)", "icon": "react" } },
    { "tag": "Group", "id": "fe-ci", "color": "purple", "styleMode": "plain", "x": 40, "y": 620, "width": 1120, "height": 120, "containerId": "repo-frontend", "isContainer": true, "title": { "text": "CI" } },
    { "tag": "Activity", "id": "fe-affected", "x": 60, "y": 660, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "detect affected" }] },
    { "tag": "Activity", "id": "fe-install", "x": 220, "y": 660, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "Install deps" }] },
    { "tag": "Activity", "id": "fe-lint", "x": 380, "y": 660, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "Lint" }] },
    { "tag": "Activity", "id": "fe-units", "x": 540, "y": 660, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "Units" }] },
    { "tag": "Activity", "id": "fe-build", "x": 700, "y": 660, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "Build" }] },
    { "tag": "Activity", "id": "fe-bundle-stats", "x": 860, "y": 660, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "Send bundle stats" }] },
    { "tag": "Activity", "id": "fe-tg", "x": 1020, "y": 660, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "Send to tg" }] },
```
на
```
    { "tag": "Group", "id": "repo-frontend", "color": "purple", "styleMode": "plain", "x": 20, "y": 580, "width": 1160, "height": 280, "containerId": "github", "isContainer": true, "title": { "text": "Frontend monorepo · bun workspaces · Turborepo", "icon": "react" } },
    { "tag": "Group", "id": "fe-ci", "color": "purple", "styleMode": "plain", "x": 40, "y": 620, "width": 1120, "height": 220, "containerId": "repo-frontend", "isContainer": true, "title": { "text": "CI" } },
    { "tag": "Activity", "id": "fe-install", "x": 60, "y": 660, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "bun install" }] },
    { "tag": "Activity", "id": "fe-check", "x": 220, "y": 660, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "turbo: lint · typecheck · test" }] },
    { "tag": "Activity", "id": "fe-contract", "x": 380, "y": 660, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "Contract check" }] },
    { "tag": "Activity", "id": "fe-vite-build", "x": 540, "y": 660, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "vite build" }] },
    { "tag": "Activity", "id": "fe-bundle-stats", "x": 700, "y": 660, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "Send bundle stats" }] },
    { "tag": "Activity", "id": "fe-upload-release", "x": 860, "y": 660, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "Upload release (main)" }] },
    { "tag": "Activity", "id": "fe-tg", "x": 1020, "y": 660, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "Send to tg" }] },
    { "tag": "Activity", "id": "fe-bff-compile", "x": 540, "y": 760, "width": 140, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "bun build --compile" }] },
    { "tag": "Activity", "id": "fe-build-image", "x": 700, "y": 760, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "Build image" }] },
    { "tag": "Activity", "id": "fe-push-image", "x": 860, "y": 760, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "Push image (main)" }] },
```

- [ ] **Step 3: Заменить цепочку шагов**

Edit в `diagrams/ci.json`, заменить
```
    { "tag": "Relationship", "from": "fe-affected", "to": "fe-install" },
    { "tag": "Relationship", "from": "fe-install", "to": "fe-lint" },
    { "tag": "Relationship", "from": "fe-lint", "to": "fe-units" },
    { "tag": "Relationship", "from": "fe-units", "to": "fe-build" },
    { "tag": "Relationship", "from": "fe-build", "to": "fe-bundle-stats" },
    { "tag": "Relationship", "from": "fe-bundle-stats", "to": "fe-tg" },
```
на
```
    { "tag": "Relationship", "from": "fe-install", "to": "fe-check" },
    { "tag": "Relationship", "from": "fe-check", "to": "fe-contract" },
    { "tag": "Relationship", "from": "fe-contract", "to": "fe-vite-build" },
    { "tag": "Relationship", "from": "fe-vite-build", "to": "fe-bundle-stats" },
    { "tag": "Relationship", "from": "fe-bundle-stats", "to": "fe-upload-release" },
    { "tag": "Relationship", "from": "fe-upload-release", "to": "fe-tg" },
    { "tag": "Relationship", "from": "fe-contract", "to": "fe-bff-compile" },
    { "tag": "Relationship", "from": "fe-bff-compile", "to": "fe-build-image" },
    { "tag": "Relationship", "from": "fe-build-image", "to": "fe-push-image" },
    { "tag": "Relationship", "from": "fe-push-image", "to": "fe-tg" },
```

- [ ] **Step 4: Добавить стрелки в S3 и registry**

Edit в `diagrams/ci.json`, заменить
```
    { "tag": "Relationship", "from": "fe-bundle-stats", "to": "relative-ci", "color": "black", "lineStyle": "dashed" },
```
на
```
    { "tag": "Relationship", "from": "fe-bundle-stats", "to": "relative-ci", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "fe-contract", "to": "s3", "label": "current.json", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "fe-upload-release", "to": "s3", "label": "releases/{sha}/", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "fe-push-image", "to": "reg-bff", "color": "black", "lineStyle": "dashed" },
```

- [ ] **Step 5: Старых шагов не осталось**

Run: `grep -cE '"(fe-affected|fe-lint|fe-units|fe-build)"' diagrams/ci.json`
Expected: `0`

- [ ] **Step 6: Проверки**

Run: `bun run validate && bun run check`
Expected: пять `ok`, затем `colors ok: 5 diagrams`. Легенда `ci.json` прежняя; если `check` требует другие `entries`, ошибка в цветах новых стрелок, исправить стрелки.

- [ ] **Step 7: Отрендерить и осмотреть**

Run: `bun run render`

Открыть `dist/ci.png` через Read и проверить:
- группа «Frontend monorepo · bun workspaces · Turborepo» с двумя рядами шагов: верхний bun install → turbo: lint · typecheck · test → Contract check → vite build → Send bundle stats → Upload release (main) → Send to tg; нижний bun build --compile → Build image → Push image (main), из Contract check и в Send to tg;
- группа Backend repo и всё ниже не накладываются на монорепу, Deployments repo внутри рамки GitHub;
- пунктиры: Send bundle stats → Relative CI, Push image → `bff image` в Docker Registry, Contract check и Upload release → S3 с подписями `current.json` и `releases/{sha}/`;
- легенда прежняя.

При наложениях сдвинуть на кратное 20 и повторить Step 6 и Step 7.

- [ ] **Step 8: Коммит**

```bash
git add diagrams/ci.json
git commit -q -F - <<'EOF'
ci diagram: monorepo CI with contract check and build-once artifacts

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: Monorepo CD и откат в `cd.json`

**Files:**
- Modify: `diagrams/cd.json` (группы CD в `vps5`, связи CD, правая колонка, легенда, превью в `vps7`, координаты E2E и `vps7`, высота `vps5`)

**Interfaces:**
- Consumes: `<tmp>/shift-y.ts`, `<tmp>/set-height.ts` из Task 0.
- Produces: группы `monorepo-cd`, `monorepo-rollback`, `github` (узел `deployments-repo`), узел `argocd`. Легенда: зона GitHub добавлена.

- [ ] **Step 1: Заменить группы BFF CD, Frontend CD и Frontend Rollback**

Edit в `diagrams/cd.json`, заменить
```
    { "tag": "Group", "id": "bff-cd", "color": "blue", "styleMode": "plain", "x": 20, "y": 180, "width": 860, "height": 180, "containerId": "vps5", "isContainer": true, "title": { "text": "BFF CD" } },
    { "tag": "Activity", "id": "bff-ansible", "x": 40, "y": 240, "width": 120, "height": 60, "containerId": "bff-cd", "texts": [{ "text": "Run ansible playbook" }] },
    { "tag": "Group", "id": "ansible-playbook", "color": "blue", "styleMode": "plain", "x": 200, "y": 220, "width": 320, "height": 120, "containerId": "bff-cd", "isContainer": true, "title": { "text": "Ansible playbook" } },
    { "tag": "Activity", "id": "bff-pull", "x": 220, "y": 260, "width": 120, "height": 60, "containerId": "ansible-playbook", "texts": [{ "text": "Pull image" }] },
    { "tag": "Activity", "id": "bff-compose", "x": 380, "y": 260, "width": 120, "height": 60, "containerId": "ansible-playbook", "texts": [{ "text": "Compose up" }] },
    { "tag": "Activity", "id": "bff-health", "x": 560, "y": 240, "width": 120, "height": 60, "containerId": "bff-cd", "texts": [{ "text": "Health check" }] },
    { "tag": "Activity", "id": "bff-tg", "x": 720, "y": 240, "width": 120, "height": 60, "containerId": "bff-cd", "texts": [{ "text": "Send to tg" }] },

    { "tag": "Group", "id": "frontend-cd", "color": "blue", "styleMode": "plain", "x": 20, "y": 380, "width": 1440, "height": 120, "containerId": "vps5", "isContainer": true, "title": { "text": "Frontend CD (канареечный релиз)" } },
    { "tag": "Activity", "id": "fe-build", "x": 40, "y": 420, "width": 120, "height": 60, "containerId": "frontend-cd", "texts": [{ "text": "Build" }] },
    { "tag": "Activity", "id": "fe-stats", "x": 200, "y": 420, "width": 120, "height": 60, "containerId": "frontend-cd", "texts": [{ "text": "Send bundle stats" }] },
    { "tag": "Activity", "id": "fe-deploy-s3", "x": 360, "y": 420, "width": 120, "height": 60, "containerId": "frontend-cd", "texts": [{ "text": "Deploy to s3" }] },
    { "tag": "Activity", "id": "fe-canary", "x": 520, "y": 420, "width": 120, "height": 60, "containerId": "frontend-cd", "texts": [{ "text": "Register as canary" }] },
    { "tag": "Activity", "id": "fe-health-canary", "x": 680, "y": 420, "width": 120, "height": 60, "containerId": "frontend-cd", "texts": [{ "text": "Health check (canary)" }] },
    { "tag": "Activity", "id": "fe-observe", "x": 840, "y": 420, "width": 140, "height": 60, "containerId": "frontend-cd", "texts": [{ "text": "Наблюдение" }] },
    { "tag": "Activity", "id": "fe-promote", "x": 1000, "y": 420, "width": 120, "height": 60, "containerId": "frontend-cd", "texts": [{ "text": "Promote to stable" }] },
    { "tag": "Activity", "id": "fe-health", "x": 1160, "y": 420, "width": 120, "height": 60, "containerId": "frontend-cd", "texts": [{ "text": "Health check" }] },
    { "tag": "Activity", "id": "fe-tg", "x": 1320, "y": 420, "width": 120, "height": 60, "containerId": "frontend-cd", "texts": [{ "text": "Send to tg" }] },

    { "tag": "Group", "id": "frontend-rollback", "color": "blue", "styleMode": "plain", "x": 20, "y": 520, "width": 480, "height": 120, "containerId": "vps5", "isContainer": true, "title": { "text": "Frontend Rollback" } },
    { "tag": "Activity", "id": "rb-switch", "x": 40, "y": 560, "width": 120, "height": 60, "containerId": "frontend-rollback", "texts": [{ "text": "Switch release pointer" }] },
    { "tag": "Activity", "id": "rb-health", "x": 200, "y": 560, "width": 120, "height": 60, "containerId": "frontend-rollback", "texts": [{ "text": "Health check" }] },
    { "tag": "Activity", "id": "rb-tg", "x": 360, "y": 560, "width": 120, "height": 60, "containerId": "frontend-rollback", "texts": [{ "text": "Send to tg" }] },
```
на
```
    { "tag": "Group", "id": "monorepo-cd", "color": "blue", "styleMode": "plain", "x": 20, "y": 180, "width": 1440, "height": 120, "containerId": "vps5", "isContainer": true, "title": { "text": "Monorepo CD" } },
    { "tag": "Activity", "id": "md-bump", "x": 40, "y": 220, "width": 120, "height": 60, "containerId": "monorepo-cd", "texts": [{ "text": "Commit bff:{sha}" }] },
    { "tag": "Activity", "id": "md-argo-wait", "x": 200, "y": 220, "width": 120, "height": 60, "containerId": "monorepo-cd", "texts": [{ "text": "Wait Argo CD: Healthy" }] },
    { "tag": "Activity", "id": "md-canary", "x": 360, "y": 220, "width": 120, "height": 60, "containerId": "monorepo-cd", "texts": [{ "text": "Register as canary" }] },
    { "tag": "Activity", "id": "md-health-canary", "x": 520, "y": 220, "width": 120, "height": 60, "containerId": "monorepo-cd", "texts": [{ "text": "Health check (canary)" }] },
    { "tag": "Activity", "id": "md-observe", "x": 680, "y": 220, "width": 140, "height": 60, "containerId": "monorepo-cd", "texts": [{ "text": "Наблюдение" }] },
    { "tag": "Activity", "id": "md-promote", "x": 840, "y": 220, "width": 120, "height": 60, "containerId": "monorepo-cd", "texts": [{ "text": "Promote to stable" }] },
    { "tag": "Activity", "id": "md-health", "x": 1000, "y": 220, "width": 120, "height": 60, "containerId": "monorepo-cd", "texts": [{ "text": "Health check" }] },
    { "tag": "Activity", "id": "md-retention", "x": 1160, "y": 220, "width": 120, "height": 60, "containerId": "monorepo-cd", "texts": [{ "text": "Retention: 5 релизов" }] },
    { "tag": "Activity", "id": "md-tg", "x": 1320, "y": 220, "width": 120, "height": 60, "containerId": "monorepo-cd", "texts": [{ "text": "Send to tg" }] },

    { "tag": "Group", "id": "monorepo-rollback", "color": "blue", "styleMode": "plain", "x": 20, "y": 320, "width": 800, "height": 120, "containerId": "vps5", "isContainer": true, "title": { "text": "Monorepo Rollback" } },
    { "tag": "Activity", "id": "mr-switch", "x": 40, "y": 360, "width": 120, "height": 60, "containerId": "monorepo-rollback", "texts": [{ "text": "Switch release pointer" }] },
    { "tag": "Activity", "id": "mr-health", "x": 200, "y": 360, "width": 120, "height": 60, "containerId": "monorepo-rollback", "texts": [{ "text": "Health check" }] },
    { "tag": "Activity", "id": "mr-revert", "x": 360, "y": 360, "width": 120, "height": 60, "containerId": "monorepo-rollback", "texts": [{ "text": "Revert bff tag" }] },
    { "tag": "Activity", "id": "mr-argo-wait", "x": 520, "y": 360, "width": 120, "height": 60, "containerId": "monorepo-rollback", "texts": [{ "text": "Wait Argo CD: Healthy" }] },
    { "tag": "Activity", "id": "mr-tg", "x": 680, "y": 360, "width": 120, "height": 60, "containerId": "monorepo-rollback", "texts": [{ "text": "Send to tg" }] },
```

- [ ] **Step 2: Переименовать превью**

Три Edit в `diagrams/cd.json`:
- `"title": { "text": "PR фронта открыт" }` → `"title": { "text": "PR монорепы открыт" }`
- `"id": "pr-build", "x": 200, "y": 940, "width": 120, "height": 60, "containerId": "pr-open", "texts": [{ "text": "Build image" }]` → то же с `"texts": [{ "text": "Build image (BFF + client)" }]`
- `"title": { "text": "PR фронта закрыт" }` → `"title": { "text": "PR монорепы закрыт" }`

- [ ] **Step 3: Правая колонка: убрать Relative CI, добавить GitHub и Argo CD**

Edit в `diagrams/cd.json`, заменить
```
    { "tag": "Icon", "id": "relative-ci", "x": 1600, "y": 300, "icon": "monitor", "texts": [{ "text": "Relative CI" }] },
```
на
```
    { "tag": "Group", "id": "github", "color": "purple", "x": 1580, "y": 200, "width": 240, "height": 160, "isContainer": true, "title": { "text": "GitHub", "icon": "github" } },
    { "tag": "Icon", "id": "deployments-repo", "x": 1600, "y": 240, "containerId": "github", "icon": "github", "texts": [{ "text": "Deployments repo" }] },
    { "tag": "Icon", "id": "argocd", "x": 1880, "y": 240, "icon": "argo", "texts": [{ "text": "Argo CD (прод-кластер)" }] },
```

- [ ] **Step 4: Заменить цепочки шагов**

Edit в `diagrams/cd.json`, заменить
```
    { "tag": "Relationship", "from": "bff-ansible", "to": "bff-pull" },
    { "tag": "Relationship", "from": "bff-pull", "to": "bff-compose" },
    { "tag": "Relationship", "from": "bff-compose", "to": "bff-health" },
    { "tag": "Relationship", "from": "bff-health", "to": "bff-tg" },

    { "tag": "Relationship", "from": "fe-build", "to": "fe-stats" },
    { "tag": "Relationship", "from": "fe-stats", "to": "fe-deploy-s3" },
    { "tag": "Relationship", "from": "fe-deploy-s3", "to": "fe-canary" },
    { "tag": "Relationship", "from": "fe-canary", "to": "fe-health-canary" },
    { "tag": "Relationship", "from": "fe-health-canary", "to": "fe-observe" },
    { "tag": "Relationship", "from": "fe-observe", "to": "fe-promote" },
    { "tag": "Relationship", "from": "fe-promote", "to": "fe-health" },
    { "tag": "Relationship", "from": "fe-health", "to": "fe-tg" },

    { "tag": "Relationship", "from": "rb-switch", "to": "rb-health" },
    { "tag": "Relationship", "from": "rb-health", "to": "rb-tg" },
```
на
```
    { "tag": "Relationship", "from": "md-bump", "to": "md-argo-wait" },
    { "tag": "Relationship", "from": "md-argo-wait", "to": "md-canary" },
    { "tag": "Relationship", "from": "md-canary", "to": "md-health-canary" },
    { "tag": "Relationship", "from": "md-health-canary", "to": "md-observe" },
    { "tag": "Relationship", "from": "md-observe", "to": "md-promote" },
    { "tag": "Relationship", "from": "md-promote", "to": "md-health" },
    { "tag": "Relationship", "from": "md-health", "to": "md-retention" },
    { "tag": "Relationship", "from": "md-retention", "to": "md-tg" },

    { "tag": "Relationship", "from": "mr-switch", "to": "mr-health" },
    { "tag": "Relationship", "from": "mr-health", "to": "mr-revert" },
    { "tag": "Relationship", "from": "mr-revert", "to": "mr-argo-wait" },
    { "tag": "Relationship", "from": "mr-argo-wait", "to": "mr-tg" },
```

- [ ] **Step 5: Заменить стрелки во внешние узлы**

Edit в `diagrams/cd.json`, заменить
```
    { "tag": "Relationship", "from": "bff-pull", "to": "docker-registry", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "fe-stats", "to": "relative-ci", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "fe-deploy-s3", "to": "s3", "label": "releases/{id}/", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "fe-promote", "to": "s3", "label": "current.json", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "rb-switch", "to": "s3", "label": "current.json", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "fe-canary", "to": "unleash", "color": "black", "lineStyle": "dashed" },
```
на
```
    { "tag": "Relationship", "from": "md-bump", "to": "deployments-repo", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "md-argo-wait", "to": "argocd", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "argocd", "to": "deployments-repo", "label": "sync" },
    { "tag": "Relationship", "from": "md-canary", "to": "unleash", "label": "variant: {sha}", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "md-promote", "to": "s3", "label": "current.json", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "md-retention", "to": "s3", "label": "releases/", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "mr-switch", "to": "s3", "label": "current.json", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "mr-revert", "to": "deployments-repo", "label": "git revert", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "mr-argo-wait", "to": "argocd", "color": "black", "lineStyle": "dashed" },
```

- [ ] **Step 6: Поднять E2E и VPS 7 на 200**

Run:
```bash
bun <tmp>/shift-y.ts diagrams/cd.json -200 e2e e2e-run e2e-upload e2e-tg moon reportportal vps7 pr-open pr-clone pr-build pr-deploy pr-domain pr-closed pr-destroy pr-release
bun <tmp>/set-height.ts diagrams/cd.json vps5 600
```
Expected: `shifted 15 entities by -200` и `vps5: height 600`.

- [ ] **Step 7: Старых узлов не осталось, проверка схемы**

Run: `grep -cE '"(bff-cd|ansible-playbook|frontend-cd|frontend-rollback|relative-ci|fe-[a-z-]+|rb-[a-z-]+|bff-[a-z]+)"' diagrams/cd.json`
Expected: `0`

Run: `bun run validate`
Expected: пять `ok`.

- [ ] **Step 8: Убедиться, что проверка легенды падает**

Run: `bun run check`
Expected: exit 1 и ровно одна строка:
```
diagrams/cd.json legend: entries must be [{"text":"Наша инфраструктура","color":"#2866c4"},{"text":"GitHub","color":"#c43dcf"},{"text":"Пайплайн и внешние системы, пунктир","color":"#3a3a3a"},{"text":"Алерты и уведомления, точки","color":"#bd413a"},{"text":"Прочие связи","color":"#1c1c1c"}]
```

- [ ] **Step 9: Обновить легенду и сдвинуть её вправо**

Edit в `diagrams/cd.json`, заменить
```
{ "tag": "Legend", "id": "legend", "x": 1760, "y": 0, "width": 340, "entries": [{ "text": "Наша инфраструктура", "color": "#2866c4" }, { "text": "Пайплайн и внешние системы, пунктир", "color": "#3a3a3a" }
```
на
```
{ "tag": "Legend", "id": "legend", "x": 2040, "y": 0, "width": 340, "entries": [{ "text": "Наша инфраструктура", "color": "#2866c4" }, { "text": "GitHub", "color": "#c43dcf" }, { "text": "Пайплайн и внешние системы, пунктир", "color": "#3a3a3a" }
```

Run: `bun run check`
Expected: `colors ok: 5 diagrams`

- [ ] **Step 10: Отрендерить и осмотреть**

Run: `bun run render`

Открыть `dist/cd.png` через Read и проверить:
- в VPS 5 сверху вниз: Backend CD, Monorepo CD (девять шагов в ряд, текст внутри рамок шагов), Monorepo Rollback (пять шагов), E2E с moon и ReportPortal; группы не накладываются, пустой полосы между Rollback и E2E нет;
- VPS 7 ниже VPS 5, группы «PR монорепы открыт» и «PR монорепы закрыт», шаг «Build image (BFF + client)»;
- справа сверху вниз: Docker Registry, фиолетовая группа GitHub с Deployments repo и правее Argo CD (прод-кластер) со стрелкой `sync`, S3, unleash, Allure TestOps, Telegram;
- подписи `variant: {sha}`, `current.json`, `releases/`, `git revert` читаемы;
- легенда в правом верхнем углу из пяти строк, ничего не перекрывает.

Допустимо: пунктиры пересекают заголовки групп. При наложениях узлов сдвинуть на кратное 20 и повторить Step 7, Step 9 (только `check`), Step 10.

- [ ] **Step 11: Коммит**

```bash
git add diagrams/cd.json
git commit -q -F - <<'EOF'
cd diagram: monorepo CD and rollback via Argo CD, monorepo previews

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 4: Traefik и k3s в `deployment.json` и `integrations.json`

**Files:**
- Modify: `diagrams/deployment.json` (VPS 1, VPS 2, связи)
- Modify: `diagrams/integrations.json` (узел входа VPS 1 и его связи)

**Interfaces:**
- Produces: узлы `vps1-gateway` в `deployment.json` и `gateway-vps1` в `integrations.json`. Легенды обеих схем не меняются.

- [ ] **Step 1: VPS 1 на k3s и Traefik вместо Caddy**

Три Edit в `diagrams/deployment.json`:
- `"title": { "text": "VPS 1 · Docker Compose", "icon": "docker" }` → `"title": { "text": "VPS 1 · k3s", "icon": "kubernetes" }`
- `{ "tag": "Icon", "id": "vps1-caddy", "x": 340, "y": 80, "containerId": "vps1", "icon": "server", "texts": [{ "text": "Caddy" }] }` → `{ "tag": "Icon", "id": "vps1-gateway", "x": 340, "y": 80, "containerId": "vps1", "icon": "traefik", "texts": [{ "text": "Traefik · Gateway API" }] }`
- `"texts": [{ "text": "BFF (Hono)" }]` → `"texts": [{ "text": "BFF (Hono · bun)" }]`

- [ ] **Step 2: VPS 2 на k3s без Caddy**

Edit в `diagrams/deployment.json`, заменить
```
    { "tag": "Group", "id": "vps2", "color": "blue", "styleMode": "plain", "x": 780, "y": 40, "width": 560, "height": 160, "containerId": "selectel", "isContainer": true, "title": { "text": "VPS 2 · Docker Compose", "icon": "docker" } },
    { "tag": "Icon", "id": "vps2-caddy", "x": 800, "y": 80, "containerId": "vps2", "icon": "server", "texts": [{ "text": "Caddy" }] },
```
на
```
    { "tag": "Group", "id": "vps2", "color": "blue", "styleMode": "plain", "x": 780, "y": 40, "width": 560, "height": 160, "containerId": "selectel", "isContainer": true, "title": { "text": "VPS 2 · k3s", "icon": "kubernetes" } },
```

Координаты Go API, Postgres и Node Exporter на VPS 2 не менять: освободившееся место слева нужно под подпись стрелки BFF → Go API.

- [ ] **Step 3: Связи**

Edit в `diagrams/deployment.json`, заменить
```
    { "tag": "Relationship", "from": "client", "to": "vps1-caddy", "label": "https://site.ru, /api", "color": "orange", "lineStyle": "solid" },
```
на
```
    { "tag": "Relationship", "from": "client", "to": "vps1-gateway", "label": "https://site.ru: HTML, /api/trpc", "color": "orange", "lineStyle": "solid" },
```

Edit в `diagrams/deployment.json`, заменить
```
    { "tag": "Relationship", "from": "vps1-caddy", "to": "vps1-bff" },
    { "tag": "Relationship", "from": "vps1-caddy", "to": "cdn", "label": "proxy pass static" },
    { "tag": "Relationship", "from": "vps1-bff", "to": "vps2-go", "label": "S2S, private network" },
    { "tag": "Relationship", "from": "vps1-bff", "to": "s3", "label": "index.html релиза" },
    { "tag": "Relationship", "from": "vps1-bff", "to": "vps8-unleash" },
```
на
```
    { "tag": "Relationship", "from": "vps1-gateway", "to": "vps1-bff" },
    { "tag": "Relationship", "from": "vps1-bff", "to": "vps2-go", "label": "S2S: сессия, данные, sitemap" },
    { "tag": "Relationship", "from": "vps1-bff", "to": "s3", "label": "index.html релиза" },
    { "tag": "Relationship", "from": "vps1-bff", "to": "vps8-unleash" },
    { "tag": "Relationship", "from": "vps7-coolify", "to": "vps2-go", "label": "превью" },
    { "tag": "Relationship", "from": "vps7-coolify", "to": "vps8-unleash", "label": "превью: env preview" },
```

Edit в `diagrams/deployment.json`, удалить строку (вместе с переводом строки)
```
    { "tag": "Relationship", "from": "vps2-caddy", "to": "vps2-go" },
```

Подписи BFF → S3 и BFF → Unleash остаются прежними по спеке §8.4.

- [ ] **Step 4: `integrations.json`**

Три Edit в `diagrams/integrations.json`:
- `{ "tag": "Icon", "id": "caddy-vps1", "x": 40, "y": 60, "containerId": "ours", "icon": "server", "texts": [{ "text": "Caddy (VPS 1)" }] }` → `{ "tag": "Icon", "id": "gateway-vps1", "x": 40, "y": 60, "containerId": "ours", "icon": "traefik", "texts": [{ "text": "Traefik (VPS 1)" }] }`
- `{ "tag": "Relationship", "from": "client", "to": "caddy-vps1", "label": "https://site.ru, /api", "color": "orange", "lineStyle": "solid" }` → `{ "tag": "Relationship", "from": "client", "to": "gateway-vps1", "label": "https://site.ru: HTML, /api/trpc", "color": "orange", "lineStyle": "solid" }`
- `{ "tag": "Relationship", "from": "yoomoney-api", "to": "caddy-vps1", "label": "/payment-callback" }` → `{ "tag": "Relationship", "from": "yoomoney-api", "to": "gateway-vps1", "label": "/payment-callback" }`

- [ ] **Step 5: Старых узлов не осталось, проверки**

Run: `grep -cE '"(vps1-caddy|vps2-caddy)"' diagrams/deployment.json; grep -c '"caddy-vps1"' diagrams/integrations.json`
Expected: `0` и `0`

Run: `bun run validate && bun run check`
Expected: пять `ok`, затем `colors ok: 5 diagrams`. Легенды обеих схем прежние.

- [ ] **Step 6: Отрендерить и осмотреть**

Run: `bun run render`

Открыть `dist/deployment.png` через Read и проверить:
- VPS 1 · k3s: Traefik · Gateway API, BFF (Hono · bun), Node Exporter; VPS 2 · k3s: Go API, Postgres, Node Exporter, слева свободное место;
- оранжевая стрелка Client → Traefik с подписью `https://site.ru: HTML, /api/trpc`; стрелки «proxy pass static» нет;
- подпись `S2S: сессия, данные, sitemap` у стрелки BFF → Go API;
- из Coolify на VPS 7 стрелки в Go API (`превью`) и в unleash (`превью: env preview`);
- легенда из трёх строк.

Допустимо, как и до правки: короткая подпись `index.html релиза` стоит рядом с подписью BFF, линии проходят по заголовкам групп.

Открыть `dist/integrations.png` через Read: в синей группе узел Traefik (VPS 1), в него приходят оранжевая стрелка от Client и стрелка `/payment-callback` от ЮMoney API.

При наложениях узлов сдвинуть на кратное 20 и повторить Step 5 и Step 6.

- [ ] **Step 7: Коммит**

```bash
git add diagrams/deployment.json diagrams/integrations.json
git commit -q -F - <<'EOF'
deployment, integrations: Traefik on k3s instead of Caddy, preview links

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 5: Приёмка

**Files:** без изменений, только проверки и публикация по разрешению.

- [ ] **Step 1: Полный прогон, как в CI**

Run: `bun run typecheck && bun run test && bun run build`
Expected: `tsc` без ошибок; `52 pass`, `0 fail`; пять `ok` в validate; `colors ok: 5 diagrams`; десять `ok` в render; `dist/index.html: 5 diagrams`.

- [ ] **Step 2: Приёмка спеки §10 по списку**

Проверить и отметить:
- `diagrams/frontend-monorepo.json` есть, строка в `README.md` есть (Task 1);
- `ci.json`, `cd.json`, `deployment.json`, `integrations.json` изменены по спеке §8.2–§8.5 (Task 2–4);
- PNG всех пяти схем осмотрены в Task 1–4 после последних правок координат;
- `git status --short` пустой, в истории ветки коммиты Task 1–4 поверх коммитов спеки.

- [ ] **Step 3: Спросить пользователя о публикации**

Не выполнять без явного «да». Спросить: пушить ли `feature/frontend-monorepo` и открывать ли PR в `main`.

- [ ] **Step 4: После разрешения: push, PR и превью**

```bash
git push -u origin feature/frontend-monorepo
gh pr create --base main --head feature/frontend-monorepo --title "Монорепа фронта и BFF: спека и схемы" --body-file - <<'EOF'
## Что

Спека `docs/superpowers/specs/2026-09-15-frontend-monorepo-design.md` и схемы по ней: новая `frontend-monorepo`, правки `ci`, `cd`, `deployment`, `integrations`.

## Проверка

`bun run typecheck`, `bun run test`, `bun run build` локально; PNG всех схем осмотрены.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

Дождаться прогонов CI и Pages на ветке: `gh run list --branch feature/frontend-monorepo --limit 5` до статуса `completed success` у `CI` и `Pages`. Затем:

Run: `curl -s -o /dev/null -w '%{http_code}' https://cringe-driven-development-team.github.io/docs/branches/feature-frontend-monorepo/frontend-monorepo.html`
Expected: `200`. Если `404`, точный адрес превью взять из списка `https://cringe-driven-development-team.github.io/docs/branches/`.
