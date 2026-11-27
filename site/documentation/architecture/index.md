---
aside: false
---

# Архитектура работающего сервиса {#архитектура-mvp}

Cellestial — SPA с клиентским рендерингом и отдельным BFF. Браузер получает HTML и
начальные данные от BFF, затем обращается к нему через tRPC. BFF вызывает Go API;
блокноты и результаты исполнения хранятся в PostgreSQL, сессии авторизации — в Redis,
аватары — в S3. Код пользователя выполняется в отдельном окружении runtime.

**Проверка 09.11.2026, 03:37 МСК.** Выпуски frontend и backend совпадают с их `main`
на момент сверки. Версии подтверждены журналами production CD; выпуск frontend
дополнительно проверен по HTML с публичного сайта.

| Компонент | Версия | Подтверждение |
| --- | --- | --- |
| Клиент и BFF | [`319e691`](https://github.com/Cringe-Driven-Development-Team/frontend/commit/319e691b79f81e09dcffabc04941831a5f4b5930) | [CD](https://github.com/Cringe-Driven-Development-Team/frontend/actions/runs/42538007203): образ, healthy, HTML и CDN; `/login` сейчас отдаёт ассеты этого SHA |
| Go API | [`06841d4`](https://github.com/Cringe-Driven-Development-Team/backend/commit/06841d4765c28ad7e52bf5e36df3b72cb22c094e) | [CD](https://github.com/Cringe-Driven-Development-Team/backend/actions/runs/42536140424/job/128901944399): digest работающего контейнера, healthy, внутренний HTTP и запрос через BFF |
| Инфраструктура | [`a59f858`](https://github.com/Cringe-Driven-Development-Team/infra/commit/a59f8584386810b0b94f5fb23cb72c7ff906f6d7) | [Production apply](https://github.com/Cringe-Driven-Development-Team/infra/actions/runs/42532217133) завершён успешно |

Публичные HTTP-проверки: `/login`, `/sw.js`, `/manifest.webmanifest` и `/offline.html`
возвращают `200`; `users.me` без `X-CSRF` — `403`, с `X-CSRF: 1` без сессии — `401`.
Ответ с HTML содержит `Cache-Control: private, no-store` и действующую CSP.

::: info Граница проверки
Прямой SSH при этой сверке недоступен; образ и health бэка подтверждены последним CD.
Авторизованные сценарии блокнотов и аватаров, создание и исполнение runtime-сессии,
сетевая изоляция runtime и восстановление из backup отдельно не проверены.
Схемы показывают устройство выложенного кода и конфигурации, а не результаты этих сценариев.
:::

## Доступ к серверам {#server-access}

| Машина | Роль | Домен | Подключение |
| --- | --- | --- | --- |
| VPS1 | gateway: Caddy и BFF | `cellestial.ru` | Прямой SSH |
| VPS2 | backend: Go API, PostgreSQL, Redis | Публичного домена нет | По приватной сети через VPS1 |
| VPS3 | auxiliary: служебные интеграции | `hooks.cellestial.ru` | Прямой SSH |

Для входа нужен пользователь `deploy` и личный авторизованный SSH-ключ.
Адреса и команды — в [скилле cellestial-ops](https://github.com/Cringe-Driven-Development-Team/agent-plugins-private/blob/main/plugins/cellestial-ops/skills/cellestial-ops/SKILL.md)
в приватном репозитории команды. Доступ к GitHub не выдаёт доступ к серверам.

## Размещение компонентов {#deployment}

Caddy принимает HTTPS на gateway и передаёт запросы BFF. BFF обращается к Go по
приватной сети с сервисным ключом; Go API, PostgreSQL и Redis не доступны браузеру
напрямую. PostgreSQL и Redis работают на backend VPS, а служебные интеграции — на auxiliary.

| Данные | Хранилище и путь |
| --- | --- |
| Пользователи, блокноты, ячейки, результаты и история исполнения | Go → PostgreSQL |
| Сессии авторизации и лимиты попыток входа/2FA | Go → Redis |
| Аватары | Go → S3; браузер читает `avatars.cellestial.ru` |
| JS/CSS выбранного выпуска | Браузер → CDN релизов → S3 релизов |
| Общие изображения и шрифты | Браузер → CDN статики → S3 статики |
| Service worker, manifest, иконки и офлайн-комплект | Браузер → Caddy → BFF |

Источники: [Compose](https://github.com/Cringe-Driven-Development-Team/infra/blob/a59f8584386810b0b94f5fb23cb72c7ff906f6d7/ansible/roles/app/templates/compose.yml.j2#L1),
[Caddy](https://github.com/Cringe-Driven-Development-Team/infra/blob/a59f8584386810b0b94f5fb23cb72c7ff906f6d7/ansible/roles/caddy/templates/Caddyfile.j2#L26),
[подключение хранилищ](https://github.com/Cringe-Driven-Development-Team/backend/blob/06841d4765c28ad7e52bf5e36df3b72cb22c094e/internal/app/app.go#L87),
[публичный домен аватаров](https://github.com/Cringe-Driven-Development-Team/infra/blob/a59f8584386810b0b94f5fb23cb72c7ff906f6d7/pulumi/index.ts#L683).

<Diagram name="deployment" />

## Проверки CI {#ci}

Frontend запускает Check на PR, Merge Queue и push в `main`. После Check на push
в `main` Publish release публикует GitHub Release, образ BFF по digest и ассеты
в S3/CDN. Оператор запускает выкладку отдельно. [CI фронтенда](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/ci.yml#L3-L65), [CI и публикация выпуска](/documentation/frontend/releases/publication).

Backend CI проверяет Go, runtime-agent и kernel. Для монолита образ приложения
и Release публикуются на push в `main`; образ Python kernel публикуется также
при ручном запуске. Course-sync копирует принятый `main` в учебные репозитории.
У backend нужен флаг `COURSE_SYNC_ENABLED=true`. [Образ и выпуск монолита](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/.github/workflows/ci.yml#L234-L304), [kernel](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/.github/workflows/ci.yml#L137-L163), [course-sync backend](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/.github/workflows/ci.yml#L306-L312), [course-sync frontend](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/ci.yml#L149-L162).

Infra запускает проверки перед preview в PR и apply на `main`. Docs публикует сайт
через Pages. Frontend-packages публикует npm-пакеты через OIDC, static загружает
общую статику в S3. [Infra](https://github.com/Cringe-Driven-Development-Team/infra/blob/ab7c4e189a2e346244b420f675adec7ced43557c/.github/workflows/infra.yml#L89-L216), [npm](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/872ffb6e01c13473867adfa6247e4e2d192f1c1b/.github/workflows/release.yml#L15-L43), [static](https://github.com/Cringe-Driven-Development-Team/static/blob/0cf8f4329408b9c7d970fbf30b5bd54e9f99d267/.github/workflows/ci.yml#L19-L53), [Pages](https://github.com/Cringe-Driven-Development-Team/docs/blob/8b12ddbb1ba47be5381181f1b334833f94b6fdf5/.github/workflows/pages.yml#L3-L29).

<Diagram name="ci" />

## Выкатка CD {#cd}

Оператор запускает CD фронтенда из `main`. Тег выбирает конкретный Release.
Пустое поле выбирает ближайший опубликованный выпуск по first-parent истории
обновлённого `main` после ожидания очереди. CD проверяет комплект, образ и ассеты,
затем Ansible переключает BFF. После Health check Actions сохраняет результат
в production Deployment. Rollback выбирает существующий выпуск из истории.
[CD](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/cd.yml#L47-L165), [Rollback](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/rollback.yml#L48-L148), [выкатка](/documentation/frontend/releases/deployment), [откат](/documentation/frontend/releases/rollback).

Для монолита backend при push в `main` и `PRODUCTION_ENABLED=true` CI передаёт
`release_tag` отдельному запуску CD. Тег определяет digest. Ansible обновляет
Go на VPS2 через gateway и проверяет образ, health контейнера и HTTP. Go
применяет миграции PostgreSQL при запуске. Эту цепочку подтверждает
[Deployment 7970701489](https://api.github.com/repos/Cringe-Driven-Development-Team/backend/deployments/7970701489/statuses)
со статусом `success` 21.11.2026 в 23:09:55 UTC для SHA
`3532ca97dc2c9d0f84aa999eae85918e76907aa7`. [Передача тега](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/.github/workflows/ci.yml#L278-L304), [CD](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/.github/workflows/cd.yml#L110-L136), [пробы Ansible](https://github.com/Cringe-Driven-Development-Team/infra/blob/ab7c4e189a2e346244b420f675adec7ced43557c/ansible/deploy-backend.yml#L62-L103), [миграции](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/app/app.go#L88-L90).

<Diagram name="cd" />

## Фронтенд {#frontend}

Монорепозиторий frontend объединяет `apps/client`, `apps/bff` и `packages/schemas`.
Клиент — компонентная SPA на командных React/router/zustand. Страницы и компоненты
отделены от общих сторов и API-транспорта; локальное состояние остаётся в компонентах.
Исходники библиотек и Vite BFF HTML plugin находятся в frontend-packages.

Рендеринг — CSR: BFF вставляет JSON bootstrap в HTML-шаблон, а браузер заполняет
сторы и строит интерфейс через `createRoot`. BFF управляет сессией в HttpOnly-cookie,
обслуживает tRPC и вызывает Go. HTML-шаблон и публичные PWA-файлы входят в образ BFF;
JS/CSS приложения загружаются с CDN своего выпуска.

Источники: [зависимости клиента](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/apps/client/package.json#L1),
[запуск](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/apps/client/src/main.tsx#L16),
[bootstrap](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/apps/bff/src/html.ts#L21),
[сессия](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/apps/bff/src/session/session.ts#L1),
[публичные файлы](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/apps/bff/src/public.ts#L3).
Подробнее — [устройство frontend](/documentation/frontend/) и [BFF](/documentation/frontend/bff).

<Diagram name="frontend" />

## Контракт и генерация {#contract}

Браузер и BFF связаны типизированными процедурами tRPC. BFF и Go связаны HTTP-контрактом
OpenAPI из Apidog: Orval генерирует fetch-client и Zod-схемы BFF, oapi-codegen — Go-код
и встроенную спецификацию. Генераторы работают с экспортированным snapshot.
Backend Contract drift повторяет генерацию и проверяет расхождение с репозиторием.

BFF не только пересылает запросы: `runtime.updates` собирает состояние сессии, очередь,
события и результаты нескольких исполнений в один ответ браузеру. Клиент получает
обновления опросом этой процедуры; потокового SSR здесь нет.

Источники: [Orval](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/orval.config.ts#L1),
[tRPC context](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/apps/bff/src/context.ts#L1),
[runtime.updates](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/apps/bff/src/router/runtime.ts#L59),
[опрос](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/apps/client/src/stores/runtime.ts#L271),
[backend drift](https://github.com/Cringe-Driven-Development-Team/backend/blob/06841d4765c28ad7e52bf5e36df3b72cb22c094e/.github/workflows/contract-drift.yml#L1).

<Diagram name="contract" />

## Инфраструктура {#infra}

Pulumi управляет облачными ресурсами, сетью, DNS, S3 и CDN; его state хранится в отдельном
проекте. Ansible настраивает серверы, Compose и runtime-окружения. На auxiliary работают
hooks, githubbot и Telegram proxy. Restic обслуживает данные auxiliary; это отдельный
контур от PostgreSQL продукта. Документация публикуется через GitHub Pages.

Источники: [Pulumi](https://github.com/Cringe-Driven-Development-Team/infra/blob/a59f8584386810b0b94f5fb23cb72c7ff906f6d7/pulumi/index.ts#L1),
[state](https://github.com/Cringe-Driven-Development-Team/infra/blob/a59f8584386810b0b94f5fb23cb72c7ff906f6d7/pulumi/bootstrap/index.ts#L15),
[auxiliary Compose](https://github.com/Cringe-Driven-Development-Team/infra/blob/a59f8584386810b0b94f5fb23cb72c7ff906f6d7/ansible/roles/hooks/templates/compose.yml.j2#L1),
[backup auxiliary](https://github.com/Cringe-Driven-Development-Team/infra/blob/a59f8584386810b0b94f5fb23cb72c7ff906f6d7/ansible/roles/restic_backup/templates/restic-backup.service.j2#L3).

<Diagram name="infra" />

## Блокноты: компоненты {#notebooks-components}

Go разделён на HTTP delivery, сценарии usecase, domain и адаптеры. Notebook repository
работает с PostgreSQL: `notebooks` хранит метаданные и редакцию, `notebook_cells` —
исходники и порядок, `notebook_cell_data` — outputs, execution count и attachments.
Редактирование и запись результатов выполняются транзакционно. Redis обслуживает
авторизацию, S3 — аватары; в пути чтения и сохранения блокнота S3 не участвует.

Runtime-сессии и история исполнения также сохраняются в PostgreSQL. Go provisioner
создаёт окружение через OpenStack и настраивает его Ansible. Go передаёт команды
runtime-agent, который управляет Jupyter/kernel; переменные и временные файлы живут
в окружении исполнения.

Источники: [сборка зависимостей](https://github.com/Cringe-Driven-Development-Team/backend/blob/06841d4765c28ad7e52bf5e36df3b72cb22c094e/internal/app/app.go#L101),
[хранение блокнотов](https://github.com/Cringe-Driven-Development-Team/backend/blob/06841d4765c28ad7e52bf5e36df3b72cb22c094e/docs/notebook-editing.md#L53),
[provisioning](https://github.com/Cringe-Driven-Development-Team/backend/blob/06841d4765c28ad7e52bf5e36df3b72cb22c094e/docs/runtime-provisioning.md#L1).
Подробнее — [блокноты](/documentation/notebooks/).

<Diagram name="notebooks-components" />

## Блокноты: инфраструктура {#notebooks-infrastructure}

Runtime-VPS создаётся для сессии отдельно от backend VPS. Подготовленный образ содержит
Docker, nginx, nftables и окружение агента; Ansible проверяет версию образа и применяет
настройки конкретной сессии. Go обращается к nginx по mTLS, nginx — к агенту на loopback.
Агент хранит служебное состояние в SQLite на хосте и запускает kernel в контейнере
с ограничениями ресурсов, read-only root и временными файловыми системами.

Постоянные данные блокнотов остаются в PostgreSQL. Notebook bucket сохранён в infra как
архив вне рабочего пути приложения.

Источники: [runtime playbook](https://github.com/Cringe-Driven-Development-Team/infra/blob/a59f8584386810b0b94f5fb23cb72c7ff906f6d7/ansible/runtime/site.yml#L1),
[проверка образа и firewall](https://github.com/Cringe-Driven-Development-Team/infra/blob/a59f8584386810b0b94f5fb23cb72c7ff906f6d7/ansible/runtime/roles/runtime_host/tasks/main.yml#L1),
[nginx/mTLS](https://github.com/Cringe-Driven-Development-Team/infra/blob/a59f8584386810b0b94f5fb23cb72c7ff906f6d7/ansible/runtime/roles/runtime_host/templates/nginx-agent.conf.j2#L1),
[архивный бакет](https://github.com/Cringe-Driven-Development-Team/infra/blob/a59f8584386810b0b94f5fb23cb72c7ff906f6d7/ansible/inventory/group_vars/all/vars.yml#L60).
Подробнее — [хранение и изоляция](/documentation/notebooks/storage-and-infrastructure).

<Diagram name="notebooks-infrastructure" />

## Выпуск фронта {#frontend-release-lifecycle}

Готовый комплект в GitHub Releases связывает файлы S3/CDN и образ GHCR. Ручной CD
создаёт отдельный production Deployment и проверяет результат переключения BFF.
Пример из GitHub за 27.11.2026, источники и команды приведены в
[разделе выкаток](/documentation/frontend/releases/).

<Diagram name="frontend-release-lifecycle" />

## Доставка фронта {#frontend-release-delivery}

Браузер получает HTML и API через Caddy/BFF, JS/CSS выпуска — через CDN/S3.
Образ GHCR скачивается при выкатке. Подробнее о файлах и идентификаторах —
[состав выпуска](/documentation/frontend/releases/artifacts).

<Diagram name="frontend-release-delivery" />
