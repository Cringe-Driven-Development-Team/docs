# Трек BFF: участок клиент → BFF на tRPC — дизайн

Дата: 2026-10-08. Статус: дизайн утверждён в чате, ждёт ревью спеки.

## 1. Цель

Документы трека `bff` (`site/modules/2026-10/tracks/bff.md`, `bff/contract.md`, `bff/auth.md`)
описывают BFF с tRPC между клиентом и BFF вместо прокси `/api/v1` с публичным OpenAPI-контрактом.
Решение «tRPC для всего между клиентом и BFF, переключение разом» принято в спеке
`2026-10-08-bff-into-module-design.md` (§3); здесь — как именно.

Читатели — Денис и Валентин, которые это реализуют: нужны конкретные имена, таблицы и примеры кода.

Успех:

- по «Контракту» понятно: откуда типы и схемы, как устроен роутер, какие 9 процедур есть сейчас и
  когда заводить процедуру экрана, как ошибка Go доходит до клиента, как устроен свой клиент tRPC;
- «Авторизация и CSRF» описывает обработку вызова tRPC (CSRF, сессия, refresh, Go), 10 сценариев
  показывают вызовы `/api/trpc/…` со стороны браузера;
- плашки «отвергнутый вариант» убраны, overlay и публичного контракта на страницах нет;
- безопасность не меняется: cookie `__Host-Http-session`, refresh внутри BFF, `X-CSRF: 1`, `Origin` и
  `Sec-Fetch-Site`, `SameSite=Strict`, Bearer к Go, две VPS и `X-BFF-Key`.

## 2. Проверенные факты

Репа `docs`, `main` на `782ea73`:

- `tracks/bff.md`: разделы «Было и стало» (схема с `/api/v1/* на bff:3000`), «Cookie до и после»,
  «Почему BFF», «Что меняется» (Фронт, BFF, Go API, Infra), «Переключение», «Две VPS»,
  «Ограничения», «tRPC»; сверху плашка `::: warning` про отвергнутый прокси. «Что меняется → Фронт»
  говорит про Orval из публичного контракта, «→ BFF» — про прокси `/api/v1/*` и хендлеры Hono с тегом
  `bff`, «→ Infra» — Caddy направляет `/api/v1/*` на `bff:3000`.
- `bff/contract.md`: разделы «Один источник», «Что меняется в контракте Go», «Overlay», «Команды»,
  «Генерация Orval» (цели `client`, `bff`, `goApi`), «Собственные ручки BFF», «Проверки в CI»,
  «Какие запросы BFF пропускает» (список разрешённых маршрутов, RFC 10017 §6.1.3.6).
- `bff/auth.md`: разделы «Cookie сессии», «Как BFF проксирует запрос» (8 шагов, шаг 2 — список
  разрешённых маршрутов), «CSRF» (правила для запросов к `/api/v1`, мутации — `POST`, `PUT`, `PATCH`,
  `DELETE`), «Сценарии» — 10 подразделов `###` с `sequenceDiagram`; путь `/api/v1` встречается 32 раза.
- `scripts/bff-pages.test.ts` проверяет плашку tRPC на трёх страницах, раздел `## tRPC`, overlay в
  «Контракте» (`spec/bff.overlay.yaml`, `openapi.public.json`, `client: 'hono'`, `Собственные ручки
  BFF`…), 10 сценариев с пометкой «Проект: проверить после внедрения», один refresh в Go в «Двух
  вкладках», «Две VPS» в треке, `openapi-cdd` не больше одного раза в «Контракте».
- Go (`go-park-mail-ru/2026_2_Cringe_Driven_Development` @`4094350`, `internal/api/api.gen.go`,
  `ServerInterface`) — 10 операций: `POST /auth/login`, `/auth/logout`, `/auth/refresh`,
  `/auth/register`; `GET /notebooks`, `POST /notebooks`, `GET /notebooks/{id}`,
  `POST /notebooks/{id}/cells`, `DELETE /notebooks/{id}/cells/{index}`; `GET /users/me`.
