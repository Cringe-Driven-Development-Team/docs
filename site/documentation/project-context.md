---
title: Контекст проекта
---

# Контекст проекта

Выберите владельца изменения по таблице. Рабочие команды и правила берите из `AGENTS.md` и README его репозитория. Сведения о версиях и наблюдениях на проде приведены в [текущем состоянии](/documentation/current-state).

## Исходники и проверки {#где-искать-сведения}

| Что изменить | Где исходник | Кто проверяет и чем |
| --- | --- | --- |
| Сценарий или экран | [Обзор и макеты](/documentation/#основные-сценарии-и-макеты), [задачи и требования модулей](/modules/) | Владелец сценария сверяет эффект с согласованным поведением и макетом |
| Клиент, BFF или сохранение блокнота | [frontend](https://github.com/Cringe-Driven-Development-Team/frontend), [устройство Frontend](/documentation/frontend/) | Команда frontend запускает Check и проверяет изменённый сценарий [с реальным Go](/documentation/frontend/checks#mock-boundary) |
| HTTP-контракт Go | [backend](https://github.com/Cringe-Driven-Development-Team/backend), [OpenAPI и схема контракта](/documentation/architecture/#contract) | Команда backend проверяет OpenAPI в CI. После принятия спеки frontend обновляет копию, типы и проверки. [Порядок](/documentation/frontend/bff#apidog-orval-и-схемы) |
| Исполнение блокнотов и хранилище | [backend](https://github.com/Cringe-Driven-Development-Team/backend), [реализация блокнотов](/documentation/notebooks/) | Команда backend проверяет Go и агент. Для сквозного результата frontend и backend проверяют [запуск и выдачу результата](/documentation/notebooks/execution) |
| Сеть, облачные ресурсы, прокси или поставку конфигурации | [infra](https://github.com/Cringe-Driven-Development-Team/infra), [размещение](/documentation/architecture/#deployment) | Команда infra проверяет изменения в preview и смотрит журнал apply после выкладки. [CI](/documentation/architecture/#ci) |
| Общие изображения или шрифты | [static](https://github.com/Cringe-Driven-Development-Team/static), [путь через CDN](/documentation/architecture/#deployment) | Команда static проверяет загрузку и HTTP-ответ файла. Команда frontend проверяет отображение в приложении |
| Статью или схему | [docs](https://github.com/Cringe-Driven-Development-Team/docs) | Команда docs проверяет сборку, ссылки, схему и свидетельства из репозитория владельца |
| Общий процесс задач и PR | [CONTRIBUTING организации](https://github.com/Cringe-Driven-Development-Team/.github/blob/09657094754f948d64dbb20a53d21c1aae4f3250/CONTRIBUTING.md#L94-L139) | Участники и ментор следуют правилам команды |

## Владельцы командных пакетов

Исходники `@cdd-team/*` и workflow npm-публикации принадлежат репозиторию [frontend-packages](https://github.com/Cringe-Driven-Development-Team/frontend-packages). Команда пакетов проверяет изменение и публикацию конкретной версии. Команда frontend обновляет зависимость и lockfile приложения, затем проверяет сценарий потребителя. [Точки входа, версии и порядок выпуска](/documentation/frontend/packages).

## Где вести спецификацию {#как-пользоваться-этои-страницеи}

Спецификация и план отдельной задачи хранятся в репозитории её реализации в `docs/superpowers/`. Решение, которое затрагивает несколько компонентов, отражайте в соответствующем разделе документации проекта.

## Текущее и планируемое

Для требований используйте макет и проектный документ. Для реализации сверяйте файл на нужном SHA. Для работающего поведения используйте результат проверки с датой, временем и версией выпуска. [Версии и свидетельства](/documentation/architecture/), [наблюдения](/documentation/current-state), [планы модулей](/modules/).

## Если источники расходятся

1. Сверьте SHA в ссылке с кодом нужного выпуска или с `main` владельца для локальной разработки.
2. Повторите сценарий, если расхождение касается работающего сервиса.
3. Исправьте документ у владельца и обновите ссылки на него.
