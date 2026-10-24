---
type: operations
title: Разработка, эксплуатация и алерты
description: Маршруты к репозиториям компонентов, проверка dev-среды и инфраструктуры, статус планов webhook-алертов.
tags: [development, operations, alerts]
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-489df6ad9b3fd1d758d19038
    resource: repo://diagrams/infra.json
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
  - id: openwiki-source-8972d38807da784361eda191
    resource: repo://site/modules/2/tracks/apidog-alerts.md
  - id: openwiki-source-76729568705c77e1833ed0d1
    resource: repo://site/modules/2/tracks/github-alerts.md
  - id: openwiki-source-323bb86e10cd939201b5dcfd
    resource: repo://site/modules/2/tracks/telegram-alerts.md
  - id: openwiki-source-544ecea885fca4da03008227
    resource: repo://site/project-context.md
generated: { by: "codex", at: "2026-10-24T15:47:09.601Z" }
verified:
  - by: openwiki/0.7.2
    at: 2026-10-24T15:47:09.601Z
---

# Разработка и эксплуатация

[Контекст проекта](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/site/project-context.md#L13) направляет за фактическим поведением в код компонента, за HTTP-контрактом Go — в Apidog, за состоянием продакшена — ещё и на стенд. Репозитории [frontend](https://github.com/Cringe-Driven-Development-Team/frontend), [backend](https://github.com/Cringe-Driven-Development-Team/backend) и [infra](https://github.com/Cringe-Driven-Development-Team/infra) перечислены [там же](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/site/project-context.md#L26). Для конкретной задачи сначала читайте `AGENTS.md` и README соответствующего репозитория.

## Локальная среда

В этом репозитории `bun run site:dev` относится к сайту документации; `bun run build` включает рендер схем и проверку ссылок. [Команды и требования](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/README.md#L141); подробнее — [сайт и модули](../documentation/site-and-modules.md). Эта команда ничего не доказывает о dev-серверах frontend, backend или infra.

Для локальной интеграции продукта открывайте конфигурацию dev-сервера, compose-файлы и образцы окружения в соответствующих репозиториях на актуальном SHA. Проверяйте адреса прокси, cookie/Origin, переменные и порядок запуска там, где они заданы; не переносите настройки из старых планов в статус действующей конфигурации. План BFF содержит отдельный раздел разработки и маршрутов, но он находится в модуле и должен сверяться с текущим кодом. [Целевой BFF](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/site/modules/2/tracks/bff/bootstrap.md#L179); [правило о планах](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/site/project-context.md#L30).

## Инфраструктурный маршрут

Описанная [схема infra](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/diagrams/infra.json#L27) ведёт от bootstrap-стека Pulumi к основному стеку и далее к Ansible для VPS. Но действующие команды, зависимости, credentials и inventory принадлежат `infra`: [AGENTS.md](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/AGENTS.md#L37) требует сверять подписи и связи с `pulumi/`, `pulumi/bootstrap/` и `ansible/`. В wiki не приводятся значения секретов, реальные адреса или локальные параметры.

## Webhook-алерты

В модуле №2 есть [родительский трек Telegram-алертов](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/site/modules/2/tracks/telegram-alerts.md#L1) и два подтрека: [GitHub Actions → webhook](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/site/modules/2/tracks/github-alerts.md#L1) и [Apidog → webhook](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/site/modules/2/tracks/apidog-alerts.md#L1). Их файлы пока содержат только frontmatter: механизм приёма, фильтрация, повторная доставка и деплой там не описаны. Названия показывают намерение, но не подтверждают работающий сервис.

Чтобы сделать вывод о реализации, нужны код webhook-приёмника, конфигурация и тесты на актуальном SHA соответствующего репозитория. Чтобы сделать вывод о развёртывании, нужна проверка стенда и фактических настроек интеграции. Действующие уведомления CD на [схеме](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/diagrams/cd.json#L33) не доказывают, что планы webhook уже выполнены. См. [границы источников](../concepts/sources.md) и [архитектуру MVP](../architecture/mvp.md).
