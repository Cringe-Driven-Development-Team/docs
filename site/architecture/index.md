---
aside: false
---

# Архитектура работающего сервиса {#архитектура-mvp}

Срез **01.11.2026**: размещение и доступность компонентов проверены по SSH и HTTP.
Здесь показаны работающие процессы и настроенные связи; планы развития — в [модулях](/modules/).
[Проверка гостевого BFF](/documentation/bff) и [владельцы сведений](/project-context)
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

::: warning
`ci` и `cd` ниже ещё показывают историческую модель;
остальные четыре схемы обновлены по срезу 01.11.2026.
:::

Схемы хранятся в [`diagrams/`](https://github.com/Cringe-Driven-Development-Team/docs/tree/main/diagrams),
рендерятся eraser-diagrams. Масштаб — кнопками, Ctrl/⌘ + колесо или щипком;
схему можно двигать. Ссылка «HTML» открывает её целиком.

Замороженный вариант в меню не показывается, его схемы открываются по прямым адресам:

- k3s: <a href="../frozen-k3s/deployment.html" target="_self">deployment</a>,
  <a href="../frozen-k3s/ci.html" target="_self">ci</a>, <a href="../frozen-k3s/cd.html" target="_self">cd</a>,
  <a href="../frozen-k3s/integrations.html" target="_self">integrations</a>,
  <a href="../frozen-k3s/frontend-monorepo.html" target="_self">frontend-monorepo</a>.

## deployment

**Где работает сервис и как идёт запрос?** Браузер обращается к Caddy/BFF на gateway,
а BFF — к Go на VPS2. PostgreSQL и Redis находятся рядом с Go; auxiliary обслуживает
интеграции отдельно. JS/CSS выбранного выпуска и общая статика приходят с CDN.
Связь Go с S3 описывает конфигурацию, а не проверенный сценарий сохранения блокнота.

Источники: [Compose и разделение сервисов](https://github.com/Cringe-Driven-Development-Team/infra/blob/0a21f459dc2722d631b11cb9e82af5d3aa1c95ef/ansible/roles/app/templates/compose.yml.j2#L22-L149),
[Caddy и маршруты BFF](https://github.com/Cringe-Driven-Development-Team/infra/blob/0a21f459dc2722d631b11cb9e82af5d3aa1c95ef/ansible/roles/caddy/templates/Caddyfile.j2#L26-L42),
[upstream BFF](https://github.com/Cringe-Driven-Development-Team/frontend/blob/baf512e9a7bd7e5452554cdc89baa20e24aa7a32/apps/bff/src/go/fetch.ts#L8-L24).

<Diagram name="deployment" />

## ci

GitHub-репозитории, CI-пайплайны, проверка Contract drift, GHCR и S3.

<Diagram name="ci" />

## cd

Историческая схема до BFF: CD фронта через S3 и откат, выкладка статики в бакет за CDN, CD бэка через `ansible-playbook`.

<Diagram name="cd" />

## frontend

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

## contract

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

## infra

**Кто управляет инфраструктурой и служебными потоками?** Pulumi описывает облачные
ресурсы, state хранится в отдельном проекте; Ansible настраивает серверы и Compose.
Три постоянные VPS имеют разные роли. На auxiliary hooks использует SQLite/outbox
и отправляет уведомления через Telegram proxy; Restic обслуживает данные auxiliary.
Runtime включён в Go, его пользовательский сценарий остаётся непроверенным.
Docs/Pages экспортирует существующие wiki, генерацию владелец запускает вручную.

Источники: [распределение Ansible plays](https://github.com/Cringe-Driven-Development-Team/infra/blob/0a21f459dc2722d631b11cb9e82af5d3aa1c95ef/ansible/site.yml#L1-L30),
[auxiliary Compose](https://github.com/Cringe-Driven-Development-Team/infra/blob/0a21f459dc2722d631b11cb9e82af5d3aa1c95ef/ansible/roles/hooks/templates/compose.yml.j2#L1-L51),
[backup auxiliary](https://github.com/Cringe-Driven-Development-Team/infra/blob/0a21f459dc2722d631b11cb9e82af5d3aa1c95ef/ansible/roles/restic_backup/templates/restic-backup.service.j2#L3-L16),
[включение runtime](https://github.com/Cringe-Driven-Development-Team/infra/blob/0a21f459dc2722d631b11cb9e82af5d3aa1c95ef/ansible/inventory/group_vars/all/vars.yml#L75).

<Diagram name="infra" />
