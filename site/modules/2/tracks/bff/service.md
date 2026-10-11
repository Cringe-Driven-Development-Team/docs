---
title: Сервис BFF
---

# Миграция на BFF: сервис

Как устроен сам BFF как программа: точка входа, переменные окружения, health check, логи, образ и запуск
на проде. Роутер и процедуры — [«Контракт»](./contract), сессия и CSRF —
[«Авторизация и CSRF»](./auth). Страница описывает целевое состояние: нашёл решение лучше — поправь её в
том же PR, что и код.

## Каркас

BFF — сервер на Hono под Bun. Точка входа `apps/bff/src/index.ts` делает пять шагов:

1. проверяет переменные окружения (см. [«Переменные окружения»](#переменные-окружения));
2. создаёт `new Hono()`;
3. отвечает на `GET /health`;
4. отдаёт `/api/trpc/*` адаптеру tRPC — `fetchRequestHandler` из `@trpc/server/adapters/fetch`;
5. экспортирует `{ port, fetch }`: из такого `export default` Bun сам поднимает HTTP-сервер.

```ts
// apps/bff/src/index.ts
import { env } from './env'; // первым: неверные переменные — выход до старта сервера
import { Hono } from 'hono';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from './router';
import { createContext } from './context';
import { accessLog, logTrpcError } from './log';

const app = new Hono();

app.use(accessLog);
app.get('/health', (c) => c.text('ok'));
app.all('/api/trpc/*', (c) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req: c.req.raw,
    router: appRouter,
    createContext, // ({ req, resHeaders }): CSRF и сессия из req, resHeaders — для Set-Cookie
    onError: logTrpcError,
  }),
);
app.onError((err, c) => {
  console.error(JSON.stringify({ time: new Date().toISOString(), level: 'error', path: c.req.path, error: String(err) }));
  return c.text('Internal Server Error', 500);
});

export default { port: env.PORT, fetch: app.fetch };
```

*Пример; имена модулей — на усмотрение, порядок шагов — такой.*

- `appRouter` — роутер из [«Контракта»](./contract#роутер).
- `createContext` — из [«Авторизации и CSRF»](./auth#как-bff-обрабатывает-вызов). Адаптер передаёт ему
  `req` и `resHeaders`: он проверяет CSRF и расшифровывает cookie сессии из `req`, а `resHeaders` кладёт в
  контекст — через него процедуры ставят новую cookie (`Set-Cookie`). Отдельного middleware Hono для этих
  проверок нет — правила в одном месте.
- Адаптер берёт стандартный `Request` (`c.req.raw`) и возвращает `Response`; Hono отдаёт его как есть.

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
  PORT: z.coerce.number().int().default(3000),
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
(`depends_on … service_healthy`, см. [«На проде»](#на-проде)).

Путь лежит вне `/api/trpc`, и маршрута на него в Caddy нет: снаружи `/health` попадает в SPA. Проверяет
его только compose изнутри контейнера.

## Ошибки и логи

Логи — JSON-строки в stdout, их собирает Docker.

- **Запрос — одна строка:** `time`, `method`, `path`, `procedure` (для tRPC), `status`, `ms`. `path` — без
  query string: в `?input=` у query лежит вход процедуры. `procedure` — часть пути после `/api/trpc/`, у
  батча — имена через запятую. `/health` не логируется: compose дёргает его каждые 5 с.
- **Никогда не логируются:** cookie, `Authorization`, вход процедур, токены, `SESSION_KEY`.
- **Ошибка процедуры.** `onError` адаптера пишет строку с `procedure`, `code` и `appCode` (`appCode` — тот
  же, что `errorFormatter` кладёт в ответ, см. [«Ошибки»](./contract#ошибки)). Для
  `INTERNAL_SERVER_ERROR` — ещё стек исключения, только в лог.
- **Неожиданное исключение** клиент получает как `INTERNAL_SERVER_ERROR` без стека и текста исключения:
  `errorFormatter` подменяет `message` на `Internal Server Error`, а `initTRPC.create` получает
  `isDev: false`. Без него tRPC решает по `NODE_ENV`, уйдёт ли стек в `data.stack`, а в образе
  `NODE_ENV` не задан.
- **Ошибки вне tRPC** ловит `app.onError`: в лог — строка с `path` и текстом ошибки, клиенту — `500` с телом
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

## Сборка и образ

BFF собирается в один файл: `apps/bff/dist/bff.js`. Задача `build` пакета `apps/bff` в Turborepo:

```sh
bun build src/index.ts --target bun --outfile dist/bff.js
```

В бандл входят `@cdd/schemas` и клиент к Go от Orval, поэтому `node_modules` в образе не нужен.
Turborepo собирает зависимости раньше (`^build`), см. [«Монорепа фронта»](../bff#монорепа-фронта).

`apps/bff/Dockerfile`:

```dockerfile
FROM oven/bun:1.4.3-alpine
WORKDIR /app
COPY dist/bff.js .
USER bun
EXPOSE 3000
CMD ["bun", "bff.js"]
```

*Пример; `1.4.3-alpine` — последний тег на 12.10.2026, монорепа требует bun не ниже 1.4.0. Версия
закрепляется точной, без `latest`.*

- **Почему бандл на alpine.** В alpine есть `wget` для healthcheck и shell для отладки. Бинарник
  `bun build --compile` на distroless отвергнут: ни `wget`, ни shell. Исходники с `node_modules` —
  тяжёлый образ.
- **Пользователь `bun`** уже есть в образе `oven/bun`: сервис работает не от root.

Образ публикуется в GHCR с тегом по SHA коммита. Собирает и публикует его CI из
[frontend#4](https://github.com/Cringe-Driven-Development-Team/frontend/issues/4).

## На проде

BFF встаёт на ту же VPS рядом с Go API по образцу сервиса `api`. В `infra` меняются три места.

**Compose** —
[`ansible/roles/app/templates/compose.yml.j2`](https://github.com/Cringe-Driven-Development-Team/infra/blob/2f97437/ansible/roles/app/templates/compose.yml.j2#L18-L52).
Сервис `api` там берёт образ `{{ app_backend_image }}:${BACKEND_IMAGE_TAG:?…}`
([`:19`](https://github.com/Cringe-Driven-Development-Team/infra/blob/2f97437/ansible/roles/app/templates/compose.yml.j2#L19)),
ждёт `postgres` через `depends_on`
([`:42`](https://github.com/Cringe-Driven-Development-Team/infra/blob/2f97437/ansible/roles/app/templates/compose.yml.j2#L42))
и проверяется `wget`
([`:45-46`](https://github.com/Cringe-Driven-Development-Team/infra/blob/2f97437/ansible/roles/app/templates/compose.yml.j2#L45-L46)).
Сервис `bff` устроен так же:

```yaml
  bff:
    image: {{ app_bff_image }}:${BFF_IMAGE_TAG:?bff tag is required}
    restart: unless-stopped
    environment:
      SESSION_KEY: ${SESSION_KEY:?session key is required}
      APP_ORIGIN: ${APP_ORIGIN:?app origin is required}
      GO_API_URL: http://api:8080/api/v1
    depends_on:
      api:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-q", "-O", "/dev/null", "http://127.0.0.1:3000/health"]
      interval: 5s
      timeout: 3s
      start_period: 10s
      retries: 12
    networks:
      - app
```

*Пример.*

- Порты не публикуются: BFF виден только из сети `app`, снаружи — через Caddy.
- `PORT` не задаётся: в общем `.env` уже есть `PORT=8080` для `api`, а BFF хватает значения по
  умолчанию `3000`.
- `app_bff_image` — в `roles/app/defaults/main.yml` рядом с `app_backend_image`, имя образа — то, что
  публикует CI. `BFF_IMAGE_TAG` и `SESSION_KEY` попадают в `.env` через `env.j2`, как `BACKEND_IMAGE_TAG`
  и секреты Go.

**Caddy** —
[`ansible/roles/caddy/templates/Caddyfile.j2`](https://github.com/Cringe-Driven-Development-Team/infra/blob/2f97437/ansible/roles/caddy/templates/Caddyfile.j2#L5-L15).
Сейчас там `handle /api/v1/*` → `reverse_proxy api:8080`
([`:5-7`](https://github.com/Cringe-Driven-Development-Team/infra/blob/2f97437/ansible/roles/caddy/templates/Caddyfile.j2#L5-L7))
и `handle` для SPA
([`:15`](https://github.com/Cringe-Driven-Development-Team/infra/blob/2f97437/ansible/roles/caddy/templates/Caddyfile.j2#L15)).
Перед SPA встаёт маршрут на BFF:

```txt
	handle /api/trpc/* {
		reverse_proxy bff:3000
	}
```

Снаружи `/api/v1` при переключении пропадает: браузер ходит только в BFF — см.
[«Переключение»](../bff#переключение).

**Секреты.** `SESSION_KEY` — в Ansible Vault, как остальные секреты: `vault_session_key` в `vault.yml` и
открытое имя `session_key` в `vars.yml`. `APP_ORIGIN` не секрет и лежит открыто.

CI из [frontend#4](https://github.com/Cringe-Driven-Development-Team/frontend/issues/4) собирает
`dist/bff.js`, образ и публикует его в GHCR. Compose, `.env` и Caddy правятся в `infra` отдельной задачей;
она пока не заведена.
