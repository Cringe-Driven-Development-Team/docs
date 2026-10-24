---
type: guide
title: Карта документации CDD
description: Быстрый маршрут от практического вопроса к каноническому документу, коду компонента и проверке свежести wiki.
tags: [quickstart, documentation, navigation]
sources:
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
  - id: openwiki-source-0f2cc1cdbc03f7ab19013095
    resource: repo://scripts/openwiki-update-local.ts
  - id: openwiki-source-97eec6de22a65e701a2efd60
    resource: repo://site/modules/2/tracks/backend-cicd.md
  - id: openwiki-source-544ecea885fca4da03008227
    resource: repo://site/project-context.md
generated: { by: "codex", at: "2026-10-24T17:01:28.502Z" }
verified:
  - by: openwiki/0.7.2
    at: 2026-10-24T17:01:28.502Z
---

# С чего начать

Эта wiki — тематический указатель к документации команды, а не владелец фактов. Начните с `AGENTS.md` и README рабочего репозитория; для общепроектного вопроса откройте [«Контекст проекта»](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/site/project-context.md#L9). Код компонента на актуальном SHA определяет фактическую реализацию, а состояние продакшена требует проверки стенда. [Правила источников](concepts/sources.md).

| Если нужно… | Начните здесь |
| --- | --- |
| Найти владельца сведений и различить факт от плана | [Владельцы сведений](concepts/sources.md) |
| Понять документированный MVP, Compose, Caddy, Go, Postgres и S3/CDN | [Архитектура MVP](architecture/mvp.md) |
| Разобраться с нынешним CSRF и целевой авторизацией BFF | [CSRF и BFF](architecture/security-bff.md) |
| Провести изменение Go HTTP API и клиентского контракта | [Путь изменения API](workflows/api-contract.md) |
| Понять план npm Trusted Publishing и частичный релиз | [Публикация библиотек](workflows/library-release.md) |
| Найти маршрут к dev-среде, infra и статус webhook-алертов | [Разработка и алерты](operations/development-alerts.md) |
| Разобраться с **планом** выкладки и ручного отката Go API во втором модуле | [План релиза бэка](operations/backend-release-plan.md) |
| Изменить страницу, схему или данные модуля | [Сайт, схемы и модули](documentation/site-and-modules.md) |
| Проверить свежесть wiki или разобраться с её обновлением | [Свежесть OpenWiki](documentation/wiki-freshness.md) |

Локальная команда `bun run wiki:update-local` обновляет существующую wiki. Если `openwiki/quickstart.md` ещё нет в `origin/main`, нужен отдельный ручной bootstrap; порядок и проверки wiki PR описаны в [README](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/README.md#L45) и на [странице свежести](documentation/wiki-freshness.md).

## Как проверять ссылку

В каждой тематической странице ссылки на `docs` закреплены за исходным Git HEAD `d20a0f0d6d80462569c761d2e2d9cdc1defbcee6` и строкой. Ресурс `repo://путь#L…` в Claims означает путь внутри репозитория `docs` на `gitHead` из `openwiki/.last-update.json`; это указатель на свидетельство, а не самостоятельное доказательство. [README о checkpoint](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/README.md#L55); [код проверки](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/scripts/openwiki-check.ts#L8).

Перед использованием сравните `gitHead` wiki с актуальным `docs/main`: в свежем клоне выполните `bun run wiki:check --against <SHA>` с полным SHA `main`. Если wiki устарела, используйте её только для поиска путей и сверьте утверждение с исходным документом на актуальном SHA. Если путь исчез, ищите напрямую в `docs`. Ссылки на код соседних репозиториев сохраняют их собственный конкретный SHA и не подтверждают нынешний `main` без нового чтения кода. [Процедура свежести](documentation/wiki-freshness.md).

Модули и старые спеки/планы описывают работу или историю решений; текущие разделы сайта и схемы корня описывают документированную архитектуру. Даже для них факт реализации требует кода, а прод — стенда. [Граница текущего и планируемого](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/site/project-context.md#L30).
