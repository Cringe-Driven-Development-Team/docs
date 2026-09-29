# Схема contract: spec-first через Apidog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Показать на сайте схем, что команда работает spec-first через Apidog: новая схема `contract`, правки `frontend` и `ci` под свой пакет `@my/openapi` и Contract drift фронта.

**Architecture:** Три JSON-файла eraser-diagrams с абсолютными координатами. Стартовые раскладки в этом плане уже прогнаны через validate → check → warm → render (нативно, `DIAGRAMS_NATIVE=1`) и осмотрены; исполнитель пишет файл как есть, проходит цикл скилла в Docker и правит координаты, только если PNG из Docker расходится с описанным в шаге осмотра. README получает строку `contract` и уточнённую строку `ci`.

**Tech Stack:** eraser-diagrams CLI 0.1.0, bun ≥ 1.3, Node ≥ 22.12, Docker Desktop (рендер в образе из `Dockerfile`; без Docker — `DIAGRAMS_NATIVE=1`, путь к Chrome в `CHROMIUM_PATH`).

**Spec:** `docs/superpowers/specs/2026-09-30-contract-diagram-design.md`

## Global Constraints

- Работа в worktree `.claude/worktrees/contract-diagram`, ветка `feature/contract-diagram`. Все команды — из корня worktree.
- Правила скилла `.claude/skills/eraser-diagrams/SKILL.md` обязательны: прочитай его целиком до первой схемы.
- Формат файла как в репо: одна сущность или связь — одна строка, `{ "ключ": значение }` с пробелами внутри фигурных скобок, отступ 4 пробела.
- Координаты абсолютные, кратны 20, даже у детей с `containerId`.
- Цвета верхних групп: Selectel — `blue`, GitHub — `purple`, Apidog / NPM Registry / GHCR — `green`, «Ноут студента» — `white`. Вложенные группы: `color` родителя и `"styleMode": "plain"`.
- Стрелки: из `client` — `"color": "orange", "lineStyle": "solid"`; ровно один конец `Activity` — `"color": "black", "lineStyle": "dashed"`; к `telegram` — `"color": "red", "lineStyle": "dotted"`; остальные без `color`/`lineStyle`.
- Легенда: ровно те `entries`, которые требует `bun run check`.
- Никаких `<…>` в `text`/`label`, плейсхолдеры в фигурных скобках (`{n}`, `{sha}`); апостроф только `’`.
- Имя пакета на схемах — плейсхолдер `@my/openapi`. Хостнеймы — `site.ru`. Никаких токенов и IP: у `APIDOG_TOKEN` только имя переменной.
- Состав узлов и связей — только по спеке §4–§6. При правке раскладки состав не меняется.
- `diagrams/bff/`, `diagrams/frozen-k3s/`, `scripts/` не трогать.
- Коммиты по-русски: `тип(область): что сделано`, в конце строка `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Рендер в Docker (как в CI) может проложить стрелки иначе, чем нативный, на котором подбирались координаты: шаг осмотра смотрит PNG из `bun run render` в Docker и сверяет с перечнем «что должно быть» — Task 1–3.
2. Стрелка проходит через полосу заголовка группы и «зачёркивает» его (`Contract drift (nightly)`, `bun run generate (фронт)`, `NPM Registry`, `Frontend repo`) — шаг осмотра Task 1–3. Допустимое исключение: стрелка `export` к `make generate` на `ci` задевает заголовок Contract drift бэка, так было и до правки.
3. Подписи в Activity переносятся посреди слова (`cmd/apido g`, `scripts/apidog.t s`): ширины 180/160 в `contract` подобраны под это — Task 1, Step 5.
4. Пунктир `vite build` → S3 на `frontend` идёт сквозь группу VPS: ширина `fe-pipeline` 740 уводит его в обход — Task 2, Step 4.
5. Замороженные схемы или скрипты случайно изменены: `git diff --stat main -- diagrams/bff diagrams/frozen-k3s scripts` пуст — Task 4, Step 1.

---

### Task 1: Схема `diagrams/contract.json` и строка README

**Files:**
- Create: `diagrams/contract.json`
- Modify: `README.md` (таблица MVP, после строки `frontend`)

**Interfaces:**
- Consumes: пайплайн `bun run validate|check|warm|render`.
- Produces: `dist/contract.html`, `dist/contract.png`; строка README со ссылкой `https://cringe-driven-development-team.github.io/docs/contract.html`.

- [ ] **Step 1: Прочитай скилл и спеку**

Прочитай `.claude/skills/eraser-diagrams/SKILL.md` и §4 спеки `docs/superpowers/specs/2026-09-30-contract-diagram-design.md`.

- [ ] **Step 2: Создай `diagrams/contract.json`**

