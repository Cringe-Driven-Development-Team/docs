---
type: workflow
title: Как поддерживать сайт, схемы и модули
description: Исходники VitePress, eraser-diagrams и графа модулей, их сборка, навигация и основные проверки.
tags: [documentation, vitepress, diagrams, modules]
sources:
  - id: openwiki-source-164e2da859b5277df81c7d94
    resource: repo://.github/workflows/ci.yml
  - id: openwiki-source-5f219f204b3e870beec929d9
    resource: repo://.github/workflows/pages.yml
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
  - id: openwiki-source-60ca35fb0bb21f8301c0ceb9
    resource: repo://site/.vitepress/config.mts
  - id: openwiki-source-d3adb09b450860c508acc951
    resource: repo://site/.vitepress/diagram-names.ts
  - id: openwiki-source-97eec6de22a65e701a2efd60
    resource: repo://site/modules/2/tracks/backend-cicd.md
generated: { by: "codex", at: "2026-10-24T17:01:28.502Z" }
verified:
  - by: openwiki/0.7.2
    at: 2026-10-24T17:01:28.502Z
---

# Работа с документацией

Сайт собирается VitePress из `site/`; обычную страницу добавляют файлом Markdown и пунктом меню в [конфиге](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/site/.vitepress/config.mts#L25). Меню модулей строится из файлов автоматически. Корневые схемы в `diagrams/*.json` встраиваются в страницу архитектуры, а схемы `diagrams/modules/<N>/` относятся к планам и скрыты из общего списка. [Правила размещения](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/AGENTS.md#L30).

## Схема как код

Для новой схемы корня нужен JSON, строка в таблице README, имя в `ROOT_NAMES` и раздел с `<Diagram>` на `site/architecture/index.md`. [Список имён и скрытых папок](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/site/.vitepress/diagram-names.ts#L1); [порядок правки](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/AGENTS.md#L40). Схемы редактируют по правилам `eraser-diagrams`: validate → check → render → просмотр PNG. Замороженную `frozen-k3s/` не правят.

Сборка рендерит HTML/PNG схем, генерирует индекс и переадресации старых адресов, затем собирает VitePress и проверяет ссылки, якоря и изображения. [Последовательность команд](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/package.json#L8); [старые якоря и переадресации](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/scripts/build-index.ts#L1). Docker-образ используется для `render`, `build` и `site`; локальный режим задаёт `DIAGRAMS_NATIVE=1`. Перед коммитом предусмотрены `bun run typecheck && bun run test && bun run build`. [Команды и среда](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/AGENTS.md#L44).

## Данные модулей

Модуль — каталог с номером; люди описаны в `people.yaml`, настройки графа — в `module-graph.yaml`, трек — Markdown во `tracks/`. Подстраницы трека должны совпадать со списком `pages` его frontmatter. Меню модулей создаёт пакет при чтении файлов; ошибка данных останавливает сборку. [Формат и связи](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/README.md#L277); [чтение модулей в конфиге](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/site/.vitepress/config.mts#L5). Быстрая проверка — `bun run modules:check`; CI запускает её до полной сборки. [CI](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/.github/workflows/ci.yml#L20).

Граф может показывать прогресс по снимку GitHub Projects: отдельный job Pages получает его, а при сбое снимка сайт всё равно собирается без прогресса. [Описание доски](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/README.md#L333); [job board](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/.github/workflows/pages.yml#L31).

Новый трек [«Доработки CI/CD бэка»](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/site/modules/2/tracks/backend-cicd.md#L1-L15) содержит четыре подстраницы в порядке `release`, `rollback`, `deployments`, `ansible`. Они объясняют **целевой** выпуск Go API и прямо помечены как план; описание текущего исходного состояния вынесено в отдельные разделы со ссылками на закреплённые версии backend и infra. [Тест страниц](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/scripts/backend-release-pages.test.ts#L1) проверяет структуру и ключевые границы этого материала. Для читательского маршрута см. [план выкладки и отката](../operations/backend-release-plan.md).

Отдельно см. [свежесть wiki](wiki-freshness.md) и [владельцев сведений](../concepts/sources.md): wiki объясняет связи, а исправление фактов начинается в исходных документах.
