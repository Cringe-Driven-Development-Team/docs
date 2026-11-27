# Результаты исполнения {#результаты-исполнения}

Снимок исполнения хранит исход команды и накопленный вывод. `projection: applied` подтверждает запись этого вывода в ячейку. Успешный Python может остаться без проекции, а вывод ошибки Python может сохраниться. [Запись истории и проекция](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtimesession/adapters/postgres/events.go#L16-L99), [применение](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtimesession/adapters/postgres/events.go#L136-L226). [Ревизии и статус проверки](./#существенные-разрывы).

## От события к сохранённому выводу {#от-события-к-сохраненному-выводу}

1. Агент выдаёт журнал со своей последовательностью событий. Go читает его и фиксирует события, снимки исполнений и курсор агента одной транзакцией.
2. Reducer накапливает stream, результаты, display и ошибки, обрабатывает clear/update display и счётчик выполнения. Публичная последовательность событий отделена от курсора агента.
3. При обновлении вывода Go ставит проекцию накопленного снимка в ячейку. Клиент получает снимки через [опрос](/documentation/notebooks/execution#updates).

[Журнал backend и постановка проекции](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtimesession/adapters/postgres/events.go#L16-L99), [reducer](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtimesession/domain/output.go#L7-L99), [модель исполнения](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtimesession/domain/models.go#L80-L144).

## Применение к ячейке {#projection}

Go сверяет ID code-ячейки, `source_version` и наличие более новой принятой попытки. Перемещение ячейки или правка соседней сохраняют версию её исходника. Правка и возврат прежнего текста создают новую версию, поэтому старый результат не восстанавливается. [Защита от новой попытки](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtimesession/adapters/postgres/events.go#L204), [проверка версии](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/notebook/adapters/postgres/results.go#L65-L81), [обновление source](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/notebook/adapters/postgres/editing.go#L107-L151).

| Projection | Что означает |
| --- | --- |
| `pending` | Снимок ожидает применения. Временный сбой оставляет задачу для повторной попытки. |
| `applied` | Вывод, счётчик и признак сокращения записаны в ячейку. Следующее событие может снова перевести исполнение в `pending`. |
| `conflict` | Снимок остался в истории, применению помешали версия, более новая попытка, размер или недопустимые данные. |

История хранится независимо от применения к документу. Проекция возможна и для промежуточного вывода `RUNNING`. Запись вывода сохраняет редакцию исходников. [Обработка задач](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtimesession/adapters/postgres/events.go#L136-L226), [запись результата](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/notebook/adapters/postgres/results.go#L88-L109), [редакция блокнота](./editing#revision).

## Применение в браузере {#применение-в-браузере}

Клиент отображает снимок выбранного исполнения, если SHA-256 соответствует подтверждённому исходнику ячейки и проекция без `conflict`. После вычисления хеша клиент снова проверяет поколение страницы и ID исполнения. Снимок с `pending` уже может рисоваться, поэтому сам видимый вывод не подтверждает запись в PostgreSQL. [Применение снимка](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/runtime.ts#L356-L415), [локальное обновление](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/notebook/index.ts#L748-L775).

## Представления вывода {#представления-вывода}

| Данные | Отображение |
| --- | --- |
| `stream` | Текст stdout или stderr, соседние части одного потока объединяются |
| `error` | Текст traceback с поддержкой ANSI-оформления |
| `image/png`, `image/svg+xml` | Изображение через `img` |
| `text/html` | Изолированный iframe с `sandbox=""` |
| `text/plain` | Текст |
| Остальные MIME | Список неподдерживаемых типов |
| `output_truncated` | Сообщение «Вывод сокращён» |

Для MIME bundle приоритет — PNG → SVG → HTML → plain. Строковые части соединяются без дополнительных переводов строк. Для HTML применяются ограничения iframe и CSP страницы. [Выбор представления](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/pages/NotebookPage/Output.tsx#L90-L149), [рендеринг](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/pages/NotebookPage/Output.tsx#L159-L206), [iframe](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/pages/NotebookPage/Output.tsx#L254-L271), [границы XSS](/documentation/security/xss).

## Лимиты и группировка {#лимиты-и-группировка}

Агент по умолчанию ограничивает сериализованный вывод 10 MiB на исполнение. Go при записи проверяет итоговый размер документа в 128 MiB и допустимость JSON для хранения. Группировка соседних фрагментов одного потока относится к представлению вывода. [Настройки агента](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/runtime-agent/src/runtime_agent/config.py#L20-L28), [проверки записи](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/notebook/adapters/postgres/results.go#L48-L63), [размер документа](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/notebook/usecase/contract.go#L14-L18), [группировка](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/pages/NotebookPage/Output.tsx#L127-L149), [другие лимиты](./storage-and-infrastructure#limits).
