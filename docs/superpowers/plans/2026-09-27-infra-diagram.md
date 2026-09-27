# Схема infra (Pulumi + Ansible в Selectel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить схему MVP `diagrams/infra.json`: проекты Selectel `infra-shared` и `pulumi-cellestial`, стейт Pulumi, домен, запуск Pulumi и Ansible с ноута студента.

**Architecture:** Один JSON-файл в формате eraser-diagrams (CLI 0.1.0) с абсолютными координатами, отрендеренный штатным пайплайном репозитория (`bun run build`), плюс строка в таблице MVP в `README.md`. Код пайплайна не меняется.

**Tech Stack:** eraser-diagrams CLI 0.1.0, bun ≥ 1.3, Node ≥ 22.12, Chrome/Chromium.

**Spec:** `docs/superpowers/specs/2026-09-27-infra-diagram-design.md`

## Global Constraints

- Правила скилла `.claude/skills/eraser-diagrams/SKILL.md` обязательны: прочитай его целиком до начала.
- Координаты абсолютные, кратны 20, даже у детей с `containerId`. Первый узел в группе на `x+20, y+40`.
- Группа «Selectel» — `"color": "blue"` без `styleMode`; вложенные группы — `"color": "blue", "styleMode": "plain"`.
- У `Icon`, `Textbox` и стрелок нет `color`/`lineStyle` (все стрелки этой схемы — «Прочие связи»).
- Легенда: ровно один `{"tag": "Legend", "id": "legend", "x": …, "y": 0, "width": 340, "entries": …}` справа от содержимого; `entries` — ровно то, что требует `bun run check`.
- Никаких реальных IP, CIDR, токенов: репозиторий публичный. Имена `cellestial.ru`, `cdd-infra-state`, `infra-shared`, `pulumi-cellestial` допустимы.
- Никаких `<…>` в `text`/`label` (санитайзер вырежет, `validate` упадёт с `W_CONTENT_SANITIZED`).
- Связи — только из таблицы спеки, новых не добавлять.
- Код в `scripts/` не менять.

## Review Focus

1. Тильды в markdown `Textbox`: `~/.config/… ~/.ssh/…` без обратных кавычек GFM может превратить в зачёркнутый текст — пути в подписи ноута только в `` `code` ``; проверь в PNG, что ничего не зачёркнуто.
2. Подписи стрелок, идущих из левой колонки в Selectel, могут налезать друг на друга или на иконки — проверь в PNG каждую из 10 подписей.
3. Узлы вне своей группы или пересекающие рамку после сдвигов — проверь, что все 6 узлов Selectel внутри своих рамок, а 3 иконки ноута — вне группы Selectel.
4. Длинные русские подписи иконок (`VPS 1 · gateway: floating IP, Caddy + Let's Encrypt`) переносятся и могут налезть на соседнюю иконку — шаг 140 по x может быть мал; при наложении раздвинь узлы и группы.
5. Легенда перекрывает содержимое после расширения групп — `x` легенды правее самой правой рамки минимум на 40.

---

### Task 1: Схема `diagrams/infra.json` и строка в README

**Files:**
- Create: `diagrams/infra.json`
- Modify: `README.md` (таблица «MVP (`diagrams/`)», после строки `frontend-monorepo`)

**Interfaces:**
- Consumes: пайплайн `bun run validate|check|warm|render|build` (не меняется).
- Produces: `dist/infra.html`, `dist/infra.png` при сборке; страница `https://cringe-driven-development-team.github.io/docs/infra.html` после деплоя.

- [ ] **Step 1: Прочитай скилл и эталон**

Прочитай `.claude/skills/eraser-diagrams/SKILL.md` и `diagrams/deployment.json` (эталон стиля).

- [ ] **Step 2: Создай `diagrams/infra.json`**

Стартовая раскладка (координаты — отправная точка; шаг 7 их правит по PNG):

