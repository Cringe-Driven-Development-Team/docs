# Миграция на BFF: обзор

::: warning
Проект трека миграции на BFF, ещё не внедрено. Как работает сейчас — раздел [CSRF](/security/csrf/).
:::

Браузер ходит только в BFF (Backend for Frontend), а BFF проксирует запросы в Go API. Токены остаются
на сервере и в браузер не попадают: у пользователя только зашифрованная cookie сессии. Раздел
описывает целевое состояние трека; остальные страницы — [Контракт](/bff/contract) (как spec-first через Apidog
работает с BFF между клиентом и Go) и [Авторизация и CSRF](/bff/auth) (сессия, refresh и
защита от CSRF по сценариям).

## Было и стало

Сейчас токены кладёт в cookie сам Go API, а браузер получает их напрямую:

```mermaid
flowchart LR
    B["Браузер"] -->|"cookie access_token, refresh_token, __Host-csrf"| C["Caddy"]
    C -->|"/api/v1/*"| A["Go API"]
```

После переезда между Caddy и Go появляется BFF:

```mermaid
flowchart LR
    B["Браузер"] -->|"cookie __Host-Http-session и заголовок X-CSRF: 1"| C["Caddy"]
    C -->|"/api/v1/* на bff:3000"| P["BFF"]
    P -->|"http://api:8080/api/v1 и Authorization: Bearer"| A["Go API"]
```

Клиент по-прежнему ходит на `/api/v1`: пути не меняются, а схемы данных остаются теми же. Текущая
маршрутизация — в
[`Caddyfile.j2`](https://github.com/Cringe-Driven-Development-Team/infra/blob/2f97437/ansible/roles/caddy/templates/Caddyfile.j2#L7)
(`reverse_proxy api:8080`); `api` не публикует порты и виден только из сети `app` — см.
[`compose.yml.j2`](https://github.com/Cringe-Driven-Development-Team/infra/blob/2f97437/ansible/roles/app/templates/compose.yml.j2#L18).

## Cookie до и после

| Cookie | `Path` | `HttpOnly` | `SameSite` | Кто читает |
|---|---|---|---|---|
| `access_token` (сейчас) | `/api/v1` | да | `Lax` | Go API |
| `refresh_token` (сейчас) | `/api/v1/auth` | да | `Lax` | Go API |
| `__Host-csrf` (сейчас) | `/` | **нет** | `Lax` | фронт читает из `document.cookie`, Go сверяет |
| `__Host-Http-session` (после) | `/` | да | `Strict` | только BFF; в браузере JavaScript её не видит |

Подробности про нынешние cookie — в разделе [CSRF](/security/csrf/). `__Host-Http-session` —
`Secure`, без `Domain`, срок `Max-Age` равен `refresh_expires_in`.

## Почему BFF

RFC 10017 «OAuth 2.0 for Browser-Based Applications» (BCP 212) перечисляет архитектуры браузерных
приложений ([§6](https://www.rfc-editor.org/rfc/rfc10017#section-6)) и ставит BFF первой:

> The patterns in this section are presented in decreasing order of security.

Про BFF отдельно
([§6.1.4.3](https://www.rfc-editor.org/rfc/rfc10017#section-6.1.4.3)):

> This architecture is strongly recommended for business applications, sensitive applications, and applications that handle personal data.

У нас личные данные пользователей, так что рекомендация подходит. Практический выигрыш: access и
refresh не доходят до браузера, а значит, XSS на странице не может их украсть.

## Что меняется

### Фронт

Клиент создаётся в
[`src/api/client.ts`](https://github.com/frontend-park-mail-ru/2026_2_Cringe_Driven_Development/blob/344ad0b/src/api/client.ts#L29)
с `baseUrl: '/api/v1'` и `credentials: 'include'`. Меняется middleware: `csrf.ts` больше не читает
cookie и ставит `X-CSRF: 1`; refresh на `401` и повтор после `403` уходят; `401` означает гостя и
форму входа; старт приложения — `GET /users/me`. Задача frontend#34 становится не нужна.

### BFF

Новый сервис: проксирует `/api/v1/*` в Go, хранит сессию в зашифрованной cookie, обновляет access сам,
проверяет `X-CSRF`, `Origin` и `Sec-Fetch-Site`. Работает без своего хранилища. Гонка backend#12
решается внутри BFF, пока он один экземпляр — см. сценарий [«Две вкладки»](/bff/auth#две-вкладки).

### Go API

`Authenticate` сейчас читает access из cookie
[`access_token`](https://github.com/go-park-mail-ru/2026_2_Cringe_Driven_Development/blob/4094350/internal/middleware/authenticate.go#L19),
хотя контракт уже говорит про `Authorization: Bearer`. После переезда он читает `Authorization: Bearer`,
токены отдаются в JSON, а middleware CSRF и CORS, код cookie и переменные `CSRF_SECRET`,
`COOKIE_SECURE`, `CORS_ALLOWED_ORIGINS` удаляются.

### Infra

В compose появляется сервис `bff` с `SESSION_KEY` и `APP_ORIGIN`, а Caddy направляет `/api/v1/*` на
`bff:3000`.

## Переключение

Go, BFF и Caddy выкатываются одним прогоном playbook, сразу после него промоутится релиз клиента.
Пока клиент не промоутнут, старый клиент получает `401` и `403`: это окно длится столько, сколько
проходит между двумя шагами. Ответы BFF на `login`, `register` и `logout` стирают три старые cookie с их
`Path`: `access_token` (`/api/v1`), `refresh_token` (`/api/v1/auth`) и `__Host-csrf` (`/`). Каждый
пользователь один раз входит заново — см. сценарий
[«Первый вход после переезда»](/bff/auth#первыи-вход-после-переезда).

## Ограничения

- BFF работает одним экземпляром: объединение одновременных refresh держится в его памяти.
- Смена `SESSION_KEY` разлогинивает всех: старые cookie больше не расшифровываются.
- Go API закрыт только сетью compose, без отдельного S2S-ключа: из этой сети любой сервис может
  позвать его напрямую.
