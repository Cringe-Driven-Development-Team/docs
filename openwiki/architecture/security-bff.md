---
type: security
title: Граница BFF и проверки безопасности
description: Гостевые проверки CSRF, сессии и CSP 9 ноября 2026 года, граница Go API и точки настройки в коде.
tags: [security, csrf, csp, xss, bff, session]
verified:
  - by: openwiki/0.7.2
    at: 2026-11-20T16:39:19.736Z
sources:
  - id: openwiki-source-2ac22079c5a49104f7bb3896
    resource: repo://site/documentation/architecture/index.md
  - id: openwiki-source-1a80ca3cbf75612a6a6f7bf8
    resource: repo://site/documentation/current-state.md
  - id: openwiki-source-ce98287df8bcc7af43c8a489
    resource: repo://site/documentation/frontend/bff.md
  - id: openwiki-source-2c46f27259ec845dd3569cd0
    resource: repo://site/documentation/security/csp.md
generated: { by: "codex", at: "2026-11-20T16:39:19.736Z" }
---

# Граница BFF и проверки безопасности

## Что наблюдали на проде

09.11.2026 в 04:19 МСК гостевой прогон зафиксировал HTML frontend/BFF `319e691b79f81e09dcffabc04941831a5f4b5930`; production CD подтвердил backend `06841d4765c28ad7e52bf5e36df3b72cb22c094e`. HTML формы входа имел `Cache-Control: private, no-store` и `user: null`, cookie гостю не устанавливалась. [Версии и наблюдения](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/current-state.md#L7-L26).

| Гостевая проверка | Результат |
| --- | --- |
| GET `/api/trpc/users.me` без `X-CSRF` | `403`, `csrf_invalid` |
| Тот же GET с `X-CSRF: 1` | `401`, `UNAUTHORIZED`: процедуре нужна сессия |
| POST процедуры `auth.login` с чужим `Origin` | `403`, `csrf_invalid` для запроса, указанного в протоколе |
| Публичный `/api/v1/users/me` | `404` |
| HTML `/login` | Блокирующий заголовок `Content-Security-Policy` |

POST подтверждает отказ для конкретного запроса с чужим Origin. Вход, регистрация, refresh, выход, операции с пользовательскими данными и исполнение в runtime остались за пределами прогона. [Результаты и границы](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/current-state.md#L17-L31).

## Где проверять реализацию

На границе браузера `createContext` проверяет CSRF перед чтением сессии и вызовом Go. При допустимом RPC обязательным является `X-CSRF: 1`; для POST проверяется совпадение Origin, а присутствующий `Sec-Fetch-Site` должен быть `same-origin`. Прохождение проверки оставляет защищённой процедуре отдельную проверку сессии. Эти условия зафиксированы в срезе кода frontend 08.11.2026. [Условия RPC](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/frontend/bff.md#L31-L45), [context.ts на SHA среза](https://github.com/Cringe-Driven-Development-Team/frontend/blob/ea123518d624521f999e884ff32ddec0a5bf6bfa/apps/bff/src/context.ts#L19-L42).

BFF держит сессию в HttpOnly-cookie и обращается к Go по приватной сети с сервисным ключом. На SHA выкладки frontend процедуры входа, регистрации и выхода управляют cookie, а слой сессии обновляет access token и повторяет запрос к Go. [Сессия и размещение](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/architecture/index.md#L45-L49), [HTML, tRPC и cookie](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/architecture/index.md#L123-L132), [реализация сессии в выпуске](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/current-state.md#L33-L44), [session.ts](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/apps/bff/src/session/session.ts#L82).

BFF экранирует JSON bootstrap при встраивании в HTML. Экранирование относится к этому месту вывода; для содержимого блокнотов нужны безопасный DOM-вывод и изоляция HTML-результатов. [HTML-хендлер по срезу кода](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/frontend/bff.md#L22-L29), [границы защиты содержимого](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/security/csp.md#L131-L145), [html.ts на SHA среза](https://github.com/Cringe-Driven-Development-Team/frontend/blob/ea123518d624521f999e884ff32ddec0a5bf6bfa/apps/bff/src/html.ts#L21-L134).

Caddy добавляет CSP на участке проксирования BFF, браузер использует её для ограничения источников ресурсов и действий страницы. Шаблон принадлежит infra, а в гостевом прогоне наблюдался режим применения заголовка. Этот результат не охватывает блокировки отдельных ресурсов в браузере и работу HTML-результатов вычислений. [Настройка политики](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/security/csp.md#L14-L24), [границы HTTP-сверки](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/security/csp.md#L147-L159), [Caddyfile.j2](https://github.com/Cringe-Driven-Development-Team/infra/blob/a59f8584386810b0b94f5fb23cb72c7ff906f6d7/ansible/roles/caddy/templates/Caddyfile.j2#L7-L47).

[Архитектура запроса](mvp.md), [карта владельцев](../concepts/sources.md) и [навигация по wiki](../quickstart.md).
