# Миграция на BFF: контракт

::: warning
Проект трека миграции на BFF, ещё не внедрено. Как работает сейчас — раздел [CSRF](/security/csrf/).
:::

Контракт API остаётся spec-first: в Apidog ведётся один контракт Go API, а публичный контракт BFF,
между клиентом и BFF, выводится из него отдельным файлом — overlay. Ручки данных описываются один раз,
а отличается только `/auth/*` и схема безопасности.

## Один источник

```mermaid
flowchart LR
    D["Apidog"] -->|"make generate: cmd/apidog + oapi-codegen"| G["Go: сервер"]
    D -->|"apidog"| O["spec/openapi.json (монорепа)"]
    O -->|"Orval: fetch без тега bff"| BT["BFF: клиент к Go"]
    O --> F["openapi-format"]
    Y["spec/bff.overlay.yaml"] --> F
    F --> P["spec/openapi.public.json"]
    P -->|"Orval: client fetch"| C["Клиент: apps/client"]
    P -->|"Orval: client hono и zod"| BS["BFF: ручки /auth/* и тег bff"]
```

Go забирает контракт из Apidog сам: `make generate` в бэкенде запускает
[`go run ./cmd/apidog`](https://github.com/go-park-mail-ru/2026_2_Cringe_Driven_Development/blob/4094350/Makefile#L31)
и затем `oapi-codegen`. Файл `spec/openapi.json` в монорепе нужен клиенту и BFF.

Типы и клиенты в монорепе генерирует [Orval](https://orval.dev). Сегодня клиент использует собственный
генератор команды
[`openapi-cdd`](https://github.com/frontend-park-mail-ru/2026_2_Cringe_Driven_Development/blob/344ad0b/package.json#L16);
трек переводит генерацию на Orval, потому что он умеет и сторону BFF: хендлеры Hono с валидацией через zod.

Почему не два контракта в Apidog: ручки данных (`/users/me`, `/notebooks*`) пришлось бы описывать
дважды и следить, чтобы описания не разошлись. Overlay хранит только различия.

## Что меняется в контракте Go

Go становится серверным API для BFF, поэтому его контракт в Apidog меняется:

- `TokenPair`: `access_token`, `access_expires_in` (секунды), `refresh_token`, `refresh_expires_in`
  (секунды);
- `/auth/register` → `201 { user: User, tokens: TokenPair }`, `/auth/login` → `200` того же вида;
- `/auth/refresh`: тело `{ refresh_token }` → `200 TokenPair`;
- `/auth/logout`: тело `{ refresh_token }`, `bearerAuth` → `204`;
- у ручек данных остаётся `bearerAuth`; `Set-Cookie`, параметр cookie `refresh_token` и заголовок
  `X-CSRF-Token` уходят.

Контракт уже требует `bearerAuth` у ручек данных, а бэк читает access только из cookie
[`access_token`](https://github.com/go-park-mail-ru/2026_2_Cringe_Driven_Development/blob/4094350/internal/middleware/authenticate.go#L19),
заголовок `Authorization` он не смотрит. После переезда код и контракт сходятся.

## Overlay

Публичный контракт получается из `spec/openapi.json` действиями
[OpenAPI Overlay](https://spec.openapis.org/overlay/v1.0.0.html) 1.0.0 из `spec/bff.overlay.yaml`:

- удаляется `/auth/refresh`: refresh делает сам BFF (см. сценарий [«Access истёк»](/bff/auth#access-истек));
- `/auth/register` и `/auth/login` отвечают схемой `User` и заголовком `Set-Cookie`. `update` сливает
  объекты рекурсивно: без предварительного `remove` схема `User` слилась бы с исходной `{ user, tokens }`,
  и токены попали бы в публичный контракт. Поэтому сначала `remove` на `content`, потом `update`;
- `/auth/logout` без тела запроса, отвечает `204` и `Set-Cookie`;
- `bearerAuth` заменяется схемами `sessionCookie` и `csrfHeader`: ручкам данных и `logout` нужны обе,
  `register` и `login` только `csrfHeader`;
- у ручек данных появляются ответы `401` и `403` со схемой `Error`.

```yaml
overlay: 1.0.0
info:
  title: Публичный контракт BFF
  version: 1.0.0
extends: openapi.json
actions:
  # /auth/refresh делает сам BFF, наружу его не отдаём
  - target: $.paths['/auth/refresh']
    remove: true

  # register и login: наружу отдаётся только User, токены остаются на сервере;
  # update сливает объекты, поэтому старый content сначала удаляется
  - target: $.paths['/auth/register'].post.responses['201'].content
    remove: true
  - target: $.paths['/auth/register'].post.responses['201']
    update:
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/User'
      headers:
        Set-Cookie:
          schema:
            type: string
  - target: $.paths['/auth/login'].post.responses['200'].content
    remove: true
  - target: $.paths['/auth/login'].post.responses['200']
    update:
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/User'
      headers:
        Set-Cookie:
          schema:
            type: string

  # logout: без тела запроса, 204 и Set-Cookie, который стирает сессию
  - target: $.paths['/auth/logout'].post.requestBody
    remove: true
  - target: $.paths['/auth/logout'].post.responses['204']
    update:
      headers:
        Set-Cookie:
          schema:
            type: string

  # схемы безопасности
  - target: $.components.securitySchemes.bearerAuth
    remove: true
  - target: $.components.securitySchemes
    update:
      sessionCookie:
        type: apiKey
        in: cookie
        name: __Host-Http-session
      csrfHeader:
        type: apiKey
        in: header
        name: X-CSRF

  # security: register и login — csrfHeader; данные и logout — оба
  - target: $.paths['/auth/register'].post
    update:
      security:
        - csrfHeader: []
  - target: $.paths['/auth/login'].post
    update:
      security:
        - csrfHeader: []
  - target: $.paths['/auth/logout'].post.security
    remove: true
  - target: $.paths['/auth/logout'].post
    update:
      security:
        - sessionCookie: []
          csrfHeader: []
  - target: $.paths['/users/me'].get.security
    remove: true
  - target: $.paths['/users/me'].get
    update:
      security:
        - sessionCookie: []
          csrfHeader: []
  # ... то же для остальных ручек данных без тега bff: /notebooks*, /notebooks/{id}/cells*

  # 401 и 403 со схемой Error у ручек данных
  - target: $.paths['/users/me'].get.responses
    update:
      '401':
        description: Нет сессии
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Error'
      '403':
        description: Не прошла проверка CSRF
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Error'
```

Пример; точные пути зависят от выгрузки Apidog.

## Команды

`bun run sync` выполняет три шага подряд:

1. `apidog` выгружает контракт из Apidog в `spec/openapi.json`;
2. `overlay` выводит публичный контракт:

   ```sh
   openapi-format spec/openapi.json --overlayFile spec/bff.overlay.yaml -o spec/openapi.public.json
   ```

3. `orval` запускает Orval по `orval.config.ts` (см. ниже).

`bun run sync` = `apidog` → `overlay` → `orval`.

Файлы: `spec/openapi.json` создаёт `apidog`, `spec/bff.overlay.yaml` пишется руками,
`spec/openapi.public.json` создаёт `overlay` и коммитится в репозиторий.

## Генерация Orval

Overlay остаётся отдельным файлом: у Orval есть `input.override.transformer`, но overlay — стандартный
декларативный файл, который проверяется в CI. Orval читает уже готовые контракты. Конфиг
`orval.config.ts` в корне монорепы содержит три цели:

```ts
import { defineConfig } from 'orval';

export default defineConfig({
  // клиент браузера: fetch к BFF
  client: {
    input: 'spec/openapi.public.json',
    output: {
      target: 'apps/client/src/api/gen.ts',
      client: 'fetch',
      baseUrl: '/api/v1',
      override: { mutator: { path: 'apps/client/src/api/fetch.ts', name: 'csrfFetch' } }, // ставит X-CSRF: 1
    },
  },
  // собственные ручки BFF: хендлеры Hono с валидацией zod
  bff: {
    input: {
      target: 'spec/openapi.public.json',
      filters: { mode: 'include', tags: ['auth', 'bff'] }, // только /auth/* и тег bff
    },
    output: {
      target: 'apps/bff/src/handlers',
      client: 'hono',
      mode: 'tags-split',
      override: { hono: { validatorOutputPath: 'apps/bff/src/handlers/validator.ts' } },
    },
  },
  // BFF → Go: fetch без ручек с тегом bff
  goApi: {
    input: {
      target: 'spec/openapi.json',
      filters: { mode: 'exclude', tags: ['bff'] },
    },
    output: {
      target: 'apps/bff/src/go/gen.ts',
      client: 'fetch',
      baseUrl: 'http://api:8080/api/v1',
      override: { mutator: { path: 'apps/bff/src/go/fetch.ts', name: 'bearerFetch' } }, // Authorization: Bearer <access>; на двух VPS ещё X-BFF-Key и origin из GO_API_URL
    },
  },
});
```

Пример; точные пути и мутаторы зависят от репозитория. Цель `bff` создаёт хендлеры на `createFactory` из
`hono/factory`: заготовки, тело пишется руками. Вход и ответ проверяются через `zValidator`
(`@hono/zod-validator`); остальные маршруты идут через общий прокси. Пути сгенерированных маршрутов без
`/api/v1` (например `/auth/register`), поэтому приложение BFF монтирует их под `basePath('/api/v1')`.

## Собственные ручки BFF

Ручки, которые есть только у BFF (агрегация, пакетные запросы для сервиса вроде Colab), описываются в
том же проекте Apidog с тегом `bff`. Дальше:

- Go исключает их из своей генерации опцией `output-options.exclude-tags` в конфиге `oapi-codegen`
  ([README](https://github.com/oapi-codegen/oapi-codegen#how-can-i-ignore-parts-of-the-spec-i-dont-care-about));
- в публичный контракт они попадают как есть, overlay их не трогает: `sessionCookie` и `csrfHeader`
  определены в самом проекте Apidog, и ручки с тегом `bff` сразу описываются с этими схемами и ответами
  `401` и `403` со схемой `Error`. Go их не использует, его генерация тег `bff` исключает, а `update`
  в `securitySchemes` у overlay просто сливается с ними;
- цель `goApi` в Orval исключает их через `filters`, а цель `bff` генерирует для них хендлеры.

Пример: `GET /api/v1/notebooks/{id}/view` — BFF параллельно запрашивает у Go блокнот и текущего
пользователя и отдаёт один ответ.

Список разрешённых маршрутов (ниже) остаётся прежним, но маршруты с тегом `bff` обслуживают хендлеры BFF,
а не прокси. Проверка CI «в публичном контракте нет `access_token`, `refresh_token`, `TokenPair`,
`bearerAuth`» действует и для них.

## Проверки в CI

1. Каждое действие overlay находит хотя бы один узел. Без этого правка в Apidog (переименованный путь,
   удалённый ответ) молча ломает overlay: действие ничего не меняет, а публичный контракт расходится с
   задуманным.
2. `spec/openapi.public.json` совпадает с выведенным заново из `spec/openapi.json` и
   `spec/bff.overlay.yaml`.
3. `spec/openapi.public.json` не содержит `access_token`, `refresh_token`, `TokenPair` и `bearerAuth`.
   Так ловится и утечка токенов через слияние, и ручка данных, забытая в overlay.

## Какие запросы BFF пропускает

BFF проксирует только то, что есть в публичном контракте. Список разрешённых маршрутов строится из пар
«шаблон пути + метод»; параметры пути подставляются только в шаблон. Это требование
[RFC 10017 §6.1.3.6](https://www.rfc-editor.org/rfc/rfc10017#section-6.1.3.6):

> When implementing a dynamically configurable proxy, the BFF MUST ensure that it only allows requests to explicitly permitted hosts and paths.

Проверки CSRF идут раньше списка (см. [«Авторизация и CSRF»](/bff/auth#как-bff-проксирует-запрос)), поэтому запрос
без `X-CSRF` получит `403`, а не `404`. Всё, чего нет в контракте, получает `404 not_found` без запроса в Go. Например, в контракте нет
`DELETE /api/v1/notebooks/{id}` (есть только `GET`), поэтому:

```http
DELETE /api/v1/notebooks/42
X-CSRF: 1
Origin: https://cellestial.ru

404 Not Found
{ "code": "not_found", "message": "..." }
```

Пример; в Go такой запрос не уходит.
