---
type: workflow
title: Свежесть OpenWiki и обновление источника
description: Как сравнить checkpoint wiki с docs/main, читать устаревшие страницы и исправлять канонический документ.
tags: [openwiki, freshness, provenance]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-24T14:05:58.584Z
sources:
  - id: openwiki-source-380a394a4ec8e02da4e26a7a
    resource: repo://.github/workflows/openwiki-freshness.yml
  - id: openwiki-source-7d571db73f7bc6eb1ea8e5c6
    resource: repo://scripts/openwiki-check.ts
  - id: openwiki-source-0f2cc1cdbc03f7ab19013095
    resource: repo://scripts/openwiki-update-local.ts
  - id: openwiki-source-544ecea885fca4da03008227
    resource: repo://site/project-context.md
generated: { by: "codex", at: "2026-10-24T14:05:58.584Z" }
---

# Свежесть OpenWiki

OpenWiki — производный указатель. Канонический текст остаётся в `docs`; исправление факта начинается с документа-владельца. [Правило проекта](https://github.com/Cringe-Driven-Development-Team/docs/blob/d8efbac41672d36ddd2db295f057f84c87eabfe3/site/project-context.md#L28). Проверять реализацию нужно по коду компонента на актуальном SHA, а продакшен — по стенду. [Владельцы сведений](../concepts/sources.md).

## Проверка checkpoint

Полный исходный SHA хранится в `openwiki/.last-update.json` как `gitHead` со статусом `complete`. Перед использованием wiki получите актуальный SHA `docs/main` и выполните в клоне `bun run wiki:check --against <SHA>`. [README](https://github.com/Cringe-Driven-Development-Team/docs/blob/d8efbac41672d36ddd2db295f057f84c87eabfe3/README.md#L44); [код проверки](https://github.com/Cringe-Driven-Development-Team/docs/blob/d8efbac41672d36ddd2db295f057f84c87eabfe3/scripts/openwiki-check.ts#L8).

Проверка требует настоящий commit для обоих SHA и чтобы источник wiki был предком целевого коммита. Затем сравнивает пути между ними, исключая `openwiki/`; если другие пути изменились, wiki объявляется устаревшей. Время `updatedAt` выводится как наблюдение, не как критерий свежести. [Алгоритм](https://github.com/Cringe-Driven-Development-Team/docs/blob/d8efbac41672d36ddd2db295f057f84c87eabfe3/scripts/openwiki-check.ts#L37).

Устаревшую wiki используйте только для поиска пути. Каждое важное утверждение сверяйте с каноническим документом на актуальном SHA, а факты о реализации — с кодом соответствующего компонента. Если страница wiki недоступна или путь исчез, ищите напрямую в `docs`. [Правило разрешения расхождений](https://github.com/Cringe-Driven-Development-Team/docs/blob/d8efbac41672d36ddd2db295f057f84c87eabfe3/site/project-context.md#L28).

## Обновление и контроль

Текущий процесс описывает явную локальную команду владельца `bun run wiki:update-local`. Она получает `origin/main`, проверяет wiki во временном worktree, пропускает генерацию при свежем checkpoint, а после генерации проверяет `openwiki/**` и полный checkpoint. [Описание процесса](https://github.com/Cringe-Driven-Development-Team/docs/blob/d8efbac41672d36ddd2db295f057f84c87eabfe3/README.md#L23); [реализация локальной команды](https://github.com/Cringe-Driven-Development-Team/docs/blob/d8efbac41672d36ddd2db295f057f84c87eabfe3/scripts/openwiki-update-local.ts#L28). Для PR с `openwiki/**` отдельный [freshness workflow](https://github.com/Cringe-Driven-Development-Team/docs/blob/d8efbac41672d36ddd2db295f057f84c87eabfe3/.github/workflows/openwiki-freshness.yml#L1) сравнивает checkpoint с SHA базы PR.

См. [карту вопросов](../quickstart.md) и [сборку сайта](site-and-modules.md).
