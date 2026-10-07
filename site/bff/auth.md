# Миграция на BFF: авторизация и CSRF

::: warning
Проект трека миграции на BFF, ещё не внедрено. Как работает сейчас — раздел [CSRF](/security/csrf/).
:::

Как BFF хранит сессию, обновляет токены и защищается от CSRF, а затем десять сценариев по шагам.
Общая картина — [«Обзор»](./), формат ручек — [«Контракт»](./contract). Как защита устроена сейчас —
в разделе [CSRF](/security/csrf/).

## Cookie сессии

BFF держит всю сессию в одной cookie `__Host-Http-session`. Токены Go API лежат внутри неё в
зашифрованном виде, а в браузер не попадает ничего, что JavaScript мог бы прочитать.

| Атрибут | Значение |
|---|---|
| Имя | `__Host-Http-session` |
| `HttpOnly` | да |
| `Secure` | да |
| `Path` | `/` |
| `SameSite` | `Strict` |
| `Domain` | не задаётся |
| `Max-Age` | `refresh_expires_in` из ответа Go |

Значение — `base64url(iv ‖ шифротекст ‖ тег)`: AES-256-GCM, ключ `SESSION_KEY` (32 байта), имя cookie
служит AAD (дополнительные аутентифицируемые данные). Внутри — JSON:

```json
{ "access": "…", "refresh": "…", "accessExp": 1760000000, "refreshExp": 1762600000 }
```

*Пример формы; значения токенов и ключа на страницах не приводятся.*