```json
{
  "entities": [
    { "tag": "Group", "id": "apidog", "color": "green", "x": 0, "y": 0, "width": 340, "height": 380, "isContainer": true, "title": { "text": "Apidog", "icon": "cloud" } },
    { "tag": "Icon", "id": "apidog-branch", "x": 40, "y": 80, "containerId": "apidog", "icon": "git-branch", "texts": [{ "text": "sprint-ветка api-{n}" }] },
    { "tag": "Icon", "id": "apidog-docs", "x": 200, "y": 80, "containerId": "apidog", "icon": "book-open", "texts": [{ "text": "Опубликованная документация" }] },
    { "tag": "Icon", "id": "apidog-main", "x": 40, "y": 240, "containerId": "apidog", "icon": "git-merge", "texts": [{ "text": "main (защищена)" }] },
    { "tag": "Icon", "id": "apidog-export", "x": 200, "y": 240, "containerId": "apidog", "icon": "file-code", "texts": [{ "text": "Open API: export-openapi, OAS 3.1" }] },
    { "tag": "Group", "id": "laptop", "color": "white", "x": 440, "y": 0, "width": 540, "height": 440, "isContainer": true, "title": { "text": "Ноут студента", "icon": "laptop" } },
    { "tag": "Textbox", "id": "laptop-env", "x": 460, "y": 40, "width": 480, "containerId": "laptop", "text": "`.env` в `.gitignore`: личный `APIDOG_TOKEN`, `APIDOG_BRANCH_ID` — для sprint-ветки" },
    { "tag": "Group", "id": "be-generate", "color": "white", "styleMode": "plain", "x": 460, "y": 120, "width": 500, "height": 120, "containerId": "laptop", "isContainer": true, "title": { "text": "make generate (бэк)" } },
    { "tag": "Activity", "id": "be-export", "x": 480, "y": 160, "width": 180, "height": 60, "containerId": "be-generate", "texts": [{ "text": "cmd/apidog" }] },
    { "tag": "Activity", "id": "be-codegen", "x": 780, "y": 160, "width": 160, "height": 60, "containerId": "be-generate", "texts": [{ "text": "oapi-codegen" }] },
    { "tag": "Group", "id": "fe-generate", "color": "white", "styleMode": "plain", "x": 460, "y": 300, "width": 500, "height": 120, "containerId": "laptop", "isContainer": true, "title": { "text": "bun run generate (фронт)" } },
    { "tag": "Activity", "id": "fe-export", "x": 480, "y": 340, "width": 180, "height": 60, "containerId": "fe-generate", "texts": [{ "text": "scripts/apidog.ts" }] },
    { "tag": "Activity", "id": "fe-codegen", "x": 780, "y": 340, "width": 160, "height": 60, "containerId": "fe-generate", "texts": [{ "text": "@my/openapi CLI" }] },
    { "tag": "Group", "id": "npm-registry", "color": "green", "x": 640, "y": 680, "width": 300, "height": 160, "isContainer": true, "title": { "text": "NPM Registry", "icon": "npm" } },
    { "tag": "Icon", "id": "npm-openapi", "x": 780, "y": 720, "containerId": "npm-registry", "icon": "npm", "texts": [{ "text": "@my/openapi" }] },
    { "tag": "Group", "id": "github", "color": "purple", "x": 1060, "y": 0, "width": 600, "height": 880, "isContainer": true, "title": { "text": "GitHub", "icon": "github" } },
    { "tag": "Group", "id": "repo-backend", "color": "purple", "styleMode": "plain", "x": 1080, "y": 40, "width": 560, "height": 300, "containerId": "github", "isContainer": true, "title": { "text": "Backend repo", "icon": "go" } },
    { "tag": "Icon", "id": "be-code", "x": 1100, "y": 80, "containerId": "repo-backend", "icon": "go", "texts": [{ "text": "api.gen.go: strict server, models, embedded spec" }] },
    { "tag": "Group", "id": "be-drift", "color": "purple", "styleMode": "plain", "x": 1260, "y": 200, "width": 360, "height": 120, "containerId": "repo-backend", "isContainer": true, "title": { "text": "Contract drift (nightly)" } },
    { "tag": "Activity", "id": "be-drift-generate", "x": 1280, "y": 240, "width": 120, "height": 60, "containerId": "be-drift", "texts": [{ "text": "make generate" }] },
    { "tag": "Activity", "id": "be-drift-compare", "x": 1440, "y": 240, "width": 120, "height": 60, "containerId": "be-drift", "texts": [{ "text": "Compare with code" }] },
    { "tag": "Group", "id": "repo-frontend", "color": "purple", "styleMode": "plain", "x": 1080, "y": 360, "width": 560, "height": 320, "containerId": "github", "isContainer": true, "title": { "text": "Frontend repo", "icon": "react" } },
    { "tag": "Icon", "id": "fe-schema", "x": 1100, "y": 400, "containerId": "repo-frontend", "icon": "typescript", "texts": [{ "text": "src/api/schema.d.ts" }] },
    { "tag": "Icon", "id": "fe-client", "x": 1260, "y": 400, "containerId": "repo-frontend", "icon": "file-code", "texts": [{ "text": "src/api/client.ts" }] },
    { "tag": "Group", "id": "fe-drift", "color": "purple", "styleMode": "plain", "x": 1260, "y": 540, "width": 360, "height": 120, "containerId": "repo-frontend", "isContainer": true, "title": { "text": "Contract drift (nightly)" } },
    { "tag": "Activity", "id": "fe-drift-generate", "x": 1280, "y": 580, "width": 120, "height": 60, "containerId": "fe-drift", "texts": [{ "text": "bun run generate" }] },
    { "tag": "Activity", "id": "fe-drift-compare", "x": 1440, "y": 580, "width": 120, "height": 60, "containerId": "fe-drift", "texts": [{ "text": "Compare with code" }] },
    { "tag": "Group", "id": "repo-openapi", "color": "purple", "styleMode": "plain", "x": 1080, "y": 700, "width": 560, "height": 160, "containerId": "github", "isContainer": true, "title": { "text": "OpenAPI repo", "icon": "package" } },
    { "tag": "Icon", "id": "op-package", "x": 1100, "y": 740, "containerId": "repo-openapi", "icon": "package", "texts": [{ "text": "@my/openapi: генератор и клиент" }] },
    { "tag": "Group", "id": "selectel", "color": "blue", "x": 1740, "y": 0, "width": 360, "height": 220, "isContainer": true, "title": { "text": "Selectel", "icon": "cloud" } },
    { "tag": "Group", "id": "vps", "color": "blue", "styleMode": "plain", "x": 1760, "y": 40, "width": 320, "height": 160, "containerId": "selectel", "isContainer": true, "title": { "text": "VPS · Docker Compose", "icon": "docker" } },
    { "tag": "Icon", "id": "go-api", "x": 1780, "y": 80, "containerId": "vps", "icon": "go", "texts": [{ "text": "Go API · OapiRequestValidator" }] },
    { "tag": "Icon", "id": "caddy", "x": 1940, "y": 80, "containerId": "vps", "icon": "server", "texts": [{ "text": "Caddy" }] },
    { "tag": "Icon", "id": "client", "x": 2200, "y": 80, "icon": "chrome", "texts": [{ "text": "Client (браузер)" }] },
    { "tag": "Textbox", "id": "rules", "x": 1740, "y": 300, "width": 500, "text": "**Правила контракта**\n\n1. Контракт правят только в sprint-ветке Apidog, `main` защищена, слияние через Merge Request\n2. В `main` репы попадает только код, сгенерированный из `main` Apidog: перед мержем PR перегенерировать без `APIDOG_BRANCH_ID`\n3. Сгенерированный код (`api.gen.go`, `schema.d.ts`) коммитится и руками не правится\n4. Слияние перезаписывает ресурс в `main` целиком: ревьюер Merge Request сверяет его с текущим `main`\n5. Генератор и клиент фронта — один пакет `@my/openapi`, одна версия" },
    { "tag": "Legend", "id": "legend", "x": 2360, "y": 0, "width": 340, "entries": [{ "text": "Наша инфраструктура", "color": "#2866c4" }, { "text": "GitHub", "color": "#c43dcf" }, { "text": "Внешние сервисы", "color": "#30a050" }, { "text": "Рабочее место", "color": "#242424" }, { "text": "Пользовательский трафик", "color": "#c38424" }, { "text": "Пайплайн и внешние системы, пунктир", "color": "#3a3a3a" }, { "text": "Прочие связи", "color": "#1c1c1c" }] }
  ],
  "connections": [
    { "tag": "Relationship", "from": "apidog-branch", "to": "apidog-main", "label": "Merge Request" },
    { "tag": "Relationship", "from": "apidog-main", "to": "apidog-docs" },
    { "tag": "Relationship", "from": "apidog-main", "to": "apidog-export" },
    { "tag": "Relationship", "from": "apidog-export", "to": "be-export", "label": "YAML", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "apidog-export", "to": "fe-export", "label": "JSON", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "be-export", "to": "be-codegen", "label": "openapi.yaml" },
    { "tag": "Relationship", "from": "fe-export", "to": "fe-codegen", "label": "openapi.json" },
    { "tag": "Relationship", "from": "be-codegen", "to": "be-code", "label": "commit", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "fe-codegen", "to": "fe-schema", "label": "commit", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "fe-schema", "to": "fe-client", "label": "типы paths" },
    { "tag": "Relationship", "from": "apidog-export", "to": "be-drift-generate", "label": "main", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "apidog-export", "to": "fe-drift-generate", "label": "main", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "be-drift-generate", "to": "be-drift-compare" },
    { "tag": "Relationship", "from": "fe-drift-generate", "to": "fe-drift-compare" },
    { "tag": "Relationship", "from": "op-package", "to": "npm-openapi", "label": "release" },
    { "tag": "Relationship", "from": "npm-openapi", "to": "fe-codegen", "label": "CLI", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "npm-openapi", "to": "fe-client", "label": "createClient" },
    { "tag": "Relationship", "from": "be-code", "to": "go-api", "label": "embedded spec" },
    { "tag": "Relationship", "from": "client", "to": "caddy", "label": "https://site.ru/api/v1", "color": "orange", "lineStyle": "solid" },
    { "tag": "Relationship", "from": "caddy", "to": "go-api", "label": "/api/v1/*" }
  ]
}
```

