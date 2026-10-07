# CSRF: сценарии

::: tip
Это текущая реализация; при переезде на BFF её заменяет [Авторизация и CSRF в BFF](/bff/auth).
:::

Как CSRF-защита ведёт себя в каждом случае. Устройство — [«Как устроено»](./), команды
проверки и известные пробелы — [«Проверка и ограничения»](./checks).

На схемах: `F` — код фронта, `B` — браузер (хранит cookie и сам прикладывает их к запросам),
`A` — API, `E` — чужой сайт. «Анонимный» и «подписанный» — виды токена `__Host-csrf`. Под
каждой схемой — как сценарий проверен.

## Первый заход в чистом браузере

У гостя нет cookie. Стартовая проверка сессии — изменяющий запрос, поэтому получает `403`, но
этот же ответ приносит анонимную `__Host-csrf`: к форме входа токен уже есть.

```mermaid
sequenceDiagram
  participant F as Фронт
  participant B as Браузер
  participant A as API
  F->>B: POST /api/v1/auth/refresh, cookie нет
  B->>A: POST без cookie и без X-CSRF-Token
  Note over A: cookie нет, пользователя нет - выдать анонимный токен
  A-->>B: 403 csrf_invalid, Set-Cookie __Host-csrf анонимный
  B-->>F: 403
  Note over F: refresh не прошёл - гость, показать форму входа
```

*Проверено на проде 07.10.2026 в Chrome.*

## Регистрация

```mermaid
sequenceDiagram
  participant F as Фронт
  participant B as Браузер
  participant A as API
  F->>F: читает __Host-csrf из document.cookie
  F->>B: POST /api/v1/auth/register, логин и пароль, X-CSRF-Token
  B->>A: Cookie __Host-csrf, X-CSRF-Token, Origin свой
  Note over A: Origin свой, заголовок равен cookie
  A-->>B: 201, Set-Cookie access_token, refresh_token, __Host-csrf подписанный
  B-->>F: 201, пользователь
  F->>B: GET /api/v1/notebooks
  B->>A: Cookie access_token
  A-->>B: 200
```

*Проверено на проде 07.10.2026 в Chrome.*

## Вход

Так же, как регистрация: Double Submit без подписи (пользователя ещё нет), в ответе — новые
cookie и подписанный токен. Токен, выданный до входа, после входа не действует.

```mermaid
sequenceDiagram
  participant F as Фронт
  participant B as Браузер
  participant A as API
  F->>B: POST /api/v1/auth/login, X-CSRF-Token анонимный
  B->>A: Cookie __Host-csrf анонимный, Origin свой
  Note over A: Origin свой, заголовок равен cookie, пароль верный
  A-->>B: 200, Set-Cookie access_token, refresh_token, __Host-csrf подписанный
  B-->>F: 200, пользователь
```

*Проверено на проде 07.10.2026 в Chrome и curl.*

## Вход с неверным паролем

CSRF-проверка пройдена, отказывает обработчик: `401`, cookie не меняются.

```mermaid
sequenceDiagram
  participant F as Фронт
  participant B as Браузер
  participant A as API
  F->>B: POST /api/v1/auth/login, X-CSRF-Token
  B->>A: Cookie __Host-csrf
  Note over A: CSRF в порядке, пароль неверный
  A-->>B: 401 invalid_credentials
  B-->>F: 401, сообщение на форме
```

*Проверено на проде 07.10.2026 curl.*

## Перезагрузка страницы со входом

После F5 память фронта пуста, cookie остались. Refresh проверяет подпись токена для владельца
refresh-сессии и выдаёт новую сессию.

```mermaid
sequenceDiagram
  participant F as Фронт
  participant B as Браузер
  participant A as API
  F->>B: POST /api/v1/auth/refresh, X-CSRF-Token подписанный
  B->>A: Cookie refresh_token, __Host-csrf
  Note over A: Origin свой, заголовок равен cookie, подпись для владельца refresh
  A-->>B: 204, Set-Cookie access_token, refresh_token, __Host-csrf новый
  F->>B: GET /api/v1/users/me
  B->>A: Cookie access_token
  A-->>B: 200, пользователь
```

*Проверено на проде 07.10.2026 в Chrome.*

## Изменяющий запрос

