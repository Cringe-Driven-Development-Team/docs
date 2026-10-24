---
type: workflow
title: Свежесть OpenWiki и обновление источника
description: Как сравнить checkpoint wiki с docs/main, читать устаревшие страницы и исправлять канонический документ.
tags: [openwiki, freshness, provenance]
sources:
  - id: openwiki-source-380a394a4ec8e02da4e26a7a
    resource: repo://.github/workflows/openwiki-freshness.yml
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
  - id: openwiki-source-373f8ca0184e88f8a0cc65af
    resource: repo://scripts/openwiki-check-pr.ts
  - id: openwiki-source-7d571db73f7bc6eb1ea8e5c6
    resource: repo://scripts/openwiki-check.ts
  - id: openwiki-source-0f2cc1cdbc03f7ab19013095
    resource: repo://scripts/openwiki-update-local.ts
  - id: openwiki-source-544ecea885fca4da03008227
    resource: repo://site/project-context.md
generated: { by: "codex", at: "2026-10-24T15:47:09.601Z" }
verified:
  - by: openwiki/0.7.2
    at: 2026-10-24T15:47:09.601Z
---

# Свежесть OpenWiki

OpenWiki — производный указатель. Канонический текст остаётся в `docs`; исправление факта начинается с документа-владельца. [Правило проекта](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/site/project-context.md#L28). Реализацию проверяют по коду компонента на актуальном SHA, продакшен — по стенду. [Владельцы сведений](../concepts/sources.md).

## Проверка checkpoint

Полный исходный SHA хранится в `openwiki/.last-update.json` как `gitHead` со статусом `complete`. Перед использованием wiki получите актуальный SHA `docs/main` и выполните в клоне `bun run wiki:check --against <SHA>`. [README](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/README.md#L55); [код проверки](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/scripts/openwiki-check.ts#L8).

Проверка требует настоящий commit для обоих SHA и чтобы источник wiki был предком целевого коммита. Затем сравнивает пути между ними, исключая `openwiki/`; если другие пути изменились, wiki объявляется устаревшей. Время `updatedAt` выводится как наблюдение, не как критерий свежести. [Алгоритм](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/scripts/openwiki-check.ts#L37).

Устаревшую wiki используйте только для поиска пути. Каждое важное утверждение сверяйте с каноническим документом на актуальном SHA, а факты о реализации — с кодом соответствующего компонента. Если страница wiki недоступна или путь исчез, ищите напрямую в `docs`. [Правило разрешения расхождений](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/site/project-context.md#L28).

## Локальное обновление

Владелец явно запускает `bun run wiki:update-local`. Команда получает `origin/main`, проверяет wiki во временном worktree и пропускает генерацию при свежем checkpoint. Перед запуском Codex она требует существующий `openwiki/quickstart.md` в целевом коммите. При несвежем checkpoint вызывает MCP lifecycle `update`, затем проверяет, что HEAD не изменён, изменились только `openwiki/**` и checkpoint полон и свеж. [Описание процесса](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/README.md#L23); [проверки и вызов](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/scripts/openwiki-update-local.ts#L28).

Если wiki ещё нет, локальная команда завершается до генерации и публикации. Для одноразовой инициализации [README](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/README.md#L45) предписывает отдельный bootstrap: исходные инструкции публикуют отдельно, `init` выполняют вручную в изолированном worktree, созданный OpenWiki workflow с расписанием удаляют, а wiki публикуют отдельным PR только с `openwiki/**`. Runner сам `init` не выполняет. [Проверка наличия wiki](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/scripts/openwiki-update-local.ts#L38).

## Проверка PR

Workflow `OpenWiki freshness` запускается для PR, затрагивающего `openwiki/**`. Сначала `openwiki-check-pr.ts` отвергает пути за пределами `openwiki/` в сравнении базы и head PR; затем `wiki:check` сравнивает checkpoint с SHA базы. Это две разные проверки: свежий checkpoint сам по себе не обнаруживает исходные правки внутри того же PR. [Workflow](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/.github/workflows/openwiki-freshness.yml#L3); [проверка путей](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/scripts/openwiki-check-pr.ts#L1). [Тесты](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/scripts/openwiki-freshness.test.ts#L60) покрывают смешанный PR и устаревший checkpoint.

Перед слиянием нужно снова сравнить checkpoint с текущим `docs/main`: если база продвинулась, прежний зелёный результат PR уже не достаточен. [README](https://github.com/Cringe-Driven-Development-Team/docs/blob/a889950c899592193a595747280a92171188a42f/README.md#L55). См. [карту вопросов](../quickstart.md) и [сборку сайта](site-and-modules.md).