- [ ] **Step 3: Валидация, цвета, иконки**

Run: `bun run validate && bun run check && bun run warm`
Expected: `ok    diagrams/contract.json`, `colors ok`, `icons warm` без `unknown icon`. Если `check` печатает `entries` для `contract` — скопируй массив в `legend.entries` дословно и повтори.

- [ ] **Step 4: Рендер**

Run: `bun run render` (Docker Desktop запущен; иначе `DIAGRAMS_NATIVE=1 CHROMIUM_PATH="/c/Program Files/Google/Chrome/Application/chrome.exe" bun run render`)
Expected: `dist/contract.html`, `dist/contract.png`.

- [ ] **Step 5: Осмотр PNG**

Открой `dist/contract.png` через Read. Должно быть:
- слева направо: Apidog, «Ноут студента», GitHub (Backend / Frontend / OpenAPI repo сверху вниз), Selectel, Client; «Правила контракта» под Selectel, легенда справа; NPM Registry под ноутом;
- `cmd/apidog`, `oapi-codegen`, `scripts/apidog.ts`, `@my/openapi CLI` — без переноса посреди слова;
- подписи `openapi.yaml`, `openapi.json` между шагами ноута целиком, не на заголовках групп;
- стрелки `main` к обоим Contract drift и `embedded spec` к Go API не проходят через заголовки групп;
- стрелка `CLI` от `@my/openapi` вверх к `@my/openapi CLI` не пересекает заголовок «NPM Registry»;
- все 20 стрелок на месте, подписи читаемы, легенда ничего не перекрывает.

При расхождении правь координаты (кратно 20, узел двигай вместе с рамкой группы) по одному параметру, повторяй шаги 3–5.

