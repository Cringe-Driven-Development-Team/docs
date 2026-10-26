---
title: Сервис BFF
---

# Миграция на BFF: сервис

Как устроен сам BFF как программа: точка входа, переменные окружения, health check, логи, образ и запуск
на проде. HTML и начальный пользователь — [«Серверный bootstrap»](./bootstrap). Роутер и процедуры — [«Контракт»](./contract), сессия и CSRF —
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
(`depends_on … service_healthy` на первом этапе с одной VPS, см. [«На проде»](#на-проде)).

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
- **Ошибки HTML при обращении к Go:** сеть, таймаут, `5xx`, `403 s2s_forbidden` и неожиданные ответы
  дают страницу временной недоступности с HTTP `503`, без деталей и запуска приложения. Сессия не
  удаляется; успешный refresh сохраняет новую cookie даже при последующем 503. Общий клиент Go
  имеет конечный таймаут. Bootstrap HTML, включая гостевой, и HTML 503 — `Cache-Control: private, no-store`.
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

## Сборка и образ

BFF собирается в один файл: `apps/bff/dist/bff.js`. Задача `build` пакета `apps/bff` в Turborepo:

```sh
bun build src/index.ts --target bun --outfile dist/bff.js
```

В бандл входят все зависимости: `hono`, `@trpc/server`, `zod`, `@cdd/schemas` и клиент к Go от Orval, поэтому
`serialize-javascript` также включён в серверный бандл, но не в клиентский; `node_modules` в образе не нужен.
Turborepo собирает зависимости раньше (`^build`), см. [«Монорепа фронта»](../bff#монорепа-фронта).

Упаковка — отдельный шаг после сборок клиента Vite и BFF Bun, вне `build` пакета BFF.
Обратная зависимость `bff#build` от `client#build` создаст цикл: клиент уже зависит от типов BFF.
`apps/bff/Dockerfile`; контекст сборки — корень монорепы:
`docker build -f apps/bff/Dockerfile .`. Потребляются готовые результаты обеих сборок:

```dockerfile
FROM oven/bun:1.4.3-alpine
WORKDIR /app
COPY apps/bff/dist/bff.js ./bff.js
COPY apps/client/dist/index.html ./client/index.html
USER bun
EXPOSE 3000
CMD ["bun", "bff.js"]
```

*Пример; `1.4.3-alpine` — последний тег на 12.10.2026, монорепа требует bun не ниже 1.4.0. Версия
закрепляется точной, без `latest`. Если сборка содержит favicon, robots, manifest или другие файлы
основного origin, упаковка дополнительно копирует только их по явному списку в `./client/public/`;
JS/CSS остаются в CDN. Шаблон читается по фиксированному `/app/client/index.html`.*

- **Почему бандл на alpine.** В alpine есть `wget` для healthcheck и shell для отладки. Бинарник
  `bun build --compile` на distroless отвергнут: ни `wget`, ни shell. Исходники с `node_modules` —
  тяжёлый образ.
- **Пользователь `bun`** уже есть в образе `oven/bun`: сервис работает не от root.

Образ публикуется в GHCR с тегом по SHA коммита. Собирает и публикует его CI из
[frontend#4](https://github.com/Cringe-Driven-Development-Team/frontend/issues/4). HTML и BFF — один SHA;
публикация ассетов предшествует выкладке образа. Полный [выпуск и откат](./bootstrap#выпуск-и-откат)
включает запрет выкладки при ошибке загрузки и сохранение ассетов предыдущего образа.

## На проде

Первый этап из [infra#58](https://github.com/Cringe-Driven-Development-Team/infra/issues/58)
реализован в [infra PR #71](https://github.com/Cringe-Driven-Development-Team/infra/pull/71): BFF ставится
на действующую VPS рядом с Go API. Затем [infra#59](https://github.com/Cringe-Driven-Development-Team/infra/issues/59)
развёртывает Go и новый PostgreSQL на приватной VPS2 без копирования старой БД; изменение контракта
и S2S-проверка в Go —
[backend#41](https://github.com/Cringe-Driven-Development-Team/backend/issues/41).

**Compose** —
[`ansible/roles/app/templates/compose.yml.j2`](https://github.com/Cringe-Driven-Development-Team/infra/blob/175e37ae77ae3b495ab7dd29c5d41a23e25aec50/ansible/roles/app/templates/compose.yml.j2#L18-L84).
Сервис `api` там берёт образ <code v-pre>{{ app_backend_image }}&#58;${BACKEND_IMAGE_TAG:?…}</code>
([`:19`](https://github.com/Cringe-Driven-Development-Team/infra/blob/175e37ae77ae3b495ab7dd29c5d41a23e25aec50/ansible/roles/app/templates/compose.yml.j2#L19)),
ждёт `postgres` через `depends_on`
([`:47-51`](https://github.com/Cringe-Driven-Development-Team/infra/blob/175e37ae77ae3b495ab7dd29c5d41a23e25aec50/ansible/roles/app/templates/compose.yml.j2#L47-L51))
и проверяется `wget`
([`:52-57`](https://github.com/Cringe-Driven-Development-Team/infra/blob/175e37ae77ae3b495ab7dd29c5d41a23e25aec50/ansible/roles/app/templates/compose.yml.j2#L52-L57)).
Сервис `bff` устроен так же:

```yaml
  bff:
    image: {{ app_bff_image }}:${BFF_IMAGE_TAG:?bff tag is required}
    restart: unless-stopped
    environment:
      SESSION_KEY: ${SESSION_KEY:?session key is required}
      APP_ORIGIN: ${APP_ORIGIN:?app origin is required}
      GO_API_URL: http://api:8080/api/v1
      BFF_KEY: ${BFF_API_KEY:?bff api key is required}
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

*Пример первого этапа на одной VPS.* После переноса Go на VPS2 у BFF и Go разные Compose-проекты:
`depends_on: api` между хостами не работает, а `GO_API_URL` указывает на приватный адрес VPS2.

- Порты не публикуются: BFF виден только из сети `app`, снаружи — через Caddy.
- `PORT` не задаётся, BFF хватает значения по умолчанию `3000`. Ловушка — скопировать `${PORT:-8080}` у
  `api` как `${PORT:-3000}`: подстановка compose возьмёт `PORT=8080` из общего `.env`.
- `app_bff_image` — в `roles/app/defaults/main.yml` рядом с `app_backend_image`, имя образа — то, что
  публикует CI. `BFF_IMAGE_TAG`, `SESSION_KEY`, `BFF_API_KEY` и `APP_ORIGIN` попадают в `.env` через `env.j2`, как
  `BACKEND_IMAGE_TAG` и секреты Go; `APP_ORIGIN` там — <code v-pre>APP_ORIGIN=https://{{ app_domain }}</code>
  (`app_domain` уже есть в `group_vars/all/vars.yml`). Без них Compose не поднимет сервис.

**Выкатка.** Сейчас отдельный
[`deploy-bff.yml`](https://github.com/Cringe-Driven-Development-Team/infra/blob/175e37ae77ae3b495ab7dd29c5d41a23e25aec50/ansible/deploy-bff.yml#L1-L33)
принимает `bff_image_tag`; задача
[`pull-image.yml`](https://github.com/Cringe-Driven-Development-Team/infra/blob/175e37ae77ae3b495ab7dd29c5d41a23e25aec50/ansible/roles/app/tasks/pull-image.yml#L1-L33)
тянет выбранный образ BFF из GHCR. В `env.j2` тег попадает в
<code v-pre>BFF_IMAGE_TAG={{ bff_image_tag }}</code>, а
[`validate.yml`](https://github.com/Cringe-Driven-Development-Team/infra/blob/175e37ae77ae3b495ab7dd29c5d41a23e25aec50/ansible/roles/app/tasks/validate.yml#L1-L54)
проверяет тег и `session_key`. Целевой выпуск и откат из
[frontend#4](https://github.com/Cringe-Driven-Development-Team/frontend/issues/4) и
[infra#74](https://github.com/Cringe-Driven-Development-Team/infra/issues/74) передают в этот playbook
`bff_image_ref` по digest и полный SHA. Порядок шагов описан в [«Выкатке»](./release) и
[«Откате»](./rollback).

**Caddy** —
[`ansible/roles/caddy/templates/Caddyfile.j2`](https://github.com/Cringe-Driven-Development-Team/infra/blob/175e37ae77ae3b495ab7dd29c5d41a23e25aec50/ansible/roles/caddy/templates/Caddyfile.j2#L18-L45).
Он возвращает 404 на внешнем `/health`, а остальные запросы передаёт BFF; до первой выкатки BFF
отвечает заглушкой 503. HTML BFF отдаёт сам, а JS/CSS остаются в CDN:

```txt
  handle /health {
    respond 404
  }
  handle {
    reverse_proxy bff:3000
  }
```

*Упрощённый фрагмент текущего шаблона. BFF сам обрабатывает `/api/trpc`, ограничивает выдачу
публичных файлов и HTML; неизвестные API-пути возвращают ошибку, а не SPA. Полный шаблон содержит
также политику CSP и заглушку до первого запуска BFF.*

Снаружи `/api/v1` при переключении пропадает: браузер ходит в BFF — см.
[«Переключение»](../bff#переключение).

**Секреты.** `SESSION_KEY` — в Ansible Vault, как остальные секреты: `vault_session_key` в `vault.yml` и
открытое имя `session_key` в `vars.yml`. `APP_ORIGIN` не секрет и лежит открыто.

CI из [frontend#4](https://github.com/Cringe-Driven-Development-Team/frontend/issues/4) собирает
`dist/bff.js` и клиент Vite из одного коммита, публикует ассеты, затем упаковывает HTML
и серверный бандл в образ и публикует его в GHCR. Отдельного promote клиента после playbook нет.
Compose, `.env` и Caddy первого этапа добавлены в [infra PR #71](https://github.com/Cringe-Driven-Development-Team/infra/pull/71).

Канарейка — отдельный следующий этап после MVP. Для небольшого стабильного сегмента нужно
согласованно направлять HTML/RPC в одну версию, расширять долю по ошибкам и задержкам и возвращать
трафик при ухудшении. Нужны читаемые обеими версиями cookie, безопасный refresh между экземплярами,
совместимость API с открытыми вкладками и безопасные изменения Go/БД с откатом. Совместный SHA
HTML/BFF не обновляет JavaScript открытой вкладки; in-memory single-flight на 10 секунд не блокирует
refresh между процессами. Подробности — в [«Переключении»](../bff#переключение).
