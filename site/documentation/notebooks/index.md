# Блокноты: реализация

Блокнот объединяет редактируемые ячейки и сохранённые результаты Python. Браузер хранит локальные черновики, BFF переводит запросы в Go API, PostgreSQL хранит содержимое, а отдельное окружение исполняет код.

::: info Статус проверки
Проверены исходники 08.11.2026 (МСК). Сквозной сценарий на проде и фактическая миграция данных не проверялись. Схемы этого раздела показывают код указанных версий; наличие реализации не подтверждает её выкладку.
:::

| Компонент | Проверенная версия |
| --- | --- |
| Frontend и BFF | [0606aa6](https://github.com/Cringe-Driven-Development-Team/frontend/tree/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee) |
| Backend и runtime-agent | [a46aa8e](https://github.com/Cringe-Driven-Development-Team/backend/tree/a46aa8e1ec4e169af194be6c6eb05f92af85656a) |
| Инфраструктура | [7242521](https://github.com/Cringe-Driven-Development-Team/infra/tree/724252190e6758636626c70216391266f6ec5f31) |

## От открытия до результата

1. BFF собирает содержимое, метаданные и сведения об активной сессии. Браузер получает их через HTML bootstrap или запрос при SPA-переходе.
2. Ввод меняет локальный черновик. Последовательная очередь записывает его с проверкой редакции блокнота.
3. Пользователь отдельно запускает окружение. Перед исполнением приложение ждёт сохранения нужного source.
4. Go принимает команду, agent передаёт её kernel. События обновляют архив исполнения и проекцию результата в ячейку.
5. Браузер получает снимки через polling; сохранённые outputs доступны и после остановки окружения.

Основание: [загрузка](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/bff/src/notebook.ts#L9), [подготовка запуска](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/stores/runtime.ts#L476), [проекция](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/internal/runtimesession/adapters/postgres/events.go#L134).

<DiagramSection>

## Компоненты и ответственность

Браузер владеет черновиками и отображением; BFF агрегирует данные и преобразует tRPC в Go API. Go сохраняет документ, принимает команды и управляет окружениями. Agent взаимодействует с kernel и отдаёт события; постоянные результаты пишет backend. [BFF runtime](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/bff/src/router/runtime.ts#L21), [worker](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/internal/runtimesession/usecase/worker.go#L112).

<template #diagram>

<Diagram name="notebooks-components" />

</template>

Схема показывает код указанных версий. Подробности размещения и защиты находятся в [инфраструктуре](./storage-and-infrastructure).

</DiagramSection>

## Разделы

| Страница | На какой вопрос отвечает |
| --- | --- |
| [Редактирование](./editing) | Как ввод становится подтверждённым source и что происходит при конфликте |
| [Исполнение](./execution) | Как запускаются окружение и команды, откуда приходят состояния |
| [Результаты](./results) | Когда output попадает в ячейку и как безопасно отображается |
| [Хранение и инфраструктура](./storage-and-infrastructure) | Кто хранит данные и создаёт изолированное окружение |


[Открытие, ячейки и сохранение](./editing) описывает desktop/touch, Python и Markdown, ограничения source, конфликты и восстановление после ошибки записи.

## Существенные разрывы

| Область | Факт и последствие |
| --- | --- |
| Редакция блокнота | Backend меняет hash при сохранении нового результата, хотя Apidog исключает outputs из hash. Следующая запись source может получить конфликт; [разбор](./editing#revision) |
| Очистка окружения | STOPPED/FAILED освобождают слот до удаления VPS, вопреки целевому cleanup; [разбор](./execution#cleanup) |
| Несколько вкладок | Первое обнаружение старого execution может заменить выбранный новый latest; [сценарий](./execution#updates) |
| Удалённая ячейка | Локальный текст остаётся доступным для копирования, но не учитывается общим статусом сохранения; [#165 и последствия](./editing#orphans) |

[Обзор продукта](/documentation/) содержит замысел и макеты. [Контракт модуля](/modules/2/tracks/file-exec/contract) сохраняет целевую модель; её требования нельзя считать описанием всей текущей реализации.

## Открытые задачи и макеты

Статусы сверены 08.11.2026. [#172](https://github.com/Cringe-Driven-Development-Team/frontend/issues/172) меняет статусы автосохранения; [#173](https://github.com/Cringe-Driven-Development-Team/frontend/issues/173) — группировку вывода. [#35](https://github.com/Cringe-Driven-Development-Team/frontend/issues/35) — XSS-регресс, [#120](https://github.com/Cringe-Driven-Development-Team/frontend/issues/120) — реальные preview и badge сессии на карточке. Эти требования не объявлены выполненными.

Поиск имеет подробное [ТЗ #42](https://github.com/Cringe-Driven-Development-Team/frontend/issues/42), но UI поиска по блокноту отсутствует. Импорт `.ipynb` остаётся открытой [задачей #96](https://github.com/Cringe-Driven-Development-Team/frontend/issues/96); административная миграция backend не является пользовательским импортом. [Текущий NotebookPage](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/pages/NotebookPage/NotebookPage.tsx#L346).

[Редактор в Figma](https://www.figma.com/design/7iaVDGiwzQk2vZIB5ogVlq/?node-id=496-14407), [Markdown](https://www.figma.com/design/7iaVDGiwzQk2vZIB5ogVlq/?node-id=496-14596) и [исполнение](https://www.figma.com/design/7iaVDGiwzQk2vZIB5ogVlq/?node-id=581-16814) прочитаны на версии `2419168535074483350`. Макеты содержат старые надписи и состояния; актуальное поведение описано по коду, разрывы и открытые требования отмечены рядом с соответствующим сценарием.
