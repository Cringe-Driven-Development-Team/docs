# Открытие, редактирование и сохранение {#открытие-редактирование-и-сохранение}

Текст появляется в ячейке сразу. Запись считается подтверждённой, когда очередь получает или восстанавливает ожидаемый серверный снимок с актуальным `hash`. Источники и статус проверки приведены в [обзоре](./#существенные-разрывы). [Черновики и подтверждение](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/notebook/index.ts#L308-L331), [подтверждение](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/notebook/index.ts#L402-L427), [восстановление](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/notebook/index.ts#L521-L623).

## Загрузка блокнота {#загрузка-блокнота}

| Открытие | Загрузка |
| --- | --- |
| URL | BFF проверяет сессию и адрес, загружает блокнот и кладёт его в HTML bootstrap. Гость перенаправляется на вход. [HTML BFF](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/bff/src/html.ts#L49-L142) |
| SPA | Страница однократно использует подходящий preload, иначе вызывает `/api/notebooks/get`. После ухода ответ не меняет страницу. [NotebookPage](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/pages/NotebookPage/NotebookPage.tsx#L218-L287) |

Отсутствующий или недоступный блокнот возвращает на главную. При сбое загрузки SPA предлагает повторить запрос. [Прямой URL](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/bff/src/html.ts#L91-L142), [SPA](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/pages/NotebookPage/NotebookPage.tsx#L253-L272).

Общий загрузчик параллельно читает метаданные, содержимое и активную сессию. Дополнительный запрос очереди выполняется для сессии открытого блокнота. Ошибка чтения отклоняет агрегат. `hash` и `cells` приходят одним снимком содержимого. [BFF loader](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/bff/src/notebook.ts#L23-L52), [запуск приложения](/documentation/frontend/startup).

## Ячейки и ввод {#ячеики-и-ввод}

Ячейка имеет стабильный ID и индекс с нуля. Можно вставить code или Markdown, переместить и удалить ячейку. Интерфейс применяет структурную операцию после подтверждения и блокирует новые структурные действия на время записи структуры или конфликта. [Действия store](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/notebook/index.ts#L348-L427).

### Python {#python}

Code редактируется в `textarea` с отдельным слоем подсветки. Изменение отступа поддерживает Tab и Shift+Tab, Enter продолжает отступ, Backspace в ведущих пробелах сокращает его до предыдущего уровня. Esc, затем Tab или Shift+Tab переводят фокус из редактора. При основном указателе `coarse` исходник доступен для чтения и выделения. [Cell](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/components/Cell/Cell.tsx#L42-L210), [отступы](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/components/Cell/indentation.ts#L75), [компоненты и ввод](/documentation/frontend/rendering#клавиатура-и-touch).

### Markdown {#markdown}

Enter или двойной клик открывают ввод. Shift+Enter, Esc или выход фокуса из ячейки возвращают предпросмотр и инициируют сохранение. Preview строится из текущего локального текста. Исходный HTML показывается текстом. Python-блоки с метками `python`, `py` и `python3` получают подсветку. [Режимы Cell](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/components/Cell/Cell.tsx#L150-L250), [Markdown](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/modules/markdown/Markdown.tsx#L19), [обработка недоверенных данных](/documentation/security/xss).

## Лимит source {#лимит-source}

Предел для code и Markdown — **65 536 байт UTF-8** на ячейку. При вставке из буфера учитывается текст за пределами выделения, а вставляемый фрагмент сокращается по границе Unicode. Ввод сверх предела остаётся черновиком с `tooLarge` до сокращения. Серверный HTTP 413 означает отказ записи. [Расчёт вставки и правка](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/notebook/index.ts#L290-L331), [подсчёт байтов](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/notebook/snapshot.ts#L22-L39), [предел Go](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/notebook/usecase/contract.go#L14-L18).

## Очередь сохранения {#save-queue}

1. Ввод меняет `drafts` отдельно от `confirmed {hash, cells}`. Автосохранение ждёт 500 мс. Blur, завершение IME и подготовка запуска вызывают flush. Во время composition отправка ждёт завершения ввода.
2. Очередь выполняет одну запись за раз и объединяет ожидающие обновления source. Каждая отправка берёт актуальный подтверждённый `hash`.
3. После ответа обновляется `confirmed`. Если во время запроса набран новый текст, он остаётся в `drafts`. Смена поколения блокнота отсекает поздние ответы предыдущей страницы.

[Автосохранение](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/notebook/index.ts#L16-L18), [ввод](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/notebook/index.ts#L308-L347), [подтверждение](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/notebook/index.ts#L402-L427), [отправка](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/notebook/index.ts#L485-L517), [flush](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/notebook/index.ts#L798), [состояние клиента](/documentation/frontend/state#saving).

### Запросы BFF и Go {#запросы-bff-и-go}

Браузер передаёт `notebookId` и `hash` без кавычек в JSON. BFF подставляет идентификаторы в путь Go и добавляет сильный `If-Match` со значением в кавычках. [HTTP-маршруты](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/bff/src/router/cells.ts#L14-L45), [формирование заголовка](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/bff/src/go/api.ts#L55-L59), [адаптер Go](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/bff/src/go/api.ts#L193-L244).

| HTTP POST BFF | Операция Go относительно `/notebooks/{id}/content/cells` | Подтверждение |
| --- | --- | --- |
| `/api/cells/create` | `POST` с `kind, source, index?` | `201 {hash,cell}` |
| `/api/cells/update` | `PATCH /{cell_id}` с `source` | `200 {hash,cell}` |
| `/api/cells/move` | `POST /{cell_id}/move` с `index` | `200 {hash}` |
| `/api/cells/delete` | `DELETE /{cell_id}` | `200 {hash}` |

[Обработчики Go](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/notebook/delivery/http/editing.go#L53-L184).

## Hash и результат исполнения {#revision}

`hash` — непрозрачная редакция содержимого. Go проверяет её под блокировкой строки блокнота. Изменение source или структуры меняет редакцию, повтор актуального no-op её сохраняет. Правка code source сбрасывает вывод этой ячейки. [Транзакция](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/notebook/adapters/postgres/editing.go#L16-L64), [правка source](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/notebook/adapters/postgres/editing.go#L107-L155).

На описанной ревизии Go запись одного результата сохраняет прежний `hash`. Отдельный SHA-256 исходника нужен при [подготовке запуска](./execution#подготовка-запуска), а серверный `source_version` защищает [проекцию](./results#projection). [Запись результата](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/notebook/adapters/postgres/results.go#L40-L109).

## Ошибки записи и конфликт {#ошибки-записи-и-конфликт}

| Ситуация | Действие очереди |
| --- | --- |
| Таймаут, сетевой сбой, 5xx или недостоверный ответ | Перечитывает снимок. Уже применённое изменение считается подтверждённым. Прежняя структура допускает один автоматический повтор, иной снимок открывает конфликт. |
| Определённый отказ, например 413 | Перечитывает текущую версию. При прежней структуре оставляет черновик и ошибку записи, при расхождении открывает конфликт. |
| `409 notebook_conflict` или исчезновение цели | Приостанавливает очередь, снимает ожидающие структурные операции и загружает свежий снимок. |

[Сверка и retry](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/notebook/index.ts#L521-L646), [загрузка конфликта](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/notebook/index.ts#L647-L686).

После успешного чтения можно принять серверный снимок или повторно записать свой текст в сохранившиеся ячейки с новым `hash`. Закрытый диалог оставляет очередь на паузе. Для исполнения после разрешения конфликта заново нажмите запуск. [Выбор версии](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/notebook/index.ts#L688-L741), [подготовка команды](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/runtime.ts#L542-L583).

## Черновики удалённых ячеек {#orphans}

При выборе своего текста черновик отсутствующей ячейки попадает в `orphans`. Скопируйте текст из карточки восстановления в новую ячейку, затем закройте карточку. При переходах внутри SPA неподтверждённые данные остаются в памяти до возврата в блокнот. Перезагрузка страницы уничтожает эту копию. [Восстановление и удаление карточки](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/notebook/index.ts#L688-L747), [снимки в памяти](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/notebook/index.ts#L184-L224).