- [ ] **Step 6: Строка README**

В таблицу MVP в `README.md` после строки `frontend` добавь:

```markdown
| [contract](https://cringe-driven-development-team.github.io/docs/contract.html) | Spec-first: контракт в Apidog, кодогенерация бэка и фронта, Contract drift |
```

- [ ] **Step 7: Commit**

```bash
git add diagrams/contract.json README.md
git commit -m "feat(diagrams): contract — spec-first через Apidog

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Правки `diagrams/frontend.json`

**Files:**
- Modify: `diagrams/frontend.json` (весь файл)

**Interfaces:**
- Consumes: пайплайн из Task 1.
- Produces: `dist/frontend.png` со `schema.d.ts` и `@my/openapi`.

Что меняется против `main` (спека §5): новый узел `fe-schema`; `fe-api-client` → «API-клиент · @my/openapi», x 680; `repo-frontend` ширина 800, `fe-pipeline` ширина 740, `github` ширина 1060; `repo-backend`/`be-oapi`, `apidog`/`apidog-spec`, `rules`, `legend` сдвинуты вправо; `apidog-spec` → «Контракт · OAS 3.1»; связи `apidog-spec` → `fe-schema` «bun run generate» и `fe-schema` → `fe-api-client` «типы paths» вместо `apidog-spec` → `fe-api-client` «типы»; пункт 1 правил.

- [ ] **Step 1: Замени содержимое `diagrams/frontend.json`**

```json
{
  "entities": [
    { "tag": "Group", "id": "github", "color": "purple", "x": 0, "y": 0, "width": 1060, "height": 400, "isContainer": true, "title": { "text": "GitHub", "icon": "github" } },
    { "tag": "Group", "id": "repo-frontend", "color": "purple", "styleMode": "plain", "x": 20, "y": 40, "width": 800, "height": 340, "containerId": "github", "isContainer": true, "title": { "text": "Frontend repo", "icon": "react" } },
    { "tag": "Icon", "id": "fe-react", "x": 60, "y": 80, "containerId": "repo-frontend", "icon": "react", "texts": [{ "text": "React" }] },
    { "tag": "Icon", "id": "fe-router", "x": 200, "y": 80, "containerId": "repo-frontend", "icon": "layers", "texts": [{ "text": "TanStack Router" }] },
    { "tag": "Icon", "id": "fe-zustand", "x": 340, "y": 80, "containerId": "repo-frontend", "icon": "package", "texts": [{ "text": "zustand" }] },
    { "tag": "Icon", "id": "fe-schema", "x": 480, "y": 80, "containerId": "repo-frontend", "icon": "typescript", "texts": [{ "text": "schema.d.ts" }] },
    { "tag": "Icon", "id": "fe-api-client", "x": 680, "y": 80, "containerId": "repo-frontend", "icon": "file-code", "texts": [{ "text": "API-клиент · @my/openapi" }] },
    { "tag": "Group", "id": "fe-pipeline", "color": "purple", "styleMode": "plain", "x": 40, "y": 240, "width": 740, "height": 120, "containerId": "repo-frontend", "isContainer": true, "title": { "text": "CI" } },
    { "tag": "Activity", "id": "fe-install", "x": 60, "y": 280, "width": 120, "height": 60, "containerId": "fe-pipeline", "texts": [{ "text": "bun install" }] },
    { "tag": "Activity", "id": "fe-check", "x": 220, "y": 280, "width": 120, "height": 60, "containerId": "fe-pipeline", "texts": [{ "text": "lint · typecheck · test" }] },
    { "tag": "Activity", "id": "fe-vite-build", "x": 380, "y": 280, "width": 120, "height": 60, "containerId": "fe-pipeline", "texts": [{ "text": "vite build" }] },
    { "tag": "Group", "id": "repo-backend", "color": "purple", "styleMode": "plain", "x": 840, "y": 40, "width": 200, "height": 160, "containerId": "github", "isContainer": true, "title": { "text": "Backend repo", "icon": "go" } },
    { "tag": "Icon", "id": "be-oapi", "x": 860, "y": 80, "containerId": "repo-backend", "icon": "go", "texts": [{ "text": "oapi-codegen: strict server" }] },
    { "tag": "Group", "id": "apidog", "color": "green", "x": 1140, "y": 220, "width": 200, "height": 160, "isContainer": true, "title": { "text": "Apidog", "icon": "cloud" } },
    { "tag": "Icon", "id": "apidog-spec", "x": 1160, "y": 260, "containerId": "apidog", "icon": "file-code", "texts": [{ "text": "Контракт · OAS 3.1" }] },
    { "tag": "Icon", "id": "client", "x": 0, "y": 720, "icon": "chrome", "texts": [{ "text": "Client (браузер)" }] },
    { "tag": "Group", "id": "selectel", "color": "blue", "x": 300, "y": 520, "width": 660, "height": 460, "isContainer": true, "title": { "text": "Selectel", "icon": "cloud" } },
    { "tag": "Icon", "id": "cdn", "x": 340, "y": 840, "containerId": "selectel", "icon": "cloud", "texts": [{ "text": "CDN static.site.ru" }] },
    { "tag": "Icon", "id": "s3", "x": 860, "y": 840, "containerId": "selectel", "icon": "database", "texts": [{ "text": "S3: releases/{sha}/, index.html, current.json" }] },
    { "tag": "Group", "id": "vps", "color": "blue", "styleMode": "plain", "x": 320, "y": 560, "width": 400, "height": 160, "containerId": "selectel", "isContainer": true, "title": { "text": "VPS · Docker Compose", "icon": "docker" } },
    { "tag": "Icon", "id": "caddy", "x": 340, "y": 600, "containerId": "vps", "icon": "server", "texts": [{ "text": "Caddy" }] },
    { "tag": "Icon", "id": "go-api", "x": 580, "y": 600, "containerId": "vps", "icon": "go", "texts": [{ "text": "Go API" }] },
    { "tag": "Textbox", "id": "rules", "x": 1220, "y": 520, "width": 480, "text": "**Правила выкатки**\n\n1. Контракт меняется в Apidog; бэк (oapi-codegen) и фронт (@my/openapi) генерируют из него код\n2. Go API N+1 обслуживает клиента N: ручки и поля не удаляются в том же релизе\n3. Автоперезагрузки нет, вкладка живёт на чанках своего релиза\n4. В S3 последние 5 релизов, stable и previous не удаляются\n5. Откат клиента: stable ← previous, index.html ← релиз previous" },
    { "tag": "Legend", "id": "legend", "x": 1760, "y": 0, "width": 340, "entries": [{ "text": "Наша инфраструктура", "color": "#2866c4" }, { "text": "GitHub", "color": "#c43dcf" }, { "text": "Внешние сервисы", "color": "#30a050" }, { "text": "Пользовательский трафик", "color": "#c38424" }, { "text": "Пайплайн и внешние системы, пунктир", "color": "#3a3a3a" }, { "text": "Прочие связи", "color": "#1c1c1c" }] }
  ],
  "connections": [
    { "tag": "Relationship", "from": "fe-install", "to": "fe-check" },
    { "tag": "Relationship", "from": "fe-check", "to": "fe-vite-build" },
    { "tag": "Relationship", "from": "apidog-spec", "to": "fe-schema", "label": "bun run generate" },
    { "tag": "Relationship", "from": "fe-schema", "to": "fe-api-client", "label": "типы paths" },
    { "tag": "Relationship", "from": "apidog-spec", "to": "be-oapi", "label": "make generate" },
    { "tag": "Relationship", "from": "fe-vite-build", "to": "s3", "label": "releases/{sha}/ (main)", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "client", "to": "caddy", "label": "https://site.ru: HTML, /api/v1", "color": "orange", "lineStyle": "solid" },
    { "tag": "Relationship", "from": "client", "to": "cdn", "label": "https://static.site.ru", "color": "orange", "lineStyle": "solid" },
    { "tag": "Relationship", "from": "caddy", "to": "go-api", "label": "/api/v1/*" },
    { "tag": "Relationship", "from": "caddy", "to": "s3", "label": "index.html" },
    { "tag": "Relationship", "from": "s3", "to": "cdn", "label": "static" }
  ]
}
```

- [ ] **Step 2: Проверь объём правки**

Run: `git diff --stat diagrams/frontend.json`
Expected: только `diagrams/frontend.json`, 13 строк добавлено и 11 удалено.

- [ ] **Step 3: Валидация, цвета, иконки, рендер**

Run: `bun run validate && bun run check && bun run warm && bun run render`
Expected: `ok    diagrams/frontend.json`, `colors ok`, `dist/frontend.png`.

- [ ] **Step 4: Осмотр PNG**

Открой `dist/frontend.png`. Должно быть: в «Frontend repo» пять иконок в ряд — React, TanStack Router, zustand, schema.d.ts, API-клиент · @my/openapi; подпись «типы paths» в одну строку между `schema.d.ts` и клиентом; стрелка «bun run generate» из Apidog в `schema.d.ts`; «make generate» из Apidog в `oapi-codegen`; пунктир `vite build` → S3 «releases/{sha}/ (main)» обходит рамку «VPS · Docker Compose», а не идёт сквозь неё; легенда ничего не перекрывает. При расхождении правь координаты по одному параметру, повторяй шаги 3–4.

- [ ] **Step 5: Commit**

```bash
git add diagrams/frontend.json
git commit -m "feat(diagrams): frontend — schema.d.ts и клиент @my/openapi

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Правки `diagrams/ci.json` и строка README

