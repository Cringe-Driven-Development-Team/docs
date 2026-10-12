# Подстраница «Сервис BFF» трека BFF — дизайн

## 1. Зачем

Документы трека BFF описывают контракт (роутер tRPC, Orval, свой клиент tRPC) и безопасность (cookie сессии,
CSRF, refresh, сценарии). Сам сервис как программа не описан: слово «Hono» на страницах трека встречается
один раз (`site/modules/2/tracks/bff.md`, «Что меняется → BFF»). Денису, который пишет BFF, не по чему
собрать каркас, переменные окружения, health check, логи, образ и запуск на проде, а ментору — не по чему
принимать.

Цель: новая подстраница трека «Сервис BFF» фиксирует целевое состояние сервиса конкретными решениями, как
«Контракт» и «Авторизация и CSRF». Денис реализует по ней; если находит вариант лучше — правит страницу в
том же PR.

## 2. Решения

1. **Место — `site/modules/2/tracks/bff/service.md`**, `title: Сервис BFF`; в frontmatter трека
   `pages: [contract, auth, service]`.
2. **Адаптер — `fetchRequestHandler` из `@trpc/server/adapters/fetch`** в маршруте Hono
   `app.all('/api/trpc/*', …)` с `req: c.req.raw`. Отвергнуто: `@hono/trpc-server` — лишняя зависимость
   поверх официального адаптера.
3. **CSRF и сессия — в `createContext`**, как на «Авторизации и CSRF»: `createContext` получает от адаптера
   `req` и `resHeaders`, читает cookie из `req`, пишет `Set-Cookie` в `resHeaders`. Отдельного слоя
   middleware Hono для этих проверок нет: правила в одном месте.
4. **Переменные окружения проверяются при старте zod-схемой**; ошибка — выход с кодом 1 и сообщением с
   именами переменных, без значений.
5. **Health check — liveness самого BFF**: `GET /health` → `200 ok`, Go не вызывает. Живость Go — его
   healthcheck в compose и `depends_on … service_healthy`.
6. **Образ — бандл на `oven/bun:<точная версия>-alpine`**: `bun build --target bun` в один файл
   `apps/bff/dist/bff.js`. Отвергнуто: бинарник `--compile` на distroless (нет `wget` для healthcheck,
   нечем отлаживать) и исходники с `node_modules` (тяжёлый образ).
7. **Прод — по образцу Go API**: образ в GHCR с тегом по SHA, сервис `bff` в compose с обязательными
   `${VAR:?…}` и healthcheck через `wget`, маршрут Caddy `/api/trpc/*` → `bff:3000`.

## 3. Содержание страницы

Разделы `##` в таком порядке:

