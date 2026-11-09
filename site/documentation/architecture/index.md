---
aside: false
---

# Архитектура работающего сервиса {#архитектура-mvp}

Срез **01.11.2026**: размещение и доступность компонентов проверены по SSH и HTTP.
Исторические схемы этого среза показывают работающие процессы и настроенные связи; планы развития — в [модулях](/modules/).
[Проверка гостевого BFF](/documentation/frontend/bff#bff-проверенная-часть) и [владельцы сведений](/documentation/project-context)
помогают перейти от схемы к каноническому описанию и нужному репозиторию.

| Где | Что работает | Граница |
| --- | --- | --- |
| gateway | Caddy и BFF | HTTPS, HTML и `/api/trpc`; Go и БД отсюда вынесены |
| VPS2 | Go API, PostgreSQL 18, Redis 8 | Go доступен BFF по приватной сети; БД и Redis не публикуют host-порты |
| auxiliary | Caddy, hooks, Telegram proxy | Служебные интеграции отдельно от пользовательского запроса |
| S3 / CDN | Релизные JS/CSS, статика и продуктовые бакеты | Наличие и конфигурация подтверждены; пользовательский CRUD не проверен |
| GitHub Pages | Документация и OpenWiki | Отдельная публикация знаний, не часть запроса приложения |

**Свидетельства проверки.** На gateway запущены только Caddy/BFF; на VPS2 контейнеры
Go/PostgreSQL/Redis healthy, `pg_isready` и Redis ping успешны. GET `/health` Go
с gateway — `200`. Публичный `/login` с `Accept: text/html` — `200`;
GET `/api/trpc/users.me` без `X-CSRF` — `403`, с `X-CSRF: 1` без сессии — `401`.

| Компонент | Проверенная выложенная версия | Подтверждение |
| --- | --- | --- |
| BFF | [`baf512e9`](https://github.com/Cringe-Driven-Development-Team/frontend/commit/baf512e9a7bd7e5452554cdc89baa20e24aa7a32) | Revision и digest живого контейнера, SSH 01.11.2026 |
| Go API | [`6e1a0d81`](https://github.com/Cringe-Driven-Development-Team/backend/commit/6e1a0d81bc284e87aa4a9561d7b65eee835a26c3) | [Успешный CI/CD](https://github.com/Cringe-Driven-Development-Team/backend/actions/runs/41302004065), затем образ `sha-6e1a0d8`, healthy и HTTP `200` по SSH |

Digest BFF:

```text
sha256:26205cff0bdfd9c1d74e9f23557d8c931c724b9573ee49ce1b6eec3748c233f3
```

::: info Границы проверки
Авторизованные сценарии — вход, работа с блокнотами, refresh/logout — не проверены
этим срезом. `RUNTIME_ENABLED=true` в живом Go подтверждает включённый механизм,
но создание, исполнение и удаление runtime-VPS не проверены. Восстановление продукта
из backup также не проверено; backup auxiliary не доказывает backup PostgreSQL.
SHA исходников подтверждает реализацию, а наблюдение на выложенной версии — только
явно названный сценарий. Более свежий main сам по себе не обновляет это свидетельство.
:::

Дополнительно ниже приведены две схемы блокнотов **по исходникам 08.11.2026**. Они не обновляют свидетельство проверки прода от 01.11.2026.

Схемы хранятся в [`diagrams/`](https://github.com/Cringe-Driven-Development-Team/docs/tree/main/diagrams),
рендерятся eraser-diagrams. Масштаб — кнопками, Ctrl/⌘ + колесо или щипком;
схему можно двигать. Ссылка «HTML» открывает её целиком.

## Доступ к серверам {#server-access}

Три постоянные VPS имеют разные роли и маршруты подключения:

| Машина | Роль | Домен | Подключение |
| --- | --- | --- | --- |
| VPS1 | gateway | `cellestial.ru` | Прямой вход по SSH |
| VPS2 | backend | Публичного домена нет | По приватной сети через VPS1 (gateway) |
| VPS3 | auxiliary | `hooks.cellestial.ru` | Прямой вход по SSH |

Для входа используется пользователь `deploy` и личный авторизованный SSH-ключ
участника. Доступ к репозиториям сам по себе не выдаёт доступ к серверам.

Актуальные IP-адреса, подготовка ключа, команды подключения и особенности Happ/VPN
собраны в [скилле `cellestial-ops`](https://github.com/Cringe-Driven-Development-Team/agent-plugins-private/blob/main/plugins/cellestial-ops/skills/cellestial-ops/SKILL.md)
в приватном репозитории команды; для чтения нужен GitHub-доступ участника.
Успешный вход по SSH подтверждает доступ к машине, а работоспособность приложения
проверяется отдельным сценарием.

## Размещение компонентов {#deployment}

**Где работает сервис и как идёт запрос?** Браузер обращается к Caddy/BFF на gateway,
а BFF — к Go на VPS2. PostgreSQL и Redis находятся рядом с Go; auxiliary обслуживает
интеграции отдельно. JS/CSS выбранного выпуска и общая статика приходят с CDN.
Связь Go с S3 описывает конфигурацию, а не проверенный сценарий сохранения блокнота.

Источники: [Compose и разделение сервисов](https://github.com/Cringe-Driven-Development-Team/infra/blob/0a21f459dc2722d631b11cb9e82af5d3aa1c95ef/ansible/roles/app/templates/compose.yml.j2#L22-L149),
[Caddy и маршруты BFF](https://github.com/Cringe-Driven-Development-Team/infra/blob/0a21f459dc2722d631b11cb9e82af5d3aa1c95ef/ansible/roles/caddy/templates/Caddyfile.j2#L26-L42),
[upstream BFF](https://github.com/Cringe-Driven-Development-Team/frontend/blob/baf512e9a7bd7e5452554cdc89baa20e24aa7a32/apps/bff/src/go/fetch.ts#L8-L24).

<Diagram name="deployment" />

## Проверки CI {#ci}

**Кто что проверяет и публикует?** Frontend CI проверяет код. После успешного Check на
push в main job Publish release публикует BFF-образ в GHCR, файлы клиента в S3/CDN и
готовый GitHub Release с четырьмя Assets. Порядок и повторы описаны в
[CI и публикации](/documentation/frontend/releases/publication).
Backend CI проверяет Go/runtime-agent/kernel images; публикация образов выполняется
при push/main или `workflow_dispatch` независимо от `PRODUCTION_ENABLED`, который
ограничивает production deploy.
Публикация артефактов отделена от production CD. Course-sync копирует main командных
frontend/backend в учебные репозитории при включённом `COURSE_SYNC_ENABLED`.
В infra общие checks предшествуют двум отдельным путям: preview в PR и apply
при push/main или ручном запуске на main. Docs собирает Pages и экспортирует существующие wiki. Frontend-packages публикует библиотеки/Vite plugin через npm OIDC,
static загружает собственную статику в S3.

Источники: [frontend checks/publish](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/.github/workflows/ci.yml#L23-L147),
[backend jobs и course-sync](https://github.com/Cringe-Driven-Development-Team/backend/blob/6e1a0d81bc284e87aa4a9561d7b65eee835a26c3/.github/workflows/ci.yml#L17-L254),
[npm publishing](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/fa65157b5f6957fbf30fa2ebd4b3b75af19cc955/.github/workflows/release.yml#L33-L90),
[static Check/Upload](https://github.com/Cringe-Driven-Development-Team/static/blob/a0cea30d81d00f2e7d915b7fa0c92a25851b4e87/.github/workflows/ci.yml#L19-L52),
[Pages: подготовка, экспорт и deploy](https://github.com/Cringe-Driven-Development-Team/docs/blob/8bfd2e2519d6602f44dc88e2576a5e4f3908fca9/.github/workflows/pages.yml#L60-L122),
[infra preview/apply](https://github.com/Cringe-Driven-Development-Team/infra/blob/0a21f459dc2722d631b11cb9e82af5d3aa1c95ef/.github/workflows/infra.yml#L78-L190).

<Diagram name="ci" />

## Выкатка CD {#cd}

**Как выпуск становится работающим релизом?** Frontend CD запускается вручную через
`workflow_dispatch`: выбирает опубликованный GitHub Release, проверяет manifest, BFF digest
и CDN, создаёт отдельный production Deployment, вызывает Ansible и проверяет результат.
Пустое поле выбирает выпуск по обновлённой first-parent истории main; полный тег фиксирует
конкретный выбор. [Инструкция CD](/documentation/frontend/releases/deployment#selection).
Rollback выбирает цель по истории production и проверяет её Release без пересборки:
[правила отката](/documentation/frontend/releases/rollback#target).
Сам main CI frontend не выкладывает. Описание frontend CI/CD сверено с кодом 09.11.2026;
новая проверка production здесь не выполнялась.
Backend CD после успешного main CI при `PRODUCTION_ENABLED=true` вызывает Ansible
и обновляет Go на приватной VPS2 через SSH gateway; после backend #64 этот маршрут
проверен успешной выкладкой и SSH-сверкой работающего образа.
Миграции PostgreSQL выполняет Go при запуске. Откат BFF не откатывает БД.
Infra Pulumi/Ansible управляет ресурсами и конфигурацией отдельно от этих выпусков.

Источники: [ручной frontend CD](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/.github/workflows/cd.yml#L3-L158),
[rollback](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/.github/workflows/rollback.yml#L3-L143),
[backend CD и known_hosts для jump](https://github.com/Cringe-Driven-Development-Team/backend/blob/6e1a0d81bc284e87aa4a9561d7b65eee835a26c3/.github/workflows/cd.yml#L14-L81),
[выбор backend-хоста](https://github.com/Cringe-Driven-Development-Team/infra/blob/0a21f459dc2722d631b11cb9e82af5d3aa1c95ef/ansible/deploy-backend.yml#L1-L37),
[миграции при старте Go](https://github.com/Cringe-Driven-Development-Team/backend/blob/6e1a0d81bc284e87aa4a9561d7b65eee835a26c3/internal/app/app.go#L43-L67).

<Diagram name="cd" />

## Фронтенд {#frontend}

**Где менять frontend и его зависимости?** Репозиторий frontend содержит `apps/client`,
`apps/bff` и `packages/schemas`. Клиент использует командные React/router/zustand.
Их исходники и Vite BFF HTML plugin принадлежат отдельному репозиторию frontend-packages,
который публикует npm-пакеты; frontend потребляет версии этих пакетов.
BFF отдаёт HTML с bootstrap и обслуживает tRPC, ведёт сессию и вызывает Go.
HTML-шаблон входит в образ BFF, а JS/CSS выпуска загружаются через CDN.
Это описание реализации; успешные авторизованные сценарии не подтверждены срезом.

Источники: [зависимости клиента и Vite plugin](https://github.com/Cringe-Driven-Development-Team/frontend/blob/baf512e9a7bd7e5452554cdc89baa20e24aa7a32/apps/client/package.json#L14-L22),
[маршруты HTML/tRPC](https://github.com/Cringe-Driven-Development-Team/frontend/blob/baf512e9a7bd7e5452554cdc89baa20e24aa7a32/apps/bff/src/app.ts#L20-L55),
[серверная сессия](https://github.com/Cringe-Driven-Development-Team/frontend/blob/baf512e9a7bd7e5452554cdc89baa20e24aa7a32/apps/bff/src/session/session.ts#L18-L36),
[публикация библиотек](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/fa65157b5f6957fbf30fa2ebd4b3b75af19cc955/.github/workflows/release.yml#L33-L90).

<Diagram name="frontend" />

## Контракт и генерация {#contract}

**Какие контракты связывают стороны?** Браузер работает с BFF через tRPC;
BFF вызывает Go по HTTP-контракту OpenAPI из Apidog. Go использует oapi-codegen,
а Orval создаёт fetch-client и Zod-схемы для BFF. Эти генераторы читают экспортированный
snapshot, а не обращаются к Apidog при каждом пользовательском запросе.
Backend Contract drift заново генерирует контракт и сравнивает его с репозиторием;
отдельный frontend drift workflow в проверенном срезе отсутствует.
Генерация, совпадение типов и drift не доказывают выкладку или работу пользовательского сценария.

Источники: [Orval: клиент и Zod](https://github.com/Cringe-Driven-Development-Team/frontend/blob/baf512e9a7bd7e5452554cdc89baa20e24aa7a32/orval.config.ts#L3-L23),
[CSRF и контекст tRPC](https://github.com/Cringe-Driven-Development-Team/frontend/blob/baf512e9a7bd7e5452554cdc89baa20e24aa7a32/apps/bff/src/context.ts#L15-L31),
[вызов Go](https://github.com/Cringe-Driven-Development-Team/frontend/blob/baf512e9a7bd7e5452554cdc89baa20e24aa7a32/apps/bff/src/go/fetch.ts#L8-L24),
[backend drift](https://github.com/Cringe-Driven-Development-Team/backend/blob/6e1a0d81bc284e87aa4a9561d7b65eee835a26c3/.github/workflows/contract-drift.yml#L1-L40).

<Diagram name="contract" />

## Инфраструктура {#infra}

**Кто управляет инфраструктурой и служебными потоками?** Pulumi описывает облачные
ресурсы, state хранится в отдельном проекте; Ansible настраивает серверы и Compose.
Три постоянные VPS имеют разные роли. На auxiliary hooks использует SQLite/outbox
и отправляет уведомления через Telegram proxy; Restic обслуживает данные auxiliary.
Runtime включён в Go, его пользовательский сценарий остаётся непроверенным.
Docs/Pages экспортирует существующие wiki, генерацию владелец запускает вручную.

Источники: [распределение Ansible plays](https://github.com/Cringe-Driven-Development-Team/infra/blob/0a21f459dc2722d631b11cb9e82af5d3aa1c95ef/ansible/site.yml#L1-L30),
[auxiliary Compose](https://github.com/Cringe-Driven-Development-Team/infra/blob/0a21f459dc2722d631b11cb9e82af5d3aa1c95ef/ansible/roles/hooks/templates/compose.yml.j2#L1-L51),
[backup auxiliary](https://github.com/Cringe-Driven-Development-Team/infra/blob/0a21f459dc2722d631b11cb9e82af5d3aa1c95ef/ansible/roles/restic_backup/templates/restic-backup.service.j2#L3-L16),
[включение runtime](https://github.com/Cringe-Driven-Development-Team/infra/blob/0a21f459dc2722d631b11cb9e82af5d3aa1c95ef/ansible/inventory/group_vars/all/vars.yml#L75),
[проект и бакет state](https://github.com/Cringe-Driven-Development-Team/infra/blob/0a21f459dc2722d631b11cb9e82af5d3aa1c95ef/pulumi/bootstrap/index.ts#L15-L74),
[ресурсы и backup bucket](https://github.com/Cringe-Driven-Development-Team/infra/blob/0a21f459dc2722d631b11cb9e82af5d3aa1c95ef/pulumi/index.ts#L785-L832),
[OpenStack runtime adapter](https://github.com/Cringe-Driven-Development-Team/backend/blob/6e1a0d81bc284e87aa4a9561d7b65eee835a26c3/internal/runtime/adapters/openstack/provider.go#L38-L100),
[очередь и Telegram proxy](https://github.com/Cringe-Driven-Development-Team/.github/blob/515352beac1a5a3ae98140121ca40e25f9551707/services/webhook-alerts/README.md#L3-L29).

<Diagram name="infra" />

## Блокноты: компоненты {#notebooks-components}

Срез исходников 08.11.2026; прод не проверен. [Версии, роли и путь данных](/documentation/notebooks/) объясняют браузер → Caddy → BFF → Go, PostgreSQL и отдельный runtime. Историческая S3-модель блокнотов в старых схемах не описывает этот repository.

<Diagram name="notebooks-components" />

## Блокноты: инфраструктура {#notebooks-infrastructure}

Срез исходников 08.11.2026; сеть на проде не проверена. [Хранение и изоляция](/documentation/notebooks/storage-and-infrastructure) отделяют постоянный PostgreSQL от временных файлов kernel, описывают provisioning и mTLS.

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
