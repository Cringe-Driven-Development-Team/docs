# Раздел «Миграция на BFF»: контракт, авторизация и CSRF — дизайн

Дата: 2026-10-08. Статус: дизайн утверждён в чате, ждёт ревью спеки.

## 1. Цель

Команда начинает трек миграции на BFF: браузер ходит только в BFF, BFF проксирует запросы в Go API.
До кода нужно договориться о двух вещах, которые связаны через `/auth/*`:

1. как spec-first через Apidog и генератор Orval работают, когда между клиентом и Go стоит BFF;
2. где живут токены, как идёт refresh и как BFF защищается от CSRF.

Результат — раздел сайта документации «Миграция на BFF» из трёх страниц с mermaid-схемами. Раздел
описывает целевое состояние трека и помечен как проект: студенты берут его основой для задач, ментор
ссылается на конкретный сценарий.

Успех: в меню сайта есть «BFF»; страницы «Обзор», «Контракт», «Авторизация и CSRF» собираются,
проходят `site:check` и проверку mermaid; каждое решение раздела опирается на проверенный факт из §2
или на решение из §3; страницы CSRF ссылаются на новый раздел.

## 2. Проверенные факты

Репа `docs`, `main` на `7d4514b`:

- `docs/superpowers/specs/2026-09-29-mvp-single-vps-design.md`: MVP без BFF; вариант с BFF (Hono · bun,
  tRPC, монорепа) заморожен в `diagrams/bff/`, «к нему могут вернуться, но сейчас не правится».
- `docs/superpowers/specs/2026-09-15-frontend-monorepo-design.md` (заморожена): cookie сессии BFF с
  префиксом `__Host-`; BFF проверяет `Origin` и `Sec-Fetch-Site` на мутациях; монорепа `apps/client` и
  `apps/bff` на bun workspaces.
- Сайт: VitePress 1.6.4, `site/.vitepress/config.mts` — nav «Архитектура», «Безопасность»; sidebar
  `/security/csrf/`; mermaid через `vitepress-plugin-mermaid`; проверки `bun run site:check` и
  `bun run mermaid`.

Фронтенд `frontend-park-mail-ru/2026_2_Cringe_Driven_Development` на `344ad0b`:

- `bun run sync` = `apidog` (`scripts/openapi/apidog.ts` выгружает контракт из Apidog в
  `spec/openapi.json`) + `generate` (`openapi-cdd spec/openapi.json -o src/api/schema.ts`, пакет
  `@iredtea/openapi` 0.2.0).
- `src/api/client.ts`: `createClient<paths>({ baseUrl: '/api/v1', credentials: 'include' })`,
  `api.use(csrfMiddleware(), authMiddleware())`.
- Контракт (`spec/openapi.json`): `securitySchemes` — только `bearerAuth` (JWT); ручки данных
  (`/users/me`, `/notebooks*`) требуют `bearerAuth`; `/auth/register` → `201 User`, `/auth/login` →
  `200 User`, `/auth/refresh` и `/auth/logout` → `204` без тела, параметр cookie `refresh_token`; у
  всех `/auth/*` заголовок ответа `Set-Cookie`; у изменяющих — параметр заголовка `X-CSRF-Token`.
  `Error.code`: `validation_error`, `invalid_credentials`, `login_taken`, `unauthorized`,
  `csrf_invalid`, `not_found`, `not_implemented`, `internal`.

Бэкенд `go-park-mail-ru/2026_2_Cringe_Driven_Development` на `4094350`:

- `internal/middleware/authenticate.go:19`: access читается только из cookie `access_token`;
  заголовок `Authorization` бэк не читает — контракт с `bearerAuth` сейчас с кодом расходится.
- Cookie, CSRF и CORS — как в разделе «CSRF» сайта (`site/security/csrf/index.md`).

Инфраструктура `Cringe-Driven-Development-Team/infra` на `2f97437`:

- `ansible/roles/caddy/templates/Caddyfile.j2`: `/api/v1/*` → `reverse_proxy api:8080`; остальное —
  `index.html` из бакета релизов.