Что говорит RFC 10017. Атрибуты и префикс
([§6.1.3.2](https://www.rfc-editor.org/rfc/rfc10017#section-6.1.3.2)):

> The BFF MUST enable the Secure flag for its cookies.

> The BFF MUST enable the HttpOnly flag for its cookies.

> The BFF SHOULD enable the SameSite=Strict flag for its cookies.

> The BFF SHOULD start the name of its cookie with a prefix indicating the cookie was set via HTTP, for example, by using the __Host-Http- prefix defined in [COOKIES].

Шифрование там же:

> the BFF SHOULD encrypt its cookie contents.

Сессия в самой cookie допустима
([§6.1.2.3](https://www.rfc-editor.org/rfc/rfc10017#section-6.1.2.3)): раз cookie нужна только для
получения токенов, управление и отзыв следуют из access и refresh.

> It suffices to revoke the user's access token and/or refresh token to prevent ongoing access to protected resources, without the need to explicitly invalidate the cookie-based session.

Почему не Redis и не память процесса: BFF остаётся без состояния. Деплой на каждый коммит `main`
никого не разлогинивает, новых сервисов не появляется. Цена: смена `SESSION_KEY` разлогинивает всех.

## Как BFF проксирует запрос

Для ручки, которой нужна cookie сессии (`sessionCookie` в [«Контракте»](./contract)):

1. Проверки CSRF (раздел «CSRF» ниже) идут до расшифровки cookie. Не прошли — `403 csrf_invalid`,
   в Go ничего не уходит.
2. Расшифровать cookie. Cookie нет или она не расшифровывается — `401 unauthorized`.
3. Если до `accessExp` меньше 30 с, обновить токены через refresh до запроса.
4. Отправить запрос в Go (`http://api:8080/api/v1`) с `Authorization: Bearer`.
5. Если Go ответил `401`, обновить токены и повторить запрос один раз.
6. Ответить клиенту; если токены сменились, ответ несёт новую cookie.

В Go уходят только `Content-Type`, `Accept`, `X-Request-ID` и тело. `Cookie` и `X-CSRF` не уходят.
`Set-Cookie` из ответа Go клиенту не пропускается: cookie выставляет только BFF.

Одновременные refresh объединяются. Ключ — SHA-256 refresh-токена, результат держится в памяти
10 с: вторая вкладка со старой cookie получает те же новые токены. Если Go отвергает refresh
(`401`), BFF стирает cookie (`Max-Age=0`) и отвечает `401 unauthorized`.

## CSRF

Три правила, все на стороне BFF. Проверки идут раньше всего остального, до расшифровки cookie:

1. Каждый запрос к `/api/v1` без `X-CSRF: 1` получает `403 csrf_invalid` и в Go не уходит. Чужой
   origin не может поставить такой заголовок без preflight, а CORS BFF не разрешает никому: клиент
   живёт на том же origin.
2. Для `POST`, `PUT`, `PATCH`, `DELETE`: `Origin` равен `APP_ORIGIN`, а `Sec-Fetch-Site`, если он
   есть, равен `same-origin`; иначе `403 csrf_invalid`.
3. `SameSite=Strict`: cookie не уходит на межсайтовые запросы. SPA это не мешает: HTML отдаётся без
   cookie, а запросы к API делает страница того же сайта.

Первое правило — прямой путь из RFC
([§6.1.3.3.2](https://www.rfc-editor.org/rfc/rfc10017#section-6.1.3.3.2)):

> When this mechanism is used, the BFF MUST ensure that every incoming request carries this static header.

Подписанный Double Submit, как в нынешней реализации, RFC не ставит выше
([§6.1.3.3.3](https://www.rfc-editor.org/rfc/rfc10017#section-6.1.3.3.3)):

> Note that this mechanism is not necessarily recommended over the CORS approach.

Фронту больше не нужно читать cookie, повторять запрос после `403` и обновлять токены на `401`:
`401` означает гостя и форму входа.

## Сценарии

Участники: `F` — код фронта, `B` — браузер, `P` — BFF, `A` — Go API, `E` — чужой сайт.

### Вход

Фронт шлёт логин с заголовком `X-CSRF: 1`. BFF проверяет заголовок и `Origin`, вызывает Go и
получает токены в JSON. Токены остаются в BFF: браузеру уходят `User` и новая cookie, а три старые
cookie стираются.

```mermaid
sequenceDiagram
  participant F as Фронт
  participant B as Браузер
  participant P as BFF
  participant A as Go API
  F->>B: POST /api/v1/auth/login, X-CSRF: 1
  B->>P: POST /api/v1/auth/login, Origin свой
  Note over P: заголовок X-CSRF есть, Origin равен APP_ORIGIN
  P->>A: POST /api/v1/auth/login
  A-->>P: 200 { user, tokens }
  P-->>B: 200 User, Set-Cookie __Host-Http-session
  Note over P,B: тот же ответ стирает access_token, refresh_token и __Host-csrf
  B-->>F: 200 User
```

*Проект: проверить после внедрения.*

### Запрос данных

BFF расшифровывает cookie и подставляет access токен как `Authorization: Bearer`. Фронт про токены
ничего не знает.

```mermaid
sequenceDiagram
  participant F as Фронт
  participant B as Браузер
  participant P as BFF
  participant A as Go API
  F->>B: GET /api/v1/notebooks, X-CSRF: 1
  B->>P: GET /api/v1/notebooks, Cookie __Host-Http-session
  Note over P: расшифровывает cookie, access ещё живой
  P->>A: GET /api/v1/notebooks, Authorization: Bearer
  A-->>P: 200
  P-->>B: 200
  B-->>F: 200
```

*Проект: проверить после внедрения.*

### Access истёк

Если до `accessExp` меньше 30 с, BFF обновляет токены сам, а потом выполняет исходный запрос.
Фронт делает один запрос и не замечает refresh; новая cookie приходит с обычным ответом.

```mermaid
sequenceDiagram
  participant F as Фронт
  participant B as Браузер
  participant P as BFF
  participant A as Go API
  F->>B: GET /api/v1/notebooks, X-CSRF: 1
  B->>P: GET /api/v1/notebooks, Cookie __Host-Http-session
  Note over P: до accessExp меньше 30 с
  P->>A: POST /api/v1/auth/refresh, refresh_token
  A-->>P: 200 TokenPair
  P->>A: GET /api/v1/notebooks, Authorization: Bearer новый access
  A-->>P: 200
  P-->>B: 200, Set-Cookie __Host-Http-session новая
  B-->>F: 200
```

*Проект: проверить после внедрения.*

### Две вкладки

Две вкладки одновременно приходят со старой cookie, у которой access почти истёк. Refresh
объединяется: Go получает один вызов, обе вкладки получают одни и те же новые токены.

```mermaid
sequenceDiagram
  participant B as Браузер
  participant P as BFF
  participant A as Go API
  B->>P: запрос вкладки 1, старая cookie
  B->>P: запрос вкладки 2, старая cookie
  P->>A: POST /api/v1/auth/refresh, refresh_token
  Note over P: вторая вкладка ждёт тот же результат по SHA-256 refresh-токена
  A-->>P: 200 TokenPair
  P-->>B: ответ вкладки 1, Set-Cookie новая
  P-->>B: ответ вкладки 2, та же Set-Cookie
  Note over P: результат хранится 10 с, работает пока один экземпляр BFF
```

*Проект: проверить после внедрения.*

### Выход

BFF вызывает Go с Bearer и `refresh_token` в теле, стирает cookie и отвечает `204`. Даже если Go
вернул `401` (токен уже недействителен), клиент получает `204`: сессии больше нет в любом случае.

```mermaid
sequenceDiagram
  participant F as Фронт
  participant B as Браузер
  participant P as BFF
  participant A as Go API
  F->>B: POST /api/v1/auth/logout, X-CSRF: 1
  B->>P: POST /api/v1/auth/logout, Cookie __Host-Http-session
  P->>A: POST /api/v1/auth/logout, Authorization: Bearer, { refresh_token }
  A-->>P: 204
  P-->>B: 204, Set-Cookie __Host-Http-session Max-Age=0
  Note over P: 204 и когда Go ответил 401
  B-->>F: 204
```

*Проект: проверить после внедрения.*

### Сессия кончилась

Refresh-токен просрочен или отозван. Go отвечает `401`, BFF стирает cookie и отвечает
`401 unauthorized`; фронт показывает форму входа.

```mermaid
sequenceDiagram
  participant F as Фронт
  participant B as Браузер
  participant P as BFF
  participant A as Go API
  F->>B: GET /api/v1/users/me, X-CSRF: 1
  B->>P: GET /api/v1/users/me, Cookie __Host-Http-session
  P->>A: POST /api/v1/auth/refresh, refresh_token
  A-->>P: 401
  Note over P: refresh отвергнут, сессия кончилась
  P-->>B: 401 unauthorized, Set-Cookie Max-Age=0
  B-->>F: 401
  Note over F: гость - показать форму входа
```

*Проект: проверить после внедрения.*

### Атака с чужого сайта

Форма с чужого сайта не может поставить `X-CSRF`, поэтому получает `403 csrf_invalid`, а в Go
запрос не уходит. `fetch` с заголовком требует preflight, а BFF не разрешает CORS никому, так что
браузер не отправит основной запрос.

```mermaid
sequenceDiagram
  participant B as Браузер
  participant P as BFF
  participant E as Чужой сайт
  E->>B: форма, POST /api/v1/notebooks
  B->>P: POST без X-CSRF
  P-->>B: 403 csrf_invalid, в Go запрос не уходит
  E->>B: fetch с заголовком X-CSRF: 1
  B->>P: OPTIONS /api/v1/notebooks
  P-->>B: без разрешения CORS
  Note over B: основной запрос не отправлен
  Note over B,P: SameSite=Strict: cookie на межсайтовые запросы не уходит
```

*Проект: проверить после внедрения.*

### Запрос с поддомена

Поддомен (скажем, захваченный) находится на том же сайте, поэтому `SameSite=Strict` не помогает:
cookie уходит вместе с запросом. Это именно тот случай, который `SameSite` один не закрывает
([§6.1.3.3.1](https://www.rfc-editor.org/rfc/rfc10017#section-6.1.3.3.1)):

> As a result, a subdomain-takeover attack against b.example.com can enable CSRF attacks against the BFF of a.example.com.

Форма с поддомена не может поставить `X-CSRF`, так что запрос отклоняется уже по отсутствию
заголовка. Проверка `Origin` и `Sec-Fetch-Site` — вторая линия: она сработала бы и при ошибке в
проверке заголовка или в настройке CORS.

```mermaid
sequenceDiagram
  participant B as Браузер
  participant P as BFF
  participant E as Чужой сайт
  E->>B: форма с поддомена, POST /api/v1/notebooks
  B->>P: POST /api/v1/notebooks, Cookie __Host-Http-session, Origin поддомена, без X-CSRF
  Note over P: same-site - cookie ушла, Strict её не останавливает. Sec-Fetch-Site: same-site, Origin не равен APP_ORIGIN
  P-->>B: 403 csrf_invalid
```

*Проект: проверить после внедрения.*

### Переход по внешней ссылке

Пользователь переходит на сайт по ссылке с чужого сайта. Cookie `Strict` на такую навигацию не
уходит, и Caddy отдаёт `index.html` без неё. Дальше запросы к API делает уже страница нашего сайта, и
cookie с ними идёт.

```mermaid
sequenceDiagram
  participant E as Чужой сайт
  participant B as Браузер
  participant P as BFF
  E->>B: переход по ссылке на наш сайт
  Note over B: Caddy отдаёт index.html, cookie на навигацию не уходит
  Note over B: страница уже наша, same-site
  B->>P: GET /api/v1/users/me, Cookie __Host-Http-session, X-CSRF: 1
  P-->>B: 200
```

*Проект: проверить после внедрения.*

### Первый вход после переезда

У пользователя в браузере старые cookie `access_token`, `refresh_token` и `__Host-csrf`, а новой
`__Host-Http-session` нет. Первый же запрос получает `401`, пользователь входит заново, и ответ
входа ставит новую cookie и стирает три старые.

```mermaid
sequenceDiagram
  participant F as Фронт
  participant B as Браузер
  participant P as BFF
  F->>B: GET /api/v1/users/me, X-CSRF: 1
  B->>P: GET /api/v1/users/me, старые cookie, без __Host-Http-session
  P-->>B: 401 unauthorized
  B-->>F: 401
  Note over F: гость - показать форму входа
  F->>B: POST /api/v1/auth/login, X-CSRF: 1
  B->>P: POST /api/v1/auth/login
  P-->>B: 200 User, Set-Cookie __Host-Http-session
  Note over P,B: тот же ответ стирает access_token, refresh_token и __Host-csrf
```

*Проект: проверить после внедрения.*
