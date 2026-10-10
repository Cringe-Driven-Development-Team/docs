---
title: "Свой Zod: схемы на клиенте и сервере"
label: "Zod"
area: front
do:
  iRedTea: front
mentors: [YarikMix]
---

Пакет `@cdd-team/zod` в монорепе библиотек
[`frontend-packages`](https://github.com/Cringe-Driven-Development-Team/frontend-packages). На нём работают и BFF
(вход процедур tRPC), и формы клиента. Схемы `@cdd/schemas` генерирует Orval из контракта Go (подтрек
[«Orval»](/modules/2/tracks/bff-orval) модуля №2), и одни и те же схемы проверяют поля в браузере и на BFF: реализация
одна, расходиться нечему.

- **API** — подмножество zod, которое Orval goZod выдаёт по контракту Go: `object` (`strict`, `extend`, `shape`),
  `string` (`min`, `max`, `regex`), `number().int().min()`, `enum`, `optional`, `array`.
- **Подключение без правки кода.** В монорепе приложения зависимость `zod` указывает на свой пакет
  (`"zod": "npm:@cdd-team/zod@<версия>"`), поэтому `import { z } from 'zod'` от Orval и в роутере BFF не меняется.
- **Standard Schema** (`~standard`): по нему схему понимают tRPC 11 — проверка входа и типы процедур — и свой
  [React Hook Form](./react-hook-form).
- **Типы.** `z.infer` выводит тип схемы, в том числе необязательные ключи объекта: без него tRPC не выведет типы
  `AppRouter`.
- **Ошибки** — с путями полей и `flatten()` в формате zod: BFF отдаёт его в `zodError`, форма раскладывает по полям.

В модуле №2 BFF работает на настоящем `zod`, а клиент проверяет поля своим кодом — см.
[«Контракт»](/modules/2/tracks/bff/contract#клиент).
