---
title: Компоненты и рендеринг
---

# Компоненты и рендеринг

На примере `Cell` здесь показано, как ввод меняет состояние и превращается
в обновление DOM. Это чтение frontend на 08.11.2026, SHA
`0606aa6cb83b78a76f1e69816b2a6abd82dc20ee`, а не новый прогон на проде.
Разбор пакета относится к `@cdd-team/react` 1.7.1; гарантии других реализаций
React из совпадения имён API не следуют.

## Cell: JSX, props и события {#cell}

`NotebookPage` подписана на notebook-store и строит список ячеек.
Каждая `Cell` получает `cell`, отображаемый `text`, флаги и обработчики:
`text={notebook.drafts[row.cell.id] ?? row.cell.source}` выбирает черновик
раньше подтверждённого текста. `onInput` передаёт новый source и признак
композиции в `editSource`, а `onCommit` вызывает `commitSource`.
Компонент сам запросов BFF не отправляет.
[Пропсы и обработчики](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/pages/NotebookPage/NotebookPage.tsx#L427-L468).

JSX описывает дерево элементов: тип, props, children и key. Runtime `jsx/jsxs`
командного React нормализует children и передаёт их в `h`; это ещё не DOM.
Функциональный компонент вычисляет такое дерево по своим props и состоянию.
[JSX runtime 1.7.1](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/f4d2bd02fcc127e5603bbe09874242b071def7ba/packages/react/src/jsx-runtime.ts#L24-L55).

События `onInput`, `onBlur`, `onCompositionEnd` и `onKeyDown` описаны на
`textarea`. В React 1.7.1 DOM-патчер подключает обработчики через
`addEventListener`, при замене снимает старый обработчик; `onDoubleClick`
сопоставляется с `dblclick`, суффикс `Capture` выбирает фазу захвата.
См. [события Cell](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/components/Cell/Cell.tsx#L211-L273)
и [patch-dom.ts](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/f4d2bd02fcc127e5603bbe09874242b071def7ba/packages/react/src/patch-dom.ts#L70-L157).

## Локальный режим и key

Внутри `Cell` хранится только режим Markdown: `mode.value` (`edit`/`view`)
и `mode.refocus`. Source принадлежит notebook-store, выделенная ячейка и
цель фокуса — странице. Существующий Markdown открывается в просмотре,
новый получает `startEditing`; code показывает редактор при доступном вводе.
`tooLarge` удерживает Markdown в редакторе, чтобы текст можно было сократить.
[Условия режима](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/components/Cell/Cell.tsx#L154-L172).

Список использует `key={row.cell.id}`, поэтому при перемещении ячейки её
идентичность не определяется новым индексом. Внутри стоят ключи `editor`,
`preview`, `body`: reconciliation ищет прежний узел по key и типу среди
соседей, переносит подходящий узел, удаляет оставшиеся. Сохранённая
идентичность позволяет сохранить hooks; смена типа или ключа создаёт другой
узел и его состояние. `key` не является атрибутом DOM.
См. [ключи списка](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/pages/NotebookPage/NotebookPage.tsx#L427-L435),
[reconcile.ts](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/f4d2bd02fcc127e5603bbe09874242b071def7ba/packages/react/src/reconcile.ts#L105-L154)
и [useState](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/f4d2bd02fcc127e5603bbe09874242b071def7ba/packages/react/src/hooks.ts#L75-L112).

## Внешний стор и обновление DOM {#subscriptions}

Ввод меняет `drafts` через `useNotebookStore.setState`. Zustand 1.0.1 создаёт
новый объект состояния при частичном обновлении и уведомляет подписчиков.
Его hook читает срез, подписывается в `useLayoutEffect`, сравнивает
состояние и результат selector через `Object.is`, а при изменении вызывает
локальный `forceRender`. Отписка возвращается из эффекта. Это конкретная
реализация установленного пакета, а не предположение о современном Zustand.
См. [create-store](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/4652b210db7bf9fcdbbdf96539b412201a1bec85/packages/zustand/src/vanilla/create-store.ts#L10-L48)
и [use-store](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/4652b210db7bf9fcdbbdf96539b412201a1bec85/packages/zustand/src/react/use-store.ts#L8-L37).

Страница использует `useNotebookStore()` без selector и получает всё состояние;
`RootLayout` выбирает отдельные toast/snackbar/lost. После обновления страница
вычисляет новые props Cell. React планирует работу, сопоставляет новое дерево
со старым и в commit применяет вставки, перемещения, удаления и изменения
props к DOM. У textarea обновляется `value`, у статуса — соответствующий
текст/компонент; повторный вызов компонента не означает пересоздание всей
страницы. Сохранение на сервере начинается отдельно от этого обновления.
См. [подписки страницы](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/pages/NotebookPage/NotebookPage.tsx#L199-L201),
[макет](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/layouts/RootLayout.tsx#L13-L17),
[планирование render](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/f4d2bd02fcc127e5603bbe09874242b071def7ba/packages/react/src/render.ts#L35-L52)
и [commit](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/f4d2bd02fcc127e5603bbe09874242b071def7ba/packages/react/src/commit.ts#L77-L121).

## Эффекты и cleanup

`useLayoutEffect` Cell работает с уже изменённым DOM: переводит фокус,
восстанавливает позицию курсора, подгоняет высоту textarea и синхронизирует
декоративную подсветку. Один `ResizeObserver` следит за шириной редактора;
cleanup вызывает `disconnect` при смене зависимостей или удалении компонента.
Массив зависимостей определяет повтор эффекта, поэтому наблюдатель не
создаётся на каждое нажатие. [Эффекты Cell](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/components/Cell/Cell.tsx#L165-L205).

React 1.7.1 запускает layout-эффекты после мутаций DOM в commit;
`useEffect` относится к отдельной очереди passive-эффектов. На странице
cleanup эффекта `[id]` вызывает `leaveNotebook` и `closeRuntime`:
запускает сохранение ожидающего текста и прекращает опрос исполнения этой
страницы. Listener `beforeunload` тоже снимается cleanup. Загрузка данных
использует флаг `alive`, чтобы завершившийся запрос старой страницы не
открыл другой блокнот. Это отдельная защита от поколения очереди сохранения.
См. [commitRoot](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/f4d2bd02fcc127e5603bbe09874242b071def7ba/packages/react/src/commit.ts#L22-L43)
и [эффекты страницы](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/pages/NotebookPage/NotebookPage.tsx#L203-L262).

## Клавиатура и touch

Ввод Python использует textarea и декоративный слой подсветки, Markdown —
редактор или JSX-просмотр локального текста. Клавиши обрабатываются с учётом
IME: пока `isComposing`, обработчик не перехватывает их. Tab делает отступ,
Esc затем Tab позволяет выйти из редактора; Shift+Enter/Esc возвращают
Markdown в просмотр и вызывают commit. Полная таблица клавиш и правила
preview находятся в [редактировании блокнота](/documentation/notebooks/editing).

`useTouchDevice` читает `matchMedia('(pointer: coarse)')` через
`useSyncExternalStore`, подписывается на `change` и снимает listener при
отписке. Это тип основного указателя, а не ширина экрана. Страница передаёт
`readOnly={touch}`: code становится фокусируемым `pre`, Markdown — preview,
добавление и изменение структуры скрываются. Запуск остаётся доступен.
Если указатель сменился во время ввода, страница вызывает `leaveNotebook`,
а Cell переводит режим в просмотр.
См. [touch.ts](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/utils/touch.ts#L1-L16),
[реакцию страницы](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/pages/NotebookPage/NotebookPage.tsx#L250-L253)
и [ветви Cell](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/components/Cell/Cell.tsx#L313-L379).

## Что проверить в понимании

- Почему source не хранится в `mode`? Он нужен очереди сохранения и странице;
  локальный режим определяет только форму показа.
- Почему перемещение не должно менять key на индекс? Иначе состояние компонента
  будет связано с позицией, а не с конкретной ячейкой.
- Когда ввод становится сохранённым? После серверного подтверждения или сверки,
  как описано в [сохранении и конфликтах](./state#saving).

Карта приложения — в [обзоре](./), выбор страницы — в [роутинге](./routing).