```json
{
  "entities": [
    { "tag": "Textbox", "id": "laptop-note", "x": 0, "y": 0, "width": 420, "text": "**Ноут студента:** `~/.config/selectel.env` (личный сервисный пользователь, личный S3-ключ стейта, passphrase), `clouds.yaml`, `~/.ssh/selectel_release`" },

    { "tag": "Icon", "id": "stack-bootstrap", "x": 100, "y": 140, "icon": "pulumi", "texts": [{ "text": "pulumi/bootstrap · стек main" }] },
    { "tag": "Icon", "id": "stack-main", "x": 100, "y": 320, "icon": "pulumi", "texts": [{ "text": "pulumi · стек dev" }] },
    { "tag": "Icon", "id": "ansible", "x": 100, "y": 500, "icon": "ansible", "texts": [{ "text": "Ansible" }] },

    { "tag": "Group", "id": "selectel", "color": "blue", "x": 560, "y": 60, "width": 500, "height": 500, "isContainer": true, "title": { "text": "Selectel", "icon": "cloud" } },

    { "tag": "Group", "id": "infra-shared", "color": "blue", "styleMode": "plain", "x": 580, "y": 100, "width": 280, "height": 160, "containerId": "selectel", "isContainer": true, "title": { "text": "Проект infra-shared" } },
    { "tag": "Icon", "id": "state-bucket", "x": 600, "y": 140, "containerId": "infra-shared", "icon": "database", "texts": [{ "text": "S3 cdd-infra-state · ru-7: bootstrap/, main/" }] },
    { "tag": "Icon", "id": "dns-zone", "x": 740, "y": 140, "containerId": "infra-shared", "icon": "globe", "texts": [{ "text": "DNS-зона cellestial.ru." }] },

    { "tag": "Icon", "id": "domain", "x": 920, "y": 140, "containerId": "selectel", "icon": "globe", "texts": [{ "text": "cellestial.ru · регистрация" }] },

    { "tag": "Group", "id": "pulumi-cellestial", "color": "blue", "styleMode": "plain", "x": 580, "y": 360, "width": 420, "height": 160, "containerId": "selectel", "isContainer": true, "title": { "text": "Проект pulumi-cellestial" } },
    { "tag": "Icon", "id": "vps1", "x": 600, "y": 400, "containerId": "pulumi-cellestial", "icon": "server", "texts": [{ "text": "VPS 1 · gateway: floating IP, Caddy + Let's Encrypt" }] },
    { "tag": "Icon", "id": "vps2", "x": 740, "y": 400, "containerId": "pulumi-cellestial", "icon": "server", "texts": [{ "text": "VPS 2 · backend: только приватная сеть" }] },
    { "tag": "Icon", "id": "product-bucket", "x": 880, "y": 400, "containerId": "pulumi-cellestial", "icon": "database", "texts": [{ "text": "Бакет продукта" }] },

    { "tag": "Legend", "id": "legend", "x": 1120, "y": 0, "width": 340, "entries": [{ "text": "Наша инфраструктура", "color": "#2866c4" }, { "text": "Прочие связи", "color": "#1c1c1c" }] }
  ],
  "connections": [
    { "tag": "Relationship", "from": "stack-bootstrap", "to": "infra-shared", "label": "pulumi up: проект, бакет, DNS-зона" },
    { "tag": "Relationship", "from": "stack-bootstrap", "to": "state-bucket", "label": "стейт bootstrap/" },
    { "tag": "Relationship", "from": "stack-main", "to": "pulumi-cellestial", "label": "pulumi up: проект, сеть, VPS, бакет" },
    { "tag": "Relationship", "from": "stack-main", "to": "state-bucket", "label": "стейт main/" },
    { "tag": "Relationship", "from": "stack-main", "to": "dns-zone", "label": "A-запись" },
    { "tag": "Relationship", "from": "domain", "to": "dns-zone", "label": "NS" },
    { "tag": "Relationship", "from": "dns-zone", "to": "vps1", "label": "cellestial.ru → floating IP" },
    { "tag": "Relationship", "from": "ansible", "to": "pulumi-cellestial", "label": "dynamic inventory (clouds.yaml)" },
    { "tag": "Relationship", "from": "ansible", "to": "vps1", "label": "ssh deploy" },
    { "tag": "Relationship", "from": "vps1", "to": "vps2", "label": "ssh через ProxyCommand" }
  ]
}
```

- [ ] **Step 3: Валидация схемы**

Run: `bun run validate`
Expected: успех без ошибок и без `W_CONTENT_SANITIZED` для `infra`. При ошибке — исправь JSON по сообщению и повтори.

- [ ] **Step 4: Цветовая конвенция и легенда**

Run: `bun run check`
Expected: успех. Если `check` печатает ожидаемый массив `entries` для легенды `infra` — скопируй его в `legend.entries` дословно и повтори.

- [ ] **Step 5: Прогрев иконок**

Run: `bun run warm`
Expected: успех, без `unknown icon`.

- [ ] **Step 6: Рендер**

Run: `bun run render`
Expected: появились `dist/infra.html` и `dist/infra.png`. Рендерер запускается под Node из PATH; если Chrome не найден — задай `CHROMIUM_PATH`.

- [ ] **Step 7: Осмотр PNG и правка координат (цикл)**

Открой `dist/infra.png` через Read. Проверь каждый пункт из Review Focus плана и шаг 6 скилла: узлы не накладываются, все узлы внутри своих групп, заголовки групп не обрезаны, все 10 подписей стрелок читаемы и не налезают друг на друга, легенда ничего не перекрывает, в подписи ноута ничего не зачёркнуто. При проблеме — правь координаты/размеры (кратно 20; сдвигая узел, сдвигай и рамку его группы), повторяй шаги 3–7. Состав узлов, подписей и связей не меняй.

- [ ] **Step 8: Строка в README**

В `README.md`, в таблице под «MVP (`diagrams/`):», после строки `frontend-monorepo` добавь:

```markdown
| [infra](https://cringe-driven-development-team.github.io/docs/infra.html) | Проекты Selectel, стейт Pulumi, домен; Pulumi и Ansible с ноута студента |
```

- [ ] **Step 9: Полная проверка, как в CI**

Run: `bun run typecheck && bun run test && bun run build`
Expected: всё зелёное; `dist/index.html` содержит ссылку на `infra.html`.

- [ ] **Step 10: Commit**

```bash
git add diagrams/infra.json README.md
git commit -m "docs: схема infra — проекты Selectel, стейт Pulumi, запуск Pulumi и Ansible"
```
