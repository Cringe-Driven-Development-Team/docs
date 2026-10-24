---
type: security
title: CSRF сейчас и целевая схема BFF
description: Текущая документированная защита Go API и отдельный план cookie-сессии, tRPC и CSRF-проверок BFF.
tags: [csrf, authentication, bff]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-24T14:00:30.220Z
sources:
  - id: openwiki-source-2b398f2cf16ee972af9b568c
    resource: repo://site/modules/2/tracks/bff/auth.md
  - id: openwiki-source-a3176359e81bfeb5ba324a0d
    resource: repo://site/security/csrf/checks.md
  - id: openwiki-source-942a55896b8fb01a7eabe4d9
    resource: repo://site/security/csrf/index.md
generated: { by: "codex", at: "2026-10-24T14:00:30.220Z" }
---

# CSRF: текущий путь и план BFF

Раздел [«CSRF: как устроено»](https://github.com/Cringe-Driven-Development-Team/docs/blob/d8efbac41672d36ddd2db295f057f84c87eabfe3/site/security/csrf/index.md#L1) описывает текущий путь браузер → Go API по снимкам кода backend `4094350` и frontend `344ad0b`. Это ссылки на конкретные версии соседних репозиториев, а не проверка их нынешнего `main`. [BFF](https://github.com/Cringe-Driven-Development-Team/docs/blob/d8efbac41672d36ddd2db295f057f84c87eabfe3/site/modules/2/tracks/bff/auth.md#L5) находится в разделе модуля и задаёт целевой маршрут; состояние развёртывания нужно проверять отдельно.

## Нынешняя защита Go API

Документированная схема — подписанный Double Submit Cookie. Сервер выдаёт читаемую JavaScript cookie `__Host-csrf`, а фронт перед изменяющим запросом читает её и повторяет значение в `X-CSRF-Token`. Сессионные `access_token` и `refresh_token` имеют `HttpOnly`; CSRF-cookie его не имеет, чтобы браузерный код мог поставить заголовок. [Описание и атрибуты cookie](https://github.com/Cringe-Driven-Development-Team/docs/blob/d8efbac41672d36ddd2db295f057f84c87eabfe3/site/security/csrf/index.md#L14).

Middleware выдаёт анонимный или подписанный токен при обращении к API и проверяет равенство cookie и заголовка; для изменяющих авторизованных запросов нужна и подпись, привязанная к пользователю. Login/register и refresh имеют свои правила `Origin` и подписи. Ошибка CSRF даёт `403 csrf_invalid`, а не `401`. [Порядок и матрица проверок](https://github.com/Cringe-Driven-Development-Team/docs/blob/d8efbac41672d36ddd2db295f057f84c87eabfe3/site/security/csrf/index.md#L38); [поведение фронта](https://github.com/Cringe-Driven-Development-Team/docs/blob/d8efbac41672d36ddd2db295f057f84c87eabfe3/site/security/csrf/index.md#L119).

[Матрица ручной проверки](https://github.com/Cringe-Driven-Development-Team/docs/blob/d8efbac41672d36ddd2db295f057f84c87eabfe3/site/security/csrf/checks.md#L41) относится к стенду на 07.10.2026 и backend `4094350`. В ней отмечены ограничения: потерянная CSRF-cookie у существующей сессии и гонка двух одновременных refresh. Эти наблюдения не подтверждают состояние стенда сегодня.

## Целевой путь BFF

План BFF хранит токены Go в зашифрованной `HttpOnly`, `Secure`, `SameSite=Lax` cookie `__Host-Http-session`; JavaScript их не читает. BFF расшифровывает сессию, при необходимости обновляет Go-токены и обращается к Go от сервера. [Атрибуты и поток вызова](https://github.com/Cringe-Driven-Development-Team/docs/blob/d8efbac41672d36ddd2db295f057f84c87eabfe3/site/modules/2/tracks/bff/auth.md#L11). В том же документе есть ссылки на конкретные SHA кода frontend и backend; для вывода о текущем `main` их надо повторно сверить.

В плане каждый RPC к `/api/trpc` требует статический `X-CSRF: 1`. Для POST дополнительно проверяются точный `Origin` и `Sec-Fetch-Site: same-origin` при наличии заголовка. Проверка идёт перед чтением сессии и вызовом Go. Межсайтовому `fetch` с этим заголовком нужен CORS preflight, который BFF не разрешает; обычная форма не выставляет заголовок. `SameSite=Lax` допускает cookie на внешней GET-навигации к HTML, поэтому GET не должен менять предметные данные. [Правила CSRF и сценарии](https://github.com/Cringe-Driven-Development-Team/docs/blob/d8efbac41672d36ddd2db295f057f84c87eabfe3/site/modules/2/tracks/bff/auth.md#L147).

Контракт браузера в плане меняется на типы роутера tRPC, а Go остаётся за Apidog и генерацией клиента Orval; см. [маршрут API](../workflows/api-contract.md). За границей между планом и фактом следите по [владельцам сведений](../concepts/sources.md).