- `ansible/roles/app/templates/compose.yml.j2`: у `api` нет `ports`, он доступен только из сети `app`;
  окружение `CSRF_SECRET`, `COOKIE_SECURE`, `CORS_ALLOWED_ORIGINS`.
- `pulumi/index.ts`: ресурсы `private-network`, `private-subnet`, `router` (L182-L192); инстанс `gateway`
  на порту частной подсети (L250), `metadata.role: "gateway"`, floating IP и его привязка к порту
  (L271-L280).
- `ansible/inventory/openstack.yml:17`: группа `gateway` по `metadata.role`.
- `pulumi/README.md`: L8 — двухсерверная схема (gateway + backend) заморожена в варианте `bff`
  документации, стек — одна VPS; L287 — ресурсы backend-сервера удалены, возвращать их прежним
  именем нельзя до проверки стейта.

RFC 10017 «OAuth 2.0 for Browser-Based Applications» (BCP 212, август 2026):

- §6: схемы перечислены «in decreasing order of security», BFF первая; §6.1.4.3 «strongly recommended for
  business applications, sensitive applications, and applications that handle personal data».
- §6.1.2.2: refresh делает BFF, обычно прямо в обработке запроса; срок сессии разумно равнять сроку
  refresh; отвергнутый refresh — повод завершить сессию.
- §6.1.2.3: состояние сессии в cookie (client-side) допустимо: управление и отзыв следуют из access и
  refresh.
- §6.1.3.2: cookie `Secure` и `HttpOnly` — MUST; `SameSite=Strict`, `Path=/`, без `Domain`, префикс
  `__Host-Http-` — SHOULD; токены в cookie BFF SHOULD шифровать.
- §6.1.3.3: CSRF-защита — MUST; CORS с обязательным статичным заголовком на каждом запросе (пример
  `My-Static-Header: 1`); Double Submit «not necessarily recommended over the CORS approach».
- §6.1.3.6: прокси — MUST явный список разрешённых адресатов и путей; методы — по ручке.

Инструменты:

- `openapi-format` 1.33.7: CLI `--overlayFile` применяет действия OpenAPI Overlay.
- MDN, `Set-Cookie`: префикс `__Host-Http-` — `Secure`, `HttpOnly`, `Path=/`, без `Domain`; браузер без
  поддержки префиксов такую cookie просто принимает.

## 3. Решения

| Решение | Почему | Отвергнуто |
| --- | --- | --- |
| BFF — прокси к `/api/v1`, пути и схемы данных те же | трек начинается с переноса токенов и CSRF, не с переделки API | tRPC и серверный bootstrap HTML из замороженного варианта |
| BFF в монорепе фронта: `apps/client`, `apps/bff` | один `sync` из Apidog, клиент и overlay меняются одним PR | отдельная репа `bff` |
| Один контракт в Apidog (Go API), публичный контракт BFF выводится overlay | ручки данных описываются один раз; отличается только `/auth/*` и схема безопасности | два контракта в Apidog; один контракт без описания отличий |
| Генерация — Orval: клиент (fetch), BFF (hono + zod, fetch к Go) | один генератор для обеих сторон; хендлеры Hono с валидацией zod; overlay остаётся (стандартный файл, проверяется в CI) | свой `openapi-cdd` |
| Собственные ручки BFF — тег `bff` в том же проекте Apidog | один контракт; Go исключает их `exclude-tags` (`oapi-codegen`), Orval `goApi` — `filters` | отдельный контракт BFF |
| Сессия — зашифрованная cookie с access и refresh | BFF без состояния: деплой на каждый коммит `main` никого не разлогинивает; новых сервисов нет; RFC §6.1.2.3 | Redis; память процесса BFF |
| CSRF — статичный заголовок `X-CSRF: 1` + `SameSite=Strict` + `Origin`/`Sec-Fetch-Site` | основной путь RFC §6.1.3.3; фронту не нужно читать cookie и повторять после `403` | подписанный Double Submit; оба механизма |
| Go API — только Bearer: токены в JSON, cookie, CSRF и CORS удаляются | Go снаружи не виден; контракт Apidog становится честным S2S | Go без изменений, BFF изображает браузер; переходный режим cookie + Bearer |
| S2S-ключ BFF → Go: на одной VPS без ключа, на двух — `X-BFF-Key` и файрвол | одна VPS: Go закрыт сетью compose (§2), превью на боевых данных нет; две VPS: Go в частной сети, ключ и security group не пускают чужих (§4.7) | одна VPS — ключ из замороженной спеки; две VPS — mTLS между машинами как более сильная альтернатива |

