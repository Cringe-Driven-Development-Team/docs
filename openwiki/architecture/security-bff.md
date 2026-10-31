---
type: security
title: Проверка CSRF и сессии в гостевом BFF
description: Наблюдаемые отказы 403 и 401 в гостевом tRPC-маршруте, bootstrap без cookie и ограничения свидетельства защиты BFF.
tags: [security, csrf, bff, session]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-31T13:49:52.870Z
sources:
  - id: openwiki-source-4f5bdd77990b98e5f7081f26
    resource: repo://site/documentation/bff.md
  - id: openwiki-source-942a55896b8fb01a7eabe4d9
    resource: repo://site/security/csrf/index.md
generated: { by: "codex", at: "2026-10-31T13:49:52.870Z" }
---

# CSRF и сессия в гостевом BFF

Свидетельство в `site/documentation/bff.md` относится к **31.10.2026, 13:11 UTC**, чистому Chrome и [cellestial.ru](https://cellestial.ru). Оно связывает проверку с production-выкладками frontend `dd3d11fbeebe5bf1e2b51fdd663a36d1829a4e64`, backend `23d3dd9e955424a7634fb0dc49a38af6eb08792c` и infra `14653763279dab055e3cea47a84a0c531bccf03f`. SHA получены из GitHub Deployments, а не измерены у работающего процесса. [Дата и сценарий](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/documentation/bff.md#L3-L15), [источники выкладки](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/documentation/bff.md#L25-L36). Полная таблица релизов и маршрут HTML — на странице [архитектуры](mvp.md).

## Как читать два отказа

| Запрос из страницы входа | Наблюдение | Что подтверждает проверка |
| --- | --- | --- |
| `GET /api/trpc/users.me` без `X-CSRF` | `403`, `appCode: csrf_invalid` | Запрос отклонён проверкой CSRF |
| Тот же GET с `X-CSRF: 1` | `401`, «Нет сессии» | После прохождения CSRF-проверки требуется сессия |

Это два независимых ограничения доступа: добавление заголовка не делает гостя авторизованным. HTML `/login` содержит `user: null`, cookie гостю не установлены. Эти результаты зафиксированы в [site/documentation/bff.md, строки 9–15](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/documentation/bff.md#L9-L15) и [сводке проверки](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/documentation/index.md#L11-L19).

## Куда ведёт ссылка на реализацию

Канонический документ указывает [frontend/apps/bff/src/context.ts, строки 25–31](https://github.com/Cringe-Driven-Development-Team/frontend/blob/dd3d11fbeebe5bf1e2b51fdd663a36d1829a4e64/apps/bff/src/context.ts#L25-L31) на фиксированном SHA frontend: CSRF проверяется перед чтением сессии, требуется `X-CSRF: 1`, а POST дополнительно проверяет `Origin` и `Sec-Fetch-Site`. Это описание кода по документу; **на проде испытаны только два GET из таблицы**. При генерации wiki текущий main frontend не читался. [Источник: site/documentation/bff.md, строки 40–48](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/documentation/bff.md#L40-L48).

## Пределы вывода о безопасности

Проверка не даёт свидетельств входа, регистрации, refresh и параллельных запросов, выхода, истечения сессии, работы с блокнотами и POST-защиты от чужого Origin. Из ответов двух гостевых GET нельзя вывести результаты этих сценариев или свойства авторизованной сессии. Участок BFF → Go имеет ссылки на исходники, но не подтверждён авторизованным продовым сценарием. [Граница проверки: site/documentation/bff.md, строки 46–57](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/documentation/bff.md#L46-L57).

Прежний раздел `site/security/csrf/` явно помечен как история и не описывает текущую защиту; его механизм не используется здесь для объяснения гостевого BFF. [Статус раздела](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/security/csrf/index.md#L1-L5).

Для изменения защиты сначала найди [владельца реализации](../concepts/sources.md) и сверь его исходники; [карта документации](../quickstart.md) помогает выбрать нужную тему.
