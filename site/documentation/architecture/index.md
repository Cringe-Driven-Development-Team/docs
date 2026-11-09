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

Frontend проверяет типы, линтер, тесты, сборку клиента/BFF и Docker-образ в PR,
Merge Queue и `main`. После успешных проверок push в `main` публикует GitHub Release
`release-<SHA>`: образ BFF по digest, ассеты в S3/CDN и описание комплекта выпуска.
Публикация не выкатывает приложение и не зависит от `PRODUCTION_ENABLED`.
Подробно: [CI и публикация выпуска](/documentation/frontend/releases/publication).

Backend CI проверяет Go, runtime-agent и реальные Python/R kernels. На `main`
или при ручном запуске публикует образы; `PRODUCTION_ENABLED` управляет только CD.
Course-sync копирует `main` в учебные репозитории после проверок: у фронта — при
push в `main`, у бэка — дополнительно при включённом `COURSE_SYNC_ENABLED`.

Infra запускает проверки перед preview в PR и apply на `main`. Docs собирает
Pages с сохранёнными wiki. Frontend-packages публикует npm-пакеты через OIDC,
static загружает общую статику в S3.

Источники: [frontend CI](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/.github/workflows/ci.yml#L1),
[backend CI](https://github.com/Cringe-Driven-Development-Team/backend/blob/06841d4765c28ad7e52bf5e36df3b72cb22c094e/.github/workflows/ci.yml#L1),
[infra](https://github.com/Cringe-Driven-Development-Team/infra/blob/a59f8584386810b0b94f5fb23cb72c7ff906f6d7/.github/workflows/infra.yml#L1),
[npm](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/f4d2bd02fcc127e5603bbe09874242b071def7ba/.github/workflows/release.yml#L33),
[static](https://github.com/Cringe-Driven-Development-Team/static/blob/a0cea30d81d00f2e7d915b7fa0c92a25851b4e87/.github/workflows/ci.yml#L19),
[Pages](https://github.com/Cringe-Driven-Development-Team/docs/blob/24ac26396821dbb21a87ce0c377c59ea0a2ae118/.github/workflows/pages.yml#L1).

<Diagram name="ci" />

## Выкатка CD {#cd}

Frontend CD запускается вручную. Оператор указывает тег Release; пустое поле
выбирает ближайший опубликованный выпуск по first-parent истории обновлённого `main`
после ожидания очереди. До выкладки проверяются
комплект, digest образа и ассеты. Ansible обновляет BFF на gateway; затем проверяются
работающий образ, HTML и CDN. Rollback выбирает существующий выпуск из истории
production без пересборки. Инструкции: [выкатка](/documentation/frontend/releases/deployment)
и [откат](/documentation/frontend/releases/rollback).

Backend CD после успешного push/main при `PRODUCTION_ENABLED=true` получает
`backend@sha256:…` от CI. Ansible выкатывает этот digest на VPS2 через gateway,
сверяет образ и health контейнера, внутренний HTTP и внешний запрос через BFF.
Go применяет миграции PostgreSQL при старте. Откат приложения не откатывает БД.

Источники: [frontend CD](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/.github/workflows/cd.yml#L1),
[rollback](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/.github/workflows/rollback.yml#L1),
[backend CD](https://github.com/Cringe-Driven-Development-Team/backend/blob/06841d4765c28ad7e52bf5e36df3b72cb22c094e/.github/workflows/cd.yml#L1),
[проверки backend](https://github.com/Cringe-Driven-Development-Team/infra/blob/a59f8584386810b0b94f5fb23cb72c7ff906f6d7/ansible/deploy-backend.yml#L38),
[миграции](https://github.com/Cringe-Driven-Development-Team/backend/blob/06841d4765c28ad7e52bf5e36df3b72cb22c094e/internal/app/app.go#L77).

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
контур от PostgreSQL продукта. Документация и сохранённые OpenWiki публикуются через
GitHub Pages; генерацию wiki владелец запускает отдельно.

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
Реализация сверена 09.11.2026; источники и границы проверки — в
[разделе выкаток](/documentation/frontend/releases/).

<Diagram name="frontend-release-lifecycle" />

## Доставка фронта {#frontend-release-delivery}

Браузер получает HTML и API через Caddy/BFF, JS/CSS выпуска — через CDN/S3.
Образ GHCR скачивается при выкатке. Подробнее о файлах и идентификаторах —
[состав выпуска](/documentation/frontend/releases/artifacts).

<Diagram name="frontend-release-delivery" />
