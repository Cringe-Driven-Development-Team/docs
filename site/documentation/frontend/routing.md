---
title: Роутинг
---

# Роутинг

Роутер выбирает страницу по URL, проверяет клиентский статус сессии и помещает
страницу в общий макет. Здесь разобран код frontend на 08.11.2026, SHA
`0606aa6cb83b78a76f1e69816b2a6abd82dc20ee`; это не новый прогон на проде.
Путь первого HTML и начальных данных описан в [запуске приложения](./startup).

## PAGES и дерево маршрутов

Список `PAGES` — общий модуль клиента и BFF. Он задаёт пути, по которым BFF
распознаёт прямой запрос HTML; клиент использует те же значения как `path`.
Поэтому новая страница начинается с `PAGES`, а затем получает маршрут в дереве.
См. [pages.ts](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/bff/src/pages.ts#L1-L16).

| Ветка дерева | URL | Компонент |
| --- | --- | --- |
| `root → _guest → login/register` | `/login`, `/register` | Общий `AuthPage` на `_guest` |
| `root → _auth → index` | `/` | `NotebooksPage` |
| `root → _auth → notebook` | `/notebooks/$notebookId` | `NotebookPage` |
| `root → _auth → profile` | `/profile` | `ProfilePage` |
| `root → notFound` | `/404` | `NotFoundPage` |

`_guest` и `_auth` — идентификаторы обёрток без сегмента URL. Их вложенность
видна в [routeTree.ts](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/routes/routeTree.ts#L9-L14).
Единственный [router.ts](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/router.ts#L1-L11)
создаёт роутер и регистрирует его тип для проверки путей и параметров TypeScript.

Корневой маршрут показывает `RootLayout`: в его единственном `main` расположен
`Outlet`, рядом — общие Toast и Snackbar. `Outlet` находит следующий совпавший
маршрут; обёртка без компонента также продолжает вывод через `Outlet`.
При переходе между входом и регистрацией остаётся общий `AuthPage`.
См. [макет](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/layouts/RootLayout.tsx#L8-L26),
[guest.ts](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/routes/guest.ts#L8-L30)
и [Outlet в router 0.1.0](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/bda991c58d01a88b119d910787a87966e31bfe0a/packages/router/src/components.tsx#L31-L84).

## Переход и история {#navigation}

`Link` создаёт обычный `a` с вычисленным `href`. Клик основной кнопкой без
модификаторов перехватывается и вызывает переход роутера; Ctrl/Meta-клик и
открытие в другую вкладку остаются браузеру. Из обработчика используется
`useNavigate`, например при переходе на `/404` после `NOT_FOUND` блокнота.
См. [Link](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/bda991c58d01a88b119d910787a87966e31bfe0a/packages/router/src/components.tsx#L115-L182)
и [NotebookPage](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/pages/NotebookPage/NotebookPage.tsx#L185-L239).

Навигация собирает адрес, вызывает `history.pushState` или `replaceState`, затем
загружает совпадения маршрутов. `replace: true` заменяет текущую запись, поэтому
ошибочный адрес не добавляется ещё одной ступенью при таком перенаправлении.
Back/Forward вызывают `popstate`: подписка истории заново запускает загрузку
маршрутов. `pushState` сам `popstate` не генерирует — после него роутер вызывает
загрузку явно. Полного запроса HTML при этих SPA-переходах нет.
См. [commit](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/bda991c58d01a88b119d910787a87966e31bfe0a/packages/router/src/router.ts#L444-L449)
и [браузерную историю](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/bda991c58d01a88b119d910787a87966e31bfe0a/packages/router/src/history.ts#L27-L52).

Прямое открытие или reload сначала попадают в BFF. После выдачи HTML
`RouterProvider` подключает роутер к истории; далее работают клиентские
переходы. Сравнение загрузки данных при двух способах открытия — в
[запуске приложения](./startup).

## Параметры и 404

`$notebookId` соответствует одному непустому сегменту. Router 0.1.0 декодирует
его, а при построении URL кодирует переданный параметр; статические сегменты
сравниваются без учёта регистра, завершающий слэш не меняет совпадение.
См. [matchPath и interpolatePath](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/bda991c58d01a88b119d910787a87966e31bfe0a/packages/router/src/path.ts#L47-L99).
`NotebookPage` получает строку через
`useParams({ from: '/_auth/notebooks/$notebookId' })` и преобразует её в число.
Совпадение пути ещё не доказывает существование блокнота и право доступа:
это устанавливает запрос данных. [Чтение ID и ответ missing](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/pages/NotebookPage/NotebookPage.tsx#L185-L225).

Неизвестный путь внутри SPA обрабатывает `notFoundComponent` корня: гостя
перенаправляет на `/login`, вошедшего — на `/404` с заменой записи истории.
Отсутствующий или чужой блокнот тоже ведёт на `/404`. Сам маршрут `/404`
доступен обеим группам; HTTP-статус 404 при прямом открытии выставляет BFF,
а клиентский переход только меняет экран и URL.
См. [UnknownAddress](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/routes/root.tsx#L6-L24)
и [notFoundRoute](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/routes/notFound.ts#L6-L11).

## beforeLoad и защита запросов

Перед загрузкой маршрутов роутер вызывает `beforeLoad` от корня к листу.
`_auth` читает `useSessionStore.getState().status` и бросает `redirect` на
`/login`, если пользователь гость. `_guest` отправляет вошедшего на `/`.
Статус уже заполнен из bootstrap до первого рендера; отдельного запроса
«проверить вход» здесь нет. См. [auth.ts](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/routes/auth.ts#L5-L12),
[guest.ts](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/routes/guest.ts#L12-L21)
и [порядок beforeLoad](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/bda991c58d01a88b119d910787a87966e31bfe0a/packages/router/src/router.ts#L379-L409).

Эта проверка управляет интерфейсом. Серверная защита RPC проверяет сессию
независимо от маршрута, а Go проверяет доступ к блокноту. Пользователь может
вызвать запрос без перехода страницы, поэтому `beforeLoad` не заменяет
серверную проверку. Граница подробно описана в
[безопасности](/documentation/security/); точки BFF —
[authedProcedure](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/bff/src/trpc.ts#L52-L56).

## Что проверить в понимании

- Почему `_auth` отсутствует в адресной строке? Это `id` обёртки, а не `path`.
- Почему Back снова выбирает страницу? Роутер слушает `popstate` через историю.
- Почему совпавший URL блокнота не гарантирует доступ? Параметр выбирает ресурс,
  а доступ проверяют серверные процедуры.

Дальше — [компоненты и рендеринг](./rendering) и [управление состоянием](./state).
