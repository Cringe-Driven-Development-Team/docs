---
title: Добавление процедур BFF
---

# Добавление процедур BFF

Роутер tRPC — контракт BFF с браузером. Устройство роутера и список процедур — в
[контракте](./contract#роутер), настройка транспорта — в [клиенте tRPC](./client#клиент).

## Как добавить процедуру

1. Согласовать имя процедуры, query/mutation, вход, результат, ошибки и необходимость авторизации.
2. Если нужной операции Go нет, сначала изменить контракт в Apidog и реализацию Go, затем выполнить
   `bun run sync`: Orval обновит клиент и схемы. Если существующих операций достаточно, новый OpenAPI не нужен.
3. Добавить процедуру в роутер tRPC. Для passthrough взять подходящие схемы Orval; собственный вход
   агрегированной процедуры описать в BFF на Zod. Hono подключает общий HTTP-адаптер
   (см. [«Каркас»](./service#каркас)); отдельная Hono-ручка для каждой процедуры не нужна.
4. В обработчике вызвать общий клиент Go, при необходимости собрать несколько ответов для интерфейса.
   Предметная логика остаётся в Go.
5. Экспортировать `AppRouter`: TypeScript выводит методы, типы входов и ответов официального клиента
   из роутера. Кодогенерации клиента BFF → браузер нет; независимой OpenAPI-спецификации BFF тоже нет.
6. Вызвать `api.<процедура>.query(...)` или `.mutate(...)` на фронте; выполнить `typecheck` и ручную
   проверку результата, ошибок и авторизации.

Настройка `api` описана в [разделе «Клиент»](./client#клиент).
Например, существующая операция получения блокнота связывает сервер и клиент так:

```ts
// apps/bff/src/router/notebooks.ts
import { z } from 'zod';
import { authedProcedure, router } from '../trpc';

export const notebooks = router({
  get: authedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(({ ctx, input }) => ctx.go.getNotebook(input.id)),
});

// apps/bff/src/router/index.ts
export const appRouter = router({ auth, users, notebooks, cells });
export type AppRouter = typeof appRouter;

// apps/client: api — один раз настроенный официальный клиент из раздела «Клиент»
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@cdd/bff';

type NotebookInput = inferRouterInputs<AppRouter>['notebooks']['get'];
type NotebookResult = inferRouterOutputs<AppRouter>['notebooks']['get'];
const input: NotebookInput = { id: 1 };
const notebook: NotebookResult = await api.notebooks.get.query({ id: 1 });
```

*Фрагменты разных файлов; имя метода Go — по выгрузке Orval. Тип результата берётся из Go-клиента
через обработчик роутера, без ручного DTO и обязательной runtime-проверки всех ответов.*

## Процедуры экранов

Процедура ресурса — одно действие или один ресурс. Если экрану нужно больше одного вызова Go, для него
заводится процедура в роутере `views`: она делает вызовы Go параллельно и отдаёт один ответ. Процедуры
ресурсов остаются для действий и отдельных виджетов.

Сейчас каждый экран фронта делает по одному запросу: список блокнотов —
[`GET /notebooks`](https://github.com/frontend-park-mail-ru/2026_2_Cringe_Driven_Development/blob/344ad0b/src/pages/NotebooksPage/NotebooksPage.tsx#L32),
блокнот —
[`GET /notebooks/{id}`](https://github.com/frontend-park-mail-ru/2026_2_Cringe_Driven_Development/blob/344ad0b/src/pages/NotebookPage/NotebookPage.tsx#L38),
поэтому процедур экранов пока нет.

::: info
`views.notebook` ниже — ранний пример агрегации. Текущий план блокнотов использует общий загрузчик
для HTML/bootstrap и `notebooks.get`, а для наблюдения за исполнением — `runtime.updates`.
Согласованные границы и формы данных — в [«Сохранении и исполнении»](../file-exec/contract),
создание и очистка окружений — в подтреке [«Окружения исполнения»](../notebook-vps).
:::

```ts [apps/bff/src/router/views.ts]
// apps/bff/src/router/views.ts
export const views = router({
  notebook: authedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const [notebook, runtime] = await Promise.all([ctx.go.getNotebook(input.id), ctx.go.getRuntime(input.id)]);
      return { notebook, runtime };
    }),
});
```

*Исторический пример; `getRuntime` здесь — условный метод, а не новая ручка текущего контракта блокнотов.*
