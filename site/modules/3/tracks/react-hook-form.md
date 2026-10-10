---
title: "Свой React Hook Form"
label: "React Hook Form"
area: front
do:
  ManInTheCoat: front
mentors: [YarikMix]
related:
  - track: zod
    why: "Поля форм проверяются схемами из @cdd/schemas на своём Zod"
---

Пакет `@cdd-team/react-hook-form` в монорепе библиотек
[`frontend-packages`](https://github.com/Cringe-Driven-Development-Team/frontend-packages). Формы проверяют поля
схемами из `@cdd/schemas` ещё до запроса — через Standard Schema своего [Zod](./zod), — а ошибку `zodError` от BFF
раскладывают по полям так же, как свою. Ручные правила полей из
[`src/utils/credentials.ts`](https://github.com/frontend-park-mail-ru/2026_2_Cringe_Driven_Development/blob/f499d4e/src/utils/credentials.ts#L28)
заменяются схемами: правило поля описано один раз, в контракте Go.
