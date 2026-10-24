---
type: architecture
title: Архитектура MVP и инфраструктурные маршруты
description: Где проходят границы текущей документированной схемы MVP и как соотносятся клиент, Compose, хранилища и операции.
tags: [architecture, mvp, infrastructure]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-24T15:47:09.601Z
sources:
  - id: openwiki-source-1f4b78441958385b2008e9e8
    resource: repo://diagrams/deployment.json
  - id: openwiki-source-489df6ad9b3fd1d758d19038
    resource: repo://diagrams/infra.json
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
generated: { by: "codex", at: "2026-10-24T15:47:09.601Z" }
---

# Архитектура MVP

В [README](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/README.md#L88) рабочей архитектурой названа одна VPS: браузер обращается к Go API напрямую через Caddy, рядом работают Go и Postgres в Docker Compose. [Страница архитектуры](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/site/architecture/index.md#L18) и [исходник схемы deployment](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/diagrams/deployment.json#L23) показывают путь `/api/v1/*` от Caddy к Go и связь Go с Postgres.

## Потоки и хранилища

В схеме браузер получает HTML через Caddy, а статические файлы через CDN. Go обращается к приватному S3 для ноутбуков и публичному хранилищу аватаров; отдельный бакет за CDN отведён под статику. Это описание связей в документации, а не самостоятельная проверка живого стенда. [Связи deployment](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/diagrams/deployment.json#L23).

Схема [CD](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/site/architecture/index.md#L30) показывает доставку фронта в S3 с переключением релиза и откатом, а бэкенда — через Ansible на VPS. За точным действующим поведением пайплайнов нужно идти в репозитории компонентов и проверять фактический запуск; схема фиксирует документированный маршрут.

## Инфраструктурный порядок

[Схема infra](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/diagrams/infra.json#L27) разделяет bootstrap-стек Pulumi для общего проекта, бакета состояния и DNS и основной стек для сети, VPS, бакетов и CDN. После подготовки ресурсов Ansible использует inventory и подключается к VPS. Реальные параметры и порядок команд следует подтверждать в `infra` (`pulumi/`, `pulumi/bootstrap/`, `ansible/`), как предписывают [инструкции репозитория](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/AGENTS.md#L33).

## Граница актуальности

`diagrams/frozen-k3s/` — замороженный вариант; [README](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/README.md#L88) явно отделяет его от MVP. Схемы модуля №2 описывают план BFF и не меняют текущую картину сами по себе. Проверка реализации требует кода компонента на актуальном SHA, проверка продакшена — стенда; см. [владельцев сведений](../concepts/sources.md) и [CSRF/BFF](security-bff.md).
