---
type: security
title: Проверка CSRF и сессии в гостевом BFF
description: Наблюдаемые отказы 403 и 401 в гостевом tRPC-маршруте, bootstrap без cookie и ограничения свидетельства защиты BFF.
tags: [security, csrf, bff, session]
verified:
  - by: openwiki/0.7.2
    at: 2026-11-02T21:45:57.919Z
sources:
  - id: openwiki-source-2ac22079c5a49104f7bb3896
    resource: repo://site/documentation/architecture/index.md
  - id: openwiki-source-4f5bdd77990b98e5f7081f26
    resource: repo://site/documentation/bff.md
  - id: openwiki-source-05e5679509526baa1bbfcf58
    resource: repo://site/documentation/csrf/index.md
generated: { by: "codex", at: "2026-11-02T21:45:57.919Z" }
---

# CSRF и сессия в гостевом BFF

Подробное свидетельство в `site/documentation/bff.md` относится к **31.10.2026, 13:11 UTC**, чистому Chrome и публичному сайту. Оно подтверждает гостевой bootstrap и два отказа tRPC. [Дата и сценарий](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/bff.md#L3-L19).

В срезе **01.11.2026** повторно получены `/login` — `200`, tRPC без CSRF-заголовка — `403`, с `X-CSRF: 1` без сессии — `401`. Версия BFF `baf512e9a7bd7e5452554cdc89baa20e24aa7a32` установлена по revision и digest живого контейнера; Go `6e1a0d81bc284e87aa4a9561d7b65eee835a26c3` проверен по образу и HTTP после выкладки. Это пересказ зафиксированного свидетельства, без новой проверки стенда. [Протокол и версии](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/architecture/index.md#L20-L42). Полное размещение — на странице [архитектуры](mvp.md).

## Как читать два отказа

| Запрос из страницы входа | Наблюдение | Что подтверждает проверка |
| --- | --- | --- |
| `GET /api/trpc/users.me` без `X-CSRF` | `403`, `appCode: csrf_invalid` | Запрос отклонён проверкой CSRF |
| Тот же GET с `X-CSRF: 1` | `401`, «Нет сессии» | После прохождения CSRF-проверки требуется сессия |

Это два независимых ограничения доступа: добавление заголовка не делает гостя авторизованным. HTML `/login` содержит `user: null`, cookie гостю не установлены. Эти результаты зафиксированы в [site/documentation/bff.md, строки 9–15](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/bff.md#L9-L15) и [сводке проверки](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/index.md#L11-L19).

## Куда ведёт ссылка на реализацию

Канонический документ указывает [frontend/apps/bff/src/context.ts, строки 25–31](https://github.com/Cringe-Driven-Development-Team/frontend/blob/dd3d11fbeebe5bf1e2b51fdd663a36d1829a4e64/apps/bff/src/context.ts#L25-L31) на фиксированном SHA frontend: CSRF проверяется перед чтением сессии, требуется `X-CSRF: 1`, а POST дополнительно проверяет `Origin` и `Sec-Fetch-Site`. Это описание кода по документу; **на проде испытаны только два GET из таблицы**. При генерации wiki текущий main frontend не читался. [Источник: site/documentation/bff.md, строки 40–48](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/bff.md#L40-L48).

## Пределы вывода о безопасности

Проверка не даёт свидетельств входа, регистрации, refresh и параллельных запросов, выхода, истечения сессии, работы с блокнотами и POST-защиты от чужого Origin. Из ответов двух гостевых GET нельзя вывести результаты этих сценариев или свойства авторизованной сессии. Участок BFF → Go имеет ссылки на исходники, но не подтверждён авторизованным продовым сценарием. [Граница проверки: site/documentation/bff.md, строки 46–57](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/bff.md#L46-L57).

Раздел `site/documentation/csrf/` явно помечен как история и не описывает текущую защиту; его механизм не используется здесь для объяснения гостевого BFF. [Статус раздела](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/csrf/index.md#L1-L5).

Для изменения защиты сначала найди [владельца реализации](../concepts/sources.md) и сверь его исходники; [карта документации](../quickstart.md) помогает выбрать нужную тему.
