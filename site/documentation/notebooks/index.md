# Блокноты {#блокноты-реализация}

Браузер хранит черновик и показывает вывод, BFF передаёт операции Go API, а Go записывает ячейки и результаты в PostgreSQL. Код выполняется в kernel отдельного окружения. [Общий загрузчик BFF](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/bff/src/notebook.ts#L23-L52), [запись документа](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/notebook/adapters/postgres/editing.go#L16-L64), [выполнение и сбор событий](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtimesession/usecase/worker.go#L220-L252).

## От открытия до результата {#от-открытия-до-результата}

1. Откройте блокнот по прямому адресу или из списка. В обоих случаях BFF загружает документ и сведения о сессии. [Открытие](./editing#загрузка-блокнота).
2. Измените ячейку. Очередь отправит правку с редакцией последнего подтверждённого снимка. [Сохранение](./editing#save-queue).
3. Запустите окружение и выполните ячейку. Браузер дождётся записи исходника и передаст команде его SHA-256. [Подготовка запуска](./execution#подготовка-запуска).
4. Проверьте исход команды и сохранение её вывода в ячейке. [Результаты исполнения](./results#projection).

| Исход | Основание |
| --- | --- |
| Локальный черновик | Новый текст хранится в `drafts` в памяти клиента. [Ввод](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/notebook/index.ts#L308-L331) |
| Подтверждение записи | Клиент применил ответ с актуальным `hash` или перечитал ожидаемый серверный снимок после неопределённого ответа. [Подтверждение](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/notebook/index.ts#L402-L427), [перечитывание](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/stores/notebook/index.ts#L521-L623) |
| Сохранённый результат исполнения | `projection: applied` подтверждает запись накопленного вывода в ячейку. [Проекция](./results#projection) |

## Компоненты и ответственность {#компоненты-и-ответственность}

Браузер вызывает HTTP-маршруты BFF. Go управляет сессией и принимает команды, агент передаёт их kernel и ведёт журнал. Go переносит события и применимый вывод в постоянное хранилище. [HTTP-маршруты](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/bff/src/router/runtime.ts#L17-L112), [сбор журнала](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtimesession/usecase/worker.go#L220-L252), [публикация](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/notebook/adapters/postgres/results.go#L40-L109).

<Diagram name="notebooks-components" />

## Разделы {#разделы}

| Раздел | Содержание |
| --- | --- |
| [Редактирование](./editing) | Ввод, операции над ячейками, проверка редакции, восстановление текста |
| [Исполнение](./execution) | Состояния окружения, команды, polling, остановка |
| [Результаты](./results) | История исполнения, проекция на ячейку, типы вывода |
| [Хранение и инфраструктура](./storage-and-infrastructure) | Владельцы данных, сеть, подготовка и лимиты окружения |

## Проверенные ревизии и сценарии {#существенные-разрывы}

| Компонент | Ревизия и свидетельство |
| --- | --- |
| Frontend и BFF | `b1baf996fb6753d1a62eab6f874d03dca30faadc`. Deployment `8118066244` получил `success` 27.11.2026 в 19:45:23 UTC. Гостевой GET `/login` 28.11.2026 в 01:13:43 МСК вернул bootstrap с `user: null` и ссылки на ассеты этого выпуска. [Workflow отката](https://github.com/Cringe-Driven-Development-Team/frontend/actions/runs/46058681997), [проверка первого HTML](/documentation/frontend/startup#первыи-html-от-bff). |
| Go и агент | `3532ca97dc2c9d0f84aa999eae85918e76907aa7`. Deployment `7970701489` с образом `sha256:e016be28d81f80a148c22f9ef80fe332ea024b57299a7ba38b16aca73f93afcb` получил `success` 21.11.2026 в 23:09:55 UTC. Более поздний Deployment `8116451615` на `cc4ea0790ca3fe07fcfccd6a140ea27c1bcb7173` завершился ошибкой внешней проверки BFF 27.11.2026 в 18:10:47 UTC. Фактически запущенный после этой попытки образ не установлен. Исходники блокнотов, исполнения и агента в обеих ревизиях совпадают. [Успешная выкладка](https://github.com/Cringe-Driven-Development-Team/backend/actions/runs/44960100516), [поздняя попытка](https://github.com/Cringe-Driven-Development-Team/backend/actions/runs/46046649107), [сравнение ревизий](https://github.com/Cringe-Driven-Development-Team/backend/compare/3532ca97dc2c9d0f84aa999eae85918e76907aa7...cc4ea0790ca3fe07fcfccd6a140ea27c1bcb7173). |
| Инфраструктура | `686218395ad12e5752af312d18f32efc508d55ea`. Выкатка завершилась 27.11.2026 в 22:11:43 UTC со статусом `success`. На этом снимке основаны ссылки и схема раздела о блокнотах. Более поздний apply зафиксирован в [архитектуре сервиса](/documentation/architecture/). [Workflow инфраструктуры](https://github.com/Cringe-Driven-Development-Team/infra/actions/runs/46073347148/job/140758442567). |
| OpenAPI | `947a19ccf4319a621007b2900aa8e620ca27762b` — ревизия контракта в снимке frontend. [Манифест](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/spec/contract-source.json#L1-L5). |

| Сценарий | Статус и основание |
| --- | --- |
| Открытие своего блокнота по URL и внутри SPA | По исходникам общего загрузчика и страницы. [Входы](./editing#загрузка-блокнота). |
| Набор текста, подтверждение записи, конфликт и восстановление | По исходникам очереди клиента и транзакции Go. [Очередь](./editing#save-queue), [конфликт](./editing#ошибки-записи-и-конфликт). |
| Запуск, остановка, сохранение вывода после перезагрузки | По исходникам BFF, клиента и Go. [Обновления](./execution#updates), [запись вывода](./results#projection), [очистка](./execution#cleanup). |
| Выделение runtime-VPS, рабочие файлы и сетевая изоляция | По исходникам провайдера, playbook и агента. [Окружение](./storage-and-infrastructure#кто-создает-окружение), [изоляция](./storage-and-infrastructure#изоляция-kernel). |

Сквозных проверок авторизованных сценариев на production на этих ревизиях нет. Для сравнения с требованиями доступны ограничения [очистки](./execution#cleanup), [порядка событий между вкладками](./execution#updates) и [восстановления текста удалённой ячейки](./editing#orphans).

## Требования и макеты {#открытые-задачи-и-макеты}

Целевые состояния хранятся в [контракте модуля](/modules/2/tracks/file-exec/contract). В макетах доступны [редактор](https://www.figma.com/design/7iaVDGiwzQk2vZIB5ogVlq/?node-id=496-14407), [Markdown](https://www.figma.com/design/7iaVDGiwzQk2vZIB5ogVlq/?node-id=496-14596) и [исполнение](https://www.figma.com/design/7iaVDGiwzQk2vZIB5ogVlq/?node-id=581-16814). Пользовательские сценарии и проектные задачи собраны в [обзоре продукта](/documentation/).

Поиск по тексту доступен в панели блокнота. Это сверка интерфейса по коду, не новый прогон на production. Поддержка импорта в интерфейсе остаётся [задачей #96](https://github.com/Cringe-Driven-Development-Team/frontend/issues/96). [Текущая панель](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/pages/NotebookPage/NotebookPage.tsx#L463-L477), [прежняя реализация поиска](https://github.com/Cringe-Driven-Development-Team/frontend/blob/ea123518d624521f999e884ff32ddec0a5bf6bfa/apps/client/src/pages/NotebookPage/NotebookPage.tsx#L322-L346).