Допущение: BFF на Hono и bun, как в замороженном варианте. Раздел называет Hono только в примерах
кода.

## 4. Целевое состояние, которое описывает раздел

### 4.1. Путь запроса

Caddy: `/api/v1/*` → `bff:3000`, остальное — как сейчас. BFF → `http://api:8080/api/v1` по сети
`app` (на двух VPS — по `GO_API_URL`, §4.7). Клиент по-прежнему ходит на `/api/v1`: пути не меняются.

### 4.2. Контракт

- Apidog — единственный источник. Go-контракт меняется:
  - `TokenPair`: `access_token`, `access_expires_in` (с), `refresh_token`, `refresh_expires_in` (с);
  - `/auth/register` → `201 { user: User, tokens: TokenPair }`, `/auth/login` → `200` того же вида;
  - `/auth/refresh`: тело `{ refresh_token }` → `200 TokenPair`;
  - `/auth/logout`: тело `{ refresh_token }`, `bearerAuth` → `204`;
  - на двух VPS в `Error.code` добавляется `s2s_forbidden` (`403`, §4.7);
  - ручки данных — `bearerAuth`; `Set-Cookie`, параметр cookie `refresh_token` и `X-CSRF-Token` уходят.
- Go забирает контракт из Apidog сам: `make generate` (backend@4094350) — `go run ./cmd/apidog` и
  `oapi-codegen`; монорепа нужна клиенту и BFF.
- Монорепа: `spec/openapi.json` (выгрузка Apidog), `spec/bff.overlay.yaml`, `spec/openapi.public.json`
  (выведен, закоммичен). `bun run sync`: `apidog` → `overlay`
  (`openapi-format spec/openapi.json --overlayFile spec/bff.overlay.yaml -o spec/openapi.public.json`)
  → `orval` (`orval.config.ts`: `client` — fetch, `baseUrl: '/api/v1'`, мутатор с `X-CSRF: 1`; `bff` —
  `client: 'hono'`, zod, `filters` `include` тегов `auth` и `bff`; `goApi` — из `openapi.json` с `filters` `exclude` тега `bff`, fetch, Bearer).
- Overlay:
  - удаляет `/auth/refresh`;
  - `/auth/register` и `/auth/login` отвечают `User` и заголовком `Set-Cookie` (`update` сливает
    объекты, поэтому `content` сначала удаляется `remove`); `/auth/logout` — без
    тела запроса, `204` и `Set-Cookie`;
  - `securitySchemes`: `sessionCookie` (apiKey, cookie `__Host-Http-session`) и `csrfHeader` (apiKey,
    header `X-CSRF`); ручкам данных и `logout` — оба, `register` и `login` — `csrfHeader`;
    `bearerAuth` удаляется;
  - добавляет к ответам ручек данных `401` и `403` со схемой `Error`.
- Генерация (Orval 8.40.0: `OutputClient` — `fetch`, `hono`, `zod`; `InputFiltersOptions` — `mode`, `tags`,
  `schemas`): `apps/client` — fetch из `openapi.public.json`; `apps/bff` — хендлеры Hono (`createFactory`,
  `@hono/zod-validator`) для `/auth/*` и тега `bff` и fetch к Go из `openapi.json` без тега `bff`.
