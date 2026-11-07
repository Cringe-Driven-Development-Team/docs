# Хранение и инфраструктура блокнотов

Документ и результаты живут в PostgreSQL. Go управляет отдельной VPS сессии; agent запускает kernel в контейнере, а рабочие файлы kernel временные. Потеря окружения не означает удаления сохранённых ячеек и outputs.

::: info Проверено по коду
08.11.2026: backend/agent `a46aa8e`, infra `7242521`, frontend/BFF `0606aa6`. [Полные SHA](./). Размещение, изоляция и миграция на текущем проде не проверялись; ниже описана декларация и реализация.
:::

## Владельцы данных

| Данные | Владелец / хранение | Что сохраняется после остановки kernel |
| --- | --- | --- |
| Metadata, revision, preview, size | PostgreSQL `notebooks` | Сохраняются |
| Cell ID, position, source, source_version | PostgreSQL `notebook_cells` | Сохраняются |
| Outputs, count, truncated, attachments | PostgreSQL `notebook_cell_data` | Сохраняются применённые результаты |
| Сессии, команды, события, snapshots и projection jobs | PostgreSQL runtime-таблицы | История доступна независимо от живого агента |
| Admission и журнал агента | SQLite/state dir runtime-VPS | Доступны до удаления VPS; backend архивирует отдельно |
| Переменные kernel | Память процесса | Теряются при новом kernel |
| `/workspace`, `/tmp` | tmpfs контейнера | Теряются при уничтожении контейнера |

