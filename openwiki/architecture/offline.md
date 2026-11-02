---
type: architecture
title: Проверенный гостевой офлайн-режим
description: Проверка отдельной неперсональной офлайн-страницы и установки PWA 02.11.2026; границы Cache Storage, регистрации SW и доступности личных данных.
tags: [offline, service-worker, pwa, caching, evidence]
verified:
  - by: openwiki/0.7.2
    at: 2026-11-02T21:45:57.919Z
sources:
  - id: openwiki-source-0634619481d0ac776b61c45f
    resource: repo://site/documentation/offline/build-and-registration.md
  - id: openwiki-source-c552e07733b766b94145b7e4
    resource: repo://site/documentation/offline/index.md
generated: { by: "codex", at: "2026-11-02T21:45:57.919Z" }
---

# Гостевой офлайн-режим

В `site/documentation/offline/index.md` зафиксирован прогон **02.11.2026, 01:46 UTC+3**, Chrome на Ubuntu, чистый профиль, гостевой сценарий на публичном сайте. SHA из HTML — **`e3b327f58f8ef929afe0403ed7c7487abba2c48d`**. Это отдельное свидетельство со своей версией, а не обновление всех результатов [архитектурного среза](mvp.md). [Дата, версия и протокол](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/offline/index.md#L169-L195).

| Шаг | Наблюдение |
| --- | --- |
| Открытие с сетью | Форма входа отрисована; `/sw.js` активен, scope `/`, страница имеет controller |
| Просмотр Cache Storage | Только `offline.html` и `manifest.webmanifest` с ревизиями precache |
| Проверка манифеста | Chrome не сообщил ошибок манифеста и критериев установки |
| Отключение сети у страницы и SW, повторное открытие `/login` | Под тем же URL показана офлайн-страница без скриптов и внешних ресурсов |
| Восстановление сети и кнопка «Повторить» | Форма входа снова отрисована |

На том же SHA отдельный прогон **02.11.2026, 00:28 UTC+3** подтвердил нативный Install: результат `accepted`, отдельное окно, `display-mode: standalone` и управление этим окном со стороны `/sw.js`. Наличие установки PWA само по себе не заменяет проверку офлайн-показа. [Наблюдения](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/offline/index.md#L175-L186), [разделение установки PWA и SW](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/offline/index.md#L46-L49).

## Как запрос превращается в офлайн-страницу

Клиент остаётся SPA с server bootstrap от BFF и JS/CSS с CDN. BFF публично отдаёт `/sw.js`, `/offline.html` и манифест перед персональным HTML. В описанном выпуске SW применяет к навигации `NetworkOnly`: при сетевом отказе подставляет заранее сохранённую неперсональную страницу. Полученный HTTP-ответ, в том числе `503`, остаётся ответом сервера и не считается отсутствием сети. [Механизм и ссылки на код](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/offline/index.md#L119-L139).

| Ресурс | Отношение к Cache Storage |
| --- | --- |
| `offline.html`, публичный манифест | Precache с ревизиями |
| Персональный HTML BFF | Не сохраняется |
| RPC / API | Не сохраняются; HTML-подстановка вместо RPC не возвращается |
| JS/CSS и прочие ассеты SPA | Не сохраняются SW; обычная загрузка с CDN и HTTP-кеш рассматриваются отдельно |

Из этого не следует офлайн-запуск редактора: страница не предоставляет личные данные и не ставит действия пользователя в очередь. [Правила кеширования](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/offline/index.md#L121-L139), [ограничения](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/offline/index.md#L188-L195).

## Регистрация SW и сохранённые ответы

Установленная регистрация и код SW принадлежат внутреннему хранилищу браузерного профиля; они не лежат в `localStorage` или Cache Storage приложения. Контекст выполнения может останавливаться и запускаться снова по событиям. HTTP-кеш, регистрация SW и Cache Storage — разные механизмы. `Network → Disable cache` не удаляет регистрацию и сохранённые ответы; `Unregister` и очистка Cache Storage тоже решают разные задачи. [Хранение SW](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/offline/index.md#L16-L26), [сравнение хранилищ](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/offline/index.md#L55-L61), [проверка и сброс](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/offline/index.md#L90-L115).

По каноническому описанию сборки `vite-plugin-pwa`/`workbox-build` создают SW в режиме `generateSW`; `virtual:pwa-register` подставляет клиентский регистратор, который использует `workbox-window`. Обе части знают `/sw.js`, но настройки Workbox уже находятся в коде SW и не передаются при регистрации. Сам SW получает браузер от BFF с origin приложения; SPA загружается с CDN. Получение объекта регистрации ещё не доказывает precache и управление страницей. [Генерация и регистратор](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/offline/build-and-registration.md#L90-L129), [разделение настроек и регистрации](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/offline/build-and-registration.md#L151-L176), [браузерная стадия](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/offline/build-and-registration.md#L184-L217).

Место изменения — frontend: [apps/client/vite/plugins.ts на SHA офлайн-прогона](https://github.com/Cringe-Driven-Development-Team/frontend/blob/e3b327f58f8ef929afe0403ed7c7487abba2c48d/apps/client/vite/plugins.ts#L31-L84), [apps/client/src/serviceWorker.ts на том же SHA](https://github.com/Cringe-Driven-Development-Team/frontend/blob/e3b327f58f8ef929afe0403ed7c7487abba2c48d/apps/client/src/serviceWorker.ts#L1-L15). Это указатели из [канонической таблицы файлов](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/offline/build-and-registration.md#L156-L176), а не новая проверка текущего main frontend.

## Границы свидетельства

Подтверждён гостевой Chrome на Ubuntu. Safari, iOS, Android, авторизованные операции, данные блокнотов и доступность Go API этим прогоном не проверены. Обновление между двумя продовыми выпусками и тост восстановления соединения описаны по коду, но не испытаны этим гостевым сценарием. Первый визит без сети, удалённая регистрация или кеш и незавершённая установка SW не гарантируют офлайн-показ. [Границы проверки](https://github.com/Cringe-Driven-Development-Team/docs/blob/1a9e9ea19cb14507d6ac14b3707ca03b57dcbe2a/site/documentation/offline/index.md#L188-L195).

Другие свойства защиты — на странице [безопасности BFF](security-bff.md); места правки — в [карте владельцев](../concepts/sources.md); выбор темы — в [quickstart](../quickstart.md).
