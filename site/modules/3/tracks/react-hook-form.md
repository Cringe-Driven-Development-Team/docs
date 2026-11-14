---
title: "Свой React Hook Form"
label: "React Hook Form"
area: front
do:
  ManInTheCoat: front
mentors: [YarikMix]
related:
  - track: http-libraries
    why: "Формы и BFF используют общие ручные проверки из @cdd/schemas и согласованный формат ошибок полей"
---

План модуля №3 — пакет `@cdd-team/react-hook-form` в монорепе библиотек
[`frontend-packages`](https://github.com/Cringe-Driven-Development-Team/frontend-packages).
Формы используют общие ручные проверки из `@cdd/schemas` ещё до запроса; BFF независимо
проверяет вход теми же правилами. Ошибки полей от HTTP API отображаются так же, как ошибки
локальной проверки. Контракт и удаление Zod — в треке [«HTTP API и свои библиотеки»](./http-libraries).
