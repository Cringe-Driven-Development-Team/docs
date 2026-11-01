---
title: Монорепа BFF
---

Монорепа связывает клиент, BFF и схемы; ниже — целевые границы workspace и сборок.

## Монорепа фронта

<Diagram name="modules/2/frontend-monorepo" />

[frontend#44](https://github.com/Cringe-Driven-Development-Team/frontend/issues/44) делает репозиторий фронта
монорепой на bun workspaces и Turborepo из трёх workspace: `apps/client`, `apps/bff` и `packages/schemas`
(`@cdd/schemas`).

Собственные React/Zustand — пакеты `@cdd-team/*` из npm
(монорепа [`frontend-packages`](https://github.com/Cringe-Driven-Development-Team/frontend-packages));
`@trpc/client`, `@trpc/server` и `zod` — официальные внешние зависимости.

Клиент берёт у BFF
только типы (`import type AppRouter` и `BootstrapData`), а Turborepo сначала собирает зависимости (`^build`) и повторный запуск
без изменений берёт из кеша.

Vite собирает клиент и HTML, Bun build — BFF. Упаковка общего образа
с HTML выполняется после обеих сборок вне `bff#build`, чтобы не создать цикл с клиентом.
[Выпуск и откат](./bootstrap#выпуск-и-откат) связывают HTML и BFF одним SHA; ассеты идут в CDN.
Подробный поток — на страницах [выкатки](./release) и [отката](./rollback).
Генерация клиента к Go и схем — в [«Как устроен контракт»](../bff#как-устроен-контракт).