- Фронт (`frontend-park-mail-ru/2026_2_Cringe_Driven_Development` @`344ad0b`):
  - `dependencies` — только свои пакеты: `@iredtea/openapi`, `@maninthecoat/react`,
    `@maninthecoat/zustand`; сторонних runtime-библиотек нет;
  - экраны делают по одному запросу: `NotebooksPage.tsx:32` — `GET /notebooks`, `NotebookPage.tsx:38` —
    `GET /notebooks/{id}`; действия — `POST /notebooks`, `POST /notebooks/{id}/cells`,
    `DELETE /notebooks/{id}/cells/{index}`; пользователь грузится один раз при старте
    (`restoreSession` в `main.tsx`, стор `useSessionStore`).
- tRPC 11, [HTTP RPC](https://trpc.io/docs/rpc): query — `GET <endpoint>/<путь>?input=<encodeURIComponent(JSON)>`,
  mutation — `POST` с телом; вложенные процедуры — путь через точку; батч — пути через запятую,
  `?batch=1`, `input` — объект по индексам, ответ — массив конвертов, при разных статусах — `207`;
  успех — `{ "result": { "data": … } }`, ошибка — `{ "error": { "message", "code", "data": { "code",
  "httpStatus", "path" } } }`; коды: `BAD_REQUEST` 400, `UNAUTHORIZED` 401, `FORBIDDEN` 403,
  `NOT_FOUND` 404, `CONFLICT` 409, `INTERNAL_SERVER_ERROR` 500, `BAD_GATEWAY` 502.
- [Адаптер fetch](https://trpc.io/docs/server/adapters/fetch): `fetchRequestHandler({ endpoint, req,
  router, createContext })`, `createContext({ req, resHeaders }: FetchCreateContextFnOptions)`.
- [Orval](https://orval.dev/docs/guides/zod): `client: 'zod'` генерирует zod-схемы операций
  (например `CreatePetsBody`).

## 3. Решения

| Решение | Почему | Отвергнуто |
| --- | --- | --- |
| Apidog — только контракт Go | клиент ↔ BFF описывает роутер tRPC; алерты Apidog решаются в своём треке | OpenAPI из роутера для Apidog (`trpc-to-openapi`) |
| Вход процедур — zod-схемы Orval из контракта Go | правило поля описано один раз, в Apidog | zod руками в роутере |
| Выход — типы Orval, без проверки во время работы | Go — наш сервис | `.output()` с zod |
| Процедуры по ресурсам, 9 штук | экраны сейчас делают по одному запросу; действия — один к одному | процедуры экранов сразу (`notebook.open` = `notebooks.get`) |
| Процедуры экранов — роутер `views`, когда экрану нужно больше одного вызова Go | данные собираются параллельно и отдаются одним ответом | агрегации в процедурах ресурсов |
| CSRF — в `createContext`, ошибка — `TRPCError FORBIDDEN` | ответ в конверте tRPC, в том числе для батча; клиент обрабатывает одинаково | отдельный middleware Hono со своим форматом ответа |
| Свой клиент tRPC, типы — `import type` из `@trpc/server` | на клиенте нет сторонних runtime-библиотек | `@trpc/client`; свой RPC без `@trpc/server` |
| Путь `/api/trpc`, батч включён | экрану с двумя вызовами — один HTTP-запрос | без батча |

## 4. Устройство

```
Браузер ── свой клиент tRPC (X-CSRF: 1, батч) ──► Caddy /api/trpc/* ──► BFF (Hono)
                                                                       └─ /api/trpc → роутер tRPC
                                                                            createContext: CSRF, сессия
                                                                            процедура → клиент Go (Orval)
                                                                            ──► Go /api/v1 (Bearer)
```

- `bun run sync` = `apidog` → `orval`. Цели Orval (вход — `spec/openapi.json`, выход —
  `apps/bff/src/go/`): `goApi` — fetch-клиент к Go с мутатором (`Authorization: Bearer`, на двух VPS
  ещё `X-BFF-Key` и адрес из `GO_API_URL`), `goZod` — zod-схемы операций.
- Роутер — `apps/bff/src/router/`, по файлу на ресурс; `index.ts` экспортирует `appRouter` и
  `type AppRouter`. Клиент: `import type { AppRouter } from '@cdd/bff'`.
- Требование RFC 10017 §6.1.3.6 («только явно разрешённые пути») выполняется устройством: BFF ничего
  не проксирует, Go вызывается только из процедур и только сгенерированным клиентом.
- Caddy направляет `/api/trpc/*` на `bff:3000`; клиентского `/api/v1` нет.

## 5. Роутер и процедуры

| Процедура | Тип | Go | Вход |
| --- | --- | --- | --- |
| `auth.register` | mutation | `POST /auth/register` | тело регистрации |
| `auth.login` | mutation | `POST /auth/login` | тело входа |
| `auth.logout` | mutation | `POST /auth/logout` | — |
| `users.me` | query | `GET /users/me` | — |
| `notebooks.list` | query | `GET /notebooks` | — |
| `notebooks.get` | query | `GET /notebooks/{id}` | `{ id }` |
| `notebooks.create` | mutation | `POST /notebooks` | тело создания |
| `cells.create` | mutation | `POST /notebooks/{id}/cells` | `{ notebookId, …тело }` |
| `cells.delete` | mutation | `DELETE /notebooks/{id}/cells/{index}` | `{ notebookId, index }` |

- `auth.refresh` нет: refresh делает BFF.
- Имена zod-схем — как их сгенерирует Orval (пример на странице помечается «точные имена — по
  выгрузке»).
- Процедуры экранов: если экрану нужно больше одного вызова Go — процедура в роутере `views`, вызовы
  Go параллельно, один ответ; процедуры ресурсов остаются для действий и отдельных виджетов. Пример —
  `views.notebook` (блокнот + статус рантайма) с пометкой «появится вместе с треком «Авто-VPS»».

## 6. Контекст, сессия, ошибки

- `createContext({ req, resHeaders })`:
  1. CSRF: `X-CSRF: 1` на каждом вызове; для `POST` ещё `Origin == APP_ORIGIN` и `Sec-Fetch-Site`
     (если есть) `same-origin`; иначе `TRPCError FORBIDDEN`, `appCode: csrf_invalid`;
  2. cookie `__Host-Http-session` → `session` или `null` (ошибка расшифровки — `null`).
  Cookie ставится и стирается через `resHeaders.append('Set-Cookie', …)`.
- `publicProcedure` — `auth.login`, `auth.register`; `auth.logout` — `optionalSessionProcedure`: при
  сессии вызывает Go через `ctx.go` (refresh до вызова и один повтор после `401`, чтобы refresh-токен
  отозвался и при истёкшем access), ошибки Go не пробрасывает, `UNAUTHORIZED` не отвечает, всегда успешен
  и стирает cookie сессии и три старые cookie.
- Раньше `createContext` tRPC сам разбирает запрос: тело не в JSON (обычная HTML-форма) — `415
  UNSUPPORTED_MEDIA_TYPE`; ошибка в `createContext` на батч — один конверт `{ error }`, а не массив.
- `authedProcedure` — middleware: нет сессии — `UNAUTHORIZED`; иначе `ctx.go` — клиент Go с токеном:
  refresh за 30 с до `accessExp`, один повтор после `401`, одновременные refresh объединяются по
  SHA-256 refresh-токена (10 с в памяти); refresh отвергнут — cookie стирается, `UNAUTHORIZED`.
- Ошибки Go (`Error { code, message }`) → tRPC: 400 → `BAD_REQUEST`, 401 после неудачного refresh →
  `UNAUTHORIZED` (cookie стирается), 403 → `FORBIDDEN`, 404 → `NOT_FOUND`, 409 → `CONFLICT`;
  `403 s2s_forbidden`, 5xx, сеть → `BAD_GATEWAY`, запись в лог, сессия не трогается.
- `errorFormatter`: `data.appCode` — код приложения (`csrf_invalid`, код из `Error.code` Go);
  ошибка zod на входе — `BAD_REQUEST` и `data.zodError` (`flatten()`); `stack` в прод не уходит.

## 7. Свой клиент tRPC

- Пакет `packages/trpc-client` в монорепе фронта.
- `createClient<AppRouter>({ url: '/api/trpc' })` → `api.notebooks.get.query({ id })`,
  `api.cells.create.mutate({ … })`; типы — `inferRouterInputs` / `inferRouterOutputs` через
  `import type` из `@trpc/server`.
- Каждый запрос — `X-CSRF: 1`, `credentials: 'same-origin'`.
- Батч: вызовы одного метода в одном тике — один запрос (`?batch=1`, пути через запятую); URL
  длиннее 2000 символов — делится на несколько запросов.
- Ошибка — `TrpcError { code, httpStatus, appCode, message, zodError? }`; `UNAUTHORIZED` — стор
  сессии переходит в «гость», форма входа.
- Подписок нет; задел одной строкой: потоковый вывод ячеек — SSE на `fetch` (у `EventSource` нельзя
  поставить `X-CSRF`).
- На странице — пример теста клиента на подставном `fetch`: кодирование `input`, батч, разбор
  конвертов успеха и ошибки.

## 8. Правки страниц

Заголовки разделов, которые остаются, не меняются — от них зависят якоря.

**`bff/contract.md`** — переписывается:

- `## Источники правды` (вместо «Один источник») — схема §4 и абзац про Apidog только для Go;
- `## Что меняется в контракте Go` — без изменений;
- `## Команды` — `bun run sync` = `apidog` → `orval`;
- `## Генерация Orval` — цели `goApi` и `goZod`;
- `## Роутер` — таблица §5, пример `cells.create` с `.input()` из Orval и вызовом `ctx.go`;
- `## Процедуры экранов` — правило и пример `views.notebook`;
- `## Ошибки` — таблица §6 и `appCode`;
- `## Клиент` — протокол, API, батч, ошибки, пример теста;
- `## Какие вызовы BFF принимает` (вместо «Какие запросы BFF пропускает») — RFC §6.1.3.6 устройством;
  вызов несуществующей процедуры — `404 NOT_FOUND` от tRPC без запроса в Go.

Удаляются: «Overlay», «Собственные ручки BFF», «Проверки в CI», `openapi-cdd` (кроме одной фразы, что
клиенту генератор больше не нужен).

**`bff/auth.md`:**

- `## Как BFF проксирует запрос` → `## Как BFF обрабатывает вызов`: шаги §6 (CSRF в `createContext` →
  сессия → `authedProcedure` → refresh → Go → ошибки);
- `## CSRF`: «каждый вызов к `/api/trpc`»; правило 2 — для `POST` (mutation и батч мутаций); абзац
  про WebSocket остаётся;
- `## Сценарии`: на стороне браузера `/api/v1/…` → `/api/trpc/<процедура>` (`POST /api/trpc/auth.login`,
  `GET /api/trpc/users.me`, …), ответы — конверты tRPC; сторона Go не меняется; заголовки `###` и
  пометки «Проект: проверить после внедрения» остаются;
- ссылки на удалённые якоря «Контракта» переписываются.

**`tracks/bff.md`:**

- плашка `::: warning` про отвергнутый вариант убирается;
- «Было и стало»: вторая схема — `/api/trpc/* на bff:3000`; абзац «Клиент по-прежнему ходит на
  `/api/v1`» → клиент вызывает процедуры tRPC;
- «Что меняется → Фронт»: свой клиент tRPC вместо `client.ts` с `baseUrl: '/api/v1'`, типы из
  `AppRouter`; «→ BFF»: роутер tRPC, `createContext`, `authedProcedure`, клиент Go от Orval;
  «→ Infra»: Caddy — `/api/trpc/*` на `bff:3000`;
- `## tRPC` — короткая выжимка со ссылкой на «Контракт»; без «отвергнутого варианта».

**`scripts/bff-pages.test.ts`:**

- нет плашки про отвергнутый вариант ни на одной странице;
- «Контракт»: есть `AppRouter`, `views.notebook`, `appCode`, `inferRouterOutputs`, `/api/trpc` и все
  9 процедур; нет `bff.overlay.yaml`, `openapi.public.json`, `client: 'hono'`;
- в «Авторизации» в строках сценариев от браузера нет `/api/v1`;
- остаются: 10 сценариев со схемой и пометкой, один refresh в Go в «Двух вкладках», «Две VPS».

## 9. Проверка

- `bun run typecheck && bun run test`, `DIAGRAMS_NATIVE=1 bun run build` (`check-site` — ссылки и
  якоря, `check-mermaid` — схемы).
- Chrome на локальной сборке: три страницы трека, схемы mermaid, якоря со старых ссылок на
  сохранённые разделы.

## 10. Не входит

- Код BFF, клиента tRPC и Go.
- Подписки и SSE — только строка-задел.
- Реализация `views.notebook`.
- Схемы `diagrams/`, раздел CSRF прода (`site/security/csrf/`).
- Правка прошлых спек.
