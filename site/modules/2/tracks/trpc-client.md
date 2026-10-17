---
title: "tRPC (client): подключение официального клиента"
label: "tRPC (client)"
area: front
do:
  iRedTea: front
part_of: bff
---

В модуле №2 подключаем официальный `@trpc/client` к BFF на официальном `@trpc/server` и `zod`.
Задача [frontend#46](https://github.com/Cringe-Driven-Development-Team/frontend/issues/46) остаётся
подтреком BFF: настроить общий транспорт на `/api/trpc`, типы `AppRouter`, батчинг, заголовок `X-CSRF`
и разбор ошибок, затем заменить прежние вызовы API. Настройка и ручная приёмка — в разделе
[«Клиент»](./bff/contract#клиент), работа с роутером — в [«Как добавить процедуру»](./bff/contract#как-добавить-процедуру).

Собственную реализацию здесь не пишем: отдельный трек модуля №3 —
[«Свой tRPC: клиент и сервер»](/modules/3/tracks/trpc).