- Собственные ручки BFF (агрегация, пакетные запросы) — тег `bff` в том же проекте Apidog; Go исключает их
  `output-options.exclude-tags`, в публичный контракт они проходят как есть, BFF обслуживает их хендлерами,
  а не прокси. Они описаны в Apidog сразу с `sessionCookie` и `csrfHeader` (схемы определены в самом
  проекте, Go их не использует) и ответами `401`/`403` с `Error`. Цель `bff` — `filters` include тегов `auth`
  и `bff` (проверено запуском Orval 8.40.0: папки только `auth/` и `bff/`).
- CI монорепы: каждое действие overlay находит хотя бы один узел (иначе правка в Apidog молча ломает
  overlay); `openapi.public.json` совпадает с выведенным заново; `openapi.public.json` не содержит
  `access_token`, `refresh_token`, `TokenPair` и `bearerAuth`.
- Список разрешённых маршрутов прокси строится из пар «шаблон пути + метод» публичного контракта
  (RFC §6.1.3.6). Параметры пути подставляются только в шаблон; чего нет в контракте — `404 not_found`
  без запроса в Go.

### 4.3. Сессия и refresh

- Cookie `__Host-Http-session`: `HttpOnly`, `Secure`, `Path=/`, `SameSite=Strict`, без `Domain`,
  `Max-Age` = `refresh_expires_in`. Значение — `base64url(iv ‖ шифротекст ‖ тег)` AES-256-GCM ключом
  `SESSION_KEY` (32 байта) от JSON `{ access, refresh, accessExp, refreshExp }`; имя cookie — AAD.
  `iv` — 12 случайных байт из CSPRNG, новые при каждом шифровании; повтор IV с тем же ключом ломает GCM.
  Ошибка расшифровки или тега — `401 unauthorized`.
- Порядок проверок для каждого запроса к `/api/v1`, включая `login`, `register`, `logout`: CSRF
  (`403 csrf_invalid`) → маршрут в списке разрешённых (`404 not_found`) → для ручек с `sessionCookie`
  расшифровать cookie (нет или не расшифровывается — `401 unauthorized`); если до `accessExp` меньше
  30 с — refresh; запрос в Go с `Authorization: Bearer` (на двух VPS и `X-BFF-Key`); `403 s2s_forbidden`
  от Go — клиенту `502 internal`, в лог, без refresh, сессию не трогать; на `401` от Go — refresh и один
  повтор; ответ клиенту с новой cookie, если токены сменились. Upgrade WebSocket проходит только
  проверку `Origin` (§4.7).
- В Go уходят только `Content-Type`, `Accept`, `X-Request-ID` и тело; `Cookie` и `X-CSRF` — нет.
  `Set-Cookie` из ответа Go не пропускается.
- Одновременные refresh объединяются: ключ — SHA-256 refresh-токена, результат держится в памяти 10 с.
  Вторая вкладка со старой cookie получает те же новые токены. Гонка backend#12 уходит, пока BFF один
  экземпляр.
- Refresh отвергнут (`401` от Go) — BFF стирает cookie (`Max-Age=0`) и отвечает `401 unauthorized`.
- `login`/`register`: BFF вызывает Go, ставит cookie, отдаёт `User`. `logout`: после проверки
  CSRF и списка BFF вызывает Go с Bearer и refresh в теле, стирает cookie сессии и три старые
  (`access_token`, `refresh_token`, `__Host-csrf`), отвечает `204` даже если Go ответил `401`; без cookie
  сессии Go не вызывается, ответ тот же `204`.

### 4.4. CSRF

- Проверки CSRF идут первыми: раньше списка разрешённых маршрутов и расшифровки cookie.
- Каждый запрос к `/api/v1` без `X-CSRF: 1` — `403 csrf_invalid`, без запроса в Go. Чужой origin не
  может поставить заголовок без preflight, а CORS BFF не разрешает никому: клиент на том же origin.
- `POST`, `PUT`, `PATCH`, `DELETE`: `Origin` равен `APP_ORIGIN`, `Sec-Fetch-Site` (если есть) —
  `same-origin`; иначе `403 csrf_invalid`.
