---
type: architecture
title: Проверенный маршрут и размещение компонентов
description: Размещение на трёх VPS и проверенные версии BFF и Go на 01.11.2026, гостевой маршрут и границы подтверждения пользовательских сценариев.
tags: [architecture, bff, production, evidence, deployment]
verified:
  - by: openwiki/0.7.2
    at: 2026-11-02T21:45:57.919Z
sources:
  - id: openwiki-source-2ac22079c5a49104f7bb3896
    resource: repo://site/documentation/architecture/index.md
  - id: openwiki-source-4f5bdd77990b98e5f7081f26
    resource: repo://site/documentation/bff.md
generated: { by: "codex", at: "2026-11-02T21:45:57.919Z" }
---

# Маршрут запроса и границы компонентов

Срез **01.11.2026** в `site/documentation/architecture/index.md` фиксирует проверку размещения по SSH и HTTP. Это пересказ канонического свидетельства на SHA docs `1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a`, без нового обращения к продакшену или коду соседних репозиториев. [Дата, размещение и результаты](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/architecture/index.md#L7-L42).

| Участок | Ответственность | Что подтверждено |
| --- | --- | --- |
| gateway | Caddy и BFF: HTTPS, HTML, `/api/trpc` | На машине только Caddy/BFF; `/login` с `Accept: text/html` возвращает `200` |
| VPS2 | Go API, PostgreSQL 18, Redis 8 | Контейнеры healthy; `pg_isready`, Redis ping успешны; Go `/health` с gateway — `200` |
| auxiliary | Caddy, hooks, Telegram proxy | Служебные интеграции отделены от пользовательского запроса |
| S3 / CDN | JS/CSS выпуска, общая статика и продуктовые бакеты | Наличие и конфигурация; пользовательский CRUD не испытан |
| GitHub Pages | Документация | Отдельная публикация знаний |

Браузер обращается к Caddy/BFF на gateway; BFF настроен вызывать Go по приватной сети на VPS2. PostgreSQL и Redis размещены рядом с Go и не публикуют host-порты. JS/CSS поступают с CDN; HTML-шаблон входит в образ BFF. Настроенная связь Go с S3 не доказывает сохранение блокнота. [Размещение](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/architecture/index.md#L12-L23), [поток запроса](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/architecture/index.md#L68-L77), [разделение HTML и ассетов](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/architecture/index.md#L123-L136).

## На каких версиях сделана проверка

| Компонент | Версия в свидетельстве 01.11.2026 | Способ проверки |
| --- | --- | --- |
| BFF | [`baf512e9a7bd7e5452554cdc89baa20e24aa7a32`](https://github.com/Cringe-Driven-Development-Team/frontend/commit/baf512e9a7bd7e5452554cdc89baa20e24aa7a32) | Revision и digest живого контейнера по SSH |
| Go API | [`6e1a0d81bc284e87aa4a9561d7b65eee835a26c3`](https://github.com/Cringe-Driven-Development-Team/backend/commit/6e1a0d81bc284e87aa4a9561d7b65eee835a26c3) | Успешная выкладка, затем образ `sha-6e1a0d8`, healthy и HTTP `200` по SSH |

Digest BFF в источнике: `sha256:26205cff0bdfd9c1d74e9f23557d8c931c724b9573ee49ce1b6eec3748c233f3`. Эти сведения относятся к названному срезу, а не к текущему main или новой проверке работающих процессов. [Версии и свидетельства](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/architecture/index.md#L25-L42).

## Что проходит от браузера до BFF

Подробная проверка **31.10.2026, 13:11 UTC**, чистый Chrome, зафиксировала следующие результаты. [Канонический протокол](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/bff.md#L3-L19).

| Действие гостя | Наблюдение |
| --- | --- |
| Открыть `/` | `302` на `/login`, затем `200` и форма входа |
| Прочитать bootstrap `/login` | `user: null`, cookie не установлены |
| `GET /api/trpc/users.me` без `X-CSRF` | `403`, `appCode: csrf_invalid` |
| Тот же GET с `X-CSRF: 1` | `401`, «Нет сессии» |
| `GET /api/v1/users/me` | `404 Not Found` |

Обычный curl к `/` без `Accept: text/html` возвращает `404` и не воспроизводит браузерное открытие формы. В срезе 01.11 повторно зафиксированы `/login` и два отказа tRPC. Добавление CSRF-заголовка не создаёт сессию; подробнее — [безопасность BFF](security-bff.md). [Условие Accept](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/bff.md#L17-L19), [повторная проверка](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/architecture/index.md#L20-L28).

## Контракты и места реализации

В frontend находятся `apps/client`, `apps/bff` и `packages/schemas`. Браузер вызывает tRPC BFF, а BFF обращается к Go по HTTP-контракту OpenAPI из Apidog. oapi-codegen для Go и Orval для fetch-client/Zod читают экспортированный snapshot; Apidog не участвует в каждом пользовательском запросе. Backend drift повторно генерирует контракт и сравнивает его с репозиторием; отдельного frontend drift workflow в описанном срезе нет. [Границы frontend](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/architecture/index.md#L123-L136), [контракт](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/architecture/index.md#L140-L153).

Для проверки связи с Go документ указывает [frontend/apps/bff/src/go/fetch.ts на `baf512e9a7bd7e5452554cdc89baa20e24aa7a32`](https://github.com/Cringe-Driven-Development-Team/frontend/blob/baf512e9a7bd7e5452554cdc89baa20e24aa7a32/apps/bff/src/go/fetch.ts#L8-L24), для размещения — [infra/ansible/roles/app/templates/compose.yml.j2 на `0a21f459dc2722d631b11cb9e82af5d3aa1c95ef`](https://github.com/Cringe-Driven-Development-Team/infra/blob/0a21f459dc2722d631b11cb9e82af5d3aa1c95ef/ansible/roles/app/templates/compose.yml.j2#L22-L149). Это закреплённые указатели из канонической страницы, а не отдельное чтение текущего кода. [Источники связи](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/architecture/index.md#L75-L77). Остальные места правки — в [карте владельцев](../concepts/sources.md).

## Выпуск и инфраструктура

Публикация артефактов отделена от production CD. Frontend main publish при включённом флаге создаёт BFF image, S3-ассеты SHA и release-artifacts. Его production CD запускают вручную: выбирается выпуск, сверяются digest и ассеты, Ansible выкладывает его и проверяет результат. Rollback выбирает существующий выпуск без пересборки. Backend публикует образы независимо от `PRODUCTION_ENABLED`; этот флаг разрешает production deploy после успешного main CI через gateway на VPS2. Go выполняет миграции при старте; откат BFF не откатывает БД. [CI и закреплённые источники](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/architecture/index.md#L81-L99), [CD и границы отката](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/architecture/index.md#L103-L119).

Pulumi владеет облачными ресурсами и отдельным проектом state, Ansible — настройкой серверов и Compose. На auxiliary hooks использует SQLite/outbox и Telegram proxy, Restic обслуживает данные auxiliary. Это не свидетельство backup PostgreSQL или восстановления продукта. [Инфраструктура и исходники](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/architecture/index.md#L157-L173), [граница восстановления](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/architecture/index.md#L36-L42).

## Где заканчивается проверка

Участок BFF → Go указан в исходниках, но авторизованный сценарий не проверен. Вход, регистрация, refresh, параллельные запросы, logout, истечение сессии, блокноты и POST-защита от чужого Origin не подтверждены проверкой гостевого BFF. В срезе 01.11 также не испытаны создание, исполнение и удаление runtime-VPS и восстановление из backup; `RUNTIME_ENABLED=true` подтверждает только включение механизма. [Граница BFF](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/bff.md#L38-L57), [граница архитектурного среза](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/architecture/index.md#L36-L42).

Более поздний [офлайн-прогон](offline.md) имеет собственные дату, SHA и ограничения. Выбор темы — в [карте документации](../quickstart.md).
