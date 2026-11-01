---
title: Сервис BFF
---

# Миграция на BFF: сервис

Как устроен BFF как программа: точка входа, переменные окружения, health check и логи.
Образ и запуск — в [«Сборке и запуске BFF»](./build-and-run). HTML и начальный пользователь — [«Серверный bootstrap»](./bootstrap). Роутер и процедуры — [«Контракт»](./contract), сессия и CSRF —
[«Авторизация и CSRF»](./auth). Страница описывает целевое состояние: нашёл решение лучше — поправь её в
том же PR, что и код.

## Каркас

BFF — сервер на Hono под Bun. Точка входа `apps/bff/src/index.ts`:

1. проверяет переменные окружения (см. [«Переменные окружения»](#переменные-окружения));
2. читает HTML-шаблон из фиксированного пути образа в память, проверяет единственный
   `script#bootstrap` и `type="application/json"`; ошибка — отказ старта, без раздачи пустого HTML;
3. создаёт `new Hono()` и access log;
4. отвечает на внутренний `GET /health` без вызова Go;
5. отдаёт `/api/trpc` и `/api/trpc/*` официальному `fetchRequestHandler` из
   `@trpc/server/adapters/fetch`, не оборачивая ошибки RPC в HTML;
6. отвергает остальные `/api/*`, отдельно раздаёт публичные файлы из явного списка сборки;
7. для GET/HEAD с `Accept: text/html` включает HTML-хендлер с общей сессией и bootstrap,
   включая прямые ссылки на клиентские экраны; остальные запросы — ошибка маршрутизации;
8. экспортирует `{ port, fetch }`: Bun поднимает HTTP-сервер.

Маршруты API, служебные и public обрабатываются до SPA fallback; HEAD сохраняет статус и заголовки
соответствующего GET, но не содержит тела. Чужой URL не выбирает произвольный файл образа.
[Проверка и преобразование шаблона](./bootstrap#вставка-данных) используют Bun HTMLRewriter и
серверный serialize-javascript; на каждый ответ создаётся отдельный преобразователь.

Фрагмент подключения адаптера, не полный сервер:

```ts
// Внутри обработчика Hono; appRouter и createContext — модули приложения.
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from './router';
import { createContext } from './context';

export function handleTrpc(req: Request): Promise<Response> {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext, // ({ req, resHeaders }): сначала CSRF; resHeaders — для Set-Cookie
  });
}
```

*Пример подключения; обработчик регистрируется на обоих путях tRPC, `onError: logTrpcError`
добавляет лог ошибок процедур. Проверка шаблона и HTML-маршрут входят в каркас выше.*

- `appRouter` — роутер из [«Контракта»](./contract#роутер).
- `createContext` — из [«Авторизации и CSRF»](./auth#как-bff-обрабатывает-вызов). Адаптер передаёт
  `req` и `resHeaders`: сначала CSRF, затем общий слой сессии; через `resHeaders` процедуры ставят
  `Set-Cookie`. Отдельного Hono middleware для CSRF нет. HTML вызывает общий слой сессии напрямую,
  без собственного HTTP-запроса к tRPC.
- Адаптер возвращает `Response`, Hono отдаёт его как есть. HTML-хендлер завершает решение о cookie
  до отправки тела, включая ответ 503 после успешного refresh.

## Переменные окружения

| Переменная | Что | Пример |
|---|---|---|
| `SESSION_KEY` | ключ AES-256-GCM cookie сессии, base64, ровно 32 байта | — |
| `APP_ORIGIN` | origin приложения для проверки `Origin` | `https://cellestial.ru` |
| `GO_API_URL` | адрес Go API | `http://api:8080/api/v1` |
| `PORT` | порт BFF, по умолчанию `3000` | `3000` |

Переменные проверяет zod-схема в `apps/bff/src/env.ts` при старте:

```ts
// apps/bff/src/env.ts
import { z } from 'zod';

const Env = z.object({
  SESSION_KEY: z
    .string()
    .base64()
    .refine((s) => Buffer.from(s, 'base64').length === 32, 'нужно ровно 32 байта'),
  APP_ORIGIN: z.string().url().refine((s) => new URL(s).origin === s, 'только origin, без пути и слэша'),
  GO_API_URL: z.string().url(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000), // пустой PORT иначе стал бы 0
});

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  const names = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))];
  console.error(`BFF не стартует, неверные переменные окружения: ${names.join(', ')}`);
  process.exit(1);
}
export const env = parsed.data;
```

*Пример.*

Пустая или неверная переменная — выход с кодом 1, в сообщении только имена. Значения в логи не попадают:
ни при старте, ни потом. `APP_ORIGIN` сравнивается с заголовком `Origin` побуквенно, поэтому схема
пропускает только origin: `https://cellestial.ru/` со слэшем не пройдёт. Новый `SESSION_KEY` даёт
`openssl rand -base64 32`; смена ключа разлогинивает всех.

## Health check

`GET /health` отвечает `200` с телом `ok`. Это liveness самого BFF: процесс жив и принимает запросы. Go он
не вызывает: живость Go проверяет healthcheck сервиса `api` в compose, а BFF стартует после него
(`depends_on … service_healthy` на первом этапе с одной VPS, см. [«На проде»](./build-and-run#на-проде)).

Путь лежит вне `/api/trpc`: Caddy явно запрещает внешний `/health`, в SPA он не попадает.
Проверяет его только compose изнутри контейнера.

В MVP работает один экземпляр BFF, короткое окно недоступности при выпуске допустимо.
Готовность к приёму трафика наступает после проверки конфигурации и HTML-шаблона при старте;
новый публичный readiness endpoint для этого не нужен. `/health` остаётся внутренним liveness.
При остановке нужен graceful shutdown: прекратить приём новых запросов и дать текущим завершиться.
Ожидание имеет конечный срок, после него оставшиеся запросы завершаются принудительно; сетевые вызовы
Go также имеют конечный таймаут. Срок остановки контейнера должен позволять BFF выполнить это завершение.

## Ошибки и логи

Логи — JSON-строки в stdout, их собирает Docker.

- **Запрос — одна строка:** `time`, `method`, `path`, `procedure` (для tRPC), `status`, `ms`. `path` — без
  query string: в `?input=` у query лежит вход процедуры. `procedure` — часть пути после `/api/trpc/`, у
  батча — имена через запятую. `/health` не логируется: compose дёргает его каждые 5 с.
- **Никогда не логируются:** cookie, `Authorization`, вход процедур, токены, `SESSION_KEY`, JSON пользователя из bootstrap.
- **Ошибка процедуры.** `onError` адаптера пишет строку с `procedure`, `code` и `appCode`. Он получает
  `TRPCError`, а не готовый ответ, поэтому `appCode` считает той же функцией, что и `errorFormatter`
  (`appCodeOf(error)`, см. [«Ошибки»](./contract#ошибки)). Для
  `INTERNAL_SERVER_ERROR` — ещё стек исключения, только в лог.
- **Неожиданное исключение** клиент получает как `INTERNAL_SERVER_ERROR` без стека и текста исключения:
  `errorFormatter` подменяет `message` на `Internal Server Error`, а `initTRPC.create` получает
  `isDev: false`. Без него tRPC решает по `NODE_ENV`, уйдёт ли стек в `data.stack`, а в образе
  `NODE_ENV` не задан.
- **Ошибки HTML при обращении к Go** обрабатываются по [правилам bootstrap](./bootstrap#ошибки):
  HTTP `503` без запуска приложения, с сохранением сессии и новой cookie после успешного refresh.
  Политика HTML-ответов — в [«Кешировании»](./bootstrap#кеширование).
- **Прочие ошибки вне tRPC** ловит `app.onError`: в лог — строка с `path` и текстом ошибки, клиенту — `500` с телом
  `Internal Server Error`.

```ts
// apps/bff/src/log.ts
import type { MiddlewareHandler } from 'hono';

const TRPC = '/api/trpc/';

export const accessLog: MiddlewareHandler = async (c, next) => {
  if (c.req.path === '/health') return next();
  const start = performance.now();
  await next();
  console.log(
    JSON.stringify({
      time: new Date().toISOString(),
      method: c.req.method,
      path: c.req.path,
      procedure: c.req.path.startsWith(TRPC) ? c.req.path.slice(TRPC.length) : undefined,
      status: c.res.status,
      ms: Math.round(performance.now() - start),
    }),
  );
};
```

*Пример; `logTrpcError` устроен так же.*

## Сборка и образ {#сборка-и-образ}

Команда Bun, состав образа и фиксированные пути — в [«Сборке и образе»](./build-and-run#сборка-и-образ).

## На проде {#на-проде}

Compose, Caddy, секреты и граница исходного среза и целевого запуска — в [«На проде»](./build-and-run#на-проде).
