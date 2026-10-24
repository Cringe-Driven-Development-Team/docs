---
type: workflow
title: Путь изменения API
description: Маршрут от Apidog через генерацию Go и фронтенда до ручной логики, а также целевой контракт tRPC для BFF.
tags: [api, contract, codegen]
sources:
  - id: openwiki-source-dfb6448150e9dce89ae71bb7
    resource: repo://diagrams/contract.json
  - id: openwiki-source-e4437c14760fc788adca6616
    resource: repo://docs/superpowers/specs/2026-10-18-backend-refactor-design.md
  - id: openwiki-source-c6bca33463cea6f318e7ff5f
    resource: repo://site/modules/2/tracks/bff/contract.md
generated: { by: "codex", at: "2026-10-24T15:47:09.601Z" }
verified:
  - by: openwiki/0.7.2
    at: 2026-10-24T15:47:09.601Z
---

# Как провести изменение API

[Контрактная схема MVP](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/site/architecture/index.md#L42) задаёт spec-first маршрут: Go HTTP API описывают в Apidog, затем экспортируют OpenAPI и запускают генераторы в backend и frontend. На [схеме](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/diagrams/contract.json#L3) показана sprint-ветка Apidog и защищённый `main`. Перед слиянием кода контракт и сгенерированные файлы должны соответствовать `main` Apidog, а не только временной ветке.

## Go: контракт и ручная реализация

Документированный маршрут `make generate` запускает экспорт через `cmd/apidog`, затем `oapi-codegen`; результатом становится HTTP-граница со strict server, моделями и встроенной спецификацией. [Узлы генерации](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/diagrams/contract.json#L10); [связи](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/diagrams/contract.json#L40). Сгенерированный файл редактируют повторной генерацией, а не вручную.

Генерация не заменяет прикладную реализацию. Для новой или изменённой операции нужно сверить предметную модель и usecase, адаптеры доступа к PostgreSQL/S3 и HTTP-маппинг запроса, результата и ошибок. [Спека рефакторинга backend](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/docs/superpowers/specs/2026-10-18-backend-refactor-design.md#L54) описывает целевое разделение: DTO генератора остаются на HTTP-границе, delivery/http вызывает usecase, адаптеры реализуют его порты. Это проектное решение; фактическую структуру и поведение новой операции надо проверять в backend на актуальном SHA. Та же спека приводит проверенные факты только для backend SHA `31ab4ecda248ddbf20ef1eb692a8230ea9d65f23`. [Предел проверки](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/docs/superpowers/specs/2026-10-18-backend-refactor-design.md#L29).

## Фронтенд MVP

[Схема контракта](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/diagrams/contract.json#L13) показывает экспорт Apidog скриптом frontend, генерацию схемы типов и использование её HTTP-клиентом; она также показывает Contract drift проверку после повторной генерации. При изменении API проверьте diff выгрузки, обновите сгенерированную схему командой репозитория frontend, затем адаптируйте ручной клиент и UI-код и проверьте ошибки и авторизацию. Конкретные команды и имена файлов нужно подтвердить в актуальном frontend: схема `docs` фиксирует документированный маршрут, а не текущий SHA его кода.

## План BFF

Для целевого BFF Apidog остаётся владельцем Go-контракта. План задаёт `bun run sync`: выгрузка `spec/openapi.json` и Orval-генерация Go-клиента и Zod-схем. Браузерский контракт становится типом `AppRouter` из `@cdd/bff`, а не самостоятельной OpenAPI-схемой. [План источников](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/site/modules/2/tracks/bff/contract.md#L7); [команды и граница генерации](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/site/modules/2/tracks/bff/contract.md#L66). Если операции Go не хватает, план требует сначала обновить Apidog и Go, затем sync и процедуру tRPC. [Порядок добавления процедуры](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/site/modules/2/tracks/bff/contract.md#L158).

Статус BFF как продукта нельзя вывести из этого плана; см. [разделение источников](../concepts/sources.md) и [CSRF/BFF](../architecture/security-bff.md).
