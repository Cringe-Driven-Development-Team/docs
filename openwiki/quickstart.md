---
type: guide
title: Карта проверенной документации CDD
description: Куда перейти за размещением компонентов, гостевым BFF, проверенным офлайн-режимом и владельцами репозиториев и пакетов.
tags: [quickstart, navigation, ownership, evidence]
verified:
  - by: openwiki/0.7.2
    at: 2026-11-02T21:45:57.919Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-2ac22079c5a49104f7bb3896
    resource: repo://site/documentation/architecture/index.md
  - id: openwiki-source-4f5bdd77990b98e5f7081f26
    resource: repo://site/documentation/bff.md
  - id: openwiki-source-c552e07733b766b94145b7e4
    resource: repo://site/documentation/offline/index.md
  - id: openwiki-source-e1dd9e8766736372528742ec
    resource: repo://site/documentation/project-context.md
generated: { by: "codex", at: "2026-11-02T21:45:57.919Z" }
---

# С чего начать

OpenWiki — производный тематический указатель. Канонический текст остаётся в docs; исправления начинают с исходного документа. Перед работой прочитай `AGENTS.md` и README своего репозитория. Реализацию проверяй по актуальному коду владельца, продовое поведение — по SHA выкаченного релиза, дате и результату сценария, при необходимости на стенде. [Правила: site/documentation/project-context.md](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/project-context.md#L9-L31), [разрешение расхождений](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/project-context.md#L54-L56).

| Практический вопрос | Куда перейти |
| --- | --- |
| Как запрос идёт через gateway и VPS2, где Go, PostgreSQL, Redis и служебные интеграции? | [Маршрут и размещение компонентов](architecture/mvp.md) |
| На каких версиях проверены BFF и Go и где заканчивается свидетельство? | [Версии архитектурного среза](architecture/mvp.md#на-каких-версиях-сделана-проверка) |
| Почему tRPC возвращает `403` без заголовка и `401` с ним? Что известно о POST-защите? | [CSRF и сессия в гостевом BFF](architecture/security-bff.md) |
| Что показывается без сети, где сохранён SW и какие данные кешируются? | [Проверенный гостевой офлайн-режим](architecture/offline.md) |
| Где менять BFF, Go API или инфраструктуру? | [Владельцы репозиториев](concepts/sources.md#репозитории-и-границы-компонентов) |
| Кому принадлежат `@cdd-team/*`, где править пакет и искать выпуск? | [Командные пакеты](concepts/sources.md#командные-пакеты) |
| Как разрешить расхождение документов и кода? | [Проверка источников](concepts/sources.md#как-разрешать-расхождения) |

## Что означает «проверено»

Каждое свидетельство имеет свою дату, версию и набор сценариев; их нельзя объединять в проверку всех возможностей одной версии.

- **01.11.2026, SSH/HTTP:** размещение на трёх VPS, healthy Go/PostgreSQL/Redis, Go `/health` с gateway — `200`, публичный `/login` — `200`, гостевые tRPC — `403` без `X-CSRF` и `401` с `X-CSRF: 1`. BFF `baf512e9a7bd7e5452554cdc89baa20e24aa7a32` установлен по revision/digest живого контейнера; Go `6e1a0d81bc284e87aa4a9561d7b65eee835a26c3` — по образу и HTTP после выкладки. Вход, блокноты, refresh/logout, runtime-VPS и восстановление из backup не испытаны этим срезом. [site/documentation/architecture/index.md](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/architecture/index.md#L7-L42).
- **31.10.2026, 13:11 UTC, чистый Chrome:** подробная гостевая проверка подтверждает форму входа, bootstrap `user: null` без cookie, два GET-отказа CSRF/сессии и `404` прежнего маршрута пользователя. Свидетельства выкладки в этом документе взяты из GitHub Deployments, а не из измерения версии процесса. Авторизованный BFF → Go и POST-защита этой проверкой не подтверждены. [Сценарии BFF](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/bff.md#L3-L19), [граница выкладки](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/bff.md#L25-L36), [непроверенные сценарии](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/bff.md#L38-L57).
- **02.11.2026, 01:46 UTC+3, Chrome на Ubuntu:** SHA из HTML `e3b327f58f8ef929afe0403ed7c7487abba2c48d`; активный SW и precache, повторное открытие `/login` без сети у страницы и SW показывает неперсональную офлайн-страницу, «Повторить» после восстановления сети возвращает форму. Отдельный Install-прогон в 00:28 UTC+3 на том же SHA подтвердил отдельное окно и standalone. Другие браузеры, авторизованные операции и Go API этим прогоном не проверены. [site/documentation/offline/index.md](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/offline/index.md#L169-L195).

Карта владельцев — другой вид факта: она указывает репозиторий и место правки по зависимостям и CI. Ссылки на соседний код сохраняют собственные SHA; это не проверка их нынешнего main или состояния прода. [Карта: site/documentation/project-context.md](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/project-context.md#L33-L46).

## Как пользоваться ссылками и свежестью

Ссылки docs закреплены за исходным SHA **`1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a`**. Ресурс `repo://путь#L…` в Claims означает путь внутри docs на `gitHead` из `openwiki/.last-update.json`; сам по себе он не доказывает утверждение — нужно прочитать указанный исходник. Этот SHA фиксирует версию описания и карты, а не свежесть соседнего кода или прода. [Правило интерпретации ссылок](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/openwiki/INSTRUCTIONS.md#L26-L41).

Перед использованием проверь свежесть клона и выполни `bun run wiki:check --against <SHA>` с актуальным SHA docs. Устаревшая wiki служит указателем: сверь утверждение с текущим исходником владельца, а продовое утверждение — со свидетельством проверки. Если wiki недоступна или путь исчез, ищи напрямую в docs. [Правило свежести](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/project-context.md#L31), [сравнение версий](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/project-context.md#L54-L56).

Обновление запускает владелец локально после слияния исходников; CI только валидирует отдельный wiki PR, таймеров и автоматической генерации нет. Инструкции обслуживания остаются в README. `openwiki/INSTRUCTIONS.md` меняют отдельно как исходник, вне генерации. [AGENTS.md](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/AGENTS.md#L116-L119), [граница генерации](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/openwiki/INSTRUCTIONS.md#L56-L64).

[Модули](https://docs.cellestial.ru/modules/) содержат планы. Для любой страницы вне модулей учитывай статус и свидетельство; расположение документа само по себе не доказывает текущее поведение. Wiki не пересказывает планы и историю. [Статус документов](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/project-context.md#L48-L50).
