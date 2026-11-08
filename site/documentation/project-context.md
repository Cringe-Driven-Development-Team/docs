---
title: Контекст проекта
---

# Контекст проекта

Это указатель для работы в репозиториях команды. Он помогает найти владельца сведений и не заменяет документацию компонентов или исходники.

## Как пользоваться этой страницей

1. Начни с `AGENTS.md` своего репозитория и его README.
2. Для поиска контекста начни с `openwiki_search`, затем прочитай нужный раздел через `openwiki_read` с ID wiki из результата. Если ответа достаточно и нет противоречий, остановись.
3. К конкретному исходнику переходи при пробеле, противоречии или для внесения изменений. Эта страница помогает найти владельца сведений.
4. Для утверждения о состоянии прода прямо сейчас нужны соответствующие свидетельства: SHA выкаченного релиза, дата и результат сценария; wiki, код и CI сами по себе этого не доказывают.

## Где искать сведения

| Что нужно узнать | Где смотреть |
| --- | --- |
| Что такое Cellestial и какие возможности обсуждать | [Обзор продукта](/documentation/): сценарии, макеты, решения и открытые вопросы |
| Быстро найти общепроектные сведения по теме | <a href="../openwiki/" target="_self">OpenWiki — производный тематический указатель</a> |
| Как устроен работающий продукт и где проходят границы компонентов | [Документация работающего продукта](/documentation/current-state): наблюдения, дата и границы проверки; [архитектура](/documentation/architecture/) отдельно помечает исторические схемы |
| Что команда планирует сделать | [Модули](/modules/) и утверждённые проектные документы; это план, а не описание работающего продукта |
| Где хранить SDD-спеку и план реализации конкретной задачи | В репозитории, где выполняется работа, обычно в `docs/superpowers/specs/` и `docs/superpowers/plans/`; общие для нескольких компонентов решения отражай здесь |
| Как устроены клиент, BFF и сохранение блокнота | [Frontend](/documentation/frontend/): учебный путь по исходникам выбранного SHA |
| Что реализовано в компоненте | Wiki компонента; при пробеле, противоречии или для правки — его исходники, конфигурация и проверки на актуальном SHA; работу на проде подтверждают отдельно |
| Как устроен HTTP API | Контракт в Apidog; путь от контракта к коду показан в [схеме контракта](/documentation/architecture/#contract) |
| Как вести задачи и PR | [Правила команды](https://github.com/Cringe-Driven-Development-Team/.github/blob/main/CONTRIBUTING.md) |
| Как работать в конкретном репозитории | Корневой `AGENTS.md`, README и локальные инструкции этого репозитория |

Основные репозитории: [frontend](https://github.com/Cringe-Driven-Development-Team/frontend), [backend](https://github.com/Cringe-Driven-Development-Team/backend), [infra](https://github.com/Cringe-Driven-Development-Team/infra), [docs](https://github.com/Cringe-Driven-Development-Team/docs) и [общие процессы](https://github.com/Cringe-Driven-Development-Team/.github). Остальные библиотеки и вспомогательные репозитории перечислены в [организации](https://github.com/Cringe-Driven-Development-Team).

При обычном чтении опубликованная wiki считается актуальной: за её актуальность отвечает процесс обновления и публикации. Достаточный ответ завершает поиск; агент не запускает проверку свежести, не сравнивает SHA и не ищет те же сведения в исходниках. Явные ошибки инструментов и противоречия требуют разбирательства.

Без MCP читай `openwiki/quickstart.md` и нужную Markdown-страницу с тем же правилом остановки. Если wiki отсутствует или не даёт нужных сведений, ищи в канонических документах и коде владельца. Для простой правки известного файла предварительный поиск по wiki не обязателен.

Wiki — производное представление документации. Канонический текст остаётся в `docs`: исправления начинают с исходного документа и проверяют по соответствующим источникам. Проверки свежести относятся к обслуживанию и генерации wiki, CI или явной диагностике по запросу пользователя. Сейчас обновление wiki запускает владелец явной локальной командой.

## Владельцы командных пакетов

Версии библиотек выбранного среза frontend, точки импорта и выпуск описаны в
[командных пакетах Frontend](/documentation/frontend/packages). Карта ниже сохраняет
исторический срез 31.10.2026; её ссылки указывают владельца, а не текущие версии приложения.

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

Обзор продукта объединяет замысел и сведения о готовности с явными пометками.
Остальные разделы сайта вне модулей отделяют проверенный прод от исторических описаний: учитывай статус и свидетельство на самой странице. [Архитектура](/documentation/architecture/) указывает, какие схемы подтверждены, а какие ещё требуют проверки. [Страницы модулей](/modules/) сохраняют планы, даже если часть уже реализована. Замороженные варианты архитектуры не становятся текущими из-за того, что схема осталась в репозитории.

Планы развития проекта в этом разделе не означают, что все рабочие спеки и планы реализации нужно переносить в `docs`. Например, спека и план изменения логирования backend принадлежат репозиторию `backend`; общепроектный документ обновляют, только если меняется решение, важное для других компонентов.

## Если источники расходятся

Проверь, что локальный клон не отстаёт от командного `main`, и сверь сравниваемые версии по SHA. Для факта о реализации смотри исходники; для состояния продакшена проверь стенд. Не принимай план модуля за уже реализованное поведение. Сообщи о расхождении и обнови документ, которому принадлежит этот вид сведений, вместе с изменением.