Источники: [cell schema](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/migrations/20261105120000_notebook_cells.sql#L1), [runtime schema](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/migrations/20261105080000_create_runtime_sessions.sql#L1), [agent journal](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/runtime-agent/src/runtime_agent/journal.py#L207), [container mounts](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/runtime-agent/src/runtime_agent/containers.py#L153).

Сохранение source блокирует строку notebook, проверяет revision и меняет затронутые ячейки, размеры, preview и revision одной транзакцией. Тяжёлые outputs/attachments при source-save не читаются; content читается в read-only repeatable-read, поэтому hash соответствует ячейкам. Полная сборка ipynb нужна на import/export boundary, а не при каждом PATCH. [Editing repository](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/internal/notebook/adapters/postgres/editing.go#L16), [content](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/internal/notebook/adapters/postgres/notebook.go#L145).

### S3 и миграция

Приватный notebook bucket остаётся в infra как часть прежней модели и offline migration. Текущий notebook repository подключён к PostgreSQL и не пишет содержимое в S3. S3 других подсистем, например аватаров, не меняет источник истины блокнотов. Runtime-agent не пишет ни notebook tables, ни notebook bucket. [Wiring app](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/internal/app/app.go#L97), [руководство миграции](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/docs/notebook-migration.md#L3).

Миграция — административный offline-процесс, не пользовательский import API. API отказывается запускаться при неперенесённых revision; инструкция требует переноса и verify, S3 автоматически не удаляется. Факт её выполнения на проде здесь неизвестен. [Проверка старых записей](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/internal/app/app.go#L101), [migration verify](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/docs/notebook-migration.md#L51).

### Список блокнотов

Backend читает компактные metadata, сортирует `updated_at DESC,id DESC`. Preview — первые шесть строк первой непустой code-ячейки, максимум 1024 Unicode code points; output-only save preview не меняет. `has_active_session` определяется одним запросом для списка, не опросом agent на каждую карточку. Однако frontend на этом SHA показывает одинаковый фиктивный PREVIEW_CODE и не отображает active badge: [#120](https://github.com/Cringe-Driven-Development-Team/frontend/issues/120) остаётся целью. [Preview backend](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/internal/notebook/domain/preview.go#L5), [список](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/internal/notebook/usecase/notebook.go#L20), [карточка frontend](https://github.com/Cringe-Driven-Development-Team/frontend/blob/0606aa6cb83b78a76f1e69816b2a6abd82dc20ee/apps/client/src/components/NotebookCard/NotebookCard.tsx#L14).

<DiagramSection>

## Размещение и сеть {#deployment}

Gateway содержит Caddy и BFF, backend-хост — Go API, PostgreSQL и Redis. Caddy направляет публичный трафик в BFF; Go API не является публичным upstream. BFF обращается к Go по приватной сети с сервисным ключом; PostgreSQL/Redis не публикуют host ports. [Caddy routes](https://github.com/Cringe-Driven-Development-Team/infra/blob/724252190e6758636626c70216391266f6ec5f31/ansible/roles/caddy/templates/Caddyfile.j2#L29), [Compose](https://github.com/Cringe-Driven-Development-Team/infra/blob/724252190e6758636626c70216391266f6ec5f31/ansible/roles/app/templates/compose.yml.j2#L76).

<template #diagram>

<Diagram name="notebooks-infrastructure" />

</template>

Схема — срез кода, не проверка текущей сети. Agent доступен backend через nginx с mTLS, а сам слушает loopback. Nginx проверяет сертификат и CN backend, проксирует WebSocket без buffering. [Nginx agent](https://github.com/Cringe-Driven-Development-Team/infra/blob/724252190e6758636626c70216391266f6ec5f31/ansible/runtime/roles/runtime_host/templates/nginx-agent.conf.j2#L8).

</DiagramSection>

## Кто создаёт окружение

Pulumi готовит общую инфраструктуру: учётную запись provisioner, security group, SSH keypair, CA/клиентский сертификат и ключ шифрования runtime credentials. **Отдельные VPS создаёт Go через OpenStack**, не отдельный Pulumi resource на каждую сессию. Go создаёт порт, загрузочный том и сервер, затем запускает Ansible с назначением сессии и артефактами; временные файлы операции удаляются, SSH проверяет host key. [Общие ресурсы](https://github.com/Cringe-Driven-Development-Team/infra/blob/724252190e6758636626c70216391266f6ec5f31/pulumi/index.ts#L866), [OpenStack adapter](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/internal/runtime/adapters/openstack/provider.go#L49), [Ansible runner](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/internal/runtime/adapters/ansible/runner.go#L79).

Playbook ждёт SSH/Python и cloud-init, ставит Docker, nginx, nftables и Python venv; wheel агента сверяется по SHA-256, зависимости закреплены. Systemd запускает агента с приватным state dir, NoNewPrivileges/ProtectSystem/ProtectHome/PrivateTmp и Restart=on-failure. Повтор настройки того же назначения не перезапускает активного агента; чужое назначение отвергается. Повторная установка не обещает восстановления живой памяти kernel. [Playbook](https://github.com/Cringe-Driven-Development-Team/infra/blob/724252190e6758636626c70216391266f6ec5f31/ansible/runtime/site.yml#L13), [agent install](https://github.com/Cringe-Driven-Development-Team/infra/blob/724252190e6758636626c70216391266f6ec5f31/ansible/runtime/roles/runtime_agent/tasks/main.yml#L2), [assignment](https://github.com/Cringe-Driven-Development-Team/infra/blob/724252190e6758636626c70216391266f6ec5f31/ansible/runtime/roles/runtime_agent/tasks/assignment.yml#L2).

## Изоляция kernel

Agent создаёт один контейнер назначенной сессии на отдельном Docker bridge, без host mounts и опубликованных портов. Jupyter доступен агенту с одноразовым token. Kernel работает не от root, с read-only root filesystem, dropped capabilities и no-new-privileges. Запись разрешена только в tmpfs `/workspace` и `/tmp`. [Container setup](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/runtime-agent/src/runtime_agent/containers.py#L121).

Runtime-VPS не получает floating IP. Security group допускает настройку и agent TLS от backend; firewall хоста отдельно контролирует исходящий трафик kernel. Разрешены DNS к заданному resolver и HTTP/HTTPS в публичный интернет после исключения внутренних, служебных и собственных инфраструктурных назначений. Новые kernel→host и межконтейнерные соединения запрещены, IPv6 закрыт. Правила проверяются до старта агента. Это механизм из исходников, а не результат сетевых проб или аудит изоляции. [Security group](https://github.com/Cringe-Driven-Development-Team/infra/blob/724252190e6758636626c70216391266f6ec5f31/pulumi/index.ts#L867), [firewall](https://github.com/Cringe-Driven-Development-Team/infra/blob/724252190e6758636626c70216391266f6ec5f31/ansible/runtime/roles/runtime_host/templates/firewall.nft.j2#L10), [проверка загрузки](https://github.com/Cringe-Driven-Development-Team/infra/blob/724252190e6758636626c70216391266f6ec5f31/ansible/runtime/roles/runtime_host/tasks/main.yml#L47).

## Лимиты по уровням {#limits}

| Уровень | Значение | Источник |
| --- | --- | --- |
| Документ | 1000 ячеек, 128 MiB компактного JSON целиком | [Notebook contract](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/internal/notebook/usecase/contract.go#L12) |
| Source | 65536 байт UTF-8, NUL/invalid UTF-8 отвергаются | [Editing validation](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/internal/notebook/usecase/editing.go#L11) |
| HTTP notebook | Body 512 KiB, включая chunked | [Body limit](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/internal/transport/http/middleware/body_limit.go#L14) |
| Backend queue | 1000 незавершённых команд с inspect | [Batch limit](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/internal/runtimesession/domain/batch.go#L7) |
| Agent queue | 100 ожидающих команд | [Agent admission](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/runtime-agent/src/runtime_agent/runtime.py#L157) |
| Execute | По умолчанию 300 с, диапазон 1–86400 с | [Models](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/internal/runtimesession/domain/models.go#L87) |
| Output | По умолчанию 10 MiB сериализованного JSON на execution | [Agent config](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/runtime-agent/src/runtime_agent/config.py#L38) |
| Idle / startup kernel / interrupt | 900 / 30 / 5 с по умолчанию | [Agent config](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/runtime-agent/src/runtime_agent/config.py#L38) |
| Kernel container | 1 GiB RAM, 1 CPU, 128 процессов; swap сверх RAM не добавлен | [Containers](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/runtime-agent/src/runtime_agent/containers.py#L168) |
| Kernel tmpfs | `/workspace` 256 MiB, `/tmp` 64 MiB | [Containers](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/runtime-agent/src/runtime_agent/containers.py#L178) |
| Весь provisioning | 3 активных runtime, startup VPS 20 мин, Ansible 15 мин, drain 30 с, удаление 10 мин, reconcile 5 мин — defaults | [Backend runtime config](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/internal/config/runtime.go#L107) |
| Agent HTTP | Body 2 MiB; внешний nginx допускает 16 MiB, что не отменяет внутреннего лимита | [Agent API](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/runtime-agent/src/runtime_agent/api.py#L61), [nginx](https://github.com/Cringe-Driven-Development-Team/infra/blob/724252190e6758636626c70216391266f6ec5f31/ansible/runtime/roles/runtime_host/templates/nginx-agent.conf.j2#L24) |

Лимит контейнера не равен ёмкости VPS. Default config не подтверждает live env. Idle не останавливает активную команду лишь по истечении 15 минут; [условия idle и остановки](./execution).

## Артефакты выпуска

Backend CI собирает Python/R kernel images, передаёт digest refs в образ Go. Образ содержит wheel агента, checksum, requirements и systemd unit. Infra доставляет runtime playbook на backend и монтирует его read-only; рабочие каталоги операций writable. Поэтому local image name из Go defaults не описывает штатный release. [CI](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/.github/workflows/ci.yml#L105), [Dockerfile](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/build/main.Dockerfile#L16), [доставка playbook](https://github.com/Cringe-Driven-Development-Team/infra/blob/724252190e6758636626c70216391266f6ec5f31/ansible/roles/app/tasks/main.yml#L72).

Python image основан на Python 3.13; requirements задают Jupyter server и ipykernel. Наличие готового NumPy/pandas/scikit-learn окружения отсюда не следует. Создание артефактов и декларация CD не подтверждают успешную выкладку исследованного SHA. [Python image](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/runtime-agent/images/python.Dockerfile#L1), [requirements](https://github.com/Cringe-Driven-Development-Team/backend/blob/a46aa8e1ec4e169af194be6c6eb05f92af85656a/runtime-agent/requirements-kernel.in#L1).