**Files:**
- Modify: `diagrams/ci.json` (весь файл)
- Modify: `README.md` (строка `ci` в таблице MVP)

**Interfaces:**
- Consumes: пайплайн из Task 1.
- Produces: `dist/ci.png` с OpenAPI repo и Contract drift фронта.

Что меняется против `main` (спека §6): новые `repo-openapi` с пайплайном `openapi-release` (5 шагов), `fe-drift` во Frontend repo, `npm-openapi` в NPM Registry (группа шире, 340); порядок реп React → OpenAPI → Static → Frontend → Backend → Deployments, `github` высотой 1500; `s3`, `apidog`, `ghcr`, `telegram`, `legend` переставлены; `apidog-spec` → «Контракт · OAS 3.1»; новые связи `op-*` по цепочке, `op-deploy-npm` → `npm-openapi`, `fe-generate` → `fe-compare`, `apidog-spec` → `fe-generate` «export».

- [ ] **Step 1: Замени содержимое `diagrams/ci.json`**

```json
{
  "entities": [
    { "tag": "Group", "id": "github", "color": "purple", "x": 0, "y": 0, "width": 880, "height": 1500, "isContainer": true, "title": { "text": "GitHub", "icon": "github" } },
    { "tag": "Group", "id": "repo-react", "color": "purple", "styleMode": "plain", "x": 20, "y": 40, "width": 840, "height": 180, "containerId": "github", "isContainer": true, "title": { "text": "React repo", "icon": "react" } },
    { "tag": "Group", "id": "react-release", "color": "purple", "styleMode": "plain", "x": 40, "y": 80, "width": 800, "height": 120, "containerId": "repo-react", "isContainer": true, "title": { "text": "React release" } },
    { "tag": "Activity", "id": "react-install", "x": 60, "y": 120, "width": 120, "height": 60, "containerId": "react-release", "texts": [{ "text": "Install deps" }] },
    { "tag": "Activity", "id": "react-lint", "x": 220, "y": 120, "width": 120, "height": 60, "containerId": "react-release", "texts": [{ "text": "Lint" }] },
    { "tag": "Activity", "id": "react-build", "x": 380, "y": 120, "width": 120, "height": 60, "containerId": "react-release", "texts": [{ "text": "Build" }] },
    { "tag": "Activity", "id": "react-deploy-npm", "x": 540, "y": 120, "width": 120, "height": 60, "containerId": "react-release", "texts": [{ "text": "Deploy to NPM" }] },
    { "tag": "Activity", "id": "react-tg", "x": 700, "y": 120, "width": 120, "height": 60, "containerId": "react-release", "texts": [{ "text": "Send to tg" }] },
    { "tag": "Group", "id": "repo-openapi", "color": "purple", "styleMode": "plain", "x": 20, "y": 240, "width": 840, "height": 180, "containerId": "github", "isContainer": true, "title": { "text": "OpenAPI repo", "icon": "package" } },
    { "tag": "Group", "id": "openapi-release", "color": "purple", "styleMode": "plain", "x": 40, "y": 280, "width": 800, "height": 120, "containerId": "repo-openapi", "isContainer": true, "title": { "text": "OpenAPI release" } },
    { "tag": "Activity", "id": "op-install", "x": 60, "y": 320, "width": 120, "height": 60, "containerId": "openapi-release", "texts": [{ "text": "Install deps" }] },
    { "tag": "Activity", "id": "op-lint", "x": 220, "y": 320, "width": 120, "height": 60, "containerId": "openapi-release", "texts": [{ "text": "Lint · test" }] },
    { "tag": "Activity", "id": "op-build", "x": 380, "y": 320, "width": 120, "height": 60, "containerId": "openapi-release", "texts": [{ "text": "Build" }] },
    { "tag": "Activity", "id": "op-deploy-npm", "x": 540, "y": 320, "width": 120, "height": 60, "containerId": "openapi-release", "texts": [{ "text": "Deploy to NPM" }] },
    { "tag": "Activity", "id": "op-tg", "x": 700, "y": 320, "width": 120, "height": 60, "containerId": "openapi-release", "texts": [{ "text": "Send to tg" }] },
    { "tag": "Group", "id": "repo-frontend", "color": "purple", "styleMode": "plain", "x": 20, "y": 640, "width": 840, "height": 320, "containerId": "github", "isContainer": true, "title": { "text": "Frontend repo", "icon": "react" } },
    { "tag": "Group", "id": "fe-ci", "color": "purple", "styleMode": "plain", "x": 40, "y": 680, "width": 800, "height": 120, "containerId": "repo-frontend", "isContainer": true, "title": { "text": "CI" } },
    { "tag": "Activity", "id": "fe-install", "x": 60, "y": 720, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "bun install" }] },
    { "tag": "Activity", "id": "fe-check", "x": 220, "y": 720, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "lint · typecheck · test" }] },
    { "tag": "Activity", "id": "fe-vite-build", "x": 380, "y": 720, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "vite build" }] },
    { "tag": "Activity", "id": "fe-upload-release", "x": 540, "y": 720, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "Upload release (main)" }] },
    { "tag": "Activity", "id": "fe-tg", "x": 700, "y": 720, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "Send to tg" }] },
    { "tag": "Group", "id": "repo-backend", "color": "purple", "styleMode": "plain", "x": 20, "y": 980, "width": 840, "height": 320, "containerId": "github", "isContainer": true, "title": { "text": "Backend repo", "icon": "go" } },
    { "tag": "Group", "id": "be-ci", "color": "purple", "styleMode": "plain", "x": 40, "y": 1020, "width": 800, "height": 120, "containerId": "repo-backend", "isContainer": true, "title": { "text": "CI" } },
    { "tag": "Activity", "id": "be-lint", "x": 60, "y": 1060, "width": 120, "height": 60, "containerId": "be-ci", "texts": [{ "text": "golangci-lint" }] },
    { "tag": "Activity", "id": "be-test", "x": 220, "y": 1060, "width": 120, "height": 60, "containerId": "be-ci", "texts": [{ "text": "go test -race" }] },
    { "tag": "Activity", "id": "be-build-image", "x": 380, "y": 1060, "width": 120, "height": 60, "containerId": "be-ci", "texts": [{ "text": "Build image" }] },
    { "tag": "Activity", "id": "be-push-image", "x": 540, "y": 1060, "width": 120, "height": 60, "containerId": "be-ci", "texts": [{ "text": "Push image (main)" }] },
    { "tag": "Activity", "id": "be-tg", "x": 700, "y": 1060, "width": 120, "height": 60, "containerId": "be-ci", "texts": [{ "text": "Send to tg" }] },
    { "tag": "Group", "id": "be-drift", "color": "purple", "styleMode": "plain", "x": 40, "y": 1160, "width": 320, "height": 120, "containerId": "repo-backend", "isContainer": true, "title": { "text": "Contract drift (nightly)" } },
    { "tag": "Activity", "id": "be-generate", "x": 60, "y": 1200, "width": 120, "height": 60, "containerId": "be-drift", "texts": [{ "text": "make generate" }] },
    { "tag": "Activity", "id": "be-compare", "x": 220, "y": 1200, "width": 120, "height": 60, "containerId": "be-drift", "texts": [{ "text": "Compare with code" }] },
    { "tag": "Group", "id": "fe-drift", "color": "purple", "styleMode": "plain", "x": 40, "y": 820, "width": 320, "height": 120, "containerId": "repo-frontend", "isContainer": true, "title": { "text": "Contract drift (nightly)" } },
    { "tag": "Activity", "id": "fe-generate", "x": 60, "y": 860, "width": 120, "height": 60, "containerId": "fe-drift", "texts": [{ "text": "bun run generate" }] },
    { "tag": "Activity", "id": "fe-compare", "x": 220, "y": 860, "width": 120, "height": 60, "containerId": "fe-drift", "texts": [{ "text": "Compare with code" }] },
    { "tag": "Group", "id": "repo-static", "color": "purple", "styleMode": "plain", "x": 20, "y": 440, "width": 360, "height": 180, "containerId": "github", "isContainer": true, "title": { "text": "Static repo", "icon": "box" } },
    { "tag": "Group", "id": "static-pipeline", "color": "purple", "styleMode": "plain", "x": 40, "y": 480, "width": 320, "height": 120, "containerId": "repo-static", "isContainer": true, "title": { "text": "Static" } },
    { "tag": "Activity", "id": "static-deploy-s3", "x": 60, "y": 520, "width": 120, "height": 60, "containerId": "static-pipeline", "texts": [{ "text": "Deploy to S3" }] },
    { "tag": "Activity", "id": "static-tg", "x": 220, "y": 520, "width": 120, "height": 60, "containerId": "static-pipeline", "texts": [{ "text": "Send to tg" }] },
    { "tag": "Group", "id": "repo-deployments", "color": "purple", "styleMode": "plain", "x": 20, "y": 1320, "width": 740, "height": 160, "containerId": "github", "isContainer": true, "title": { "text": "Deployments repo", "icon": "ansible" } },
    { "tag": "Icon", "id": "dep-pulumi", "x": 40, "y": 1360, "containerId": "repo-deployments", "icon": "pulumi", "texts": [{ "text": "Pulumi configs" }] },
    { "tag": "Icon", "id": "dep-ansible", "x": 180, "y": 1360, "containerId": "repo-deployments", "icon": "ansible", "texts": [{ "text": "ansible roles / playbooks" }] },
    { "tag": "Icon", "id": "dep-vault", "x": 320, "y": 1360, "containerId": "repo-deployments", "icon": "ansible", "texts": [{ "text": "ansible vault" }] },
    { "tag": "Icon", "id": "dep-compose", "x": 460, "y": 1360, "containerId": "repo-deployments", "icon": "docker", "texts": [{ "text": "docker-compose.yml" }] },
    { "tag": "Icon", "id": "dep-caddyfile", "x": 600, "y": 1360, "containerId": "repo-deployments", "icon": "server", "texts": [{ "text": "Caddyfile" }] },
    { "tag": "Group", "id": "npm-registry", "color": "green", "x": 1100, "y": 40, "width": 340, "height": 160, "isContainer": true, "title": { "text": "NPM Registry", "icon": "npm" } },
    { "tag": "Icon", "id": "npm-react", "x": 1120, "y": 80, "containerId": "npm-registry", "icon": "npm", "texts": [{ "text": "@my/react" }] },
    { "tag": "Icon", "id": "npm-openapi", "x": 1260, "y": 80, "containerId": "npm-registry", "icon": "npm", "texts": [{ "text": "@my/openapi" }] },
    { "tag": "Icon", "id": "s3", "x": 1120, "y": 600, "icon": "database", "texts": [{ "text": "S3" }] },
    { "tag": "Group", "id": "ghcr", "color": "green", "x": 1100, "y": 1100, "width": 200, "height": 160, "isContainer": true, "title": { "text": "GHCR", "icon": "docker" } },
    { "tag": "Icon", "id": "reg-backend", "x": 1120, "y": 1140, "containerId": "ghcr", "icon": "docker", "texts": [{ "text": "backend:sha-{short}" }] },
    { "tag": "Group", "id": "apidog", "color": "green", "x": 1100, "y": 900, "width": 200, "height": 160, "isContainer": true, "title": { "text": "Apidog", "icon": "cloud" } },
    { "tag": "Icon", "id": "apidog-spec", "x": 1120, "y": 940, "containerId": "apidog", "icon": "file-code", "texts": [{ "text": "Контракт · OAS 3.1" }] },
    { "tag": "Icon", "id": "telegram", "x": 1120, "y": 1400, "icon": "telegram", "texts": [{ "text": "Telegram" }] },
    { "tag": "Legend", "id": "legend", "x": 1500, "y": 0, "width": 340, "entries": [{ "text": "GitHub", "color": "#c43dcf" }, { "text": "Внешние сервисы", "color": "#30a050" }, { "text": "Пайплайн и внешние системы, пунктир", "color": "#3a3a3a" }, { "text": "Алерты и уведомления, точки", "color": "#bd413a" }, { "text": "Прочие связи", "color": "#1c1c1c" }] }
  ],
  "connections": [
    { "tag": "Relationship", "from": "react-install", "to": "react-lint" },
    { "tag": "Relationship", "from": "react-lint", "to": "react-build" },
    { "tag": "Relationship", "from": "react-build", "to": "react-deploy-npm" },
    { "tag": "Relationship", "from": "react-deploy-npm", "to": "react-tg" },
    { "tag": "Relationship", "from": "op-install", "to": "op-lint" },
    { "tag": "Relationship", "from": "op-lint", "to": "op-build" },
    { "tag": "Relationship", "from": "op-build", "to": "op-deploy-npm" },
    { "tag": "Relationship", "from": "op-deploy-npm", "to": "op-tg" },
    { "tag": "Relationship", "from": "fe-install", "to": "fe-check" },
    { "tag": "Relationship", "from": "fe-check", "to": "fe-vite-build" },
    { "tag": "Relationship", "from": "fe-vite-build", "to": "fe-upload-release" },
    { "tag": "Relationship", "from": "fe-upload-release", "to": "fe-tg" },
    { "tag": "Relationship", "from": "be-lint", "to": "be-test" },
    { "tag": "Relationship", "from": "be-test", "to": "be-build-image" },
    { "tag": "Relationship", "from": "be-build-image", "to": "be-push-image" },
    { "tag": "Relationship", "from": "be-push-image", "to": "be-tg" },
    { "tag": "Relationship", "from": "be-generate", "to": "be-compare" },
    { "tag": "Relationship", "from": "fe-generate", "to": "fe-compare" },
    { "tag": "Relationship", "from": "static-deploy-s3", "to": "static-tg" },
    { "tag": "Relationship", "from": "react-deploy-npm", "to": "npm-react", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "op-deploy-npm", "to": "npm-openapi", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "fe-upload-release", "to": "s3", "label": "releases/{sha}/", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "be-push-image", "to": "reg-backend", "label": "tags: sha-{short}, main", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "apidog-spec", "to": "be-generate", "label": "export", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "apidog-spec", "to": "fe-generate", "label": "export", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "static-deploy-s3", "to": "s3", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "github", "to": "telegram", "label": "Send to tg", "color": "red", "lineStyle": "dotted" }
  ]
}
```

