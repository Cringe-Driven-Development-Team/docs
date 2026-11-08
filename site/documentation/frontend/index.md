---
title: Frontend
---

# Frontend

Frontend Cellestial загружает блокнот, показывает редактор ячеек и сохраняет исходник
через BFF. Ниже — карта приложения и один путь от открытия страницы до подтверждения
правки сервером. Первый рендер подробно разобран в [запуске приложения](./startup).
Выбор страницы — в [роутинге](./routing#navigation), связь ввода и DOM — в
[компонентах и рендеринге](./rendering#cell), сохранность текста — в
[сохранении и конфликтах](./state#saving).

## Статус сведений

Раздел описывает код удалённого `frontend/main` на 08.11.2026:
[`0606aa6cb83b78a76f1e69816b2a6abd82dc20ee`](https://github.com/Cringe-Driven-Development-Team/frontend/tree/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee).
Это чтение реализации, а не новый прогон сценария на проде. Исторические наблюдения
сохраняют собственные дату и релиз на [странице BFF](/documentation/bff).

## Монорепа

В одном репозитории находятся три части. Клиент получает данные страницы и вызывает
процедуры BFF; BFF обращается к Go. Схемы проверяют данные на серверной границе.

| Каталог | Ответственность | Точка кода |
| --- | --- | --- |
| `apps/client` | Интерфейс в браузере, страницы, компоненты и состояние редактора | [NotebookPage.tsx](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/pages/NotebookPage/NotebookPage.tsx#L185-L239) |
| `apps/bff` | HTML с начальными данными и процедуры между клиентом и Go | [html.ts](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/bff/src/html.ts#L83-L134), [cells.ts](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/bff/src/router/cells.ts#L21-L44) |
| `packages/schemas` | Workspace-пакет `@cdd/schemas`: схемы, которые использует BFF для проверки входа | [импорт и применение схем](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/bff/src/router/cells.ts#L1-L32) |

Корневой [package.json](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/package.json#L4-L30)
объединяет `apps/*` и `packages/*` через Bun workspaces; `dev` и `build` запускают
задачи через Turbo. Границы остальных репозиториев описаны в
[контексте проекта](/documentation/project-context), общая схема — в
[архитектуре](/documentation/architecture/).

## Карта файлов

Пути клиента ниже начинаются с `apps/client/src/`, пути BFF — с `apps/bff/src/`.

| Где читать | Что искать |
| --- | --- |
| [main.tsx](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/main.tsx#L16-L44), [bootstrap.ts](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/bootstrap.ts#L23-L65) | Чтение первого HTML, заполнение session/preloaded, запуск роутера и рендера |
| [stores/preloaded.ts](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/stores/preloaded.ts#L3-L34) | Однократная передача блокнота из HTML странице |
| [pages/NotebookPage/NotebookPage.tsx](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/pages/NotebookPage/NotebookPage.tsx#L185-L253) | Загрузка страницы и открытие notebook/runtime-сторов |
| [components/Cell/Cell.tsx](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/components/Cell/Cell.tsx#L124-L172) | Поле исходника, просмотр Markdown и режим чтения |
| [stores/notebook/index.ts](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/stores/notebook/index.ts#L34-L94) | Подтверждённый снимок `confirmed`, `drafts`, очередь и статусы сохранения |
| [notebook.ts](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/bff/src/notebook.ts#L4-L54), [router/notebooks.ts](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/bff/src/router/notebooks.ts#L8-L12) | Общий загрузчик для HTML и `notebooks.get`; `active_session` и `runtime_queue` — сведения исполнения, отдельные от очереди сохранения |
| [router/cells.ts](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/bff/src/router/cells.ts#L11-L44), [go/api.ts](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/bff/src/go/api.ts#L179-L184) | Проверка мутации и вызов Go |

## Сквозной сценарий {#notebook-flow}

Предусловие: пользователь вошёл и открывает свой блокнот на устройстве с доступным
редактором. При `(pointer: coarse)` приложение включает просмотр: `useTouchDevice`
следит за media query, а страница передаёт `readOnly={touch}` в ячейку.
Это проверяется по [touch.ts](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/utils/touch.ts#L3-L16)
и [пропсам Cell](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/pages/NotebookPage/NotebookPage.tsx#L446-L458).

1. **Открытие.** При прямом URL BFF выдаёт HTML с `user` и `notebookPage`.
   Общий загрузчик соединяет метаданные, согласованные `hash` и ячейки из одного
   ответа content, активную runtime-сессию и её очередь, если она относится к этому
   блокноту. См. [загрузчик BFF](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/bff/src/notebook.ts#L22-L54).
2. **Первый экран.** Клиент проверяет bootstrap, заполняет session/preloaded и запускает
   рендер. Страница забирает подходящий preloaded без повторного `notebooks.get`;
   при SPA-переходе без этих данных запрашивает блокнот через эту процедуру.
   См. [main.tsx](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/main.tsx#L19-L44)
   и [открытие страницы](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/pages/NotebookPage/NotebookPage.tsx#L185-L239).
3. **Ввод.** `Cell` получает текст из `drafts`, если он есть, иначе — подтверждённый
   `source`. `onInput` вызывает `editSource`: меняется черновик стора, подписанная
   страница передаёт новый текст и показывает статус сохранения. Для Markdown Enter
   или двойной клик открывают исходник. См. [связь страницы с Cell](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/pages/NotebookPage/NotebookPage.tsx#L446-L458),
   [редактор](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/components/Cell/Cell.tsx#L239-L265)
   и [просмотр](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/components/Cell/Cell.tsx#L343-L377).
4. **Постановка в очередь.** После 500 мс без ввода вызывается `commitSource`;
   уход фокуса из поля и конец IME вызывают его явно. Во время IME-композиции
   autosave откладывается. Исходник больше 65 536 байт UTF-8 остаётся видимым
   черновиком и не отправляется, пока его не сократят. См. [лимит и задержку](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/stores/notebook/index.ts#L5-L13),
   [editSource/commitSource](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/stores/notebook/index.ts#L270-L318)
   и [события Cell](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/components/Cell/Cell.tsx#L228-L248).
5. **Запись.** Очередь отправляет операции последовательно: `cells.update` получает
   `notebookId`, `cellId`, `source` и текущий `hash`. BFF проверяет вход, оборачивает
   hash в кавычки заголовка `If-Match` и вызывает Go. Каждая следующая запись
   использует hash предыдущего ответа. См. [очередь и запрос](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/stores/notebook/index.ts#L403-L478),
   [валидацию](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/bff/src/router/cells.ts#L11-L33)
   и [If-Match](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/bff/src/go/api.ts#L86-L88).
6. **Подтверждение.** Успешный ответ обновляет `confirmed` и hash. Черновик снимается
   только при совпадении с отправленным текстом: новый ввод во время запроса остаётся.
   Ответ прежнего открытого блокнота не применяется после смены поколения стора.
   «Сохранено» появляется, когда больше нечего сохранять. См. [commit](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/stores/notebook/index.ts#L374-L386),
   [проверку поколения](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/stores/notebook/index.ts#L444-L478)
   и [статус](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/stores/notebook/index.ts#L237-L252).

Если Go сообщает `notebook_conflict`, очередь останавливается, черновики сохраняются
и загружается свежий снимок для выбора версии. После сетевого сбоя или 5xx результат
записи может быть неизвестен: стор перечитывает блокнот и сверяет его с ожидаемым
результатом перед повтором. Это две разные причины восстановления;
[обработка ошибок и сверка](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/stores/notebook/index.ts#L481-L610)
не объявляют каждый неуспешный ответ несостоявшейся записью. Запуск Python не входит
в этот сценарий: runtime-данные отмечены в карте отдельно.

## Что проверить в понимании

- Почему ввод виден до ответа Go? `Cell` показывает черновик; `confirmed` меняется
  только после подтверждения или сверки.
- Почему старая отправка не стирает новое слово? При подтверждении стор сравнивает
  текущий черновик с отправленным исходником.
- Когда нужен `notebooks.get` при открытии? Когда нет подходящих одноразовых данных
  из HTML; подробности — в [запуске приложения](./startup).

Офлайн-поведение имеет [собственный раздел](/documentation/offline/), а граница
защиты запросов — [раздел безопасности](/documentation/security/).
