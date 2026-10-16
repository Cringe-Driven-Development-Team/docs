# Три схемы CSRF в BFF — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Объяснить CSRF тремя самостоятельными Eraser-схемами и тремя подразделами страницы авторизации BFF.

**Architecture:** Три JSON показывают HTTP RPC нашего клиента, блокировку чужого сайта и разрешённую HTML-навигацию.
Страница заменяет три прежних Mermaid-сценария новыми подразделами, сохраняет якоря и семь сценариев сессии.
Политика защиты не меняется; графовые тесты и осмотр PNG проверяют схемы, тест страницы и браузер — интеграцию.

**Tech Stack:** eraser-diagrams CLI 0.1.0, JSON, TypeScript, Bun test, VitePress, Chrome.

**Spec:** `docs/superpowers/specs/2026-10-16-bff-csrf-eraser-design.md`.

## Global Constraints

- Новая защита или новый транспорт не проектируются.
- Схемы не объявляются описанием уже работающего BFF.
- Ссылки для пользователя — на VitePress, а не на исходники Markdown.
- Сохраняется `## CSRF` и краткий общий текст с тремя действующими правилами и ссылками на RFC.
- Ровно три H3 в CSRF: `Запрос нашего клиента`, `Атака с чужого сайта`, `Переход по внешней ссылке`.
- Поддомен раскрывается внутри второго подраздела под `#### Запрос с поддомена`, без четвёртой схемы.
- Заголовки «Атака с чужого сайта», «Запрос с поддомена» и «Переход по внешней ссылке» сохраняются дословно.
- В `## Сценарии` остаются семь сценариев сессии с прежними Mermaid и пометками будущей проверки.
- Пример — защищённая mutation `POST /api/trpc/notebooks.create` с JSON-телом.
- `X-CSRF: 1` — не секрет и не случайный токен. Отдельного получения CSRF-токена нет.
- POST-проверки: `Origin` равен `APP_ORIGIN`, `Sec-Fetch-Site: same-origin`, если заголовок есть.
- Проверки CSRF предшествуют чтению сессии и вызову Go; login/register не требуют уже существующей сессии.
- Отказ preflight не изображается ответом 403 на якобы выполненную mutation.
- Для same-site поддомена нельзя обещать, что cookie никогда не отправляется.
- GET HTML не меняет предметные данные и не выполняет logout; последующие RPC проходят обычные CSRF-проверки.
- Не вводятся собственные цвета «разрешено/запрещено». Узел браузера имеет id `client`.
- Старые схемы BFF, ROOT_NAMES, sidebar и текущий раздел `/security/csrf/` не меняются.
- Продуктовый код, issues и назначения вне scope. WebSocket не возвращается на целевую страницу.
- Масштабирование общего просмотрщика не входит в эту задачу.

## Review Focus

1. Статический X-CSRF выглядит секретным токеном или доказательством сессии: Task 1 проверяет пояснения и путь CSRF → session → Go.
2. Форма и fetch ошибочно получают одинаковый 403: Task 1 различает 415, 403 и остановку основного запроса после preflight.
3. Поддомен объявлен защищённым одним Lax: Task 1 проверяет same-site/cross-origin и возможность cookie, Task 2 сохраняет соответствующий H4/RFC.
4. Внешний GET HTML выглядит обходом защиты API: Task 1 требует Lax/bootstrap и повторные CSRF-проверки для дальнейшего RPC.
5. После переноса пропадают якоря или сценарии сессии: Task 2 проверяет уникальные старые заголовки, три H3 в CSRF и семь Mermaid-сценариев в «Сценариях».

---

## Карта файлов

