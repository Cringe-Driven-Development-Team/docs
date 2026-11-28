# Документация работающего продукта

На проде проверены гостевая страница входа, ответы API без сессии и офлайн-переход после установки service worker. Для успешной авторизации, сохранения блокнота и исполнения ячейки нужны сквозные проверки с аккаунтом.

## Что подтверждено на проде

**28.11.2026, 02:18:48–02:18:49 МСК (UTC+03:00).** Гостевые HTTP-запросы к `cellestial.ru`. HTML и [production Deployment 8118066244](https://api.github.com/repos/Cringe-Driven-Development-Team/frontend/deployments/8118066244/statuses) указывают на frontend/BFF [`b1baf996`](https://github.com/Cringe-Driven-Development-Team/frontend/commit/b1baf996fb6753d1a62eab6f874d03dca30faadc).

| Действие | Результат |
| --- | --- |
| GET `/login` с `Accept: text/html` | `200`. Один bootstrap с `user: null`, ассеты выпуска `b1baf996`, `Cache-Control: private, no-store`, заголовок `Content-Security-Policy`. Ответ не устанавливает cookie |
| GET `/api/users/me` без `X-CSRF` | `403`, `csrf_invalid` |
| GET `/api/users/me` с `X-CSRF: 1` без сессии | `401`, `UNAUTHORIZED` |
| GET `/api/v1/users/me` на публичном домене | `404` |
| GET `/sw.js`, `/manifest.webmanifest`, `/offline.html` | `200` |

[Разбор HTTP-границы BFF](/documentation/frontend/bff), [проверки CSRF](/documentation/security/csrf), [действующая CSP](/documentation/security/csp).

## Что реализовано в выложенном коде

В frontend/BFF `b1baf996` BFF обслуживает HTTP-маршруты авторизации и управляет сессионной cookie. Адаптер Go обновляет токены и повторяет запрос при истечении access token. В последнем успешном выпуске Go `3532ca9` приложение использует PostgreSQL для записей блокнотов и исполнения, Redis для сессий и лимитов, S3 для аватаров. [Маршруты авторизации](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/bff/src/router/auth.ts#L12-L63), [обновление сессии](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/bff/src/session/session.ts#L79-L122), [подключение хранилищ](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/app/app.go#L92-L136).

Более поздний backend Deployment завершился ошибкой внешней проверки. Версия активного Go после этой попытки не установлена. Описание блокнотов и сессий опирается на чтение исходников. Проверками выше не охвачены вход и регистрация, refresh, аватары, запись блокнота, запуск и изоляция runtime, восстановление резервных копий. [Выкладки](/documentation/architecture/#cd), [блокноты](/documentation/notebooks/), [сессия](/documentation/frontend/session).

## Офлайн-режим

**28.11.2026, 01:53:53–01:53:55 МСК (UTC+03:00), Chrome Headless 154.0.8037.57, выпуск `b1baf996`.** Чистый браузер без сети получил `ERR_INTERNET_DISCONNECTED` при первом открытии `/login`. После онлайн-загрузки формы и установки service worker при повторной навигации без сети открылась страница «Нет подключения к интернету» по тому же URL. HTML, CSS и шрифт пришли из worker. После возвращения сети и нажатия «Повторить» браузер вернулся к форме входа. [Условия и результаты прогона](/documentation/offline/).

Офлайн-доступ ограничен отдельной страницей. [Кеш и регистрация worker](/documentation/offline/build-and-registration), [PWA-файлы и инфраструктура](/documentation/offline/infrastructure).

## Архитектура, безопасность и эксплуатация

- [Архитектура](/documentation/architecture/) — версии, размещение компонентов, хранилища и контракты.
- [Frontend](/documentation/frontend/) — клиент, BFF и инструменты разработки.
- [Безопасность](/documentation/security/) — cookie, CSRF, CSP и вывод HTML.
- [Выкатки](/documentation/frontend/releases/) — публикация, переключение выпуска и откат.
- [Владельцы сведений](/documentation/project-context) — исходники и проверки перед изменением.

## Где находятся планы

[Модули](/modules/) хранят проектные требования и задачи. Целевые сценарии и макеты собраны в [обзоре продукта](/documentation/).
