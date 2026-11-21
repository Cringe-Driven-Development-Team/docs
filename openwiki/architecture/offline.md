---
type: architecture
title: Публичные файлы PWA и офлайн-страница
description: Доступность файлов PWA на версии frontend от 9 ноября 2026 года и границы офлайн-подстановки по коду выпуска.
tags: [offline, service-worker, pwa, caching, evidence]
verified:
  - by: openwiki/0.7.2
    at: 2026-11-20T16:39:19.736Z
sources:
  - id: openwiki-source-2ac22079c5a49104f7bb3896
    resource: repo://site/documentation/architecture/index.md
  - id: openwiki-source-1a80ca3cbf75612a6a6f7bf8
    resource: repo://site/documentation/current-state.md
generated: { by: "codex", at: "2026-11-20T16:39:19.736Z" }
---

# Публичные файлы PWA и офлайн-страница

09.11.2026 в 04:19 МСК в гостевом прогоне для frontend/BFF `319e691b79f81e09dcffabc04941831a5f4b5930` публичные `/sw.js`, `/manifest.webmanifest`, `/offline.html`, `/offline.css` и `/onest-variable.woff2` вернули `200`. SHA найден в HTML и совпал с успешным frontend CD. Запросы подтвердили доступность файлов без сессии. В этом прогоне Chrome не проверял установку PWA или показ страницы при отключённой сети. [Версия выпуска](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/current-state.md#L7-L13), [HTTP-результат](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/current-state.md#L19-L26), [границы проверки](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/current-state.md#L46-L56).

## Как устроена офлайн-подстановка

Публичные PWA-файлы идут через Caddy и BFF. При отказе сети во время навигации Service Worker настроен на подстановку неперсональной страницы. В precache входят её HTML, CSS, шрифт и манифест. Персональный HTML, ответы API и ассеты редактора не сохраняются этим Service Worker. Автономное редактирование и исполнение блокнотов выходят за границы этого механизма. [Маршрут файлов](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/architecture/index.md#L45-L58), [состав precache](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/current-state.md#L46-L51).

В репозитории frontend настройка находится в `apps/client/vite/plugins.ts`, а выдача файлов — в `apps/bff/src/public.ts`. Обе ссылки закреплены на SHA выпуска из гостевого прогона. [Настройка сборки](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/apps/client/vite/plugins.ts#L43), [публичные файлы BFF](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/apps/bff/src/public.ts#L3), [указатели в docs](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/architecture/index.md#L123-L132).

[Размещение компонентов](mvp.md) и [карта документации](../quickstart.md).
