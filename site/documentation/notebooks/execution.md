# Окружение и исполнение {#окружение-и-исполнение}

Сначала запустите окружение Python, затем выполните ячейку. Go сохраняет принятую команду, агент передаёт её kernel, а браузер получает состояния через BFF. [HTTP-команды](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/bff/src/router/runtime.ts#L15-L65), [приём и доставка](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtimesession/usecase/worker.go#L356-L420). [Ревизии и статус проверки](./#существенные-разрывы).

## Запуск и пользовательский слот {#запуск-и-пользовательскии-слот}

1. Кнопка запуска окружения вызывает `POST /api/runtime/start` с ID блокнота и `requestId`. BFF передаёт Go язык `python`.
2. Go сохраняет сессию до подготовки VPS. Повтор того же ID с теми же параметрами возвращает прежнюю сессию. Для нового запуска нужен новый ID.
3. У пользователя один активный слот. Если окружение занято другим блокнотом, клиент показывает его и предлагает завершить. Запуск ячеек становится доступен после `READY`.

[Запуск BFF](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/bff/src/router/runtime.ts#L15-L27), [начало сессии](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtimesession/usecase/session.go#L33-L41), [резервирование слота](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtimesession/adapters/postgres/store.go#L108-L159), [клиентский слот](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/runtime.ts#L498-L540), [остановка другой сессии](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/runtime.ts#L712-L742).

## Жизненный цикл сессии {#session}

| Состояние | Действие |
| --- | --- |
| `PROVISIONING`, `STARTING` | Выделение VPS, настройка агента и проверка готовности |
| `READY` | Приём новых команд исполнения |
| `RECONNECTING` | Восстановление связи Go с агентом |
| `STOPPING` | Остановка окружения и дочитывание журнала |
| `STOPPED`, `FAILED` | Терминальное состояние сессии. Признак завершения облачной очистки проверяется отдельно |

`state` описывает этап сессии, `stage` уточняет выполняемую операцию, `reason` передаёт причину. [Модель](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtimesession/domain/models.go#L14-L80), [подготовка и восстановление](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtimesession/usecase/worker.go#L116-L204), [потеря связи](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtimesession/usecase/worker.go#L255-L276).

### Очистка окружения {#cleanup}

Go может сообщить `STOPPED` или `FAILED` и освободить пользовательский слот до удаления VPS. При незавершённой очистке HTTP-снимок передаёт `cleanup_error: cleanup_pending`. Клиент продолжает опрос, пока признак присутствует. [Checkpoint и удаление](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtimesession/usecase/worker.go#L499-L521), [поля HTTP](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtimesession/delivery/http/runtime.go#L50-L74), [завершение polling](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/runtime.ts#L337-L353).

## Подготовка запуска {#подготовка-запуска}

1. Для одной ячейки клиент запоминает её исходник. Для запуска всех фиксирует упорядоченный список code-ячеек и их текст.
2. Клиент ждёт сохранения исходников и структурных операций, затем сверяет выбранные ячейки. При конфликте или изменении выбранного исходника требуется новое нажатие.
3. В запрос уходит SHA-256 подтверждённого UTF-8 source. Go проверяет хеш и захватывает код вместе с `source_version`.

[Подготовка и сверка](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/runtime.ts#L542-L628), [отправка](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/runtime.ts#L630-L682), [приём batch](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtimesession/adapters/postgres/batch.go#L24).

## Приём и доставка команды {#command}

Go принимает новое исполнение в `READY`, сверяет исходник и сохраняет команду. Batch принимает упорядоченный набор code-ячеек одной транзакцией. Дальнейшая правка ячейки уже принятую команду не меняет. Повтор того же `request_id` с теми же параметрами возвращает прежнюю попытку. [Одиночный приём](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtimesession/adapters/postgres/executions.go#L20), [пакетный приём](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtimesession/adapters/postgres/batch.go#L24), [доставка](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtimesession/usecase/worker.go#L356-L420).

### Команды и ответы {#команды-и-ответы}

| HTTP POST BFF | Go относительно `/runtime-sessions/{id}` | Действие |
| --- | --- | --- |
| `/api/runtime/execute` | `POST /executions` | Поставить одну команду |
| `/api/runtime/execute-all` | `POST /executions/batch` | Поставить список команд |
| `/api/runtime/interrupt` | `POST /kernel/interrupt` | Прервать текущее выполнение и продолжить очередь |
| `/api/runtime/stop-executions` | `POST /executions/stop` | Прервать текущее выполнение и отменить оставшуюся очередь, сохранив окружение |
| `/api/runtime/stop` | `POST /stop` | Завершить окружение |
| `/api/runtime/activity` | `POST /activity` | Отметить активность |

[Маршруты BFF](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/bff/src/router/runtime.ts#L15-L79), [адаптер Go](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/bff/src/go/api.ts#L360-L478). Ответ о приёме содержит идентификатор сессии или исполнения. Состояния выполнения приходят с обновлениями. [Отправка и обработка ответа](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/runtime.ts#L630-L683).

## Очередь и результат Python {#очередь-и-результат-python}

Go выдаёт ожидающие команды в порядке приёма. При заполнении очереди агента backend может оставить команду для повторной доставки. Публичная очередь описывает выполняемые и ожидающие команды, исход завершённых команд доступен в снимках. [Доставка](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtimesession/usecase/worker.go#L356-L420), [снимки очереди](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtimesession/adapters/postgres/executions.go#L90).

| Состояние | Значение |
| --- | --- |
| `QUEUED`, `RUNNING` | Принято или выполняется |
| `SUCCEEDED`, `FAILED` | Подтверждённый успех или ошибка исполнения |
| `INTERRUPTED`, `TIMED_OUT` | Подтверждённое прерывание или таймаут |
| `CANCELLED`, `REJECTED` | Отмена или отказ агента |
| `UNKNOWN` | Достоверного исхода нет |

[Состояния Go](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtimesession/domain/models.go#L15-L110). Состояние Python и [сохранение вывода](./results#projection) проверяются отдельно.

## Получение обновлений {#updates}

1. Браузер передаёт `sessionId`, курсор `after` и до 100 отслеживаемых ID в `POST /api/runtime/updates`.
2. BFF параллельно читает сессию, очередь и одну страницу событий. Затем читает снимки исполнений по объединению указанных ID и ID из событий. Сбой любого чтения отклоняет ответ целиком.
3. Клиент применяет ответ и передвигает курсор. Следующий шаг через 2 секунды, при `has_more` или следующей порции ID сразу. При сбое показывает потерю связи и повторяет с прежним курсором и порцией.

[Агрегация](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/bff/src/router/runtime.ts#L80-L117), [лимит ID](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/packages/schemas/src/validate.ts#L466-L476), [цикл опроса](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/runtime.ts#L290-L353).

При перезагрузке запрос начинается с начального курсора, а `active_session.public_seq` задаёт границу для исторических событий. Код выбирает последнее исполнение ячейки по порядку первого знакомства с ID. Поэтому впервые полученный старый снимок, который проходит фильтр свежести, способен заменить уже замеченную новую команду в другой вкладке. [Инициализация](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/runtime.ts#L188-L204), [выбор ID](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/runtime.ts#L225-L235), [порядок применения](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/runtime.ts#L356-L376).

## Остановка, idle и интерфейс {#остановка-idle-и-интерфеис}

| Действие | Что происходит |
| --- | --- |
| Прервать ячейку | Клиент ждёт исхода текущего исполнения из событий. Очередь продолжается. |
| Остановить всё | Снимаются ожидающие исполнения и прерывается выполняемое. Сессия остаётся. |
| Завершить окружение | Go останавливает сессию, дочитывает журнал и запрашивает удаление облачных ресурсов. При недоступном журнале может остаться `journal_incomplete`. |
| Уйти со страницы | Опрос прекращается. Сессия завершается отдельно по команде или по idle. |

[Клиентские действия](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/runtime.ts#L686-L804), [остановка команд](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtimesession/usecase/stop_executions.go#L15), [остановка сессии](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtimesession/usecase/worker.go#L463-L521).

Редактирование своей активной сессии отправляет activity с интервалом от 30 секунд. Загрузка обновлений сама по себе activity не отправляет. Idle по умолчанию — 900 секунд, с учётом работы kernel и очереди. [Клиентские интервалы](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/runtime.ts#L40-L45), [activity](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/runtime.ts#L793-L804), [настройки агента](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/runtime-agent/src/runtime_agent/config.py#L20-L28), [проверка idle](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/runtime-agent/src/runtime_agent/runtime.py#L253-L266).