| Путь | Ответственность |
| --- | --- |
| `diagrams/modules/2/bff-csrf-client.json` | RPC нашего клиента, заголовки и порядок проверок |
| `diagrams/modules/2/bff-csrf-foreign.json` | Форма, preflight и случай поддомена |
| `diagrams/modules/2/bff-csrf-navigation.json` | GET HTML через Caddy и bootstrap с Lax-cookie |
| `scripts/bff-csrf-diagrams.test.ts` | Существенные пути и подписи трёх схем |
| `site/modules/2/tracks/bff/auth.md` | Три подраздела CSRF и семь сценариев сессии |
| `scripts/bff-pages.test.ts` | Состав разделов, схемы, старые якоря и сценарии |
| `README.md` | Три строки в таблице схем модуля №2 |

### Task 1: Три компактные Eraser-схемы и их структурный контракт

**Files:**
- Create: три JSON из карты файлов.
- Create: `scripts/bff-csrf-diagrams.test.ts`.

**Interfaces:**
- Consumes: полная binding spec §4, `.agents/skills/eraser-diagrams/SKILL.md`, `DiagramDoc` из `scripts/diagram.ts`.
- Produces: имена `modules/2/bff-csrf-client`, `modules/2/bff-csrf-foreign`, `modules/2/bff-csrf-navigation`.
- Во всех схемах `client` — браузер без `containerId`; компоненты BFF внутри синей группы `bff`, а не отдельные развёрнутые серверы. Если используется `vps`, `bff` вложена в неё с plain-стилем.
- Client: `app-code`, `csrf-check`, `session`, `go-api`; policy-выноски `client-policy`, `csrf-policy`, `session-policy`.
- Foreign: `foreign` — зелёная группа чужого сайта, `attack-code` внутри неё; `trpc-adapter`, `csrf-check`, `form-415`, `csrf-403`, `preflight-response` внутри `bff`; `browser-blocked` у браузера; выноски `cookie-policy`, `subdomain-policy`.
- Navigation: `external-link` у внешнего сайта; `caddy` и `go-api` в инфраструктуре, `html-handler`, `session`, `guest` внутри `bff`; выноски `html-policy`, `bootstrap-policy`, `rpc-policy`.
- `go-api` находится в инфраструктуре вне BFF; в foreign-схеме Go отсутствует, поясняется, что вызова не будет.
- Точные координаты, иконки и компоновку выбирает исполнитель по PNG; три схемы не сливаются в одну.

- [ ] **Step 1: Написать тесты существенных путей и текстов, подтверждающих пять Review Focus.**

Использовать `DiagramDoc`, helper `nodeText(doc, id): string` для text/texts узла и
`edgeText(doc, from, to): string` для подписей связей. Helpers локальны тесту, новые общие модули не нужны.
Не импортировать test-файлы друг в друга. Прочитать три JSON и проверить связи как подмножество:

```ts
for (const pair of ['app-code>client', 'client>csrf-check', 'csrf-check>session', 'session>go-api'])
  expect(pairs(clientDoc)).toContain(pair);
for (const pair of [
  'attack-code>client', 'client>trpc-adapter', 'trpc-adapter>form-415',
  'trpc-adapter>csrf-check', 'csrf-check>csrf-403',
  'client>preflight-response', 'preflight-response>browser-blocked',
]) expect(pairs(foreignDoc)).toContain(pair);
for (const pair of [
  'external-link>client', 'client>caddy', 'caddy>html-handler', 'html-handler>session',
  'session>go-api', 'go-api>session', 'session>html-handler',
  'session>guest', 'guest>html-handler', 'html-handler>caddy', 'caddy>client',
]) expect(pairs(navigationDoc)).toContain(pair);
expect(foreignDoc.entities.some(e => e.id === 'go-api')).toBe(false);
expect(foreignDoc.connections.filter(c => c.from === 'browser-blocked')).toEqual([]);
expect(pairs(clientDoc)).not.toContain('client>go-api');
expect(pairs(clientDoc)).not.toContain('csrf-check>go-api');
```

Именованные тесты дополнительно проверяют по **конкретным узлам/связям**, не всему JSON:

