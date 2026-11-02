---
title: Сценарии авторизации BFF
---

# Сценарии авторизации BFF

::: info Статус плана
Проект: проверить после внедрения. Ниже описано целевое поведение сессии;
пометки у сценариев сохраняют эту границу проверки.
:::

Семь сценариев показывают вход, запросы и завершение сессии по шагам.
Правила — [cookie сессии](./auth#cookie-сессии),
[обработка вызова](./auth#как-bff-обрабатывает-вызов) и [CSRF](./auth#csrf).
Общая картина — [обзор трека](../bff).

## Сценарии

Участники: `F` — код фронта, `B` — браузер, `P` — BFF, `A` — Go API.

<DiagramSection>

### Вход

Фронт шлёт логин с заголовком `X-CSRF: 1`. BFF проверяет заголовок и `Origin`, вызывает Go и
получает токены в JSON. Токены остаются в BFF: браузеру уходят `User` и новая cookie, а три старые
cookie стираются.

<template #diagram>

```mermaid
sequenceDiagram
  participant F as Фронт
  participant B as Браузер
  participant P as BFF
  participant A as Go API
  F->>B: POST /api/trpc/auth.login, X-CSRF: 1
  B->>P: POST /api/trpc/auth.login, Origin свой
  Note over P: заголовок X-CSRF есть, Origin равен APP_ORIGIN
  P->>A: POST /api/v1/auth/login
  A-->>P: 200 { user, tokens }
  P-->>B: 200 { result: { data: User } }, Set-Cookie __Host-Http-session
  Note over P,B: тот же ответ стирает access_token, refresh_token и __Host-csrf
  B-->>F: 200 User
```

</template>

*Проект: проверить после внедрения.*

</DiagramSection>

<DiagramSection>

### Запрос данных

BFF расшифровывает cookie и подставляет access токен как `Authorization: Bearer`. Фронт про токены
ничего не знает.

<template #diagram>

```mermaid
sequenceDiagram
  participant F as Фронт
  participant B as Браузер
  participant P as BFF
  participant A as Go API
  F->>B: GET /api/trpc/notebooks.list, X-CSRF: 1
  B->>P: GET /api/trpc/notebooks.list, Cookie __Host-Http-session
  Note over P: расшифровывает cookie, access ещё живой
  P->>A: GET /api/v1/notebooks, Authorization: Bearer
  A-->>P: 200
  P-->>B: 200
  B-->>F: 200
```

</template>

*Проект: проверить после внедрения.*

</DiagramSection>

<DiagramSection>

### Access истёк

Если до `accessExp` меньше 30 с, BFF обновляет токены сам, а потом выполняет исходный запрос.
Фронт делает один запрос и не замечает refresh; новая cookie приходит с обычным ответом.

<template #diagram>

```mermaid
sequenceDiagram
  participant F as Фронт
  participant B as Браузер
  participant P as BFF
  participant A as Go API
  F->>B: GET /api/trpc/notebooks.list, X-CSRF: 1
  B->>P: GET /api/trpc/notebooks.list, Cookie __Host-Http-session
  Note over P: до accessExp меньше 30 с
  P->>A: POST /api/v1/auth/refresh, refresh_token
  A-->>P: 200 TokenPair
  P->>A: GET /api/v1/notebooks, Authorization: Bearer новый access
  A-->>P: 200
  P-->>B: 200, Set-Cookie __Host-Http-session новая
  B-->>F: 200
```

</template>

*Проект: проверить после внедрения.*

<a id="две-вкладки"></a>

</DiagramSection>

<DiagramSection>

### Параллельные RPC

`users.me` и `notebooks.list` отправлены из одной вкладки разными HTTP-запросами со старой cookie,
у которой access почти истёк. Go получает один вызов refresh, а оба RPC используют новую пару.
После refresh вызовы данных в Go независимы: они могут выполняться параллельно и завершаться
в любом порядке.

<template #diagram>

```mermaid
sequenceDiagram
  participant F as Фронт
  participant B as Браузер
  participant P as BFF
  participant A as Go API
  F->>B: GET users.me и notebooks.list
  B->>P: GET /api/trpc/users.me, старая cookie
  B->>P: GET /api/trpc/notebooks.list, старая cookie
  P->>A: POST /api/v1/auth/refresh, refresh_token
  Note over P: оба RPC ждут одну Promise в inflight
  A-->>P: 200 TokenPair
  par users.me
    P->>A: GET /api/v1/users/me, Bearer новый access
    A-->>P: 200
  and notebooks.list
    P->>A: GET /api/v1/notebooks, Bearer новый access
    A-->>P: 200
  end
  P-->>B: users.me, Set-Cookie новая
  P-->>B: notebooks.list, Set-Cookie с той же парой
  Note over P: успешный результат хранится ещё 10 с
```

</template>

*Проект: проверить после внедрения.*

</DiagramSection>

<DiagramSection>

### Выход

Клиент сначала дожидается остальных защищённых HTTP-запросов или подтверждает их отмену, а новые
не отправляет. Иначе ответ старого RPC может прийти после успешного выхода и восстановить cookie.
Это правило действует для разных RPC, даже если они не попали в один батч.

После проверки CSRF процедура `auth.logout` (при истёкшем access — после refresh) вызывает Go с Bearer и `refresh_token` в теле, стирает cookie
и отвечает успехом. Даже если Go вернул `401` (токен уже недействителен), клиент получает успех: сессии
больше нет в любом случае. Без cookie сессии Go не вызывается, а ответ тот же; три старые cookie
стираются всегда.

<template #diagram>

```mermaid
sequenceDiagram
  participant F as Фронт
  participant B as Браузер
  participant P as BFF
  participant A as Go API
  F->>B: GET /api/trpc/notebooks.list
  B->>P: GET /api/trpc/notebooks.list
  F->>B: пользователь нажал «Выход»
  Note over F,B: новые защищённые RPC не отправляются
  P->>A: GET /api/v1/notebooks
  A-->>P: 200
  P-->>B: ответ старого RPC, возможный Set-Cookie
  B-->>F: прежний запрос завершился
  F->>B: POST /api/trpc/auth.logout, X-CSRF: 1
  B->>P: POST /api/trpc/auth.logout, Cookie __Host-Http-session
  P->>A: POST /api/v1/auth/logout, Authorization: Bearer, { refresh_token }
  A-->>P: 204
  P-->>B: 200 { result: {} }, Set-Cookie __Host-Http-session Max-Age=0
  Note over P: успех и когда Go ответил 401
  Note over P,B: тот же ответ стирает access_token, refresh_token и __Host-csrf
  B-->>F: успех
```

</template>

*Проект: проверить после внедрения.*

</DiagramSection>

<DiagramSection>

### Сессия кончилась

Refresh-токен отозван или не принят Go. Go отвечает `401`, BFF стирает cookie и отвечает
`UNAUTHORIZED`; фронт показывает форму входа. Если refresh просто истёк, браузер уже удалил
cookie (`Max-Age` = `refresh_expires_in`), и `authedProcedure` отвечает `UNAUTHORIZED`, не обращаясь в Go.

<template #diagram>

```mermaid
sequenceDiagram
  participant F as Фронт
  participant B as Браузер
  participant P as BFF
  participant A as Go API
  F->>B: GET /api/trpc/users.me, X-CSRF: 1
  B->>P: GET /api/trpc/users.me, Cookie __Host-Http-session
  Note over P: до accessExp меньше 30 с
  P->>A: POST /api/v1/auth/refresh, refresh_token
  A-->>P: 401
  Note over P: refresh отозван или не принят, сессия кончилась
  P-->>B: 401 UNAUTHORIZED, Set-Cookie Max-Age=0
  B-->>F: 401
  Note over F: гость - показать форму входа
```

</template>

*Проект: проверить после внедрения.*

</DiagramSection>

<DiagramSection>

### Первый вход после переезда

У пользователя в браузере старые cookie `access_token`, `refresh_token` и `__Host-csrf`, а новой
`__Host-Http-session` нет. HTML содержит `user: null` без вызова Go; клиент показывает форму входа.
Пользователь входит заново, и ответ входа ставит новую cookie и стирает три старые.

<template #diagram>

```mermaid
sequenceDiagram
  participant F as Фронт
  participant B as Браузер
  participant P as BFF
  B->>P: GET HTML через Caddy, старые cookie, без __Host-Http-session
  Note over P: Go не вызывается
  P-->>B: 200 HTML с user null
  B-->>F: bootstrap user null
  Note over F: гость - показать форму входа
  F->>B: POST /api/trpc/auth.login, X-CSRF: 1
  B->>P: POST /api/trpc/auth.login
  P-->>B: 200 { result: { data: User } }, Set-Cookie __Host-Http-session
  Note over P,B: тот же ответ стирает access_token, refresh_token и __Host-csrf
```

</template>

*Проект: проверить после внедрения.*

</DiagramSection>