- [ ] **Step 2: Валидация, цвета, иконки, рендер**

Run: `bun run validate && bun run check && bun run warm && bun run render`
Expected: `ok    diagrams/ci.json`, `colors ok`, `dist/ci.png`.

- [ ] **Step 3: Осмотр PNG**

Открой `dist/ci.png`. Должно быть: в GitHub сверху вниз React repo, OpenAPI repo (Install deps → Lint · test → Build → Deploy to NPM → Send to tg), Static repo, Frontend repo (CI и Contract drift (nightly): bun run generate → Compare with code), Backend repo, Deployments repo; справа NPM Registry с `@my/react` и `@my/openapi`, S3 напротив Static/Frontend, Apidog между Frontend и Backend, GHCR ниже Apidog и не наезжает на него, Telegram внизу; две стрелки `export` из Apidog в оба `generate`; стрелки в S3 не пересекают Static repo; одна стрелка «Send to tg» от группы GitHub. При расхождении правь координаты по одному параметру, повторяй шаги 2–3.

- [ ] **Step 4: Строка README**

В `README.md` замени строку `ci`:

```markdown
| [ci](https://cringe-driven-development-team.github.io/docs/ci.html) | GitHub-репозитории, CI-пайплайны, Contract drift, GHCR, NPM, S3 |
```