- `SameSite=Strict`: cookie не уходит на межсайтовые запросы. SPA это не мешает: HTML отдаётся без
  cookie, а запросы к API делает страница того же сайта.

### 4.5. Что меняется по репам

- Фронт: `csrf.ts` не читает cookie, middleware ставит `X-CSRF: 1`; refresh на `401` и повтор после
  `403` уходят; `401` — гость, форма входа; старт — `GET /users/me`. frontend#34 становится не нужна.
- Go: `Authenticate` читает `Authorization: Bearer`; ответы `/auth/*` по §4.2; middleware CSRF и CORS,
  код cookie, `CSRF_SECRET`, `COOKIE_SECURE`, `CORS_ALLOWED_ORIGINS` удаляются.
- Infra: сервис `bff` в compose с `SESSION_KEY` и `APP_ORIGIN`; Caddy `/api/v1/*` → `bff:3000`.

### 4.6. Переключение

- Одна выкатка: Go, BFF и Caddy одним прогоном playbook, сразу после него — промоут релиза клиента.
  До промоута старый клиент получает `401` и `403`; окно — время между шагами.
- Ответы BFF на `login`, `register`, `logout` стирают старые cookie: `access_token` (`Path=/api/v1`),
  `refresh_token` (`Path=/api/v1/auth`), `__Host-csrf` (`Path=/`). Каждый пользователь один раз
  входит заново.

### 4.7. Две VPS

Вариант размещения, утверждённый владельцем команды; в «Обзоре» ему посвящён раздел «Две VPS».

- VPS1: Caddy и BFF, публичный (floating) IP, домен `cellestial.ru`. VPS2: Go API и Postgres, без
  публичного IP, доступна только через частную сеть Selectel. Домен для пользователя один, публичного
  `api.cellestial.ru` нет: браузер говорит только с BFF, приложение на одном origin с ним (RFC 10017
  §6.1.3.3.2); публичный `api.*` нужен только другим клиентам (мобильный, партнёры) с Bearer или OAuth.
- BFF → Go по приватному адресу VPS2 (в документах адрес и подсеть не пишутся). Файрвол VPS2
  (security group) пускает порт API только с VPS1.
- S2S-ключ: заголовок `X-BFF-Key: <BFF_API_KEY>`, Go сравнивает за постоянное время и проверяет
  его раньше Bearer; `BFF_API_KEY` в `.env` обеих машин. Сильнее — mTLS между VPS1 и VPS2.
- Без ключа или с неверным — `403 s2s_forbidden`, а не `401`: на `401` BFF делает refresh,
  тот же ключ даёт `401`, и BFF стёр бы cookie — рассинхрон ключей или ротация на одной машине
  разлогинили бы всех. BFF считает `s2s_forbidden` инфраструктурной ошибкой: клиенту `502` (`internal`),
  лог, без refresh, сессию не трогает. Ротация: Go принимает два ключа на время переключения.
  `s2s_forbidden` — новое значение `Error.code` в Go-контракте (§4.2, применимо на двух VPS).
  Сравнение — `crypto/subtle.ConstantTimeCompare`.
- Адрес Go для BFF — переменная `GO_API_URL`: `http://api:8080` на одной VPS, `http://<приватный адрес
  VPS2>:8080` на двух; на VPS2 compose публикует порт API только на приватном интерфейсе. Мутатор
  `bearerFetch` подставляет origin из `GO_API_URL` и ставит `X-BFF-Key`; клиентский `X-BFF-Key` не
  пропускается.
- Security group VPS2: порт API и SSH только с VPS1, порт Postgres не открыт.
- Нужно добавить в infra: инстанс и порт VPS2 под новым именем, security group, `ProxyJump` в inventory
  (`ssh_hardening` сейчас запрещает `AllowTcpForwarding`, tasks/main.yml:14-16).