1. **Каркас.** Файл `apps/bff/src/index.ts`: проверка env → `new Hono()` → `GET /health` →
   `app.all('/api/trpc/*', (c) => fetchRequestHandler({ endpoint: '/api/trpc', req: c.req.raw, router: appRouter, createContext, onError }))`
   → `export default { port: env.PORT, fetch: app.fetch }` (запускает Bun). Пример кода — блок `ts` с
   пометкой «Пример». Ссылки: роутер — [«Контракт»](./contract#роутер), `createContext` —
   [«Авторизация и CSRF»](./auth#как-bff-обрабатывает-вызов).
2. **Переменные окружения.** Таблица:

   | Переменная | Что | Пример |
   |---|---|---|
   | `SESSION_KEY` | ключ AES-256-GCM cookie сессии, base64, ровно 32 байта | — |
   | `APP_ORIGIN` | origin приложения для проверки `Origin` | `https://cellestial.ru` |
   | `GO_API_URL` | адрес Go API | `http://api:8080/api/v1` |
   | `PORT` | порт BFF, по умолчанию `3000` | `3000` |

   Проверка при старте — zod-схема в `apps/bff/src/env.ts`; неверная или пустая переменная — выход с
   кодом 1, в сообщении только имена. Значения секретов в логи не попадают.
3. **Health check.** `GET /health` → `200`, тело `ok`; Go не вызывает; путь вне `/api/trpc`, Caddy его
   наружу не отдаёт (маршрута нет).
4. **Ошибки и логи.**
   - Одна JSON-строка в stdout на запрос: `time`, `method`, `path`, `procedure` (для tRPC), `status`,
     `ms`.
   - Никогда не логируются: cookie, `Authorization`, вход процедур, токены, `SESSION_KEY`.
   - `onError` адаптера tRPC пишет `code` и `appCode`; неожиданное исключение клиенту — `INTERNAL_SERVER_ERROR`
     без стека и текста исключения.
   - Ошибки вне tRPC — `app.onError`: `500` с телом `Internal Server Error`.
5. **Сборка и образ.**
   - Задача `build` пакета `apps/bff` в Turborepo:
     `bun build src/index.ts --target bun --outfile dist/bff.js` — в бандл входят `@cdd/schemas` и клиент к
     Go от Orval.
   - `apps/bff/Dockerfile`: `FROM oven/bun:<точная версия>-alpine`, `WORKDIR /app`, `COPY dist/bff.js .`,
     `USER bun`, `EXPOSE 3000`, `CMD ["bun", "bff.js"]`.
   - Образ — в GHCR с тегом по SHA коммита; собирает и публикует CI из frontend#4.
6. **На проде.** Что меняется в `infra` (одна VPS):
   - `ansible/roles/app/templates/compose.yml.j2`: сервис `bff` по образцу `api` — образ
     `{{ app_bff_image }}:${BFF_IMAGE_TAG:?…}`, переменные из §2 с `:?`, `GO_API_URL: http://api:8080/api/v1`,
     healthcheck `wget -q -O /dev/null http://127.0.0.1:3000/health`, `depends_on: api: condition: service_healthy`,
     сеть `app`, порты не публикуются.
   - `ansible/roles/caddy/templates/Caddyfile.j2`: `handle /api/trpc/*` → `reverse_proxy bff:3000`, перед
     `handle` для SPA. Снаружи `/api/v1` пропадает при переключении — см. трек, раздел «Переключение».
   - Секреты (`SESSION_KEY`) — в Ansible Vault, как остальные.

Последний абзац страницы: что делают CI (frontend#4) и задача в `infra`, если она заведена.

## 4. Что не входит

- CI/CD BFF — frontend#4.
- Задача в `infra` на compose и Caddy — заводится отдельно по просьбе пользователя.
- Две VPS и `X-BFF-Key` — уже на странице трека, раздел «Две VPS».
- Метрики, трейсинг, rate limiting.

## 5. Проверка

- Тесты docs (`scripts/bff-pages.test.ts`, `scripts/modules-data.test.ts`):
  - у трека `bff` подстраницы «Контракт», «Авторизация и CSRF», «Сервис BFF» в этом порядке;
  - на странице шесть разделов §3 в этом порядке;
  - есть `fetchRequestHandler`, `@trpc/server/adapters/fetch`, `/health`, `SESSION_KEY`, `APP_ORIGIN`,
    `GO_API_URL`, `oven/bun:`, `-alpine`, `bff:3000`, `service_healthy`;
  - нет `@hono/trpc-server`;
  - ссылки `./contract#роутер` и `./auth#как-bff-обрабатывает-вызов` ведут на существующие заголовки.
- `bun run typecheck && bun run test && bun run build`.
- Превью ветки или прод после мержа: подстраница в меню трека и в шапке, ссылки работают.

## 6. Проверенные факты

- docs `main` `c65e17e`:
  - `site/modules/2/tracks/bff.md:12` — `pages: [contract, auth]`; «Что меняется → BFF» — «Новый сервис на
    Hono с роутером tRPC на `/api/trpc`».
  - `site/modules/2/tracks/bff/auth.md:61` — раздел «Как BFF обрабатывает вызов»; `:78` — «если токены
    сменились, BFF дописывает новую cookie в `resHeaders`»; `:97` — «CSRF», проверки в `createContext`.
  - `site/modules/2/tracks/bff/auth.md:26` — `SESSION_KEY`, AES-256-GCM, 32 байта.
  - `scripts/modules-data.test.ts:14` — подстраницы `bff`: «Контракт», «Авторизация и CSRF».
- infra `main` `2f97437`:
  - `ansible/roles/app/templates/compose.yml.j2:18-19` — сервис `api`, образ
    `{{ app_backend_image }}:${BACKEND_IMAGE_TAG:?…}`; `:42` — `depends_on`; `:45-46` — healthcheck
    `wget` на `http://127.0.0.1:8080/health`.
  - `ansible/roles/caddy/templates/Caddyfile.j2:5-7` — `handle /api/v1/*` → `reverse_proxy api:8080`;
    `:15` — `handle` для SPA.
- tRPC 11, fetch-адаптер: `createContext` получает `{ req, resHeaders, info }`.
- Bun: `export default { port, fetch }` из точки входа запускает HTTP-сервер.
