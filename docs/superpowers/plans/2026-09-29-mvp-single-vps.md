# MVP на одной VPS без BFF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заморозить нынешние схемы MVP (две VPS, BFF) в `diagrams/bff/` и нарисовать в корне `diagrams/` новые схемы MVP: одна VPS с Caddy, Go API и Postgres, фронт — одна репа, ходит в Go API напрямую.

**Architecture:** Перенос `git mv` пяти файлов в подпапку (подпапка сама становится табом `bff`, код `scripts/` не меняется), затем пять новых JSON-файлов eraser-diagrams с абсолютными координатами, каждый проходит цикл validate → check → warm → render → осмотр PNG. Документация (README, CLAUDE.md, скилл) правится в первой задаче.

**Tech Stack:** eraser-diagrams CLI 0.1.0, bun ≥ 1.3, Node ≥ 22.12, Docker Desktop (рендер в образе из `Dockerfile`; без Docker — `DIAGRAMS_NATIVE=1`).

**Spec:** `docs/superpowers/specs/2026-09-29-mvp-single-vps-design.md`

## Global Constraints

- Работа в worktree `.claude/worktrees/mvp-single-vps`, ветка `feature/mvp-single-vps`. Все команды — из корня worktree.
- Правила скилла `.claude/skills/eraser-diagrams/SKILL.md` обязательны: прочитай его целиком до первой схемы.
- Координаты абсолютные, кратны 20, даже у детей с `containerId`. Первый узел в группе на `x+20, y+40`.
- Цвета верхних групп: Selectel — `blue`, GitHub / GitHub Actions — `purple`, GHCR / NPM Registry / Apidog — `green`, ноут — `white`. Вложенные группы: `color` родителя и `"styleMode": "plain"`. У иконок, `Activity`, `Textbox` цвета нет.
- Стрелки: из `client` — `"color": "orange", "lineStyle": "solid"`; ровно один конец `Activity` — `"color": "black", "lineStyle": "dashed"`; к `telegram` — `"color": "red", "lineStyle": "dotted"`; остальные без `color`/`lineStyle`.
- Легенда: ровно один `{"tag": "Legend", "id": "legend", "x": …, "y": 0, "width": 340, "entries": …}` справа от содержимого; `entries` — ровно то, что требует `bun run check`. Hex: blue `#2866c4`, purple `#c43dcf`, green `#30a050`, orange `#c38424`, red `#bd413a`, black (пунктир) `#3a3a3a`, white `#242424`, прочие связи `#1c1c1c`.
- Никаких `<…>` в `text`/`label`; апостроф только типографский `’`.
- Хостнеймы: `site.ru`, `static.site.ru` (плейсхолдеры); в `infra` — `cellestial.ru`, как сейчас. Никаких реальных IP, CIDR, токенов.
- Связи и подписи — только из таблиц спеки §7. Состав узлов и связей при правке раскладки не меняется.
- `diagrams/bff/` и `diagrams/frozen-k3s/` после Task 1 не правятся.
- Код в `scripts/` не менять.
- Коммиты по-русски: `тип(область): что сделано`, в конце строка `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Перенос испортил замороженные схемы: файлы `diagrams/bff/*.json` должны быть побайтно равны прежним корневым — проверка `git diff --cached --stat -M` в Task 1 и `git diff -M --name-status main -- diagrams` (только `R100`) в Task 7.
2. Остатки BFF и второй VPS в новых схемах корня: `grep -nE "BFF|bff|trpc|tRPC|VPS 1|VPS 2|vps1|vps2|monorepo|Hono" diagrams/*.json` должен ничего не найти — проверка в Task 7.
3. Таб `mvp` не первый или не открыт: в `dist/index.html` первый radio `id="tab-0"` с `checked` и первая метка `mvp`, затем `bff`, затем `frozen-k3s` — проверка в Task 7.
4. Подпись `/api/v1/*` со звёздочкой может уйти в markdown-курсив или пропасть: в PNG `deployment` и `frontend` подпись видна целиком со `*` — проверка в Task 2 и Task 6.
5. Длинные подписи иконок (`S3: releases/{sha}/, index.html, current.json`, `VPS · floating IP, Caddy + Let’s Encrypt, Docker Compose`) переносятся в 3–5 строк и налезают на соседей или рамку — осмотр PNG в Task 2 и Task 3.

---

### Task 1: Перенос схем в `diagrams/bff/` и документация

**Files:**
- Move: `diagrams/{deployment,ci,cd,frontend-monorepo,infra}.json` → `diagrams/bff/`
- Modify: `README.md:17-31` (абзац про архитектуры и таблица MVP)
- Modify: `CLAUDE.md:10`
- Modify: `.claude/skills/eraser-diagrams/SKILL.md:9-12`

**Interfaces:**
- Consumes: ничего.
- Produces: пустой корень `diagrams/` (кроме подпапок); таб `bff` на сайте; строки README для пяти новых схем корня (`deployment`, `ci`, `cd`, `frontend`, `infra`), которые создают Task 2–6.

- [ ] **Step 1: Перенеси файлы**

```bash
mkdir -p diagrams/bff
git mv diagrams/deployment.json diagrams/ci.json diagrams/cd.json diagrams/frontend-monorepo.json diagrams/infra.json diagrams/bff/
```

- [ ] **Step 2: Убедись, что перенос без изменений содержимого**

Run: `git diff --cached --stat -M -- diagrams`
Expected: пять строк вида `diagrams/{ => bff}/deployment.json | 0`, без `+`/`-`.

- [ ] **Step 3: Перепиши абзац и таблицы в README**

В `README.md` замени строки 17–31 (от `Архитектур две.` до последней строки таблицы MVP включительно) на:

```markdown
Архитектур три. **MVP: одна VPS** это рабочая, с ней идёт вся текущая
работа: одна VPS с Caddy, Go API и Postgres, фронт ходит в Go API напрямую;
дизайн в `docs/superpowers/specs/2026-09-29-mvp-single-vps-design.md`.
**BFF: две VPS** заморожена в `diagrams/bff/`, её схемы не правятся; дизайн
в `docs/superpowers/specs/2026-09-16-mvp-compose-design.md`. **Frozen: k3s**
заморожена в `diagrams/frozen-k3s/`, её схемы не правятся; дизайн в
`docs/superpowers/specs/2026-09-15-frontend-monorepo-design.md`.

MVP (`diagrams/`):

| Схема | Что показывает |
| --- | --- |
| [deployment](https://cringe-driven-development-team.github.io/docs/deployment.html) | Одна VPS в Selectel: Caddy, Go API, Postgres; S3/CDN, клиент |
| [ci](https://cringe-driven-development-team.github.io/docs/ci.html) | GitHub-репозитории, CI-пайплайны, Contract drift, GHCR, S3 |
| [cd](https://cringe-driven-development-team.github.io/docs/cd.html) | CD фронта через S3, откат, CD бэка через ansible-playbook |
| [frontend](https://cringe-driven-development-team.github.io/docs/frontend.html) | Репа клиента, контракт из Apidog, модель релизов |
| [infra](https://cringe-driven-development-team.github.io/docs/infra.html) | Проекты Selectel, стейт Pulumi, домен; Pulumi и Ansible с ноута студента |

BFF: две VPS (`diagrams/bff/`):

| Схема | Что показывает |
| --- | --- |
| [deployment](https://cringe-driven-development-team.github.io/docs/bff/deployment.html) | Два VPS в Selectel с Docker Compose, S3/CDN, клиент |
| [ci](https://cringe-driven-development-team.github.io/docs/bff/ci.html) | GitHub-репозитории, CI-пайплайны, GHCR, S3 |
| [cd](https://cringe-driven-development-team.github.io/docs/bff/cd.html) | CD и откат через ansible-playbook из GitHub Actions |
| [frontend-monorepo](https://cringe-driven-development-team.github.io/docs/bff/frontend-monorepo.html) | Монорепа клиента и BFF, контракт tRPC, модель релизов |
| [infra](https://cringe-driven-development-team.github.io/docs/bff/infra.html) | Проекты Selectel, стейт Pulumi, домен; две VPS |
```

Таблицу Frozen: k3s и текст после неё не трогай.

- [ ] **Step 4: CLAUDE.md**

Строку 10 `CLAUDE.md` замени на:

```markdown
- Рабочие схемы MVP — в корне `diagrams/`. `diagrams/bff/` и `diagrams/frozen-k3s/` заморожены, не правятся.
```

- [ ] **Step 5: Скилл**

В `.claude/skills/eraser-diagrams/SKILL.md` замени предложения

```
Новые схемы кладутся в корень `diagrams/`. Папка
`diagrams/frozen-k3s/` заморожена: файлы в ней не правятся, для новой
архитектуры на её основе заводится новая схема в корне.
```

на

```
Новые схемы кладутся в корень `diagrams/`. Папки
`diagrams/bff/` и `diagrams/frozen-k3s/` заморожены: файлы в них не
правятся, для новой архитектуры на их основе заводится новая схема в корне.
```

- [ ] **Step 6: Сборка без схем в корне**

Run: `bun run typecheck && bun run test && bun run build`
Expected: всё зелёное; `dist/bff/deployment.png` существует; в `dist/index.html` метки табов `bff` и `frozen-k3s` (таба `mvp` пока нет — корень пуст, это нормально).

- [ ] **Step 7: Commit**

```bash
git add -A diagrams README.md CLAUDE.md .claude/skills/eraser-diagrams/SKILL.md
git commit -m "docs(diagrams): заморозить вариант с BFF в diagrams/bff/

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Схема `diagrams/deployment.json`

**Files:**
- Create: `diagrams/deployment.json`

**Interfaces:**
- Consumes: строка README из Task 1; пайплайн `bun run validate|check|warm|render|build`.
- Produces: `dist/deployment.html`, `dist/deployment.png`.

- [ ] **Step 1: Прочитай скилл и прежнюю схему**

Прочитай `.claude/skills/eraser-diagrams/SKILL.md` и `diagrams/bff/deployment.json` (эталон стиля).

- [ ] **Step 2: Создай `diagrams/deployment.json`**

Стартовая раскладка (координаты правит Step 7):

```json
{
  "entities": [
    { "tag": "Icon", "id": "client", "x": 60, "y": 200, "icon": "chrome", "texts": [{ "text": "Client (браузер)" }] },

    { "tag": "Group", "id": "selectel", "color": "blue", "x": 300, "y": 0, "width": 760, "height": 480, "isContainer": true, "title": { "text": "Selectel", "icon": "cloud" } },

    { "tag": "Group", "id": "vps", "color": "blue", "styleMode": "plain", "x": 320, "y": 40, "width": 440, "height": 160, "containerId": "selectel", "isContainer": true, "title": { "text": "VPS · Docker Compose", "icon": "docker" } },
    { "tag": "Icon", "id": "vps-caddy", "x": 340, "y": 80, "containerId": "vps", "icon": "server", "texts": [{ "text": "Caddy" }] },
    { "tag": "Icon", "id": "vps-go", "x": 480, "y": 80, "containerId": "vps", "icon": "go", "texts": [{ "text": "Go API" }] },
    { "tag": "Icon", "id": "vps-postgres", "x": 620, "y": 80, "containerId": "vps", "icon": "postgres", "texts": [{ "text": "Postgres" }] },

    { "tag": "Icon", "id": "cdn", "x": 340, "y": 320, "containerId": "selectel", "icon": "cloud", "texts": [{ "text": "CDN static.site.ru" }] },
    { "tag": "Icon", "id": "s3", "x": 620, "y": 320, "containerId": "selectel", "icon": "database", "texts": [{ "text": "S3: releases/{sha}/, index.html, current.json" }] },
    { "tag": "Icon", "id": "domain", "x": 900, "y": 320, "containerId": "selectel", "icon": "globe", "texts": [{ "text": "site.ru" }] },

    { "tag": "Legend", "id": "legend", "x": 1120, "y": 0, "width": 340, "entries": [{ "text": "Наша инфраструктура", "color": "#2866c4" }, { "text": "Пользовательский трафик", "color": "#c38424" }, { "text": "Прочие связи", "color": "#1c1c1c" }] }
  ],
  "connections": [
    { "tag": "Relationship", "from": "client", "to": "vps-caddy", "label": "https://site.ru: HTML, /api/v1", "color": "orange", "lineStyle": "solid" },
    { "tag": "Relationship", "from": "client", "to": "cdn", "label": "https://static.site.ru", "color": "orange", "lineStyle": "solid" },
    { "tag": "Relationship", "from": "vps-caddy", "to": "vps-go", "label": "/api/v1/*" },
    { "tag": "Relationship", "from": "vps-caddy", "to": "s3", "label": "index.html" },
    { "tag": "Relationship", "from": "vps-go", "to": "vps-postgres" },
    { "tag": "Relationship", "from": "s3", "to": "cdn", "label": "static" }
  ]
}
```

- [ ] **Step 3: Валидация**

Run: `bun run validate`
Expected: успех, без `W_CONTENT_SANITIZED`. При ошибке — исправь JSON по сообщению и повтори.

- [ ] **Step 4: Цвета и легенда**

Run: `bun run check`
Expected: успех. Если `check` печатает массив `entries` для `deployment` — скопируй его в `legend.entries` дословно и повтори.

- [ ] **Step 5: Прогрев иконок**

Run: `bun run warm`
Expected: успех, без `unknown icon`.

- [ ] **Step 6: Рендер**

Run: `bun run render`
Expected: `dist/deployment.html` и `dist/deployment.png`.

- [ ] **Step 7: Осмотр PNG и правка координат (цикл)**

Открой `dist/deployment.png` через Read. Проверь: узлы не накладываются; Caddy, Go API, Postgres внутри рамки VPS; CDN, S3, site.ru внутри Selectel и вне VPS; подпись S3 не налезает на соседей; все 5 подписей стрелок читаемы, `/api/v1/*` видна со звёздочкой (не курсив); легенда ничего не перекрывает. При проблеме правь координаты и размеры (кратно 20; сдвигая узел, сдвигай рамку его группы), по одному параметру за раз, повторяй шаги 3–7.

- [ ] **Step 8: Commit**

```bash
git add diagrams/deployment.json
git commit -m "feat(diagrams): deployment — одна VPS: Caddy, Go API, Postgres

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Схема `diagrams/infra.json`

**Files:**
- Create: `diagrams/infra.json`

**Interfaces:**
- Consumes: `diagrams/bff/infra.json` как основа; пайплайн.
- Produces: `dist/infra.html`, `dist/infra.png`.

- [ ] **Step 1: Прочитай скилл и прежнюю схему**

Прочитай `.claude/skills/eraser-diagrams/SKILL.md` и `diagrams/bff/infra.json`.

- [ ] **Step 2: Создай `diagrams/infra.json`**

Отличия от `bff/infra.json`: вместо `vps1` и `vps2` одна `vps`, нет связи через ProxyCommand. Стартовая раскладка:

```json
{
  "entities": [
    { "tag": "Group", "id": "laptop", "color": "white", "x": 0, "y": 0, "width": 300, "height": 860, "isContainer": true, "title": { "text": "Ноут студента", "icon": "laptop" } },
    { "tag": "Textbox", "id": "laptop-note", "x": 20, "y": 40, "width": 260, "containerId": "laptop", "text": "`~/.config/selectel.env` (личный сервисный пользователь, личный S3-ключ стейта, passphrase), `ansible/clouds.yaml`, `~/.ssh/selectel_release`" },
    { "tag": "Icon", "id": "stack-bootstrap", "x": 100, "y": 200, "containerId": "laptop", "icon": "pulumi", "texts": [{ "text": "pulumi/bootstrap · стек main" }] },
    { "tag": "Icon", "id": "stack-main", "x": 100, "y": 340, "containerId": "laptop", "icon": "pulumi", "texts": [{ "text": "pulumi · стек prod" }] },
    { "tag": "Icon", "id": "ansible", "x": 100, "y": 700, "containerId": "laptop", "icon": "ansible", "texts": [{ "text": "Ansible" }] },

    { "tag": "Group", "id": "selectel", "color": "blue", "x": 800, "y": 60, "width": 940, "height": 960, "isContainer": true, "title": { "text": "Selectel", "icon": "cloud" } },

    { "tag": "Group", "id": "infra-shared", "color": "blue", "styleMode": "plain", "x": 820, "y": 100, "width": 440, "height": 300, "containerId": "selectel", "isContainer": true, "title": { "text": "Проект infra-shared" } },
    { "tag": "Icon", "id": "state-bucket", "x": 920, "y": 140, "containerId": "infra-shared", "icon": "database", "texts": [{ "text": "S3 cdd-infra-state · ru-7: bootstrap/, main/" }] },
    { "tag": "Icon", "id": "dns-zone", "x": 1120, "y": 140, "containerId": "infra-shared", "icon": "globe", "texts": [{ "text": "DNS-зона cellestial.ru." }] },

    { "tag": "Icon", "id": "domain", "x": 1560, "y": 140, "containerId": "selectel", "icon": "globe", "texts": [{ "text": "cellestial.ru · регистрация" }] },

    { "tag": "Group", "id": "pulumi-cellestial", "color": "blue", "styleMode": "plain", "x": 820, "y": 460, "width": 900, "height": 520, "containerId": "selectel", "isContainer": true, "title": { "text": "Проект pulumi-cellestial" } },
    { "tag": "Icon", "id": "vps", "x": 1120, "y": 600, "containerId": "pulumi-cellestial", "icon": "server", "texts": [{ "text": "VPS · floating IP, Caddy + Let’s Encrypt, Docker Compose" }] },
    { "tag": "Icon", "id": "product-bucket", "x": 1560, "y": 800, "containerId": "pulumi-cellestial", "icon": "database", "texts": [{ "text": "Бакет продукта" }] },

    { "tag": "Legend", "id": "legend", "x": 1780, "y": 0, "width": 340, "entries": [{ "text": "Наша инфраструктура", "color": "#2866c4" }, { "text": "Рабочее место", "color": "#242424" }, { "text": "Прочие связи", "color": "#1c1c1c" }] }
  ],
  "connections": [
    { "tag": "Relationship", "from": "stack-bootstrap", "to": "infra-shared", "label": "pulumi up: проект, бакет, DNS-зона" },
    { "tag": "Relationship", "from": "stack-bootstrap", "to": "state-bucket", "label": "стейт bootstrap/" },
    { "tag": "Relationship", "from": "stack-main", "to": "pulumi-cellestial", "label": "pulumi up: проект, сеть, VPS, бакет" },
    { "tag": "Relationship", "from": "stack-main", "to": "state-bucket", "label": "стейт main/" },
    { "tag": "Relationship", "from": "stack-main", "to": "dns-zone", "label": "A-запись" },
    { "tag": "Relationship", "from": "domain", "to": "dns-zone", "label": "NS" },
    { "tag": "Relationship", "from": "dns-zone", "to": "vps", "label": "cellestial.ru → floating IP" },
    { "tag": "Relationship", "from": "ansible", "to": "pulumi-cellestial", "label": "dynamic inventory (clouds.yaml)" },
    { "tag": "Relationship", "from": "ansible", "to": "vps", "label": "ssh под deploy" }
  ]
}
```

- [ ] **Step 3: Валидация**

Run: `bun run validate`
Expected: успех, без `W_CONTENT_SANITIZED`.

- [ ] **Step 4: Цвета и легенда**

Run: `bun run check`
Expected: успех; при напечатанном `entries` для `infra` — скопируй в легенду и повтори.

- [ ] **Step 5: Прогрев иконок**

Run: `bun run warm`
Expected: успех, без `unknown icon`.

- [ ] **Step 6: Рендер**

Run: `bun run render`
Expected: `dist/infra.html` и `dist/infra.png`.

- [ ] **Step 7: Осмотр PNG и правка координат (цикл)**

Открой `dist/infra.png` через Read. Проверь: после удаления VPS 2 в `pulumi-cellestial` нет лишней пустоты (при желании уменьши рамку и сдвинь `product-bucket`, сохраняя его внутри); подпись `vps` в 3–5 строк не налезает на соседей и рамку; все 9 подписей стрелок читаемы; в подписи ноута ничего не зачёркнуто; легенда ничего не перекрывает. Правь по одному параметру, повторяй шаги 3–7.

- [ ] **Step 8: Commit**

```bash
git add diagrams/infra.json
git commit -m "feat(diagrams): infra — одна VPS в проекте pulumi-cellestial

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Схема `diagrams/cd.json`

**Files:**
- Create: `diagrams/cd.json`

**Interfaces:**
- Consumes: пайплайн.
- Produces: `dist/cd.html`, `dist/cd.png`.

- [ ] **Step 1: Прочитай скилл и прежнюю схему**

Прочитай `.claude/skills/eraser-diagrams/SKILL.md` и `diagrams/bff/cd.json`.

- [ ] **Step 2: Создай `diagrams/cd.json`**

```json
{
  "entities": [
    { "tag": "Group", "id": "actions", "color": "purple", "x": 0, "y": 0, "width": 680, "height": 580, "isContainer": true, "title": { "text": "GitHub Actions", "icon": "github-actions" } },

    { "tag": "Group", "id": "frontend-cd", "color": "purple", "styleMode": "plain", "x": 20, "y": 40, "width": 640, "height": 120, "containerId": "actions", "isContainer": true, "title": { "text": "Frontend CD" } },
    { "tag": "Activity", "id": "fd-promote", "x": 40, "y": 80, "width": 120, "height": 60, "containerId": "frontend-cd", "texts": [{ "text": "Promote to stable" }] },
    { "tag": "Activity", "id": "fd-health", "x": 200, "y": 80, "width": 120, "height": 60, "containerId": "frontend-cd", "texts": [{ "text": "Health check" }] },
    { "tag": "Activity", "id": "fd-retention", "x": 360, "y": 80, "width": 120, "height": 60, "containerId": "frontend-cd", "texts": [{ "text": "Retention: 5 релизов" }] },
    { "tag": "Activity", "id": "fd-tg", "x": 520, "y": 80, "width": 120, "height": 60, "containerId": "frontend-cd", "texts": [{ "text": "Send to tg" }] },

    { "tag": "Group", "id": "frontend-rollback", "color": "purple", "styleMode": "plain", "x": 20, "y": 240, "width": 480, "height": 120, "containerId": "actions", "isContainer": true, "title": { "text": "Frontend Rollback" } },
    { "tag": "Activity", "id": "fr-switch", "x": 40, "y": 280, "width": 120, "height": 60, "containerId": "frontend-rollback", "texts": [{ "text": "Switch release pointer" }] },
    { "tag": "Activity", "id": "fr-health", "x": 200, "y": 280, "width": 120, "height": 60, "containerId": "frontend-rollback", "texts": [{ "text": "Health check" }] },
    { "tag": "Activity", "id": "fr-tg", "x": 360, "y": 280, "width": 120, "height": 60, "containerId": "frontend-rollback", "texts": [{ "text": "Send to tg" }] },

    { "tag": "Group", "id": "backend-cd", "color": "purple", "styleMode": "plain", "x": 20, "y": 440, "width": 480, "height": 120, "containerId": "actions", "isContainer": true, "title": { "text": "Backend CD" } },
    { "tag": "Activity", "id": "be-playbook", "x": 40, "y": 480, "width": 120, "height": 60, "containerId": "backend-cd", "texts": [{ "text": "Run ansible playbook" }] },
    { "tag": "Activity", "id": "be-health", "x": 200, "y": 480, "width": 120, "height": 60, "containerId": "backend-cd", "texts": [{ "text": "Health check" }] },
    { "tag": "Activity", "id": "be-tg", "x": 360, "y": 480, "width": 120, "height": 60, "containerId": "backend-cd", "texts": [{ "text": "Send to tg" }] },

    { "tag": "Icon", "id": "deployments-repo", "x": 900, "y": 60, "icon": "ansible", "texts": [{ "text": "Deployments repo" }] },

    { "tag": "Group", "id": "selectel", "color": "blue", "x": 880, "y": 200, "width": 180, "height": 360, "isContainer": true, "title": { "text": "Selectel", "icon": "cloud" } },
    { "tag": "Icon", "id": "s3", "x": 900, "y": 240, "containerId": "selectel", "icon": "database", "texts": [{ "text": "S3" }] },
    { "tag": "Icon", "id": "vps", "x": 900, "y": 420, "containerId": "selectel", "icon": "docker", "texts": [{ "text": "VPS · Docker Compose" }] },

    { "tag": "Icon", "id": "ghcr", "x": 1180, "y": 420, "icon": "docker", "texts": [{ "text": "GHCR" }] },
    { "tag": "Icon", "id": "telegram", "x": 900, "y": 700, "icon": "telegram", "texts": [{ "text": "Telegram" }] },

    { "tag": "Legend", "id": "legend", "x": 1340, "y": 0, "width": 340, "entries": [{ "text": "Наша инфраструктура", "color": "#2866c4" }, { "text": "GitHub", "color": "#c43dcf" }, { "text": "Пайплайн и внешние системы, пунктир", "color": "#3a3a3a" }, { "text": "Алерты и уведомления, точки", "color": "#bd413a" }, { "text": "Прочие связи", "color": "#1c1c1c" }] }
  ],
  "connections": [
    { "tag": "Relationship", "from": "fd-promote", "to": "fd-health" },
    { "tag": "Relationship", "from": "fd-health", "to": "fd-retention" },
    { "tag": "Relationship", "from": "fd-retention", "to": "fd-tg" },
    { "tag": "Relationship", "from": "fr-switch", "to": "fr-health" },
    { "tag": "Relationship", "from": "fr-health", "to": "fr-tg" },
    { "tag": "Relationship", "from": "be-playbook", "to": "be-health" },
    { "tag": "Relationship", "from": "be-health", "to": "be-tg" },

    { "tag": "Relationship", "from": "fd-promote", "to": "s3", "label": "index.html, current.json", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "fd-retention", "to": "s3", "label": "releases/", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "fr-switch", "to": "s3", "label": "index.html, current.json", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "be-playbook", "to": "deployments-repo", "label": "playbook, vault", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "be-playbook", "to": "vps", "label": "ssh: pull backend:sha-{short}, compose up", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "vps", "to": "ghcr", "label": "pull" },
    { "tag": "Relationship", "from": "actions", "to": "telegram", "label": "Send to tg", "color": "red", "lineStyle": "dotted" }
  ]
}
```

- [ ] **Step 3: Валидация**

Run: `bun run validate`
Expected: успех, без `W_CONTENT_SANITIZED`.

- [ ] **Step 4: Цвета и легенда**

Run: `bun run check`
Expected: успех; при напечатанном `entries` для `cd` — скопируй в легенду и повтори.

- [ ] **Step 5: Прогрев иконок**

Run: `bun run warm`
Expected: успех.

- [ ] **Step 6: Рендер**

Run: `bun run render`
Expected: `dist/cd.html` и `dist/cd.png`.

- [ ] **Step 7: Осмотр PNG и правка координат (цикл)**

Открой `dist/cd.png` через Read. Проверь: три пайплайна внутри своих рамок; стрелки в S3 из Promote, Retention и Switch не кладут подписи друг на друга (скилл, раздел «Раскладка»: сдвигай цель, а не источник); подпись `ssh: pull backend:sha-{short}, compose up` читаема целиком; левый верхний угол `actions` свободен (к нему идёт стрелка к Telegram); легенда ничего не перекрывает. Правь по одному параметру, повторяй шаги 3–7.

- [ ] **Step 8: Commit**

```bash
git add diagrams/cd.json
git commit -m "feat(diagrams): cd — фронт через S3, бэк через ansible на одну VPS

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Схема `diagrams/ci.json`

**Files:**
- Create: `diagrams/ci.json`

**Interfaces:**
- Consumes: `diagrams/bff/ci.json` как основа для React, Static и Deployments repo; пайплайн.
- Produces: `dist/ci.html`, `dist/ci.png`.

- [ ] **Step 1: Прочитай скилл и прежнюю схему**

Прочитай `.claude/skills/eraser-diagrams/SKILL.md` и `diagrams/bff/ci.json`.

- [ ] **Step 2: Создай `diagrams/ci.json`**

```json
{
  "entities": [
    { "tag": "Group", "id": "github", "color": "purple", "x": 0, "y": 0, "width": 880, "height": 1160, "isContainer": true, "title": { "text": "GitHub", "icon": "github" } },

    { "tag": "Group", "id": "repo-react", "color": "purple", "styleMode": "plain", "x": 20, "y": 40, "width": 840, "height": 180, "containerId": "github", "isContainer": true, "title": { "text": "React repo", "icon": "react" } },
    { "tag": "Group", "id": "react-release", "color": "purple", "styleMode": "plain", "x": 40, "y": 80, "width": 800, "height": 120, "containerId": "repo-react", "isContainer": true, "title": { "text": "React release" } },
    { "tag": "Activity", "id": "react-install", "x": 60, "y": 120, "width": 120, "height": 60, "containerId": "react-release", "texts": [{ "text": "Install deps" }] },
    { "tag": "Activity", "id": "react-lint", "x": 220, "y": 120, "width": 120, "height": 60, "containerId": "react-release", "texts": [{ "text": "Lint" }] },
    { "tag": "Activity", "id": "react-build", "x": 380, "y": 120, "width": 120, "height": 60, "containerId": "react-release", "texts": [{ "text": "Build" }] },
    { "tag": "Activity", "id": "react-deploy-npm", "x": 540, "y": 120, "width": 120, "height": 60, "containerId": "react-release", "texts": [{ "text": "Deploy to NPM" }] },
    { "tag": "Activity", "id": "react-tg", "x": 700, "y": 120, "width": 120, "height": 60, "containerId": "react-release", "texts": [{ "text": "Send to tg" }] },

    { "tag": "Group", "id": "repo-frontend", "color": "purple", "styleMode": "plain", "x": 20, "y": 240, "width": 840, "height": 180, "containerId": "github", "isContainer": true, "title": { "text": "Frontend repo", "icon": "react" } },
    { "tag": "Group", "id": "fe-ci", "color": "purple", "styleMode": "plain", "x": 40, "y": 280, "width": 800, "height": 120, "containerId": "repo-frontend", "isContainer": true, "title": { "text": "CI" } },
    { "tag": "Activity", "id": "fe-install", "x": 60, "y": 320, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "bun install" }] },
    { "tag": "Activity", "id": "fe-check", "x": 220, "y": 320, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "lint · typecheck · test" }] },
    { "tag": "Activity", "id": "fe-vite-build", "x": 380, "y": 320, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "vite build" }] },
    { "tag": "Activity", "id": "fe-upload-release", "x": 540, "y": 320, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "Upload release (main)" }] },
    { "tag": "Activity", "id": "fe-tg", "x": 700, "y": 320, "width": 120, "height": 60, "containerId": "fe-ci", "texts": [{ "text": "Send to tg" }] },

    { "tag": "Group", "id": "repo-backend", "color": "purple", "styleMode": "plain", "x": 20, "y": 440, "width": 840, "height": 320, "containerId": "github", "isContainer": true, "title": { "text": "Backend repo", "icon": "go" } },
    { "tag": "Group", "id": "be-ci", "color": "purple", "styleMode": "plain", "x": 40, "y": 480, "width": 800, "height": 120, "containerId": "repo-backend", "isContainer": true, "title": { "text": "CI" } },
    { "tag": "Activity", "id": "be-lint", "x": 60, "y": 520, "width": 120, "height": 60, "containerId": "be-ci", "texts": [{ "text": "golangci-lint" }] },
    { "tag": "Activity", "id": "be-test", "x": 220, "y": 520, "width": 120, "height": 60, "containerId": "be-ci", "texts": [{ "text": "go test -race" }] },
    { "tag": "Activity", "id": "be-build-image", "x": 380, "y": 520, "width": 120, "height": 60, "containerId": "be-ci", "texts": [{ "text": "Build image" }] },
    { "tag": "Activity", "id": "be-push-image", "x": 540, "y": 520, "width": 120, "height": 60, "containerId": "be-ci", "texts": [{ "text": "Push image (main)" }] },
    { "tag": "Activity", "id": "be-tg", "x": 700, "y": 520, "width": 120, "height": 60, "containerId": "be-ci", "texts": [{ "text": "Send to tg" }] },
    { "tag": "Group", "id": "be-drift", "color": "purple", "styleMode": "plain", "x": 40, "y": 620, "width": 320, "height": 120, "containerId": "repo-backend", "isContainer": true, "title": { "text": "Contract drift (nightly)" } },
    { "tag": "Activity", "id": "be-generate", "x": 60, "y": 660, "width": 120, "height": 60, "containerId": "be-drift", "texts": [{ "text": "make generate" }] },
    { "tag": "Activity", "id": "be-compare", "x": 220, "y": 660, "width": 120, "height": 60, "containerId": "be-drift", "texts": [{ "text": "Compare with code" }] },

    { "tag": "Group", "id": "repo-static", "color": "purple", "styleMode": "plain", "x": 20, "y": 780, "width": 360, "height": 180, "containerId": "github", "isContainer": true, "title": { "text": "Static repo", "icon": "box" } },
    { "tag": "Group", "id": "static-pipeline", "color": "purple", "styleMode": "plain", "x": 40, "y": 820, "width": 320, "height": 120, "containerId": "repo-static", "isContainer": true, "title": { "text": "Static" } },
    { "tag": "Activity", "id": "static-deploy-s3", "x": 60, "y": 860, "width": 120, "height": 60, "containerId": "static-pipeline", "texts": [{ "text": "Deploy to S3" }] },
    { "tag": "Activity", "id": "static-tg", "x": 220, "y": 860, "width": 120, "height": 60, "containerId": "static-pipeline", "texts": [{ "text": "Send to tg" }] },

    { "tag": "Group", "id": "repo-deployments", "color": "purple", "styleMode": "plain", "x": 20, "y": 980, "width": 740, "height": 160, "containerId": "github", "isContainer": true, "title": { "text": "Deployments repo", "icon": "ansible" } },
    { "tag": "Icon", "id": "dep-pulumi", "x": 40, "y": 1020, "containerId": "repo-deployments", "icon": "pulumi", "texts": [{ "text": "Pulumi configs" }] },
    { "tag": "Icon", "id": "dep-ansible", "x": 180, "y": 1020, "containerId": "repo-deployments", "icon": "ansible", "texts": [{ "text": "ansible roles / playbooks" }] },
    { "tag": "Icon", "id": "dep-vault", "x": 320, "y": 1020, "containerId": "repo-deployments", "icon": "ansible", "texts": [{ "text": "ansible vault" }] },
    { "tag": "Icon", "id": "dep-compose", "x": 460, "y": 1020, "containerId": "repo-deployments", "icon": "docker", "texts": [{ "text": "docker-compose.yml" }] },
    { "tag": "Icon", "id": "dep-caddyfile", "x": 600, "y": 1020, "containerId": "repo-deployments", "icon": "server", "texts": [{ "text": "Caddyfile" }] },

    { "tag": "Group", "id": "npm-registry", "color": "green", "x": 980, "y": 40, "width": 200, "height": 160, "isContainer": true, "title": { "text": "NPM Registry", "icon": "npm" } },
    { "tag": "Icon", "id": "npm-react", "x": 1000, "y": 80, "containerId": "npm-registry", "icon": "npm", "texts": [{ "text": "@my/react" }] },

    { "tag": "Icon", "id": "s3", "x": 1000, "y": 280, "icon": "database", "texts": [{ "text": "S3" }] },

    { "tag": "Group", "id": "ghcr", "color": "green", "x": 980, "y": 440, "width": 200, "height": 160, "isContainer": true, "title": { "text": "GHCR", "icon": "docker" } },
    { "tag": "Icon", "id": "reg-backend", "x": 1000, "y": 480, "containerId": "ghcr", "icon": "docker", "texts": [{ "text": "backend:sha-{short}" }] },

    { "tag": "Group", "id": "apidog", "color": "green", "x": 980, "y": 620, "width": 200, "height": 160, "isContainer": true, "title": { "text": "Apidog", "icon": "cloud" } },
    { "tag": "Icon", "id": "apidog-spec", "x": 1000, "y": 660, "containerId": "apidog", "icon": "file-code", "texts": [{ "text": "openapi.yaml" }] },

    { "tag": "Icon", "id": "telegram", "x": 1000, "y": 1000, "icon": "telegram", "texts": [{ "text": "Telegram" }] },

    { "tag": "Legend", "id": "legend", "x": 1240, "y": 0, "width": 340, "entries": [{ "text": "GitHub", "color": "#c43dcf" }, { "text": "Внешние сервисы", "color": "#30a050" }, { "text": "Пайплайн и внешние системы, пунктир", "color": "#3a3a3a" }, { "text": "Алерты и уведомления, точки", "color": "#bd413a" }, { "text": "Прочие связи", "color": "#1c1c1c" }] }
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
    { "tag": "Relationship", "from": "be-lint", "to": "be-test" },
    { "tag": "Relationship", "from": "be-test", "to": "be-build-image" },
    { "tag": "Relationship", "from": "be-build-image", "to": "be-push-image" },
    { "tag": "Relationship", "from": "be-push-image", "to": "be-tg" },
    { "tag": "Relationship", "from": "be-generate", "to": "be-compare" },
    { "tag": "Relationship", "from": "static-deploy-s3", "to": "static-tg" },

    { "tag": "Relationship", "from": "react-deploy-npm", "to": "npm-react", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "fe-upload-release", "to": "s3", "label": "releases/{sha}/", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "be-push-image", "to": "reg-backend", "label": "tags: sha-{short}, main", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "be-generate", "to": "apidog-spec", "label": "export", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "static-deploy-s3", "to": "s3", "color": "black", "lineStyle": "dashed" },
    { "tag": "Relationship", "from": "github", "to": "telegram", "label": "Send to tg", "color": "red", "lineStyle": "dotted" }
  ]
}
```

- [ ] **Step 3: Валидация**

Run: `bun run validate`
Expected: успех, без `W_CONTENT_SANITIZED`.

- [ ] **Step 4: Цвета и легенда**

Run: `bun run check`
Expected: успех; при напечатанном `entries` для `ci` — скопируй в легенду и повтори.

- [ ] **Step 5: Прогрев иконок**

Run: `bun run warm`
Expected: успех, без `unknown icon` (`file-code` уже используется в `bff/frontend-monorepo.json`).

- [ ] **Step 6: Рендер**

Run: `bun run render`
Expected: `dist/ci.html` и `dist/ci.png`.

- [ ] **Step 7: Осмотр PNG и правка координат (цикл)**

Открой `dist/ci.png` через Read. Проверь: все пайплайны и иконки внутри своих рамок; `Contract drift (nightly)` не обрезан; стрелка `make generate` → `openapi.yaml` и `Push image` → `backend:sha-{short}` не кладут подписи друг на друга; стрелка из `Static` в S3 не пересекает подписи; левый верхний угол `github` свободен; легенда ничего не перекрывает. Правь по одному параметру, повторяй шаги 3–7.

- [ ] **Step 8: Commit**

```bash
git add diagrams/ci.json
git commit -m "feat(diagrams): ci — репа фронта без BFF, CI бэка и Contract drift из Apidog

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Схема `diagrams/frontend.json`

**Files:**
- Create: `diagrams/frontend.json`

**Interfaces:**
- Consumes: строка README `frontend` из Task 1; пайплайн.
- Produces: `dist/frontend.html`, `dist/frontend.png`.

- [ ] **Step 1: Прочитай скилл и прежнюю схему**

Прочитай `.claude/skills/eraser-diagrams/SKILL.md` и `diagrams/bff/frontend-monorepo.json`.

- [ ] **Step 2: Создай `diagrams/frontend.json`**

```json
{
  "entities": [
    { "tag": "Group", "id": "github", "color": "purple", "x": 0, "y": 0, "width": 860, "height": 400, "isContainer": true, "title": { "text": "GitHub", "icon": "github" } },

    { "tag": "Group", "id": "repo-frontend", "color": "purple", "styleMode": "plain", "x": 20, "y": 40, "width": 600, "height": 340, "containerId": "github", "isContainer": true, "title": { "text": "Frontend repo", "icon": "react" } },
    { "tag": "Icon", "id": "fe-react", "x": 60, "y": 80, "containerId": "repo-frontend", "icon": "react", "texts": [{ "text": "React" }] },
    { "tag": "Icon", "id": "fe-router", "x": 200, "y": 80, "containerId": "repo-frontend", "icon": "layers", "texts": [{ "text": "TanStack Router" }] },
    { "tag": "Icon", "id": "fe-zustand", "x": 340, "y": 80, "containerId": "repo-frontend", "icon": "package", "texts": [{ "text": "zustand" }] },
    { "tag": "Icon", "id": "fe-api-client", "x": 480, "y": 80, "containerId": "repo-frontend", "icon": "file-code", "texts": [{ "text": "API-клиент · openapi-fetch" }] },
    { "tag": "Group", "id": "fe-pipeline", "color": "purple", "styleMode": "plain", "x": 40, "y": 240, "width": 520, "height": 120, "containerId": "repo-frontend", "isContainer": true, "title": { "text": "CI" } },
    { "tag": "Activity", "id": "fe-install", "x": 60, "y": 280, "width": 120, "height": 60, "containerId": "fe-pipeline", "texts": [{ "text": "bun install" }] },
    { "tag": "Activity", "id": "fe-check", "x": 220, "y": 280, "width": 120, "height": 60, "containerId": "fe-pipeline", "texts": [{ "text": "lint · typecheck · test" }] },
    { "tag": "Activity", "id": "fe-vite-build", "x": 380, "y": 280, "width": 120, "height": 60, "containerId": "fe-pipeline", "texts": [{ "text": "vite build" }] },

    { "tag": "Group", "id": "repo-backend", "color": "purple", "styleMode": "plain", "x": 640, "y": 220, "width": 200, "height": 160, "containerId": "github", "isContainer": true, "title": { "text": "Backend repo", "icon": "go" } },
    { "tag": "Icon", "id": "be-oapi", "x": 680, "y": 260, "containerId": "repo-backend", "icon": "go", "texts": [{ "text": "oapi-codegen: strict server" }] },

    { "tag": "Group", "id": "apidog", "color": "green", "x": 940, "y": 40, "width": 200, "height": 160, "isContainer": true, "title": { "text": "Apidog", "icon": "cloud" } },
    { "tag": "Icon", "id": "apidog-spec", "x": 960, "y": 80, "containerId": "apidog", "icon": "file-code", "texts": [{ "text": "openapi.yaml" }] },

    { "tag": "Icon", "id": "client", "x": 0, "y": 700, "icon": "chrome", "texts": [{ "text": "Client (браузер)" }] },

    { "tag": "Group", "id": "selectel", "color": "blue", "x": 300, "y": 520, "width": 480, "height": 360, "isContainer": true, "title": { "text": "Selectel", "icon": "cloud" } },
    { "tag": "Icon", "id": "cdn", "x": 340, "y": 560, "containerId": "selectel", "icon": "cloud", "texts": [{ "text": "CDN static.site.ru" }] },
    { "tag": "Icon", "id": "s3", "x": 620, "y": 560, "containerId": "selectel", "icon": "database", "texts": [{ "text": "S3: releases/{sha}/, index.html, current.json" }] },
    { "tag": "Group", "id": "vps", "color": "blue", "styleMode": "plain", "x": 320, "y": 700, "width": 300, "height": 160, "containerId": "selectel", "isContainer": true, "title": { "text": "VPS · Docker Compose", "icon": "docker" } },
    { "tag": "Icon", "id": "caddy", "x": 340, "y": 740, "containerId": "vps", "icon": "server", "texts": [{ "text": "Caddy" }] },
    { "tag": "Icon", "id": "go-api", "x": 480, "y": 740, "containerId": "vps", "icon": "go", "texts": [{ "text": "Go API" }] },

    { "tag": "Textbox", "id": "rules", "x": 860, "y": 520, "width": 480, "text": "**Правила выкатки**\n\n1. Контракт меняется в Apidog; бэк и фронт генерируют код из openapi.yaml\n2. Go API N+1 обслуживает клиента N: ручки и поля не удаляются в том же релизе\n3. Автоперезагрузки нет, вкладка живёт на чанках своего релиза\n4. В S3 последние 5 релизов, stable и previous не удаляются\n5. Откат клиента: stable ← previous, index.html ← релиз previous" },

    { "tag": "Legend", "id": "legend", "x": 1400, "y": 0, "width": 340, "entries": [{ "text": "Наша инфраструктура", "color": "#2866c4" }, { "text": "GitHub", "color": "#c43dcf" }, { "text": "Внешние сервисы", "color": "#30a050" }, { "text": "Пользовательский трафик", "color": "#c38424" }, { "text": "Пайплайн и внешние системы, пунктир", "color": "#3a3a3a" }, { "text": "Прочие связи", "color": "#1c1c1c" }] }
  ],
  "connections": [
    { "tag": "Relationship", "from": "fe-install", "to": "fe-check" },
    { "tag": "Relationship", "from": "fe-check", "to": "fe-vite-build" },
    { "tag": "Relationship", "from": "apidog-spec", "to": "fe-api-client", "label": "типы" },
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

- [ ] **Step 3: Валидация**

Run: `bun run validate`
Expected: успех, без `W_CONTENT_SANITIZED` (в `rules` нет `<`, `'` и `~`).

- [ ] **Step 4: Цвета и легенда**

Run: `bun run check`
Expected: успех; при напечатанном `entries` для `frontend` — скопируй в легенду и повтори.

- [ ] **Step 5: Прогрев иконок**

Run: `bun run warm`
Expected: успех, без `unknown icon`.

- [ ] **Step 6: Рендер**

Run: `bun run render`
Expected: `dist/frontend.html` и `dist/frontend.png`.

- [ ] **Step 7: Осмотр PNG и правка координат (цикл)**

Открой `dist/frontend.png` через Read. Проверь: четыре иконки стека и CI внутри `Frontend repo`; `oapi-codegen` внутри `Backend repo`; стрелка `openapi.yaml` → `API-клиент` не проходит сквозь `Backend repo`; подписи `типы` и `make generate` не налезают друг на друга; `/api/v1/*` видна со звёздочкой; `rules` не перекрывает Selectel и легенду; все 5 пунктов правил читаемы. Правь по одному параметру, повторяй шаги 3–7.

- [ ] **Step 8: Commit**

```bash
git add diagrams/frontend.json
git commit -m "feat(diagrams): frontend — репа клиента, контракт из Apidog, релизы без BFF

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Финальная проверка и PR

**Files:**
- Нет новых правок, кроме исправлений по результатам проверок.

**Interfaces:**
- Consumes: всё из Task 1–6.
- Produces: ветка `feature/mvp-single-vps` на origin, PR в `main`.

- [ ] **Step 1: Остатков BFF в корне нет**

Run: `grep -nE "BFF|bff|trpc|tRPC|VPS 1|VPS 2|vps1|vps2|monorepo|Hono" diagrams/*.json`
Expected: пустой вывод (код выхода 1). Любое попадание — исправь схему и пройди её цикл заново.

- [ ] **Step 2: Замороженные схемы не тронуты**

Run: `git diff -M --name-status main -- diagrams`
Expected: ровно пять строк `R100	diagrams/<name>.json	diagrams/bff/<name>.json` и пять строк `A` для `diagrams/{deployment,ci,cd,frontend,infra}.json`; строк с `diagrams/frozen-k3s/` нет.

- [ ] **Step 3: Полная проверка, как в CI**

Run: `bun run typecheck && bun run test && bun run build`
Expected: всё зелёное.

- [ ] **Step 4: Табы**

Run: `grep -nE 'id="tab-0"|<label for="tab-' dist/index.html`
Expected: `tab-0` с `checked`; метки по порядку `mvp`, `bff`, `frozen-k3s`.

- [ ] **Step 5: Push и PR (только с согласия пользователя)**

Спроси пользователя, можно ли пушить. После согласия:

```bash
git push -u origin feature/mvp-single-vps
gh pr create --base main --title "MVP на одной VPS без BFF, заморозка варианта с BFF" --body "$(cat <<'EOF'
## Что

- Схемы MVP с двумя VPS и BFF перенесены без изменений в `diagrams/bff/` и заморожены (таб `bff`).
- Новые схемы MVP в корне: `deployment`, `ci`, `cd`, `frontend`, `infra` — одна VPS (Caddy, Go API, Postgres), фронт — одна репа, ходит в `/api/v1` Go API напрямую, контракт из Apidog.
- README, CLAUDE.md, скилл: `diagrams/bff/` заморожена.

## Решения

Спека: `docs/superpowers/specs/2026-09-29-mvp-single-vps-design.md`. HTML отдаёт Caddy из S3, автоперезагрузки вкладок нет, репа `infra` переделывается отдельной задачей.

## Проверка

- `bun run typecheck && bun run test && bun run build` зелёные.
- PNG всех новых схем осмотрены.
- Превью: https://cringe-driven-development-team.github.io/docs/branches/feature-mvp-single-vps/

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: ссылка на PR. Превью появится через ~4 минуты после push (workflow Pages на `main`).