- Трафик внутри частной сети без TLS — принятый риск MVP (Selectel изолирует сеть); mTLS его закрыл бы.
- Ansible ходит на VPS2 по SSH только через VPS1 как jump host (`ProxyJump`).
- Масштабирование: BFF — один экземпляр; второй требует общей блокировки refresh (Redis) или льготного
  окна из backend#12.
- WebSocket (будущая потоковая отдача вывода рантайма): у WS нет CORS, браузер прикладывает cookie к
  рукопожатию (Cross-Site WebSocket Hijacking). `SameSite=Strict` не пускает cookie с чужого сайта, но
  пускает с поддомена. Браузерный WebSocket не ставит свои заголовки, поэтому upgrade освобождён от
  `X-CSRF` и защищён `Origin` (нет или не равен `APP_ORIGIN` — `403`) плюс `SameSite=Strict`; правило есть
  в разделе CSRF страницы «Авторизация и CSRF».

## 5. Сайт

- `site/bff/index.md` — «Обзор», `site/bff/contract.md` — «Контракт», `site/bff/auth.md` —
  «Авторизация и CSRF».
- nav: «BFF» → `/bff/`, `activeMatch: '^/bff/'`, после «Безопасность»; sidebar `/bff/` с тремя
  страницами.
- Вверху каждой страницы — `::: warning` «Проект трека миграции на BFF, ещё не внедрено. Как
  работает сейчас — раздел CSRF.»
- На трёх страницах CSRF — `::: tip` «Это текущая реализация; при переезде на BFF её заменяет
  [Авторизация и CSRF в BFF](/bff/auth).»
- Ссылки на код — на SHA из §2, на RFC — `https://www.rfc-editor.org/rfc/rfc10017#section-…`.

## 6. Содержание

### 6.1. «Обзор»

Было и стало: flowchart браузер → Caddy → Go сейчас и браузер → Caddy → BFF → Go потом; таблица cookie
до и после; что меняется у фронта, BFF, Go и infra (§4.5); почему BFF — цитаты RFC §6 и §6.1.4.3;
переключение (§4.6); ограничения: один экземпляр BFF, ротация `SESSION_KEY` разлогинивает всех; раздел «Две VPS» (§4.7), S2S-ключ только на двух VPS.

### 6.2. «Контракт»

Flowchart Apidog → `openapi.json` → overlay → `openapi.public.json` → генерация для клиента и BFF;
изменения Go-контракта (§4.2); пример `bff.overlay.yaml` с действиями §4.2; `bun run sync`; проверки в
CI; список разрешённых маршрутов и пример ответа на путь вне контракта.

### 6.3. «Авторизация и CSRF»

Cookie сессии (§4.3), CSRF (§4.4), затем сценарии — по sequenceDiagram на каждый, участники
`F` (фронт), `B` (браузер), `P` (BFF), `A` (Go API), `E` (чужой сайт):

1. Вход.
2. Запрос данных.
3. Access истёк — BFF обновляет сам, фронт не замечает.
4. Две вкладки обновляют одновременно — один вызов refresh.
5. Выход.
6. Сессия кончилась — refresh отвергнут, вход.
7. Атака формой с чужого сайта — нет заголовка, `403`; `fetch` с заголовком — preflight без
   разрешения.
8. Запрос с поддомена — same-site, но `Origin` чужой, `403`.
9. Переход по внешней ссылке — HTML без cookie, запросы страницы с cookie.
10. Первый вход после переезда — старые cookie стираются.

Под каждой схемой — «Проект: проверить после внедрения».

## 7. Проверка

- `bun run site:check` и `bun run mermaid` проходят; `bun run build:native` собирает сайт.
- Все ссылки на код открываются на указанных SHA; ссылки на RFC ведут на существующие разделы.
- Превью ветки показывает раздел «BFF» со стилями.

## 8. Не входит

- Задачи студентам (эпик и sub-issues) — после утверждения раздела, отдельно.
- Схемы Eraser под BFF-прокси.
- Код BFF, фронта, Go и infra.
- Серверный bootstrap HTML, tRPC, канарейка, превью веток.
