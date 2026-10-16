# Eraser-схема первого HTML с пользователем — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Показать получение пользователя и подготовку первого HTML отдельной Eraser-схемой на странице bootstrap.

**Architecture:** Новый JSON описывает согласованный runtime-поток, гостя и HTML 503.
Страница встраивает схему в существующий раздел; прежние схемы контракта и монорепы сохраняются.
Тесты закрепляют смысловые связи, а рендер и браузерная проверка — читаемость и публикацию.

**Tech Stack:** eraser-diagrams JSON/CLI 0.1.0, Bun test, TypeScript, VitePress, Chrome.

**Spec:** `docs/superpowers/specs/2026-10-16-bff-bootstrap-eraser-design.md`.

## Global Constraints

- Схема показывает согласованный проект BFF, включая гостя и недоступность Go.
- Она не меняет архитектуру из спеки bootstrap `2026-10-16-bff-server-bootstrap-design.md`.
- Новая схема `diagrams/modules/2/bff-bootstrap.json`.
- `<Diagram name="modules/2/bff-bootstrap" />` в начале раздела «HTML-запрос» после вводного абзаца.
- Существующие схемы контракта и монорепы сохраняют свои задачи и адреса.
- Сборка, публикация ассетов и откат не дублируются на новой схеме.
- Серверное дерево React не изображается.
- Нет сессии: отдельный путь к сериализации `{ user: null }`, Go не вызывается.
- Подтверждённо недействительная сессия также даёт гостя с удалением cookie, в том числе после отклонённого refresh или повторного `401` от Go.
- Сеть, таймаут, `5xx` или S2S-ошибка Go: отдельный HTML `503`, приложение не запускается, сессия сохраняется.
- Успешно обновлённая cookie приходит и с последующим `503`.
- HTML `200` и `503`, включая гостевые, имеют `Cache-Control: private, no-store`.
- Координаты абсолютные, кратны 20. Легенда справа, цвета и типы стрелок — по `scripts/colors.ts`.
- Не вводятся собственные цвета статусов.
- `ROOT_NAMES` и страницу текущего прода не менять; новая страница и пункт меню не нужны.
- Issues, доска и продуктовый код вне scope.

## Review Focus

1. Сбой Go ошибочно соединён с гостевой сериализацией: тест Task 1 разделяет `guest-data` и `html-unavailable` и запрещает связь ошибки с сериализатором.
2. Успешный ответ обходит Caddy либо стартует клиент на 503: тест Task 1 закрепляет оба возврата через Caddy и подпись запуска только на HTML 200.
3. Go нарисован вызывающим сериализатор: тест Task 1 требует возврат `go-api>session-client`, запрещает прямые связи Go с преобразователями.
4. Локальный шаблон выглядит запросом к CDN на каждую навигацию: тест Task 1 требует локальный шаблон внутри BFF, связь с HTMLRewriter и текст о проверке при старте/памяти.
5. Клиентский стор выглядит серверным компонентом: тест Task 1 оставляет `client-start` вне инфраструктуры и требует порядок JSON.parse → стор → первый рендер; PNG проверяет визуальную близость к браузеру.

---

## Карта файлов

| Путь | Ответственность |
| --- | --- |
| `diagrams/modules/2/bff-bootstrap.json` | Первый HTML, сессия/Go, сборка ответа, гость/503 и клиентский старт |
| `site/modules/2/tracks/bff/bootstrap.md` | Встраивание схемы в существующий раздел |
| `README.md` | Обнаружение новой схемы в таблице модуля №2 |
| `scripts/bff-bootstrap-diagram.test.ts` | Существенные связи и подписи схемы |
| `scripts/bff-pages.test.ts` | Имя и место встраивания |

### Task 1: Схема bootstrap и её встраивание

**Files:**
- Create: `diagrams/modules/2/bff-bootstrap.json`.
- Create: `scripts/bff-bootstrap-diagram.test.ts`.
- Modify: `site/modules/2/tracks/bff/bootstrap.md` — только раздел «HTML-запрос».
- Modify: `README.md` — новая строка в таблице схем модуля №2.
- Test: `scripts/bff-pages.test.ts` — проверка встраивания в существующем разделе.

**Interfaces:**
- Consumes: согласованный поток страницы bootstrap и общую с RPC сессию; новые API и runtime-сервисы не создаются.
- Produces: `<Diagram name="modules/2/bff-bootstrap" />`, HTML/PNG `modules/2/bff-bootstrap`.
- Produces: `vps` — синяя верхняя группа; `bff` — вложенная синяя plain-группа; `client` — нейтральный браузер слева.
- Produces: `caddy`, `go-api` внутри `vps`; `html-handler`, `session-client`, `guest-data`, `serializer`, `html-rewriter`, `html-template`, `html-ok`, `html-unavailable` внутри `bff`.
- Produces: `client-start` — нейтральная выноска вне инфраструктуры возле браузера; `legend` — справа.
- `session-client` обозначает общий слой сессии/refresh и Orval-клиент Go, а не отдельный сервер.

- [ ] **Step 1: Написать структурные тесты связей, ветвей и встраивания.**