- Client: `client-policy` содержит X-CSRF, постоянный/не секрет, `credentials`, `same-origin`,
  `__Host-Http-session` и то, что cookie ставит браузер/JS не читает. `csrf-policy` — JSON POST,
  `Origin`, `APP_ORIGIN`, `Sec-Fetch-Site`, `same-origin`, условие «если есть», `createContext`.
  `session-policy` отличает CSRF от действительной сессии и поясняет public login/register.
- Foreign: `client>trpc-adapter` явно подписан как POST **формы**; `form-415` — 415,
  `application/x-www-form-urlencoded`, `text/plain`, до createContext; multipart ведёт к CSRF,
  `csrf-403` — 403 и `csrf_invalid` без X-CSRF. Выноска/узел отказа сообщает «Go не вызывается».
  `client>preflight-response` содержит OPTIONS, `preflight-response>browser-blocked` — нет разрешения CORS,
  а `browser-blocked` — основной запрос не отправлен. `cookie-policy` содержит Lax и cross-site fetch/POST;
  `subdomain-policy` — same-site, другой origin, возможность cookie и проверки Origin/Fetch Metadata.
- Navigation: `client>caddy` — GET HTML, Lax-cookie; `html-policy` — без X-CSRF,
  допустимый `Sec-Fetch-Site: cross-site`, отсутствие предметных изменений/logout;
  `guest` — user:null без вызова Go, `bootstrap-policy` — BootstrapData, стор до рендера,
  отдельное хранилище cookie встроенного браузера; `rpc-policy` — дальнейшие RPC снова с X-CSRF.
- Проверить вложенность из Interfaces и легенду `id=legend` во всех трёх схемах. Координаты не фиксировать.

Падежи и оформление текста проверять короткими regex/фрагментами, не копиями целых абзацев.

- [ ] **Step 2: Подтвердить RED.**

Run: `bun test scripts/bff-csrf-diagrams.test.ts` → ожидаемый ENOENT для новых JSON.
Сохранить существенный вывод и причину, исключить ошибки окружения как ложный RED.

- [ ] **Step 3: Создать схемы по Interfaces и спеке §4.**

Расположить код клиента отдельно от браузера, HTTP-защиту внутри BFF, результаты отказа у нужной
стороны. Runtime-компоненты — Icon, объяснения — Textbox; Activity не использовать для обозначения
сетевого запроса как шага генерации. В первых двух схемах показан логический HTTP-поток к BFF;
третья явно показывает Caddy в HTML-маршруте. Не рисовать реальный POST fetch после отказа preflight.
На foreign-схеме подписи формы и OPTIONS различаются. Порядок CSRF/сессии не трактуется как требование
авторизации до login/register. Нумеровать только там, где она упрощает чтение.

- [ ] **Step 4: Выполнить GREEN и обязательный цикл схем.**

Run: целевой тест → 0 failures.
Run: `bun run validate && bun run check && bun run warm` → exit 0.
Run: `DIAGRAMS_NATIVE=1 CHROMIUM_PATH="/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta" bun run render` → exit 0.
Открыть все три `dist/modules/2/bff-csrf-*.png` через view_image; проверить читаемость, границы и
маршруты, особенно 415/403/preflight. После корректировки повторить цикл; evidence сохранить в отчёт.

- [ ] **Step 5: Проверить проект и закоммитить только четыре пути задачи.**

Run: `bun run modules:check && bun run typecheck && bun run test` → 0 failures.
Run: native `bun run build` с переменными из Step 4 → `site ok`; `git diff --check` → exit 0.
Commit: `docs(bff): добавлены три Eraser-схемы CSRF`.
Не пушить и не править страницу/README — это Task 2.

### Task 2: Три подраздела CSRF и сохранение опубликованных якорей

**Files:**
- Modify: `site/modules/2/tracks/bff/auth.md`.
- Modify: `scripts/bff-pages.test.ts`.
- Modify: `README.md` — три строки схем модуля №2.

