# Документация работающего продукта

Cellestial — SPA с BFF и Go API. Блокноты, ячейки и результаты хранятся в PostgreSQL;
код исполняется в отдельном runtime-окружении. Здесь собраны текущие версии,
результаты проверки прода и ссылки на устройство приложения.

**Проверка 09.11.2026, 04:19 МСК:** публичные HTTP-запросы без сессии и форма входа
в чистом headless Chrome на Linux. HTML содержит выпуск frontend/BFF
[`319e691`](https://github.com/Cringe-Driven-Development-Team/frontend/commit/319e691b79f81e09dcffabc04941831a5f4b5930),
соответствующий последнему успешному [frontend CD](https://github.com/Cringe-Driven-Development-Team/frontend/actions/runs/42538007203).
Backend [`06841d4`](https://github.com/Cringe-Driven-Development-Team/backend/commit/06841d4765c28ad7e52bf5e36df3b72cb22c094e)
подтверждён [production CD](https://github.com/Cringe-Driven-Development-Team/backend/actions/runs/42536140424/job/128901944399).
Версии инфраструктуры и схема размещения — в [архитектуре](/documentation/architecture/).

## Что подтверждено на проде

| Проверка без сессии | Результат |
| --- | --- |
| `/login` с `Accept: text/html` | `200`; в Chrome отрисованы поля логина/пароля и кнопка входа, ошибок JavaScript не получено |
| Гостевой bootstrap | `user: null`; ответ не устанавливает cookie, HTML имеет `Cache-Control: private, no-store` |
| GET `/api/trpc/users.me` без `X-CSRF` | `403`, `csrf_invalid` |
| Тот же GET с `X-CSRF: 1` | `401`, `UNAUTHORIZED`: требуется сессия |
| POST `/api/trpc/auth.login` с чужим `Origin`, `X-CSRF: 1` и пустым JSON | `403`, `csrf_invalid` |
| `/api/v1/users/me` на публичном домене | `404`: браузеру не предоставляется прямой маршрут Go API |
| Ответ `/login` | Заголовок `Content-Security-Policy` включён в режиме применения, не Report-Only |
| `/sw.js`, `/manifest.webmanifest`, `/offline.html`, `/offline.css`, `/onest-variable.woff2` | `200`; публичные файлы доступны без сессии |

Проверка POST подтверждает отклонение указанного запроса с чужим Origin; это не полный
аудит CSRF. Успешный вход, регистрация, refresh, выход, операции с блокнотами и аватарами,
создание runtime-сессии и исполнение кода в этом прогоне не проверялись.
Прямой доступ к серверам, сетевая изоляция runtime и восстановление backup также не проверены.

## Что реализовано в выложенном коде

Вход, регистрация и выход — процедуры BFF, которые вызывают Go и управляют cookie сессии.
При обращении к Go реализованы refresh и повтор запроса после истечения access token.
[Процедуры авторизации](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/apps/bff/src/router/auth.ts#L6),
[обновление сессии и повтор запроса](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/apps/bff/src/session/session.ts#L82).

BFF содержит процедуры пользователей, 2FA, блокнотов, ячеек и runtime. Go подключает
PostgreSQL для блокнотов и истории исполнения, Redis для сессий/лимитов и S3 для аватаров.
[Роутер BFF](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/apps/bff/src/router/index.ts#L9),
[подключение хранилищ](https://github.com/Cringe-Driven-Development-Team/backend/blob/06841d4765c28ad7e52bf5e36df3b72cb22c094e/internal/app/app.go#L87).
Описание реализации не заменяет проверку полного пользовательского сценария.

## Офлайн-режим

SW настроен на отдельную неперсональную офлайн-страницу при отказе сети во время навигации.
В precache входят её HTML, CSS, шрифт и манифест. Персональный HTML, ответы API и ассеты
редактора не сохраняются этим SW; автономное редактирование и исполнение блокнотов не предусмотрены.
[Конфигурация выпуска](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/apps/client/vite/plugins.ts#L43).

В текущем прогоне проверена HTTP-доступность публичных файлов; отключение сети и установку
PWA повторно не проверяли. Устройство кеша и границы браузерных проверок — в
[офлайн-режиме](/documentation/offline/), [сборке и регистрации SW](/documentation/offline/build-and-registration)
и [инфраструктуре PWA](/documentation/offline/infrastructure).

## Архитектура, безопасность и эксплуатация

- [Архитектура](/documentation/architecture/) — размещение компонентов, хранилища, runtime, CI/CD и подтверждения выкладок.
- [Frontend](/documentation/frontend/) — клиент, рендеринг, состояние и сохранение;
  [BFF](/documentation/frontend/bff) — запросы и сессия. У подробных страниц указаны собственные версии исходников и границы проверки.
- [Блокноты](/documentation/notebooks/) — модель документа, сохранение и исполнение.
- [Безопасность](/documentation/security/) — CSRF и XSS. CSP уже применяется на проде;
  [страница CSP](/documentation/security/csp) ещё не заполнена. Политика задана в
  [Caddy](https://github.com/Cringe-Driven-Development-Team/infra/blob/a59f8584386810b0b94f5fb23cb72c7ff906f6d7/ansible/roles/caddy/templates/Caddyfile.j2#L7).
- [Контекст проекта и владельцы сведений](/documentation/project-context) — где находятся код, контракт API и правила команды.
  Frontend владеет клиентом и BFF, backend — Go API и runtime-agent, infra — инфраструктурой.

## Где находятся планы и OpenWiki

[Модули](/modules/) содержат планы и историю учебной работы. Статус реализации и результаты
проверок следует смотреть в документации продукта и связанных исходниках.
Публичная <a href="../openwiki/" target="_self">OpenWiki</a> — производный тематический указатель;
канонический текст остаётся в документах этого репозитория.
