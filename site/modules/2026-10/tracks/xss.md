---
title: "XSS"
area: front
do:
  iRedTea: front
subtasks:
  - "CSP и nosniff в Caddy"
---

Экранирует место вывода — фронт; бэк хранит имя блокнота и ячейки как есть и отдаёт JSON.

## CSP и nosniff в Caddy

`index.html` отдаёт Caddy ([`Caddyfile.j2`](https://github.com/Cringe-Driven-Development-Team/infra/blob/2f97437105fdc685be82afd00daaed01c1b17013/ansible/roles/caddy/templates/Caddyfile.j2#L13-L32)), поэтому заголовки ставятся там, а не в Go API:

- `Content-Security-Policy` на ответе с `index.html`. Правило зависит от того, что грузит фронт: чанки —
  с CDN бакета релизов напрямую, картинки и шрифты — с `static.cellestial.ru`, API — свой домен; Monaco,
  скорее всего, потребует `worker-src` и послаблений в `style-src`.
- `X-Content-Type-Options: nosniff` на всех ответах.

Сначала `Content-Security-Policy-Report-Only`: браузер пишет нарушения в консоль и ничего не блокирует.
Нарушений на стенде не осталось — переключить на `Content-Security-Policy`.

## Markdown-ячейки

Сейчас ячейка выводит `source` текстом в `<pre>` ([`Cell.tsx`](https://github.com/frontend-park-mail-ru/2026_2_Cringe_Driven_Development/blob/344ad0b1d9c304ebae9ca3f3758bd38b1782d201/src/components/Cell/Cell.tsx#L28-L30)) — это безопасно. Рендер
markdown в HTML появится — только через санитайзер HTML: Monaco показывает исходник ячейки и его не
заменяет.
