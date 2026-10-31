---
type: ownership
title: Владельцы репозиториев и командных пакетов
description: Где проверять реализацию BFF, Go API и инфраструктуры, кому принадлежат шесть командных пакетов и какие версии источников подтверждают карту.
tags: [ownership, repositories, packages, sources]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-31T13:49:52.870Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-4f5bdd77990b98e5f7081f26
    resource: repo://site/documentation/bff.md
  - id: openwiki-source-30ec31c4dde661ab7b0b77e3
    resource: repo://site/documentation/index.md
  - id: openwiki-source-544ecea885fca4da03008227
    resource: repo://site/project-context.md
generated: { by: "codex", at: "2026-10-31T13:49:52.870Z" }
---

# Владельцы сведений и места правки

Начинай с `AGENTS.md` и README рабочего репозитория. Состояние реализации проверяй по его коду, конфигурации и проверкам на актуальном SHA. Для работающего поведения нужны SHA выкаченного релиза, дата и результат сценария на проде; код и CI сами по себе этого не доказывают. [Источник: site/project-context.md, строки 9–24](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/project-context.md#L9-L24).

## Репозитории и границы компонентов

| Предмет изменения | Владелец | С чего начать проверку |
| --- | --- | --- |
| HTML, tRPC и BFF | [frontend](https://github.com/Cringe-Driven-Development-Team/frontend) | `apps/bff/src/bff.ts`, `apps/bff/src/context.ts`, `apps/bff/src/go/api.ts` |
| Go API | [backend](https://github.com/Cringe-Driven-Development-Team/backend) | Код, конфигурация и проверки backend; контракт HTTP API в Apidog |
| Инфраструктура | [infra](https://github.com/Cringe-Driven-Development-Team/infra) | `pulumi/`, `pulumi/bootstrap/`, `ansible/` |
| Общепроектное описание и свидетельства сценариев | [docs](https://github.com/Cringe-Driven-Development-Team/docs) | `site/project-context.md`, `site/documentation/bff.md`, `site/architecture/index.md` |
| Задачи и PR | [общие процессы .github](https://github.com/Cringe-Driven-Development-Team/.github) | `CONTRIBUTING.md` и локальные инструкции рабочего репозитория |

Распределение BFF/Go/инфраструктуры явно дано в [site/documentation/index.md, строки 27–32](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/documentation/index.md#L27-L32); карта видов сведений — в [site/project-context.md, строки 15–26](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/project-context.md#L15-L26). Каталоги infra указаны в [AGENTS.md, строки 37–39](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/AGENTS.md#L37-L39).

Для BFF канонический документ сохраняет ссылки на [сборку HTML/tRPC](https://github.com/Cringe-Driven-Development-Team/frontend/blob/dd3d11fbeebe5bf1e2b51fdd663a36d1829a4e64/apps/bff/src/bff.ts#L21-L32), [контекст CSRF/сессии](https://github.com/Cringe-Driven-Development-Team/frontend/blob/dd3d11fbeebe5bf1e2b51fdd663a36d1829a4e64/apps/bff/src/context.ts#L25-L31) и [вызов Go](https://github.com/Cringe-Driven-Development-Team/frontend/blob/dd3d11fbeebe5bf1e2b51fdd663a36d1829a4e64/apps/bff/src/go/api.ts#L44-L55) на SHA `dd3d11fbeebe5bf1e2b51fdd663a36d1829a4e64`, а для Go — на [backend `23d3dd9e955424a7634fb0dc49a38af6eb08792c`](https://github.com/Cringe-Driven-Development-Team/backend/tree/23d3dd9e955424a7634fb0dc49a38af6eb08792c). Это указатели из [site/documentation/bff.md, строки 38–49](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/documentation/bff.md#L38-L49), а не результат нового чтения соседнего main. Свидетельство гостевого прода и его пределы разобраны в [архитектуре](../architecture/mvp.md) и [безопасности](../architecture/security-bff.md).

## Командные пакеты

Владелец библиотек — [frontend-packages](https://github.com/Cringe-Driven-Development-Team/frontend-packages). Карта на **31.10.2026** ссылается на frontend `dd3d11fbeebe5bf1e2b51fdd663a36d1829a4e64`: пять пакетов в [apps/client/package.json, строки 13–23](https://github.com/Cringe-Driven-Development-Team/frontend/blob/dd3d11fbeebe5bf1e2b51fdd663a36d1829a4e64/apps/client/package.json#L13-L23) и oxlint-плагин в [корневом package.json, строки 30–37](https://github.com/Cringe-Driven-Development-Team/frontend/blob/dd3d11fbeebe5bf1e2b51fdd663a36d1829a4e64/package.json#L30-L37). [Источник карты: site/project-context.md, строки 30–41](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/project-context.md#L30-L41).

| Пакет | Потребитель по карте | Каталог у владельца на `fa65157b5f6957fbf30fa2ebd4b3b75af19cc955` |
| --- | --- | --- |
| `@cdd-team/react` | frontend, клиент | [packages/react/package.json](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/fa65157b5f6957fbf30fa2ebd4b3b75af19cc955/packages/react/package.json#L1) |
| `@cdd-team/vite-plugin-bff-html` | frontend, клиент | [packages/vite-plugin-bff-html/package.json](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/fa65157b5f6957fbf30fa2ebd4b3b75af19cc955/packages/vite-plugin-bff-html/package.json#L1) |
| `@cdd-team/router` | frontend, клиент | [packages/router/package.json](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/fa65157b5f6957fbf30fa2ebd4b3b75af19cc955/packages/router/package.json#L1) |
| `@cdd-team/zustand` | frontend, клиент | [packages/zustand/package.json](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/fa65157b5f6957fbf30fa2ebd4b3b75af19cc955/packages/zustand/package.json#L1) |
| `@cdd-team/clsx` | frontend, клиент | [packages/clsx/package.json](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/fa65157b5f6957fbf30fa2ebd4b3b75af19cc955/packages/clsx/package.json#L1) |
| `@cdd-team/oxlint-plugin-jsdoc` | frontend, корневой тулинг | [packages/oxlint-plugin-jsdoc/package.json](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/fa65157b5f6957fbf30fa2ebd4b3b75af19cc955/packages/oxlint-plugin-jsdoc/package.json#L1) |

Процесс выпуска также принадлежит frontend-packages. Каноническая карта указывает [инструкцию владельца на `fa65157b5f6957fbf30fa2ebd4b3b75af19cc955`](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/fa65157b5f6957fbf30fa2ebd4b3b75af19cc955/README.md#L72-L79) и [release workflow на том же SHA](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/fa65157b5f6957fbf30fa2ebd4b3b75af19cc955/.github/workflows/release.yml#L15-L82): release-please готовит release PR, после слияния workflow проверяет и публикует выпущенные пакеты. Наличие GitHub Release не подтверждает успешную публикацию в npm. За версиями, API и результатами публикации переходи к владельцу. Здесь зафиксировано место правки по зависимостям и CI, а не состояние прода. [Источник: site/project-context.md, строка 43](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/project-context.md#L43).

## Как разрешать расхождения

При расхождении источников сравни версии по SHA и свежесть клона, проверь код для факта реализации и стенд для состояния продакшена, затем исправь документ-владелец вместе с изменением. [Источник: site/project-context.md, строки 51–53](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/project-context.md#L51-L53).

Канонический текст остаётся в docs. Если wiki устарела или недоступна, используй её только как указатель и читай исходники. SHA этой wiki фиксирует версию описания и карты, но не свежесть соседнего кода или прода. [Правило источников](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/project-context.md#L28), [граница SHA docs](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/openwiki/INSTRUCTIONS.md#L26-L31). Вернуться к [карте вопросов](../quickstart.md).