**Interfaces:**
- Consumes: три Diagram name из Task 1 без переименования.
- Produces: ровно три H3 из Global Constraints под `## CSRF`, H4 поддомена во втором подразделе.
- Produces: прежние заголовки-якоря без дублей и семь Mermaid-сценариев в `## Сценарии`.
- Ссылка на подробный bootstrap — `./bootstrap`, без нового якоря. Старые ссылки с якорями сохраняются.

- [ ] **Step 1: Обновить тесты структуры страницы и списка схем.**

В `scripts/bff-pages.test.ts` использовать существующие `section`, `subsection`, `scenarios`.
`subsection(md: string, title: string, level: 3 | 4 = 3): string` получает уровень заголовка,
чтобы существующая проверка 415 для поддомена читала H4. Не переносить тестовые helpers в новый модуль.

```ts
const auth = readFileSync(AUTH, 'utf8');
const csrf = section(auth, 'CSRF');
expect(csrf.split('\n').filter(l => l.startsWith('### '))).toEqual([
  '### Запрос нашего клиента', '### Атака с чужого сайта', '### Переход по внешней ссылке',
]);
expect(subsection(csrf, 'Атака с чужого сайта')).toContain('#### Запрос с поддомена');
expect(scenarios(auth).map(s => s.title)).toEqual([
  'Вход', 'Запрос данных', 'Access истёк', 'Две вкладки', 'Выход',
  'Сессия кончилась', 'Первый вход после переезда',
]);
```

Уточнить `subsection`: H4 не завершает извлечение родительского H3, а H3/H2 завершают.
Проверить в каждой части точный компонент своего Diagram name, короткий вводный текст **перед** ним,
единственность трёх компонентов на странице и отсутствие Mermaid внутри CSRF.
Для каждого из семи сценариев сохранить ровно один Mermaid, sequenceDiagram и пометку проверки.
Тест «две вкладки — один refresh» и существующий тест 415 не удалять.
Проверить по одному вхождению каждого прежнего заголовка: два H3 и один H4,
а также отсутствие WebSocket. Привести вводную фразу страницы к трём схемам и семи сценариям.
В этом же тесте проверить три ссылки таблицы README: `https://docs.cellestial.ru/modules/2/bff-csrf-{client,foreign,navigation}.html`.

- [ ] **Step 2: Подтвердить RED.**

Run: `bun test scripts/bff-pages.test.ts` → ожидаемое расхождение 10/7 сценариев,
отсутствие трёх подразделов/компонентов/строк README; сохранить вывод.

- [ ] **Step 3: Переразметить страницу и добавить README.**

Оставить общие правила/RFC в CSRF, затем три H3 с коротким объяснением и отдельной схемой.
Перенести тексты прежних чужого сайта, поддомена и внешнего перехода в новые подразделы;
убрать только три соответствующих Mermaid. Остальные семь сценариев не переписывать.
Текст различает статический заголовок, cookie и авторизацию; нюансы формы/preflight/поддомена
и внешнего HTML сохраняются по §4 спеки. Ссылка на bootstrap ведёт на существующую страницу.
Заголовки трёх старых якорей не переименовывать; меню и pages не менять.

- [ ] **Step 4: Выполнить GREEN и полную проверку сайта.**

Run: `bun test scripts/bff-pages.test.ts scripts/bff-csrf-diagrams.test.ts` → 0 failures.
Run: `bun run modules:check && bun run typecheck && bun run test` → 0 failures.
Run: native `bun run build` с переменными из Task 1 Step 4 → `site ok`; `git diff --check` → exit 0.
В собранном auth.html проверить три iframe/шесть HTML-PNG ссылок и прежние id якорей.
Commit: `docs(bff): разделены три сценария CSRF на странице`.

Исполнитель не пушит. Контроллер проводит task review и whole-branch review по спеке,
проверяет страницу/три схемы/консоль браузером, пушит ветку и открывает новый ready PR в main.
После CI/Pages проверяет preview. Пользователю даются production-ссылки VitePress с ясной
пометкой, что изменения станут доступны там после merge; до merge новая версия — только preview.
