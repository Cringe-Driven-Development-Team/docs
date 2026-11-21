---
title: "HTTP API и свои библиотеки"
label: "HTTP API и свои библиотеки"
area: front
do:
  iRedTea: front
  ManInTheCoat: front
mentors: [YarikMix]
pages: [redis-for-bff]
subtasks:
  - title: "HTTP-клиент и типы Go"
    issues: [frontend#253]
  - title: "Удаление tRPC"
    issues: [frontend#254]
  - title: "Свой Hono"
    issues: [frontend#255]
  - title: "Сериализатор"
    issues: [frontend#256]
  - title: "Завершение миграции"
    issues: [frontend#210]
  - title: "Перенос и выпуск"
    issues: [frontend-packages#67]
---

План модуля №3 — перейти с tRPC на типизированный HTTP API, убрать Orval и Zod,
реализовать используемое приложением подмножество HTTP-клиента, Hono и сериализатора.
Общий трек и подробные ТЗ — в
[frontend-packages#61](https://github.com/Cringe-Driven-Development-Team/frontend-packages/issues/61).

## Задачи и исполнители

| Задача | Исполнитель | Результат |
| --- | --- | --- |
| [HTTP-клиент и типы Go](https://github.com/Cringe-Driven-Development-Team/frontend/issues/253) | Денис | Общий HTTP-клиент для браузера и BFF, подключение к Go, удаление Orval; DTO и `GoPaths` без генератора |
| [Удаление tRPC](https://github.com/Cringe-Driven-Development-Team/frontend/issues/254) | Денис | HTTP-маршруты BFF, code-first `BffPaths`, миграция вызовов и ошибок фронта |
| [Свой Hono](https://github.com/Cringe-Driven-Development-Team/frontend/issues/255) | Ерофей | Используемые маршруты, middleware и контекст `c`, проверенные в BFF |
| [Сериализатор](https://github.com/Cringe-Driven-Development-Team/frontend/issues/256) | Ерофей | JSON-сериализация с экранированием для безопасного HTML-bootstrap |
| [Завершение миграции](https://github.com/Cringe-Driven-Development-Team/frontend/issues/210) | Денис | Окончательное удаление Zod, общая проверка приложения, затем подключение выпущенных npm-пакетов |
| [Перенос и выпуск](https://github.com/Cringe-Driven-Development-Team/frontend-packages/issues/67) | Ерофей | Перенос трёх проверенных библиотек в frontend-packages и выпуск в npm |

## Контракты и проверки

Между браузером и BFF остаётся **code-first**: маршруты и обработчики BFF определяют
контракт `BffPaths`, фронт импортирует только его TypeScript-типы. Отдельная OpenAPI-спека
BFF и кодогенерация не нужны. Сохраняются CSRF, сессии, refresh, multipart и агрегации;
транспортные батчи tRPC удаляются.

Между BFF и Go остаётся **spec-first**: OpenAPI задаёт контракт, но DTO и `GoPaths`
поддерживаются вручную или агентом без Orval и другого генератора. Риск расхождения
TypeScript-типов со спекой принят; сами типы не проверяют данные во время выполнения.

Общие ручные проверки в `@cdd/schemas` используются формами и независимо выполняются
на BFF. Проверки ответов Go и окружения остаются на сервере. Собственный Zod не создаётся;
оставшиеся применения оригинального Zod удаляются в задаче завершения миграции.

Один пакет HTTP-клиента используется с отдельными настройками и транспортами для браузера
и BFF. Транспорт возвращает стандартный `Response`, клиент разбирает тело один раз.
Авторизация, CSRF и обновление сессии остаются в обвязке приложения.

## Разработка и выпуск

Сначала `@cdd-team/http-client`, `@cdd-team/hono` и `@cdd-team/serialize-javascript`
разрабатываются в `frontend/packages/` и подключаются через `workspace:*` к реальному
приложению. Общие типы и ручные проверки приложения остаются в `@cdd/schemas`.

После совместной проверки приложения в первой части #210 исходники трёх библиотек
переносятся в `frontend-packages` и выпускаются существующим npm-процессом в #67.
Завершающая часть #210 переводит приложение с локальных библиотек на npm и повторно
проверяет интеграцию. Workspaces приложения и пакет `@cdd/schemas` сохраняются.
