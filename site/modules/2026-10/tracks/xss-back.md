---
title: "XSS: сторона бэка"
area: back
do:
  MrDuckVC: back
subtasks:
  - "Заголовок X-Content-Type-Options: nosniff на ответах API"
  - "Проверка: HTML в имени блокнота и в ячейках хранится как есть и уходит JSON"
related:
  - track: xss
    why: "Защита от XSS — на фронте, в месте вывода; бэк отдаёт данные как есть и с правильными заголовками"
---

## Что есть сейчас

Проверено по коду бэка на [`4094350`](https://github.com/go-park-mail-ru/2026_2_Cringe_Driven_Development/commit/409435082509e139417613487c47a91a9ad56f80):

- Экранирования и санитайзера HTML на бэке нет, защитных заголовков (`X-Content-Type-Options`,
  `Content-Security-Policy`) тоже нет.
- Ответы API — JSON с `Content-Type: application/json`; блокнот в S3 хранится как
  [`application/x-ipynb+json`](https://github.com/go-park-mail-ru/2026_2_Cringe_Driven_Development/blob/409435082509e139417613487c47a91a9ad56f80/internal/notebook/repository/s3/files.go#L77).
- Контракт ограничивает логин символами `[a-zA-Z0-9_]`
  ([`spec/openapi.json`](https://github.com/frontend-park-mail-ru/2026_2_Cringe_Driven_Development/blob/344ad0b1d9c304ebae9ca3f3758bd38b1782d201/spec/openapi.json#L1003)), а имя блокнота — только длиной 128
  ([`spec/openapi.json`](https://github.com/frontend-park-mail-ru/2026_2_Cringe_Driven_Development/blob/344ad0b1d9c304ebae9ca3f3758bd38b1782d201/spec/openapi.json#L1099)): `<script>` в имени бэк примет.

## Что делает бэк, а что нет

Экранировать на бэке не нужно: блокнот хранит код и markdown пользователя как есть, а как экранировать,
знает только место вывода — фронт (трек [XSS](./xss)). Задача бэка — не дать браузеру принять ответ API за
HTML: `nosniff` на всех ответах и `Content-Type` строго по контракту.

`Content-Security-Policy` для страниц фронта ставит Caddy, а не Go API.
