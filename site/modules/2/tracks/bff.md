---
title: "BFF"
area: fullstack
do:
  iRedTea: front
  MrDuckVC: back
mentors: [YarikMix]
subtasks:
  - "tRPC (server)"
  - title: "Turborepo + bun workspaces"
    issues: [frontend#44]
pages: [workspace, contract, auth, service, bootstrap, migration, infrastructure, release, rollback]
---

::: info
Часть проверена на проде 31.10.2026: гостевая HTML-страница и отказы tRPC без CSRF-заголовка/сессии.
[Как работает сейчас](/documentation/bff). Вход, refresh и операции с данными здесь остаются планом
до проверки; ход реализации — в GitHub-задачах трека.
:::

Подзадачи трека, включая «tRPC (server)» — роутер tRPC в BFF, делает Денис; Валентин — изменения на стороне Go (см. [«Go API»](./bff/migration#go-api)).
Клиент к Go и zod-схемы из контракта Go — подтрек [«Orval»](./bff-orval). Подключение официального
`@trpc/client` — подтрек [«tRPC (client)»](./trpc-client); сервер использует официальный `@trpc/server`
и `zod`. Собственные клиент и сервер tRPC появятся в [модуле №3](/modules/3/tracks/trpc).

Браузер получает HTML с пользователем из BFF (Backend for Frontend), затем вызывает процедуры tRPC;
BFF ходит в Go API общим клиентом с единой обработкой сессии и refresh.
Токены остаются на сервере и в браузер не попадают: у пользователя только зашифрованная cookie сессии.
Страница описывает целевое состояние трека. Порядок чтения зависит от задачи; начните с монорепы и контракта.

## Порядок чтения

| Задача читателя | Документ |
| --- | --- |
| Разобраться в workspace и границах сборок | [Монорепа BFF](./bff/workspace) |
| Связать контракт Go, Orval, роутер и официальный клиент tRPC | [Контракт](./bff/contract) |
| Настроить сессию, refresh и защиту от CSRF | [Авторизация и CSRF](./bff/auth) |
| Собрать каркас, конфигурацию, health check и запуск | [Сервис BFF](./bff/service) |
| Передать пользователя в HTML и запустить клиент | [Серверный bootstrap](./bff/bootstrap) |
| Сравнить исходную и целевую схемы и переключить клиент | [Миграция на BFF](./bff/migration) |
| Подготовить две VPS, S2S и перенос Go/Postgres | [Инфраструктура BFF](./bff/infrastructure) |
| Выпустить образ BFF и ассеты одного SHA | [Выкатка](./bff/release) |
| Вернуть прежний образ и проверить результат | [Откат](./bff/rollback) |

## Как устроен контракт

<Diagram name="modules/2/bff-contract" />

Слева — то, что делается до выкатки, на ноуте или в CI. Orval — генератор кода, а не сервис: команда
`bun run sync` запускает его, и он пишет файлы в репозиторий. В проде его нет. Справа — то, что работает в
проде. Между ними — сгенерированные файлы: они попадают в сборку BFF и Go.

- **Генерация.** Контракт Go ведётся в Apidog: Go забирает его через `make generate`, монорепа — через
  `bun run sync` в `spec/openapi.json`. Orval строит по нему клиент к Go для BFF и zod-схемы операций в пакет
  `@cdd/schemas`.
- **BFF.** Процедуры роутера проверяют вход схемами из `@cdd/schemas` на настоящем `zod` и ходят в Go
  клиентом от Orval.
- **Клиент.** Официальный `@trpc/client` берёт типы процедур из `import type AppRouter`; начальные данные HTML — из `import type BootstrapData`. Кода BFF в бандле нет.
  Формы проверяют поля своими правилами, как сейчас, а ошибку входа от BFF (`zodError`) раскладывают по полям.
  Подробности — [«Контракт»](./bff/contract).

В [модуле №3](/modules/3/) появляются свои [клиент и сервер tRPC](/modules/3/tracks/trpc),
[Zod](/modules/3/tracks/zod) и [React Hook Form](/modules/3/tracks/react-hook-form): общие схемы
`@cdd/schemas` проверяют поля на BFF и в браузере ещё до запроса.

## Карта задач

Последовательность работ:
[#44 монорепа](https://github.com/Cringe-Driven-Development-Team/frontend/issues/44) →
[#45 Orval](https://github.com/Cringe-Driven-Development-Team/frontend/issues/45) →
[#2 сервер](https://github.com/Cringe-Driven-Development-Team/frontend/issues/2) →
[#46 клиент](https://github.com/Cringe-Driven-Development-Team/frontend/issues/46) →
[#5 интерфейс](https://github.com/Cringe-Driven-Development-Team/frontend/issues/5) →
[#4 выпуск](https://github.com/Cringe-Driven-Development-Team/frontend/issues/4).

Серверный tRPC и каркас BFF делает Денис; Валентин меняет контракт и реализацию Go. Orval генерирует
клиент к Go и схемы; официальный клиент tRPC подключается в #46; #5 переводит интерфейс на процедуры
и bootstrap. CI/CD можно готовить параллельно после определения артефактов, но интеграционная приёмка
BFF требует согласованного Go.

Изменения контракта и реализации Go — [backend#41](https://github.com/Cringe-Driven-Development-Team/backend/issues/41).
Первый production-этап — [infra#58](https://github.com/Cringe-Driven-Development-Team/infra/issues/58): BFF и Caddy
на действующей VPS. После проверки этого этапа [infra#59](https://github.com/Cringe-Driven-Development-Team/infra/issues/59)
развёртывает Go API и новый PostgreSQL на приватной VPS2; backend#41 — её sub-issue.

## Монорепа фронта {#монорепа-фронта}

Три workspace разделяют клиент, BFF и схемы; общий образ упаковывается после обеих сборок.
Подробнее — [Монорепа фронта](./bff/workspace#монорепа-фронта).

## Было и стало {#было-и-стало}

При переходе браузер вызывает tRPC через BFF, а BFF обращается к Go с Bearer-токеном.
Подробнее — [Было и стало](./bff/migration#было-и-стало).

## Cookie до и после {#cookie-до-и-после}

Целевой вариант оставляет браузеру зашифрованную HttpOnly-cookie сессии вместо токенов Go.
Подробнее — [Cookie до и после](./bff/migration#cookie-до-и-после).

## Почему BFF {#почему-bff}

Токены остаются на сервере; XSS всё ещё может отправлять запросы от имени пользователя.
Подробнее — [Почему BFF](./bff/migration#почему-bff).

## Что меняется {#что-меняется}

Переход затрагивает фронт, BFF, Go API и инфраструктуру.
Подробнее — [Что меняется](./bff/migration#что-меняется).

### Фронт {#фронт}

Официальный клиент tRPC получает типы BFF и начальную сессию из HTML.
Подробнее — [Фронт](./bff/migration#фронт).

### BFF {#bff}

Hono и официальный сервер tRPC используют общий слой сессии для HTML и RPC.
Подробнее — [BFF](./bff/migration#bff).

### Go API {#go-api}

Go переходит с cookie на Authorization: Bearer и выдачу токенов в JSON.
Подробнее — [Go API](./bff/migration#go-api).

### Infra {#infra}

Caddy направляет HTML и tRPC в BFF; ассеты остаются в CDN.
Подробнее — [Infra](./bff/migration#infra).

## Переключение {#переключение}

MVP использует один экземпляр BFF; короткое окно недоступности допустимо. Образ и ассеты связывает один SHA.
Подробнее — [Переключение](./bff/migration#переключение).

### Канарейка — следующий этап {#канареика-—-следующии-этап}

Канарейка остаётся развитием после MVP: нужны согласованная маршрутизация HTML/RPC и безопасный refresh между процессами.
Подробнее — [Канарейка — следующий этап](./bff/migration#канареика-—-следующии-этап).

## Две VPS {#две-vps}

Цель — Caddy/BFF на публичной VPS1 и Go/Postgres на приватной VPS2; исходный стек Pulumi описан для одной VPS.
Подробнее — [Две VPS](./bff/infrastructure#две-vps).

### S2S-ключ {#s2s-ключ}

X-BFF-Key подтверждает знание секрета сервисами; Bearer подтверждает сессию пользователя.
Подробнее — [S2S-ключ](./bff/infrastructure#s2s-ключ).

### mTLS — следующий этап {#mtls-—-следующии-этап}

mTLS не входит в MVP. HTTP в частной сети остаётся принятым риском: S2S-ключ не шифрует канал.
Подробнее — [mTLS — следующий этап](./bff/infrastructure#mtls-—-следующии-этап).

### Перенос Go и Postgres {#перенос-go-и-postgres}

План VPS2 создаёт пустую БД и сохраняет старые тома; новые записи при откате автоматически не возвращаются.
Подробнее — [Перенос Go и Postgres](./bff/infrastructure#перенос-go-и-postgres).

## Ограничения

- Смена `SESSION_KEY` разлогинивает всех: старые cookie больше не расшифровываются.
- На одной VPS Go API закрыт только сетью compose, без S2S-ключа: из этой сети любой сервис может
  позвать его напрямую. На двух VPS есть ключ `X-BFF-Key` и файрвол, см. [«Две VPS»](./bff/infrastructure#две-vps).
- BFF работает одним экземпляром: объединение одновременных refresh держится в его памяти. Второй
  экземпляр потребует общую блокировку refresh (Redis) или льготное окно из [backend#12](https://github.com/Cringe-Driven-Development-Team/backend/issues/12).

## tRPC

После начального HTML с bootstrap вызовы клиента к BFF идут через tRPC, клиент переключается разом: проект учебный, реальных
пользователей нет. Девять процедур названы по ресурсам Go (`auth.*`, `users.me`, `notebooks.*`,
`cells.*`); если экрану нужно больше одного вызова Go, для него заводится процедура `views.*`. Клиент
tRPC в модуле №2 официальный, типы он берёт из `AppRouter`. В модуле №3 его заменяют
[собственные клиент и сервер](/modules/3/tracks/trpc). Подробности — [«Контракт»](./bff/contract).