Создание блокнота, добавление и удаление ячеек. Токен тот же, что выдан при входе или последнем
refresh: обычные запросы его не меняют.

```mermaid
sequenceDiagram
  participant F as Фронт
  participant B as Браузер
  participant A as API
  F->>F: читает __Host-csrf
  F->>B: POST /api/v1/notebooks, X-CSRF-Token
  B->>A: Cookie access_token, __Host-csrf
  Note over A: заголовок равен cookie, access действует, подпись для пользователя из access
  A-->>B: 201, блокнот
  B-->>F: 201
```

*Проверено на проде 07.10.2026 в Chrome.*

## Выход и повторный вход без перезагрузки

Выход стирает access и refresh и ставит новый анонимный токен. Фронт читает cookie перед каждым
запросом, поэтому следующий вход сразу идёт с новым значением.

```mermaid
sequenceDiagram
  participant F as Фронт
  participant B as Браузер
  participant A as API
  F->>B: POST /api/v1/auth/logout, X-CSRF-Token подписанный
  B->>A: Cookie access_token, refresh_token, __Host-csrf
  A-->>B: 204, access_token и refresh_token стёрты, __Host-csrf анонимный
  F->>F: форма входа, читает новый __Host-csrf
  F->>B: POST /api/v1/auth/login, X-CSRF-Token анонимный
  B->>A: Cookie __Host-csrf анонимный
  A-->>B: 200, три новые cookie
```

*Проверено на проде 07.10.2026 в Chrome.*

## Чужой компьютер

Алиса вышла, Боб вошёл на том же компьютере. Токен Алисы, сохранённый заранее, у Боба не
проходит: подпись привязана к пользователю.

```mermaid
sequenceDiagram
  participant F as Фронт
  participant B as Браузер
  participant A as API
  F->>B: Алиса: POST /api/v1/auth/logout
  A-->>B: 204, __Host-csrf анонимный
  F->>B: Боб: POST /api/v1/auth/login, X-CSRF-Token анонимный
  A-->>B: 200, __Host-csrf подписанный для Боба
  Note over B: кто-то подставил токен Алисы в cookie и заголовок
  B->>A: POST /api/v1/auth/refresh, токен Алисы, refresh Боба
  Note over A: подпись не сходится для Боба
  A-->>B: 403 csrf_invalid
```

*Проверено на проде 07.10.2026 curl (два пользователя).*

## Истёк access посреди работы

Через 15 минут браузер сам удаляет `access_token`. Запрос получает `401`, фронт делает один
refresh и повторяет запрос со свежим заголовком.

```mermaid
sequenceDiagram
  participant F as Фронт
  participant B as Браузер
  participant A as API
  F->>B: DELETE ячейки, X-CSRF-Token
  B->>A: Cookie __Host-csrf, access_token уже нет
  Note over A: заголовок равен cookie, пользователя нет
  A-->>B: 401
  F->>B: POST /api/v1/auth/refresh, X-CSRF-Token
  B->>A: Cookie refresh_token, __Host-csrf
  A-->>B: 204, три новые cookie
  F->>F: читает новый __Host-csrf
  F->>B: повтор DELETE, X-CSRF-Token новый
  B->>A: Cookie access_token, __Host-csrf
  A-->>B: 204
```

*Только по коду: `authMiddleware` фронта и `CSRF` бэка.*

## Атака с чужого сайта

Страница на `evil.example` отправляет форму на наш API. Форма не может поставить заголовок
`X-CSRF-Token`, а `fetch` с ним вызывает preflight, который CORS для чужого `Origin` не
пропускает. С `SameSite=Lax` браузер и не приложит наши cookie к межсайтовому `POST`, но защита
на это не рассчитывает.

```mermaid
sequenceDiagram
  participant E as evil.example
  participant B as Браузер
  participant A as API
  E->>B: форма POST /api/v1/notebooks
  B->>A: без X-CSRF-Token, Origin evil.example
  Note over A: заголовка нет
  A-->>B: 403 csrf_invalid
  E->>B: fetch POST /api/v1/auth/login с X-CSRF-Token
  B->>A: OPTIONS, Origin evil.example
  A-->>B: нет разрешения CORS для evil.example
  Note over B: основной запрос не отправлен
```

