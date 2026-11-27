---
aside: false
---

# Архитектура работающего сервиса {#архитектура-mvp}

Cellestial обслуживает браузер через Caddy и BFF. BFF отдаёт HTML и HTTP API, а Go на backend хранит блокноты и управляет окружениями для вычислений. [Маршруты BFF](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/bff/src/app.ts#L30-L66), [подключение Go-модулей](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/app/app.go#L108-L136).

| Компонент | Версия | Свидетельство |
| --- | --- | --- |
| Клиент и BFF | [`b1baf996`](https://github.com/Cringe-Driven-Development-Team/frontend/commit/b1baf996fb6753d1a62eab6f874d03dca30faadc) | [Production Deployment 8118066244](https://api.github.com/repos/Cringe-Driven-Development-Team/frontend/deployments/8118066244/statuses) получил `success` 27.11.2026 в 19:45:23 UTC. Гостевой HTML `/login` 28.11.2026 в 02:18:48 МСК (UTC+03:00) содержал ассеты этого выпуска. [HTTP-проверки](/documentation/current-state#что-подтверждено-на-проде) |
| Go API | [`3532ca9`](https://github.com/Cringe-Driven-Development-Team/backend/commit/3532ca97dc2c9d0f84aa999eae85918e76907aa7) | [Production Deployment 7970701489](https://api.github.com/repos/Cringe-Driven-Development-Team/backend/deployments/7970701489/statuses) получил последний подтверждённый `success` 21.11.2026 в 23:09:55 UTC. [Попытка 8116451615](https://api.github.com/repos/Cringe-Driven-Development-Team/backend/deployments/8116451615/statuses) для `cc4ea079` завершилась 27.11.2026 в 18:10:47 UTC ошибкой внешней проверки BFF. Активная ревизия Go после этой попытки не установлена. [Лог CD](https://github.com/Cringe-Driven-Development-Team/backend/actions/runs/46046649107) |
| Инфраструктура | [`b8f6d2d8`](https://github.com/Cringe-Driven-Development-Team/infra/commit/b8f6d2d81410f70ec5af642cb486d37b0b0f5412) | [Production apply 46079576340](https://github.com/Cringe-Driven-Development-Team/infra/actions/runs/46079576340) завершился 27.11.2026 в 23:15:53 UTC |

Схемы опираются на исходники этих ревизий и конфигурацию. Авторизованные сценарии, запуск runtime, изоляция и восстановление резервных копий не проверены. [Границы наблюдений](/documentation/current-state), [безопасность](/documentation/security/).

## Доступ к серверам {#server-access}

| Сервер | Роль | Домен |
| --- | --- | --- |
| VPS1 | gateway, Caddy и BFF | `cellestial.ru` |
| VPS2 | backend, Go API, PostgreSQL и Redis | Приватная сеть, SSH через VPS1 |
| VPS3 | auxiliary, служебные интеграции | `hooks.cellestial.ru` |

Для SSH нужен личный ключ и пользователь `deploy`. Доступом управляет команда эксплуатации. [Правила SSH и доступ к VPS2](https://github.com/Cringe-Driven-Development-Team/infra/blob/b8f6d2d81410f70ec5af642cb486d37b0b0f5412/ansible/README.md#L209-L211). Устройство серверов задают [стек infra](https://github.com/Cringe-Driven-Development-Team/infra/blob/b8f6d2d81410f70ec5af642cb486d37b0b0f5412/pulumi/index.ts#L12-L30) и [Compose](https://github.com/Cringe-Driven-Development-Team/infra/blob/b8f6d2d81410f70ec5af642cb486d37b0b0f5412/ansible/roles/app/templates/compose.yml.j2#L1-L25).

## Размещение компонентов {#deployment}

Caddy принимает HTTPS и передаёт BFF запросы за HTML, HTTP API `/api/*` и публичными файлами. BFF вызывает Go API с сервисным ключом через mTLS-прокси на VPS2 по приватной сети. Прокси передаёт запрос Go API по HTTP. Go API обращается к PostgreSQL, Redis и S3. [Caddy](https://github.com/Cringe-Driven-Development-Team/infra/blob/b8f6d2d81410f70ec5af642cb486d37b0b0f5412/ansible/roles/caddy/templates/Caddyfile.j2#L53-L75), [Compose](https://github.com/Cringe-Driven-Development-Team/infra/blob/b8f6d2d81410f70ec5af642cb486d37b0b0f5412/ansible/roles/app/templates/compose.yml.j2#L75-L117), [адрес Go в BFF](https://github.com/Cringe-Driven-Development-Team/infra/blob/b8f6d2d81410f70ec5af642cb486d37b0b0f5412/ansible/roles/app/defaults/main.yml#L7-L9), [nginx на VPS2](https://github.com/Cringe-Driven-Development-Team/infra/blob/b8f6d2d81410f70ec5af642cb486d37b0b0f5412/ansible/roles/app/templates/api-proxy.conf.j2#L8-L32), [TLS и ключ BFF](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/bff/src/go/fetch.ts#L13-L26).

| Данные | Хранилище и путь |
| --- | --- |
| Пользователи, блокноты, ячейки, результаты и история исполнения | Go → PostgreSQL |
| Сессии авторизации и лимиты попыток | Go → Redis |
| Аватары | Go → S3. Браузер читает через `avatars.cellestial.ru` |
| JS/CSS выпуска | Браузер → CDN релизов → S3 релизов |
| Общие картинки и шрифты | Браузер → CDN статики → S3 статики |
| Service worker, manifest, иконки и офлайн-комплект | Браузер → Caddy → BFF |

[Хранилища Go](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/app/app.go#L92-L136), [файлы BFF](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/bff/src/public.ts#L3-L27), [CDN и бакеты](https://github.com/Cringe-Driven-Development-Team/infra/blob/b8f6d2d81410f70ec5af642cb486d37b0b0f5412/pulumi/index.ts#L33-L59).

<Diagram name="deployment" />

## Проверки CI {#ci}

Frontend запускает Check на PR, Merge Queue и push в `main`. После Check на push
в `main` Publish release публикует GitHub Release, образ BFF по digest и ассеты
в S3/CDN. Оператор запускает выкладку отдельно. [CI фронтенда](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/ci.yml#L3-L65), [CI и публикация выпуска](/documentation/frontend/releases/publication).

На проверенной ревизии `backend/main` (`73ac7e02`) классификатор находит точки входа Identity, Workspace и Environments и выбирает `services`. `service-checks` собирает три образа и проверяет OpenAPI, Protobuf и взаимодействие по HTTP и gRPC. После проверок и подготовки Python kernel задача `publish-services` на push в `main` публикует Release v2 с образами сервисов. Python kernel публикуется на push в `main` и при ручном запуске. [Классификатор](https://github.com/Cringe-Driven-Development-Team/backend/blob/73ac7e02f2ad04fec7e6227a2e1f022b33d41994/scripts/classify-backend-source.sh#L10-L20), [сборка образов](https://github.com/Cringe-Driven-Development-Team/backend/blob/73ac7e02f2ad04fec7e6227a2e1f022b33d41994/.github/workflows/service-checks.yml#L10-L55), [проверки контрактов и сервисов](https://github.com/Cringe-Driven-Development-Team/backend/blob/73ac7e02f2ad04fec7e6227a2e1f022b33d41994/.github/workflows/service-checks.yml#L112-L121), [публикация Release v2](https://github.com/Cringe-Driven-Development-Team/backend/blob/73ac7e02f2ad04fec7e6227a2e1f022b33d41994/.github/workflows/ci.yml#L331-L360), [kernel](https://github.com/Cringe-Driven-Development-Team/backend/blob/73ac7e02f2ad04fec7e6227a2e1f022b33d41994/.github/workflows/ci.yml#L147-L185).

В [CI выпуска `73ac7e02`](https://github.com/Cringe-Driven-Development-Team/backend/actions/runs/46081858757) задача `Publish microservice release` завершилась успешно 27.11.2026 в 23:28:54 UTC. Задача `dispatch-cd` была пропущена.

Course-sync копирует принятый `main` в учебные репозитории. У backend нужен флаг `COURSE_SYNC_ENABLED=true`. [Course-sync backend](https://github.com/Cringe-Driven-Development-Team/backend/blob/73ac7e02f2ad04fec7e6227a2e1f022b33d41994/.github/workflows/ci.yml#L362-L372), [course-sync frontend](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/ci.yml#L149-L162).

Infra запускает проверки перед preview в PR и apply на `main`. Docs публикует сайт
через Pages. Frontend-packages публикует npm-пакеты через OIDC, static загружает
общую статику в S3. [Infra](https://github.com/Cringe-Driven-Development-Team/infra/blob/b8f6d2d81410f70ec5af642cb486d37b0b0f5412/.github/workflows/infra.yml#L89-L216), [npm](https://github.com/Cringe-Driven-Development-Team/frontend-packages/blob/872ffb6e01c13473867adfa6247e4e2d192f1c1b/.github/workflows/release.yml#L15-L43), [static](https://github.com/Cringe-Driven-Development-Team/static/blob/0cf8f4329408b9c7d970fbf30b5bd54e9f99d267/.github/workflows/ci.yml#L19-L53), [Pages](https://github.com/Cringe-Driven-Development-Team/docs/blob/8b12ddbb1ba47be5381181f1b334833f94b6fdf5/.github/workflows/pages.yml#L3-L29).

<Diagram name="ci" />

## Выкатка CD {#cd}

Оператор запускает CD фронтенда из `main`. Тег выбирает конкретный Release.
Пустое поле выбирает ближайший опубликованный выпуск по first-parent истории
обновлённого `main` после ожидания очереди. CD проверяет комплект, образ и ассеты,
затем Ansible переключает BFF. После Health check Actions сохраняет результат
в production Deployment. Rollback выбирает существующий выпуск из истории.
[CD](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/cd.yml#L47-L165), [Rollback](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/rollback.yml#L48-L148), [выкатка](/documentation/frontend/releases/deployment), [откат](/documentation/frontend/releases/rollback).

В последней подтверждённой выкладке монолита backend (`3532ca9`) CI на push в `main` при `PRODUCTION_ENABLED=true` передал `release_tag` отдельному запуску CD. По тегу CD определил digest, Ansible обновил Go на VPS2 через gateway и проверил образ, здоровье контейнера и HTTP. Go применяет миграции PostgreSQL при запуске. Выкладку подтверждает
[Deployment 7970701489](https://api.github.com/repos/Cringe-Driven-Development-Team/backend/deployments/7970701489), который записал SHA playbook в `payload.infra_sha`. [Статус попытки](https://api.github.com/repos/Cringe-Driven-Development-Team/backend/deployments/7970701489/statuses) стал `success` 21.11.2026 в 23:09:55 UTC для SHA
`3532ca97dc2c9d0f84aa999eae85918e76907aa7`. [Передача тега](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/.github/workflows/ci.yml#L278-L304), [CD](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/.github/workflows/cd.yml#L110-L136), [пробы Ansible](https://github.com/Cringe-Driven-Development-Team/infra/blob/da8cdc6da73cd12abcc8b562f4aafed3efedd5da/ansible/deploy-backend.yml#L18-L72), [миграции](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/app/app.go#L88-L90).

В проверенном `backend/main` автоматический запуск монолитного CD выполняется для `source_kind=monolith`. [Условие запуска](https://github.com/Cringe-Driven-Development-Team/backend/blob/73ac7e02f2ad04fec7e6227a2e1f022b33d41994/.github/workflows/ci.yml#L310-L325).

<Diagram name="cd" />

## Фронтенд {#frontend}

BFF вставляет bootstrap в HTML. Клиент читает данные до первого рендера, заполняет сторы и запускает SPA через `createRoot`. После запуска запросы браузера идут в HTTP API BFF. Клиент и BFF входят в один выпуск. [HTML и bootstrap](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/bff/src/html.ts#L107-L141), [запуск клиента](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/main.tsx#L15-L39), [маршрутизация API](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/bff/src/app.ts#L30-L66).

[Архитектура frontend](/documentation/frontend/architecture), [BFF](/documentation/frontend/bff), [сессия](/documentation/frontend/session), [командные пакеты](/documentation/frontend/packages).

<Diagram name="frontend" />

## Контракт HTTP {#contract}

| Граница | Источник контракта |
| --- | --- |
| Браузер → BFF, `/api/*` | Объявления `route({...})` в BFF. Клиент импортирует выведенный тип `BffPaths`. [Маршруты и типы](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/bff/src/http.ts#L9-L90), [экспорт](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/bff/src/types.ts#L1-L13) |
| Выложенный BFF → Go, `/api/v1` | Копия [`spec/openapi.json` в backend](https://github.com/Cringe-Driven-Development-Team/backend/blob/947a19ccf4319a621007b2900aa8e620ca27762b/spec/openapi.json#L1-L15) на SHA из [манифеста выпуска](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/spec/contract-source.json#L1-L5). Этот SHA определяет копию контракта, а активный образ Go проверяется через выкладку |
| Разработка на проверенных `main` владельцев | [`spec/identity/openapi.json`](https://github.com/Cringe-Driven-Development-Team/backend/blob/29e5ef56133c6fc42cd2cce3b5ecb379b457c6b8/spec/identity/openapi.json#L1-L15) и [`spec/workspace/openapi.json`](https://github.com/Cringe-Driven-Development-Team/backend/blob/29e5ef56133c6fc42cd2cce3b5ecb379b457c6b8/spec/workspace/openapi.json#L1-L15) принадлежат backend. Frontend [скачивает и сверяет копию по SHA](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/openapi/backend.ts#L50-L87) |

В HTTP-границах действуют ручные проверки входов BFF и ответов Go. По изменению OpenAPI команда frontend обновляет TypeScript-типы, вызовы и проверки. [Обновление спеки и интеграционная проверка](/documentation/frontend/bff#apidog-orval-и-схемы), [валидаторы маршрутов](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/bff/src/http.ts#L174-L200), [проверка ответа Go](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/bff/src/go/errors.ts#L45-L79).

<Diagram name="contract" />

## Инфраструктура {#infra}

Pulumi задаёт сеть, серверы, DNS, S3 и CDN в Selectel. State хранится в S3 отдельного проекта. Ansible настраивает серверы, Compose и окружения runtime. [Стек](https://github.com/Cringe-Driven-Development-Team/infra/blob/b8f6d2d81410f70ec5af642cb486d37b0b0f5412/pulumi/index.ts#L12-L23), [проект state](https://github.com/Cringe-Driven-Development-Team/infra/blob/b8f6d2d81410f70ec5af642cb486d37b0b0f5412/pulumi/bootstrap/index.ts#L15-L24), [шаги apply и verify](https://github.com/Cringe-Driven-Development-Team/infra/blob/b8f6d2d81410f70ec5af642cb486d37b0b0f5412/.github/workflows/infra.yml#L255-L285), [подготовка runtime-VPS](https://github.com/Cringe-Driven-Development-Team/infra/blob/b8f6d2d81410f70ec5af642cb486d37b0b0f5412/ansible/README.md#L799-L808).

На auxiliary работают hooks, githubbot и Telegram proxy. Restic сохраняет резервные копии auxiliary в выделенный S3-бакет. [Compose auxiliary](https://github.com/Cringe-Driven-Development-Team/infra/blob/b8f6d2d81410f70ec5af642cb486d37b0b0f5412/ansible/roles/hooks/templates/compose.yml.j2#L19-L66), [Restic](https://github.com/Cringe-Driven-Development-Team/infra/blob/b8f6d2d81410f70ec5af642cb486d37b0b0f5412/ansible/roles/restic_backup/templates/restic-backup.service.j2#L3-L16), [бакет auxiliary](https://github.com/Cringe-Driven-Development-Team/infra/blob/b8f6d2d81410f70ec5af642cb486d37b0b0f5412/pulumi/auxiliary.ts#L125-L138).

<Diagram name="infra" />

## Блокноты: компоненты {#notebooks-components}

Go хранит метаданные, ячейки, результаты и записи runtime-сессий в PostgreSQL. Изменения исходников и структуры двигают редакцию содержимого. Запись отдельного результата в рассмотренной ревизии Go сохраняет текущий `hash`. [Редакция содержимого](/documentation/notebooks/editing#revision), [транзакция результата](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/notebook/adapters/postgres/results.go#L40-L109), [слои и хранилища](/documentation/notebooks/storage-and-infrastructure).

<Diagram name="notebooks-components" />

## Блокноты: инфраструктура {#notebooks-infrastructure}

Go создаёт runtime-VPS по сессии через OpenStack и настраивает его Ansible. Команды идут через nginx с mTLS к локальному runtime-agent. Агент управляет kernel-контейнером с ограничениями ресурсов. Постоянные результаты хранятся в PostgreSQL. [Провайдер Go](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtime/adapters/openstack/provider.go#L49), [прокси агента](https://github.com/Cringe-Driven-Development-Team/infra/blob/b8f6d2d81410f70ec5af642cb486d37b0b0f5412/ansible/runtime/roles/runtime_host/templates/nginx-agent.conf.j2#L8), [контейнер kernel](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/runtime-agent/src/runtime_agent/containers.py#L96-L136). [Окружение и запуск](/documentation/notebooks/execution), [размещение, изоляция и лимиты](/documentation/notebooks/storage-and-infrastructure), [ответы и вывод ячеек](/documentation/notebooks/results).

<Diagram name="notebooks-infrastructure" />

## Выпуск фронта {#frontend-release-lifecycle}

GitHub Release связывает ассеты S3/CDN и образ GHCR. Отдельный production Deployment фиксирует исход CD после Health check. [Процесс, пример и команды](/documentation/frontend/releases/).

<Diagram name="frontend-release-lifecycle" />

## Доставка фронта {#frontend-release-delivery}

Браузер получает HTML и API через Caddy/BFF, JS/CSS выпуска — через CDN/S3. Образ GHCR скачивается при выкатке. [Файлы и идентификаторы выпуска](/documentation/frontend/releases/artifacts).

<Diagram name="frontend-release-delivery" />