- [ ] **Step 5: Commit**

```bash
git add diagrams/ci.json README.md
git commit -m "feat(diagrams): ci — OpenAPI repo, Contract drift фронта

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Финальная проверка и PR

**Files:**
- Нет новых правок, кроме исправлений по результатам проверок.

**Interfaces:**
- Consumes: всё из Task 1–3.
- Produces: ветка `feature/contract-diagram` на origin, PR в `main`.

- [ ] **Step 1: Замороженное и скрипты не тронуты**

Run: `git diff --stat main -- diagrams/bff diagrams/frozen-k3s scripts`
Expected: пустой вывод.

- [ ] **Step 2: Нет запрещённого в схемах**

Run: `grep -nE '<[a-z]|openapi-fetch|openapi-typescript|[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}' diagrams/contract.json diagrams/frontend.json diagrams/ci.json`
Expected: пустой вывод (код выхода 1).

- [ ] **Step 3: Полная проверка, как в CI**

Run: `bun run typecheck && bun run test && bun run build`
Expected: всё зелёное; `grep -c 'contract.html' dist/index.html` ≥ 1.

- [ ] **Step 4: Push и PR (только с согласия пользователя)**

Спроси пользователя, можно ли пушить. После согласия:

```bash
git push -u origin feature/contract-diagram
gh pr create --base main --title "Схема contract: spec-first через Apidog" --body-file - <<'BODY'
## Что

- Новая схема `contract`: контракт в Apidog (sprint-ветка → Merge Request → защищённая `main`), кодогенерация на ноуте студента (`make generate` бэка, `bun run generate` фронта), что коммитится, ночной Contract drift обеих реп, пакет `@my/openapi` через NPM, проверка запросов в Go API по встроенной спеке.
- `frontend`: `schema.d.ts` и API-клиент на своём пакете `@my/openapi` вместо openapi-fetch.
- `ci`: OpenAPI repo с релизом в NPM, Contract drift фронта.
- README: строка `contract`, уточнена строка `ci`.

## Решения

Спека: `docs/superpowers/specs/2026-09-30-contract-diagram-design.md`. Генератор и клиент свои, один пакет в отдельной репе (ТЗ — frontend#12); фронт выгружает спеку из Apidog сам, в JSON; имя пакета на схемах — плейсхолдер `@my/openapi`, как `@my/react`.

## Проверка

- `bun run typecheck && bun run test && bun run build` зелёные.
- PNG `contract`, `frontend`, `ci` осмотрены.
- Превью: https://cringe-driven-development-team.github.io/docs/branches/feature-contract-diagram/

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
```

Expected: ссылка на PR. Превью появится через ~4 минуты после push (workflow Pages на `main`).