В новом тесте использовать `DiagramDoc` из `./diagram.ts`, читать JSON через `readFileSync`.
Не импортировать `bff-pages.test.ts` в новый файл: импорт выполнит чужие тесты повторно.
Проверить родительские связи из Interfaces, `client-start` без `containerId`, `vps.color=blue`,
`bff.color=blue`, `bff.styleMode=plain`. Обязательные пары:

```ts
for (const pair of [
  'client>caddy', 'caddy>html-handler', 'html-handler>session-client',
  'session-client>go-api', 'go-api>session-client',
  'session-client>serializer', 'session-client>guest-data', 'guest-data>serializer',
  'serializer>html-rewriter', 'html-template>html-rewriter',
  'html-rewriter>html-ok', 'html-ok>caddy',
  'session-client>html-unavailable', 'html-unavailable>caddy', 'caddy>client',
]) expect(pairs).toContain(pair);
for (const pair of [
  'go-api>serializer', 'go-api>html-rewriter', 'guest-data>go-api',
  'html-unavailable>guest-data', 'html-unavailable>serializer',
]) expect(pairs).not.toContain(pair);
```

Отдельные именованные тесты закрывают пять строк Review Focus. Проверять текст **соответствующего
узла, связи или выноски**, а не наличие всех слов где угодно в JSON:

- `session-client>go-api`: `GET /users/me`; обратная связь явно возвращает ответ в BFF.
- Гостевая ветвь содержит `{ user: null }`, условие «нет сессии» и отсутствие вызова Go;
  соседнее пояснение недействительной сессии — удаление cookie после отклонённого refresh/повторного 401.
- Ветвь `html-unavailable` содержит `503`, сеть/таймаут/5xx/S2S и сохранение сессии;
  пояснение cookie — успешный refresh сохраняет новую cookie даже на 503.
- `html-template`: `index.html`, образ, проверка при старте и память; `serializer`:
  `serialize-javascript`, `isJSON: true`, только `{ user }`; `html-rewriter`: `HTMLRewriter`,
  `script#bootstrap`, `application/json`, `html: true` (часть допустима в прилегающей выноске).
- `html-ok` — `200`; обе возвратные связи идут к Caddy. Общая политика содержит
  `Cache-Control: private, no-store` и cookie до тела; вход браузера — `GET HTML` и `SameSite=Lax`.
- `client-start`: только HTML `200`, `textContent`, `JSON.parse()`, затем стор, затем первый рендер;
  стартового RPC `users.me` нет. Тест сравнивает позиции трёх шагов в тексте.
- README содержит `https://docs.cellestial.ru/modules/2/bff-bootstrap.html`.

В `scripts/bff-pages.test.ts` добавить проверку:

```ts
const part = section(readFileSync(BOOTSTRAP, 'utf8'), 'HTML-запрос');
expect(part).toContain('<Diagram name="modules/2/bff-bootstrap" />');
expect(part).toContain('Поток:');
expect(part).toContain('1. BFF');
expect(part.indexOf('<Diagram')).toBeGreaterThan(part.indexOf('Поток:'));
expect(part.indexOf('<Diagram')).toBeLessThan(part.indexOf('1. BFF'));
```

- [ ] **Step 2: Подтвердить RED.**

Run: `bun test scripts/bff-bootstrap-diagram.test.ts scripts/bff-pages.test.ts`.
Expected: отказ из-за отсутствующего нового JSON и встраивания; сохранить существенный вывод.

- [ ] **Step 3: Добавить JSON, встраивание и строку README.**

Собрать поток и ветви по Interfaces/спеке §4. Компоненты BFF — `Icon`, выноски — `Textbox`;
это runtime-поток, не диаграмма генерации кода. Источник DTO возвращается через общий Go-клиент.
Нумерация основного потока соответствует последовательности в спеке; гостевой и ошибочный пути
отделены. Выноски возле нужных узлов коротко объясняют граничные случаи.
Расположение/иконки выбрать по eraser-diagrams и осмотру PNG; не задавать координаты в тестах.
Легенда содержит только фактически используемые зоны/потоки по `scripts/colors.ts`.
Не добавлять отдельные развёрнутые сервисы для сериализатора или HTMLRewriter.
Вставить `<Diagram>` после вводного абзаца раздела, до нумерованных шагов.

- [ ] **Step 4: Выполнить GREEN и цикл рендера.**

Run: целевые тесты из Step 2 → 0 failures.
Run: `bun run validate && bun run check && bun run warm` → exit 0.
Run: `DIAGRAMS_NATIVE=1 CHROMIUM_PATH="/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta" bun run render` → exit 0.
Открыть `dist/modules/2/bff-bootstrap.png` через view_image. Проверить последовательность,
ветви гостя/503, подписи и границы; при корректировке повторить цикл. Сохранить результат осмотра.

- [ ] **Step 5: Проверить весь сайт и закоммитить файлы задачи.**

Run: `bun run modules:check && bun run typecheck && bun run test` → 0 failures.
Run: native `bun run build` с переменными из Step 4 → `site ok`.
Run: `git diff --check` → exit 0.
Проверить собранную страницу bootstrap, новую встроенную схему и её HTML/PNG-ссылки.
Коммитить только пять путей задачи: `docs(bff): добавлена Eraser-схема первого HTML`.
Исполнитель не пушит: контроллер после task review и whole-branch review проверит сайт
в браузере, запушит ветку и проверит обновлённое превью PR #72.
