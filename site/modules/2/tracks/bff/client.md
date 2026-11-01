---
title: Клиент tRPC
---

# Клиент tRPC

Клиент вызывает процедуры BFF по типам роутера; контракт Go и Orval остаются на серверной стороне.
Список процедур — в [контракте](./contract#роутер), добавление вызова — в
[инструкции по процедурам](./procedures#как-добавить-процедуру).

## Клиент

В модуле №2 используются официальные `@trpc/client` и `@trpc/server` совместимых версий 11.x,
а на BFF — официальный `zod`. Подтрек [«tRPC (client)»](../trpc-client) подключает клиент в приложении.
Собственные React и Zustand команды продолжают использоваться.

Клиент настраивается один раз в общем модуле транспорта:

```ts [apps/client/src/api/client.ts]
// apps/client/src/api/client.ts
import { createTRPCClient, httpBatchLink, TRPCClientError } from '@trpc/client';
import type { AppRouter, BootstrapData } from '@cdd/bff';

export const api = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      maxURLLength: 2000,
      headers: { 'X-CSRF': '1' },
      fetch(url, options) {
        return fetch(url, { ...options, credentials: 'same-origin' });
      },
    }),
  ],
});

const notebook = await api.notebooks.get.query({ id: 1 });
await api.cells.create.mutate({ notebookId: 1, kind: 'code' });

try {
  await api.notebooks.get.query({ id: 1 });
} catch (error) {
  if (error instanceof TRPCClientError) {
    const data = (error as TRPCClientError<AppRouter>).data;
    // data.code — код tRPC, data.appCode — код приложения,
    // data.zodError — ошибки полей от errorFormatter.
    if (data?.code === 'UNAUTHORIZED') {
      // Перевести стор сессии в «гость» и показать форму входа.
    }
  }
  throw error;
}
```

`AppRouter` и `BootstrapData` импортируются только как типы; вывод входов/ответов через
`inferRouterInputs` / `inferRouterOutputs` тоже использует `import type`. Серверный runtime-код в
клиентский бандл не попадает. Начальные данные пользователь получает из HTML без нового Zod в браузере.

Транспорт работает с `/api/trpc` на том же origin. [Официальный `httpBatchLink`](https://trpc.io/docs/client/links/httpBatchLink)
отвечает за батчинг и деление батча по `maxURLLength`, заголовок `X-CSRF: 1` и cookie добавляет общая
настройка. Реализацию HTTP RPC в модуле №2 писать не нужно. Query идут через GET, mutation — через POST;
успешный конверт содержит `result.data`, ошибка — `error` (см. [«Ошибки»](./contract#ошибки)). Если ошибка
возникла в `createContext`, на батч может прийти один конверт `{ error }`: официальный клиент
разбирает его для всех вызовов. Ошибки приходят как `TRPCClientError`, их поля читаются из `data`,
а сообщения интерфейс выбирает по `data.appCode`, не по тексту `message`.

Подписок пока нет. Потоковый вывод ячеек, когда понадобится, пойдёт через SSE на `fetch`: у `EventSource`
нельзя поставить заголовок `X-CSRF`.

**Ручная приёмка MVP.** Проверить успешные query/mutation; неверный вход — ошибка полей
`data.zodError`; `UNAUTHORIZED` — гость и форма входа; клиент не выполняет refresh и не читает cookie.
Новые автотесты клиента в MVP не требуются, существующие проверки репозитория сохраняются.

**Формы.** Поля форм клиент проверяет своими правилами, как сейчас
([`src/utils/credentials.ts`](https://github.com/frontend-park-mail-ru/2026_2_Cringe_Driven_Development/blob/f499d4e/src/utils/credentials.ts#L28)):
своего Zod пока нет. Если вход не прошёл схему на BFF, форма раскладывает `data.zodError` по полям.

В модуле №3 появляются собственные [клиент и сервер tRPC](/modules/3/tracks/trpc) и свой
[Zod](/modules/3/tracks/zod): общие схемы `@cdd/schemas` проверяют поля на BFF и в браузере вместо
ручных правил, вместе со своим [React Hook Form](/modules/3/tracks/react-hook-form).

## Какие вызовы BFF принимает

[RFC 10017 §6.1.3.6](https://www.rfc-editor.org/rfc/rfc10017#section-6.1.3.6):

> When implementing a dynamically configurable proxy, the BFF MUST ensure that it only allows requests to explicitly permitted hosts and paths.

BFF ничего не проксирует: произвольный путь из URL браузера в Go не передаётся.

| Запрос | Как обрабатывается |
| --- | --- |
| RPC к процедуре роутера | Вызывает Go сгенерированным клиентом; путь и метод заданы в коде. |
| HTML | HTML-хендлер использует тот же общий клиент с фиксированным `GET /users/me` и общей логикой refresh. Он не вызывает tRPC по HTTP. |
| API, публичные и служебные маршруты | Обрабатываются до HTML fallback. |
| Внешние `/api/v1` и остальные неизвестные `/api/*` | Не становятся SPA-страницей. |

Для RPC проверки CSRF идут раньше роутера (см. [«Авторизация и CSRF»](./auth#как-bff-обрабатывает-вызов)), поэтому
вызов без `X-CSRF` получит `403`. Вызов несуществующей процедуры получает `404 NOT_FOUND` от tRPC без
запроса в Go:

```http
POST /api/trpc/notebooks.delete
Content-Type: application/json
X-CSRF: 1
Origin: https://cellestial.ru

404 Not Found
{ "error": { "message": "No procedure found on path \"notebooks.delete\"", "code": -32004, "data": { "code": "NOT_FOUND", "httpStatus": 404, "path": "notebooks.delete" } } }
```

*Пример; удаления блокнота в контракте нет.*
