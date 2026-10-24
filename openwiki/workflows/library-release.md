---
type: workflow
title: План публикации библиотек
description: Целевой выпуск библиотек CDD через release-please и npm Trusted Publishing, проверка и восстановление частичного релиза.
tags: [libraries, release, npm, oidc]
sources:
  - id: openwiki-source-73c2d169813c22265f642d70
    resource: repo://site/modules/2/tracks/front-libs.md
  - id: openwiki-source-8239db53cb2731ff6347d6e8
    resource: repo://site/modules/2/tracks/front-libs/publishing.md
  - id: openwiki-source-90f906e62651f1a93a361e52
    resource: repo://site/modules/2/tracks/front-libs/recovery.md
  - id: openwiki-source-dd10ece5a68d3fa1eabc60ae
    resource: repo://site/modules/2/tracks/front-libs/releases.md
  - id: openwiki-source-b04302f3de34189e08596fb1
    resource: repo://site/modules/2/tracks/front-libs/setup.md
generated: { by: "codex", at: "2026-10-24T15:47:09.601Z" }
verified:
  - by: openwiki/0.7.2
    at: 2026-10-24T15:47:09.601Z
---

# Публикация библиотек: план

Это [план трека модуля №2](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/site/modules/2/tracks/front-libs.md#L14), а не свидетельство, что три пакета уже перенесены и публикуются. Цель — общий workspace `frontend-packages` для командных React, Zustand и OpenAPI, с независимыми версиями. Исходные имена и версии зафиксированы в треке по SHA соседних репозиториев на 17.10.2026; актуальный npm и код надо проверять отдельно.

## Две роли в выпуске

`release-please` в плане готовит версии, CHANGELOG, release PR и GitHub Releases. Publish job отвечает за сборку и загрузку в npm; наличие GitHub Release само по себе не подтверждает публикацию. Выпускаются только пути `paths_released` в порядке зависимостей: React до Zustand, если изменились оба. Ошибка прекращает дальнейшую публикацию. [План релиза](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/site/modules/2/tracks/front-libs/releases.md#L9).

Первичная регистрация новых npm-имён предусмотрена отдельно: проверка прав и имён, сборка архивов, ручной bootstrap пакетов и исходных тегов, затем настройка доверенного издателя и первый workflow-выпуск. [План настройки](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/site/modules/2/tracks/front-libs/setup.md#L7). Он не говорит, что bootstrap уже завершён.

## Trusted Publishing

В целевой схеме GitHub OIDC выдаёт подписанный ID-токен job; npm сверяет его с Trusted Publisher конкретного пакета и даёт краткоживущее право публикации. Постоянный npm-токен для обычного выпуска не нужен. [Механизм и порядок](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/site/modules/2/tracks/front-libs/publishing.md#L62).

Для каждого пакета план требует точное совпадение organization/repository/workflow filename, environment при его использовании и разрешение `Allow npm publish`. Job требует `id-token: write`, совместимые GitHub-hosted runner, Node.js и npm CLI. `contents: read` в примере относится к publish job; для release-please, создающего PR и Releases, отдельно нужны `pull-requests: write` и `contents: write`. [Настройка и разрешения](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/site/modules/2/tracks/front-libs/publishing.md#L87). Право OIDC подтверждает identity workflow, но не качество или совместимость кода.

## Частичный выпуск

Результат проверяют в npm registry и чистом проекте-потребителе, включая типы и runtime-связку React/Zustand. Если React уже опубликован, а Zustand упал, сверяют логи, теги и точные name/version в registry, учитывают задержку метаданных, исправляют причину и публикуют только отсутствующий пакет из того же проверенного коммита. Уже существующую пару name/version не перезаписывают; для изменения опубликованного содержимого готовят новую версию. [План проверки и восстановления](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/site/modules/2/tracks/front-libs/recovery.md#L9).

Проверенный [пример TP-Prepare](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/site/modules/2/tracks/front-libs/releases.md#L62) иллюстрирует механизм, но не доказывает CI CDD. За текущей реализацией идите в `frontend-packages` на актуальном SHA; см. [владельцев сведений](../concepts/sources.md).