*Проверено на проде 07.10.2026 curl: `POST /auth/register` с `Origin: https://evil.example` —
`403`. Поведение браузера с формой и preflight — по спецификации Fetch.*

## Токен другого пользователя

Даже если злоумышленник подставит свой подписанный токен и в cookie, и в заголовок запроса
жертвы, подпись не сойдётся для её `userID`.

```mermaid
sequenceDiagram
  participant B as Браузер
  participant A as API
  Note over B: сессия Боба, в cookie и заголовке токен Алисы
  B->>A: POST /api/v1/auth/refresh
  Note over A: заголовок равен cookie, подпись не для Боба
  A-->>B: 403 csrf_invalid
  B->>A: POST /api/v1/auth/logout
  A-->>B: 403 csrf_invalid
```

*Проверено на проде 07.10.2026 curl.*

## Вход без `__Host-csrf`

Cookie удалили в другой вкладке или в DevTools. Вход получает `403`, но ответ уже принёс новую
cookie, и фронт один раз повторяет запрос.

```mermaid
sequenceDiagram
  participant F as Фронт
  participant B as Браузер
  participant A as API
  F->>B: POST /api/v1/auth/login, cookie нет - без X-CSRF-Token
  B->>A: без __Host-csrf
  A-->>B: 403 csrf_invalid, Set-Cookie __Host-csrf анонимный
  F->>F: повтор один раз, читает новый __Host-csrf
  F->>B: POST /api/v1/auth/login, X-CSRF-Token
  A-->>B: 200, три cookie
```

*Проверено на проде 07.10.2026 в Chrome.*

## Сессия есть, `__Host-csrf` нет

Пользователь вошёл, но cookie удалили (или он вошёл до выкатки CSRF-защиты). Бэк в ответе `403`
сразу выдаёт подписанный токен, но фронт повторяет только вход и регистрацию: стартовая проверка
уводит на страницу входа, выход и изменения показывают ошибку. Перезагрузка или повтор действия
проходит. Задача — [frontend#34](https://github.com/Cringe-Driven-Development-Team/frontend/issues/34).

```mermaid
sequenceDiagram
  participant F as Фронт
  participant B as Браузер
  participant A as API
  F->>B: POST /api/v1/auth/refresh при старте
  B->>A: Cookie refresh_token, __Host-csrf нет
  Note over A: пользователь по refresh найден
  A-->>B: 403 csrf_invalid, Set-Cookie __Host-csrf подписанный
  Note over F: повтора нет - страница входа
  F->>B: перезагрузка, POST /api/v1/auth/refresh
  B->>A: Cookie refresh_token, __Host-csrf
  A-->>B: 204
```

*Проверено на проде 07.10.2026 в Chrome.*

## Две вкладки обновляют сессию одновременно

Refresh удаляет старую сессию, поэтому из двух одновременных refresh с одной cookie проходит
только первый. Вторая вкладка показывает вход, хотя cookie уже обновлены. Бывает после
перезапуска браузера с несколькими вкладками или когда access истёк во всех вкладках сразу.
Задача — [backend#12](https://github.com/Cringe-Driven-Development-Team/backend/issues/12).

```mermaid
sequenceDiagram
  participant T1 as Вкладка 1
  participant T2 as Вкладка 2
  participant A as API
  T1->>A: POST /api/v1/auth/refresh, refresh R1
  T2->>A: POST /api/v1/auth/refresh, refresh R1
  A-->>T1: 204, новая сессия R2
  A-->>T2: 401, сессии R1 уже нет
  Note over T2: страница входа, перезагрузка возвращает пользователя
```

*Проверено на проде 07.10.2026 curl: два параллельных refresh — `204` и `401`.*

## `http://` вместо `https://`

`__Host-csrf` требует `Secure` и по `http://` не сохранится. Сайт отвечает `308` и переводит на
`https://`, поэтому до API по `http://` браузер не доходит.

```mermaid
sequenceDiagram
  participant B as Браузер
  participant S as cellestial.ru
  B->>S: GET http://cellestial.ru/
  S-->>B: 308, Location https://cellestial.ru/
  B->>S: GET https://cellestial.ru/
```

*Проверено на проде 07.10.2026 curl.*
