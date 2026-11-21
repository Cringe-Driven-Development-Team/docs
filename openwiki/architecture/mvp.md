---
type: architecture
title: Архитектура работающего сервиса
description: Гостевой маршрут Cellestial, версии выкладки, размещение компонентов, хранилища и границы проверки 9 ноября 2026 года.
tags: [architecture, bff, production, evidence, deployment]
verified:
  - by: openwiki/0.7.2
    at: 2026-11-20T16:39:19.736Z
sources:
  - id: openwiki-source-2ac22079c5a49104f7bb3896
    resource: repo://site/documentation/architecture/index.md
  - id: openwiki-source-1a80ca3cbf75612a6a6f7bf8
    resource: repo://site/documentation/current-state.md
generated: { by: "codex", at: "2026-11-20T16:39:19.736Z" }
---

# Архитектура работающего сервиса

## Гостевой маршрут и версии

Браузер открывает `/login` через Caddy на gateway. BFF подставляет JSON bootstrap в HTML, а клиент строит SPA через `createRoot`. Запросы приложения идут в BFF по tRPC. JS и CSS загружаются с CDN выбранного выпуска. BFF обращается к Go API по приватной сети. [Размещение и потоки](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/architecture/index.md#L45-L63), [запуск SPA](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/architecture/index.md#L116-L132), [реализация bootstrap в frontend](
https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/apps/bff/src/html.ts#L21).

| Компонент | Свидетельство 09.11.2026 |
| --- | --- |
| Клиент и BFF `319e691b79f81e09dcffabc04941831a5f4b5930` | SHA в публичном HTML и [frontend CD](https://github.com/Cringe-Driven-Development-Team/frontend/actions/runs/42538007203) с проверками образа, HTML и CDN |
| Go API `06841d4765c28ad7e52bf5e36df3b72cb22c094e` | [Backend CD](https://github.com/Cringe-Driven-Development-Team/backend/actions/runs/42536140424/job/128901944399) с проверками digest контейнера, health, HTTP и запроса через BFF |
| Инфраструктура `a59f8584386810b0b94f5fb23cb72c7ff906f6d7` | Успешный [production apply](https://github.com/Cringe-Driven-Development-Team/infra/actions/runs/42532217133) |

Архитектурная сверка завершена в 03:37 МСК. В гостевом прогоне в 04:19 МСК чистый headless Chrome отобразил форму входа без ошибок JavaScript. HTML вернулся с `200`, `user: null`, без установки cookie. Публичный запрос к `/api/v1/users/me` вернул `404`. Проверенные отказы tRPC и CSP описаны на странице [безопасности](security-bff.md). Прогон не включал успешный вход, refresh, выход, блокноты, аватары, запуск и изоляцию runtime, SSH и восстановление из backup. [Версии и границы сверки](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/architecture/index.md#L12-L30), [гостевой протокол](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/current-state.md#L7-L31).

## Хранилища и исполнение

Go работает рядом с PostgreSQL и Redis на backend VPS. PostgreSQL хранит исходники, порядок ячеек, revision, outputs и историю исполнения. Redis обслуживает сессии авторизации и лимиты попыток входа и 2FA. S3 используется для аватаров и доставки статики через CDN. [Размещение](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/architecture/index.md#L45-L63), [данные блокнотов](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/architecture/index.md#L171-L186), [подключение хранилищ в backend](
https://github.com/Cringe-Driven-Development-Team/backend/blob/06841d4765c28ad7e52bf5e36df3b72cb22c094e/internal/app/app.go#L87).

По описанию выложенного кода Go создаёт отдельное окружение через OpenStack и Ansible. Go соединяется с nginx по mTLS, агент запускает Jupyter/kernel, а его служебное состояние хранится на runtime-хосте. Постоянные данные остаются в PostgreSQL при отдельном жизненном цикле среды исполнения. [Компоненты](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/architecture/index.md#L171-L186), [инфраструктура runtime](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/architecture/index.md#L191-L206), [описание provisioning в backend](
https://github.com/Cringe-Driven-Development-Team/backend/blob/06841d4765c28ad7e52bf5e36df3b72cb22c094e/docs/runtime-provisioning.md#L1).

Pulumi управляет облачными ресурсами и сетью, Ansible настраивает серверы и окружения. Restic обслуживает данные служебного контура auxiliary. Прогон не подтверждает восстановление данных продукта. [Инфраструктура](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/architecture/index.md#L156-L167), [границы проверки](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/architecture/index.md#L26-L30).

## Контракт и выкладка

Браузер вызывает типизированные процедуры tRPC. На границе BFF и Go действует HTTP-контракт OpenAPI из Apidog. Из экспортированного snapshot Orval генерирует fetch-client и Zod-схемы, oapi-codegen генерирует Go-код и спецификацию. Backend Contract drift повторяет генерацию и проверяет расхождения с репозиторием. [Описание контракта и закреплённые исходники](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/architecture/index.md#L137-L152).

Артефакты frontend публикуются отдельно. В ручном production CD выбирают выпуск, проверяют комплект, digest и ассеты, затем Ansible обновляет BFF. Для отката выбирают уже выложенный выпуск без пересборки. Backend CD после успешного main CI и при `PRODUCTION_ENABLED=true` выкатывает digest Go-образа. Миграции PostgreSQL выполняются при старте Go, откат приложения их не отменяет. [Публикация](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/architecture/index.md#L67-L76), [CD и откат](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/architecture/index.md#L93-L112).

О границах [офлайн-страницы](offline.md) и о том, [где менять реализацию](../concepts/sources.md).
