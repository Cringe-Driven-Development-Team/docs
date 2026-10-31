---
title: Контекст проекта
---

# Контекст проекта

Это указатель для работы в репозиториях команды. Он помогает найти владельца сведений и не заменяет документацию компонентов или исходники.

## Как пользоваться этой страницей

Начни с `AGENTS.md` своего репозитория и его README. Перед решением, затрагивающим другие компоненты, открой нужный раздел здесь. Состояние кода сверяй с исходниками на актуальном SHA. Работающее поведение подтверждай отдельно: SHA выкаченного релиза, дата и результат сценария на проде; код и CI сами по себе этого не доказывают.

## Где искать сведения

| Что нужно узнать | Где смотреть |
| --- | --- |
| Быстро найти общепроектные сведения по теме | <a href="./openwiki/" target="_self">OpenWiki — производный тематический указатель</a> |
| Как устроен работающий продукт и где проходят границы компонентов | [Архитектура](/architecture/) и другие текущие разделы этого сайта |
| Что команда планирует сделать | [Модули](/modules/) и утверждённые проектные документы; это план, а не описание работающего продукта |
| Где хранить SDD-спеку и план реализации конкретной задачи | В репозитории, где выполняется работа, обычно в `docs/superpowers/specs/` и `docs/superpowers/plans/`; общие для нескольких компонентов решения отражай здесь |
| Что реализовано в компоненте | Его исходники, конфигурация и проверки на актуальном SHA; работу на проде подтверждают отдельно |
| Как устроен HTTP API | Контракт в Apidog; путь от контракта к коду показан в [схеме контракта](/architecture/#contract) |
| Как вести задачи и PR | [Правила команды](https://github.com/Cringe-Driven-Development-Team/.github/blob/main/CONTRIBUTING.md) |
| Как работать в конкретном репозитории | Корневой `AGENTS.md`, README и локальные инструкции этого репозитория |

Основные репозитории: [frontend](https://github.com/Cringe-Driven-Development-Team/frontend), [backend](https://github.com/Cringe-Driven-Development-Team/backend), [infra](https://github.com/Cringe-Driven-Development-Team/infra), [docs](https://github.com/Cringe-Driven-Development-Team/docs) и [общие процессы](https://github.com/Cringe-Driven-Development-Team/.github). Остальные библиотеки и вспомогательные репозитории перечислены в [организации](https://github.com/Cringe-Driven-Development-Team).

Wiki — производное представление документации. Канонический текст остаётся в `docs`: исправления начинают с исходного документа. Перед использованием wiki проверь свежесть клона и checkpoint командой `bun run wiki:check --against <SHA>` в `docs`, передав актуальный SHA. Если wiki устарела, используй её как указатель путей, а каждое нужное утверждение сверь с исходником на этом SHA. Если wiki недоступна, ищи напрямую в `docs`. Факты о реализации сверяй с кодом компонента на актуальном SHA. Обновление wiki запускает владелец явной локальной командой.

## Владельцы командных пакетов

Владелец библиотек — [frontend-packages](https://github.com/Cringe-Driven-Development-Team/frontend-packages). По состоянию исходников на 31.10.2026 клиент frontend использует пять пакетов из [apps/client/package.json](https://github.com/Cringe-Driven-Development-Team/frontend/blob/dd3d11fbeebe5bf1e2b51fdd663a36d1829a4e64/apps/client/package.json#L13-L23), а корневой тулинг — [oxlint-плагин](https://github.com/Cringe-Driven-Development-Team/frontend/blob/dd3d11fbeebe5bf1e2b51fdd663a36d1829a4e64/package.json#L30-L37).

| Пакет | Где править у владельца |
| --- | --- |
| `@cdd-team/react` | [packages/react](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/fa65157b5f6957fbf30fa2ebd4b3b75af19cc955/packages/react/package.json#L1) |
| `@cdd-team/vite-plugin-bff-html` | [packages/vite-plugin-bff-html](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/fa65157b5f6957fbf30fa2ebd4b3b75af19cc955/packages/vite-plugin-bff-html/package.json#L1) |
| `@cdd-team/router` | [packages/router](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/fa65157b5f6957fbf30fa2ebd4b3b75af19cc955/packages/router/package.json#L1) |
| `@cdd-team/zustand` | [packages/zustand](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/fa65157b5f6957fbf30fa2ebd4b3b75af19cc955/packages/zustand/package.json#L1) |
| `@cdd-team/clsx` | [packages/clsx](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/fa65157b5f6957fbf30fa2ebd4b3b75af19cc955/packages/clsx/package.json#L1) |
| `@cdd-team/oxlint-plugin-jsdoc` | [packages/oxlint-plugin-jsdoc](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/fa65157b5f6957fbf30fa2ebd4b3b75af19cc955/packages/oxlint-plugin-jsdoc/package.json#L1) |

Процесс выпуска принадлежит тому же репозиторию: [инструкция владельца](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/fa65157b5f6957fbf30fa2ebd4b3b75af19cc955/README.md#L72-L79) и [release workflow](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/fa65157b5f6957fbf30fa2ebd4b3b75af19cc955/.github/workflows/release.yml#L15-L82). Release-please готовит release PR; после его слияния workflow проверяет и публикует выпущенные пакеты. GitHub Release сам по себе не подтверждает успешную публикацию в npm. Версии, API и подробности разработки проверяй у владельца; эта карта подтверждает место правки по зависимостям и CI, а не состояние прода.

## Текущее и планируемое

Разделы сайта вне модулей отделяют проверенный прод от исторических описаний: учитывай статус и свидетельство на самой странице. [Архитектура](/architecture/) указывает, какие схемы подтверждены, а какие ещё требуют проверки. [Страницы модулей](/modules/) сохраняют планы, даже если часть уже реализована. Замороженные варианты архитектуры не становятся текущими из-за того, что схема осталась в репозитории.

Планы развития проекта в этом разделе не означают, что все рабочие спеки и планы реализации нужно переносить в `docs`. Например, спека и план изменения логирования backend принадлежат репозиторию `backend`; общепроектный документ обновляют, только если меняется решение, важное для других компонентов.

## Если источники расходятся

Проверь, что локальный клон не отстаёт от командного `main`, и сверь сравниваемые версии по SHA. Для факта о реализации смотри исходники; для состояния продакшена проверь стенд. Не принимай план модуля за уже реализованное поведение. Сообщи о расхождении и обнови документ, которому принадлежит этот вид сведений, вместе с изменением.
