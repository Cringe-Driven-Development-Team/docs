---
type: ownership
title: Владельцы репозиториев и пакетов
description: Куда идти за реализацией клиента, BFF, Go API и инфраструктуры, кому принадлежат HTTP-контракт и командные пакеты.
tags: [ownership, repositories, packages, sources]
verified:
  - by: openwiki/0.7.2
    at: 2026-11-20T16:39:19.736Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-1a80ca3cbf75612a6a6f7bf8
    resource: repo://site/documentation/current-state.md
  - id: openwiki-source-ce98287df8bcc7af43c8a489
    resource: repo://site/documentation/frontend/bff.md
  - id: openwiki-source-527fdfd3396771ab16c48a10
    resource: repo://site/documentation/frontend/packages.md
  - id: openwiki-source-e1dd9e8766736372528742ec
    resource: repo://site/documentation/project-context.md
generated: { by: "codex", at: "2026-11-20T16:39:19.736Z" }
---

# Владельцы репозиториев и пакетов

Начни с `AGENTS.md` и README рабочего репозитория. При пробеле, противоречии или правке сверяй реализацию по коду, конфигурации и проверкам владельца на нужном SHA. При расхождении уточни ревизии, проверь код для вопроса о реализации и стенд для вопроса о состоянии прода, затем исправь документ-владелец. Для продового утверждения нужны SHA выкаченного релиза, дата и результат сценария. Каноническое общепроектное описание остаётся в docs. [Порядок работы](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/project-context.md#L7-L14), [источники и правила](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/project-context.md#L25-L37), [расхождения](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/project-context.md#L65-L67).

## Как найти владельца

| Что нужно проверить | Владелец и точка входа |
| --- | --- |
| Клиент, HTML и tRPC | [frontend](https://github.com/Cringe-Driven-Development-Team/frontend), `apps/client/`, `apps/bff/`, `packages/schemas/` |
| Go API, сохранение и runtime-agent | [backend](https://github.com/Cringe-Driven-Development-Team/backend). Подключение хранилищ описано в `internal/app/app.go`; развёртывание среды исполнения изучают через `docs/runtime-provisioning.md` |
| Сеть, облачные ресурсы, серверы и подготовка runtime | [infra](https://github.com/Cringe-Driven-Development-Team/infra), `pulumi/`, `pulumi/bootstrap/` и `ansible/` |
| HTTP-контракт BFF → Go | Apidog. Orval и oapi-codegen получают экспортированный OpenAPI snapshot |
| Свидетельства гостевого прогона и общая схема | [docs](https://github.com/Cringe-Driven-Development-Team/docs), `site/documentation/current-state.md`, `site/documentation/architecture/index.md` и `site/documentation/project-context.md` |
| Правила задач и PR | Общий репозиторий [`.github`](https://github.com/Cringe-Driven-Development-Team/.github), `CONTRIBUTING.md` |

[Карта репозиториев и видов сведений](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/project-context.md#L16-L31), [владельцы компонентов](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/current-state.md#L58-L68), [пути infra](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/AGENTS.md#L39-L44), [генерация контракта](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/architecture/index.md#L137-L152).

Точки входа BFF закреплены на срезе frontend `ea123518d624521f999e884ff32ddec0a5bf6bfa`: `bff.ts` собирает приложение, `context.ts` обрабатывает CSRF и сессию, `go/api.ts` вызывает Go. Для хранилищ и provisioning архитектурная страница ссылается на выложенный backend `06841d4765c28ad7e52bf5e36df3b72cb22c094e`. [Сборка BFF](https://github.com/Cringe-Driven-Development-Team/frontend/blob/ea123518d624521f999e884ff32ddec0a5bf6bfa/apps/bff/src/bff.ts#L9-L38), [контекст](https://github.com/Cringe-Driven-Development-Team/frontend/blob/ea123518d624521f999e884ff32ddec0a5bf6bfa/apps/bff/src/context.ts#L19-L42), [Go-адаптер](https://github.com/Cringe-Driven-Development-Team/frontend/blob/ea123518d624521f999e884ff32ddec0a5bf6bfa/apps/bff/src/go/api.ts#L80-L88), [хранилища](https://github.com/Cringe-Driven-Development-Team/backend/blob/06841d4765c28ad7e52bf5e36df3b72cb22c094e/internal/app/app.go#L87), [provisioning](https://github.com/Cringe-Driven-Development-Team/backend/blob/06841d4765c28ad7e52bf5e36df3b72cb22c094e/docs/runtime-provisioning.md#L1). [Указатели docs на BFF](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/frontend/bff.md#L13-L20), [на контекст](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/frontend/bff.md#L35-L45), [на адаптер](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/frontend/bff.md#L90-L97) и [на backend](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/architecture/index.md#L173-L186).

## Где менять командные пакеты

Исходники и публикация пакетов принадлежат [frontend-packages](https://github.com/Cringe-Driven-Development-Team/frontend-packages). Карта показывает места правки. Потребление подтверждают манифесты frontend и его `bun.lock` на срезе `ea123518d624521f999e884ff32ddec0a5bf6bfa`. [Карта пакетов](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/project-context.md#L39-L56), [зависимости и lockfile](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/frontend/packages.md#L12-L46), [манифест клиента](https://github.com/Cringe-Driven-Development-Team/frontend/blob/ea123518d624521f999e884ff32ddec0a5bf6bfa/apps/client/package.json#L13-L30), [корневые зависимости](https://github.com/Cringe-Driven-Development-Team/frontend/blob/ea123518d624521f999e884ff32ddec0a5bf6bfa/package.json#L34-L43), [lockfile](https://github.com/Cringe-Driven-Development-Team/frontend/blob/ea123518d624521f999e884ff32ddec0a5bf6bfa/bun.lock#L282-L298).

| Пакет | Применение во frontend | Манифест у владельца на SHA пакета |
| --- | --- | --- |
| `@cdd-team/react` | Рендерер клиента | [packages/react/package.json](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/f4d2bd02fcc127e5603bbe09874242b071def7ba/packages/react/package.json#L1-L30) |
| `@cdd-team/router` | Маршрутизация клиента | [packages/router/package.json](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/bda991c58d01a88b119d910787a87966e31bfe0a/packages/router/package.json#L1-L44) |
| `@cdd-team/zustand` | Общие сторы | [packages/zustand/package.json](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/4652b210db7bf9fcdbbdf96539b412201a1bec85/packages/zustand/package.json#L1-L45) |
| `@cdd-team/clsx` | Сборка строки CSS-классов | [packages/clsx/package.json](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/bda991c58d01a88b119d910787a87966e31bfe0a/packages/clsx/package.json#L1-L25) |
| `@cdd-team/vite-plugin-bff-html` | Инструменты разработки клиента | [packages/vite-plugin-bff-html/package.json](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/5be3456bc9df61efebef6902ac5ebe157a307c60/packages/vite-plugin-bff-html/package.json#L1-L47) |
| `@cdd-team/oxlint-plugin-jsdoc` | Корневой линтер | [packages/oxlint-plugin-jsdoc/package.json](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/ecd57a1f6e5a10c6b2a253a9d635136d14b81b18/packages/oxlint-plugin-jsdoc/package.json#L1-L47) |

У владельца release-please готовит release PR. После слияния workflow проверяет и публикует выпущенные пакеты. Доступность версии подтверждают в npm. Обновление зависимости и `bun.lock` приложения происходит во frontend отдельно. [Процесс владельца](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/project-context.md#L45-L56), [выпуск и обновление](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/frontend/packages.md#L82-L107), [release.yml на SHA среза](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/f4d2bd02fcc127e5603bbe09874242b071def7ba/.github/workflows/release.yml#L15-L82).

[Архитектура работающего сервиса](../architecture/mvp.md), [граница BFF](../architecture/security-bff.md) и [карта вопросов](../quickstart.md).
