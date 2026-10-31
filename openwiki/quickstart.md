---
type: guide
title: Карта проверенной документации CDD
description: Куда перейти за гостевым маршрутом BFF, границами проверки безопасности и владельцами репозиториев и пакетов.
tags: [quickstart, navigation, ownership, evidence]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-31T13:49:52.870Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-4f5bdd77990b98e5f7081f26
    resource: repo://site/documentation/bff.md
  - id: openwiki-source-544ecea885fca4da03008227
    resource: repo://site/project-context.md
generated: { by: "codex", at: "2026-10-31T13:49:52.870Z" }
---

# С чего начать

OpenWiki — производный тематический указатель. Канонический текст остаётся в docs; исправления начинают с исходного документа. Перед работой прочитай `AGENTS.md` и README своего репозитория. Реализацию проверяй по актуальному коду владельца, а продовое поведение — по SHA выкаченного релиза, дате и результату сценария. [Правила: site/project-context.md, строки 9–24](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/project-context.md#L9-L24), [статус wiki, строка 28](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/project-context.md#L28).

| Практический вопрос | Куда перейти |
| --- | --- |
| Что наблюдали на проде, как гость получает форму и где заканчивается проверка? | [Проверенный маршрут BFF](architecture/mvp.md) — сценарии, SHA выкладок и границы архитектуры |
| Почему tRPC возвращает `403` без заголовка и `401` с ним? Что известно о POST-защите? | [CSRF и сессия в гостевом BFF](architecture/security-bff.md) |
| Где менять BFF, Go API или инфраструктуру? | [Владельцы репозиториев](concepts/sources.md#репозитории-и-границы-компонентов) |
| Кому принадлежат `@cdd-team/*`, где править пакет и искать выпуск? | [Карта командных пакетов](concepts/sources.md#командные-пакеты) |
| Как разрешить расхождение документов и кода? | [Правила проверки источников](concepts/sources.md#как-разрешать-расхождения) |

## Что означает «проверено»

Текущее продовое свидетельство в корпусе — **31.10.2026, 13:11 UTC**, чистый Chrome на [cellestial.ru](https://cellestial.ru): форма входа, гостевой bootstrap, два отказа GET `/api/trpc/users.me` и `404` прежнего маршрута. Оно связано с SHA выкладок frontend `dd3d11fbeebe5bf1e2b51fdd663a36d1829a4e64`, backend `23d3dd9e955424a7634fb0dc49a38af6eb08792c` и infra `14653763279dab055e3cea47a84a0c531bccf03f`. Это SHA из GitHub Deployments, а не измерение версии процесса. Авторизованный участок BFF → Go и остальные пользовательские сценарии этим свидетельством не подтверждены. [Результаты](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/documentation/bff.md#L3-L19), [выкладки](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/documentation/bff.md#L25-L36), [границы](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/documentation/bff.md#L46-L57).

Карта владельцев — другой вид факта: она указывает репозиторий и место правки по зафиксированным зависимостям и CI. Её ссылки на соседний код сохраняют собственные SHA; это не проверка их нынешнего main и не доказательство состояния прода. [Карта: site/project-context.md, строки 30–43](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/project-context.md#L30-L43).

## Как пользоваться ссылками и свежестью

Ссылки на docs в этих страницах закреплены за исходным SHA `06110c81c5fa0972ad1171d2213dfc7866a5b020`. Ресурс `repo://путь#L…` в Claims означает путь внутри docs на `gitHead` из `openwiki/.last-update.json`; сам по себе он не доказывает утверждение — нужно прочитать указанный исходник. Этот SHA фиксирует версию описания и карты, а не свежесть соседнего кода или прода. [Правило интерпретации ссылок: openwiki/INSTRUCTIONS.md, строки 26–41](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/openwiki/INSTRUCTIONS.md#L26-L41).

Перед использованием проверь свежесть клона и выполни `bun run wiki:check --against <SHA>` с актуальным SHA docs. Устаревшая wiki служит указателем: сверь утверждение с текущим исходником владельца, а для продового утверждения — со свидетельством проверки. Если wiki недоступна или путь исчез, ищи напрямую в docs. [Источник: site/project-context.md, строка 28](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/project-context.md#L28), [проверка версий, строки 51–53](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/project-context.md#L51-L53).

Обновление запускает владелец локально после слияния исходников; CI только валидирует отдельный wiki PR. Инструкции обслуживания остаются в README. `openwiki/INSTRUCTIONS.md` меняют отдельно как исходник, а не при генерации. [Правило локального обновления: AGENTS.md, строки 112–115](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/AGENTS.md#L112-L115), [граница генерации: openwiki/INSTRUCTIONS.md, строки 56–64](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/openwiki/INSTRUCTIONS.md#L56-L64).

[Модули](https://docs.cellestial.ru/modules/) содержат планы. Для любой страницы вне модулей учитывай её статус и свидетельство; одно расположение документа не доказывает текущее поведение. Wiki не пересказывает планы и историю. [Статус документов: site/project-context.md, строки 45–47](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/project-context.md#L45-L47).
