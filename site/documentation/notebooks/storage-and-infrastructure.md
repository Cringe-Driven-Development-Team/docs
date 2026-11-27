# Хранение и инфраструктура блокнотов {#хранение-и-инфраструктура-блокнотов}

PostgreSQL хранит документ и применённые результаты. Go управляет временной runtime-VPS, где агент запускает процесс kernel в контейнере. Переменные и рабочие файлы окружения имеют собственный срок жизни. [Схема ячеек](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/migrations/20261105120000_notebook_cells.sql#L1), [схема сессий](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/migrations/20261105080000_create_runtime_sessions.sql#L1), [тома kernel](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/runtime-agent/src/runtime_agent/containers.py#L73-L136). [Ревизии и статус проверки](./#существенные-разрывы).

## Владельцы данных {#владельцы-данных}

| Данные | Владелец и срок хранения |
| --- | --- |
| Метаданные, редакция и preview | Go, PostgreSQL `notebooks` |
| ID, порядок, source и его версия | Go, PostgreSQL `notebook_cells` |
| Вывод, счётчик, сокращение и вложения ячеек | Go, PostgreSQL `notebook_cell_data` |
| Сессии, очереди, снимки и события | Go, runtime-таблицы PostgreSQL |
| Журнал агента | SQLite на runtime-VPS. Локальная часть удаляется вместе с VPS. |
| Переменные Python | Память процесса. Теряются с kernel. |
| Рабочие файлы | Диск runtime-VPS для `/workspace` при штатном подключении. Файлы теряются вместе с VPS. Временные тома очищаются при удалении контейнера. |

Метаданные, содержимое, применённый вывод и собранная история остаются в PostgreSQL после удаления окружения.

[Схема ячеек](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/migrations/20261105120000_notebook_cells.sql#L1), [runtime-таблицы](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/migrations/20261105080000_create_runtime_sessions.sql#L1), [журнал](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/runtime-agent/src/runtime_agent/journal.py#L40), [контейнер](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/runtime-agent/src/runtime_agent/containers.py#L73-L136), [подготовка диска](https://github.com/Cringe-Driven-Development-Team/infra/blob/686218395ad12e5752af312d18f32efc508d55ea/ansible/runtime/roles/runtime_host/tasks/workspace.yml#L34-L63).

Правки берут блокировку строки блокнота и меняют затронутые данные в транзакции. Чтение содержимого возвращает ячейки и `hash` из одного согласованного снимка PostgreSQL. [Запись](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/notebook/adapters/postgres/editing.go#L16-L64), [чтение](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/notebook/adapters/postgres/notebook.go#L159-L198).

### S3 и архив {#s3-и-миграция}

Рабочий путь записей проходит через PostgreSQL. Исторический S3-архив блокнотов удалён из конфигурации инфраструктуры. S3 остаётся отдельным хранилищем других данных, например аватаров. [Руководство infra](https://github.com/Cringe-Driven-Development-Team/infra/blob/686218395ad12e5752af312d18f32efc508d55ea/ansible/README.md#L105-L112), [запись ячеек](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/notebook/adapters/postgres/editing.go#L16-L64).

### Список блокнотов {#список-блокнотов}

Go читает компактные метаданные и сортирует по `updated_at DESC, id DESC`. Карточка показывает серверный preview и состояние по `has_active_session`. [Запрос списка](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/notebook/adapters/postgres/list.go#L13-L63), [карточка](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/components/NotebookCard/NotebookCard.tsx#L30-L71).

## Размещение и сеть {#deployment}

Схема и ссылки ниже опираются на снимок infra `6862183` от 27.11.2026, 22:11:43 UTC. Более поздний apply `b8f6d2d8` добавил в Caddy настройки сбора метрик. [Размещение после apply](/documentation/architecture/#deployment), [сравнение ревизий](https://github.com/Cringe-Driven-Development-Team/infra/compare/686218395ad12e5752af312d18f32efc508d55ea...b8f6d2d81410f70ec5af642cb486d37b0b0f5412).

Gateway принимает публичный HTTPS через Caddy и передаёт запросы BFF. BFF обращается к Go через mTLS-прокси на приватной сети. Go и PostgreSQL находятся на backend-хосте. Отдельный nginx на runtime-VPS принимает mTLS от Go и передаёт запросы агенту на loopback. [Публичные маршруты](https://github.com/Cringe-Driven-Development-Team/infra/blob/686218395ad12e5752af312d18f32efc508d55ea/ansible/roles/caddy/templates/Caddyfile.j2#L27), [Compose и mTLS](https://github.com/Cringe-Driven-Development-Team/infra/blob/686218395ad12e5752af312d18f32efc508d55ea/ansible/roles/app/templates/compose.yml.j2#L76-L117), [прокси агента](https://github.com/Cringe-Driven-Development-Team/infra/blob/686218395ad12e5752af312d18f32efc508d55ea/ansible/runtime/roles/runtime_host/templates/nginx-agent.conf.j2#L8).

<Diagram name="notebooks-infrastructure" />

## Кто создаёт окружение {#кто-создает-окружение}

1. Pulumi создаёт общие ресурсы провайдера, включая сеть доступа для runtime.
2. По запросу на запуск Go создаёт отдельную VPS через OpenStack, используя подготовленный образ.
3. Go запускает Ansible для назначения сессии. Playbook сверяет версию образа, готовит дисковый workspace и проверяет артефакт агента.
4. Агент получает конфигурацию сессии и поднимает контейнер kernel.

[Ресурсы Pulumi](https://github.com/Cringe-Driven-Development-Team/infra/blob/686218395ad12e5752af312d18f32efc508d55ea/pulumi/runtime.ts#L70-L150), [провайдер Go](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtime/adapters/openstack/provider.go#L49), [запуск Ansible](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtime/adapters/ansible/runner.go#L79), [проверка образа и workspace](https://github.com/Cringe-Driven-Development-Team/infra/blob/686218395ad12e5752af312d18f32efc508d55ea/ansible/runtime/roles/runtime_host/tasks/main.yml#L2-L17), [подготовка workspace](https://github.com/Cringe-Driven-Development-Team/infra/blob/686218395ad12e5752af312d18f32efc508d55ea/ansible/runtime/roles/runtime_host/tasks/main.yml#L145-L146), [установка агента](https://github.com/Cringe-Driven-Development-Team/infra/blob/686218395ad12e5752af312d18f32efc508d55ea/ansible/runtime/roles/runtime_agent/tasks/main.yml#L24), [контейнер](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/runtime-agent/src/runtime_agent/containers.py#L96-L136).

## Изоляция kernel {#изоляция-kernel}

Контейнер запускается от непривилегированного пользователя, с read-only root, ограничениями ресурсов и выделенной bridge-сетью. Дисковый workspace подключается отдельным bind mount. Если в настройках агента путь к дисковому workspace не задан, `/workspace` размещается в tmpfs. `/tmp` используется как домашняя и временная директория, `/packages` — как пользовательский каталог для Python-пакетов. Оба размещаются в tmpfs. Firewall регулирует DNS и исходящий HTTP(S), блокирует внутренние назначения. Эти свойства описывают настройки исходников. [Контейнер](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/runtime-agent/src/runtime_agent/containers.py#L73-L136), [сетевая политика](https://github.com/Cringe-Driven-Development-Team/infra/blob/686218395ad12e5752af312d18f32efc508d55ea/ansible/runtime/roles/runtime_host/templates/firewall.nft.j2#L10).

## Лимиты {#limits}

| Уровень | Значение в коде |
| --- | --- |
| Source | 65 536 байт UTF-8. [Лимит](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/notebook/usecase/contract.go#L14-L18) |
| Документ | 1000 ячеек и 128 MiB сериализованного документа. [Лимиты](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/notebook/usecase/contract.go#L11-L18) |
| JSON-запрос блокнота | 512 KiB. Импорт имеет собственную проверку. [Middleware](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/transport/http/middleware/body_limit.go#L14-L47) |
| Очередь Go | 1000 незавершённых команд. [Лимит очереди](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtimesession/domain/batch.go#L7-L8) |
| Timeout команды | По умолчанию 300 с. Допустимый диапазон 1–86 400 с. [Валидация](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtimesession/domain/models.go#L87-L95), [значение по умолчанию](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/internal/runtimesession/usecase/session.go#L57-L65) |
| Очередь агента | 100 ожидающих команд. [Допуск](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/runtime-agent/src/runtime_agent/session.py#L120-L140) |
| Агент | 10 MiB сериализованного вывода, idle 900 с, старт kernel 120 с, ожидание interrupt 5 с по умолчанию. [Конфигурация](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/runtime-agent/src/runtime_agent/config.py#L20-L30) |
| Контейнер | 1 GiB RAM, 1 CPU и 128 процессов. [Конфигурация](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/runtime-agent/src/runtime_agent/containers.py#L116-L136) |
| Диск `/workspace` | ФС 5 GiB по умолчанию. [Настройка диска](https://github.com/Cringe-Driven-Development-Team/infra/blob/686218395ad12e5752af312d18f32efc508d55ea/ansible/runtime/roles/runtime_host/defaults/main.yml#L36) |
| `/workspace` без заданного пути к диску | tmpfs 256 MiB. [Резервный том](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/runtime-agent/src/runtime_agent/containers.py#L73-L107) |
| `/tmp` | tmpfs 256 MiB. [Размер и HOME](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/runtime-agent/src/runtime_agent/containers.py#L100-L136) |
| `/packages` | tmpfs 512 MiB. [Размер и PYTHONUSERBASE](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/runtime-agent/src/runtime_agent/containers.py#L100-L136) |
| Передача файла через API | До 3 GiB на один upload или download. Для более крупных файлов список убирает действие `download`. Запись из kernel ограничивается доступным местом в файловой системе. [Лимит передачи](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/runtime-agent/src/runtime_agent/config.py#L9-L10), [проверки API](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/runtime-agent/src/runtime_agent/workspace_transfers.py#L208-L248), [действия списка](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/runtime-agent/src/runtime_agent/workspace_listing.py#L24-L36) |

## Артефакты выпуска {#артефакты-выпуска}

Образ Go содержит wheel агента, контрольную сумму и закреплённые зависимости. Playbook runtime поставляется через infra и монтируется в контейнер Go для подготовки новой VPS. Версии артефактов в успешной выкладке и текущий код окружения указаны в [свидетельствах](./#существенные-разрывы). [Dockerfile](https://github.com/Cringe-Driven-Development-Team/backend/blob/3532ca97dc2c9d0f84aa999eae85918e76907aa7/build/main.Dockerfile#L1-L31), [настройки backend](https://github.com/Cringe-Driven-Development-Team/infra/blob/686218395ad12e5752af312d18f32efc508d55ea/ansible/roles/app/templates/compose.yml.j2#L32-L74), [доставка playbook](https://github.com/Cringe-Driven-Development-Team/infra/blob/686218395ad12e5752af312d18f32efc508d55ea/ansible/roles/app/tasks/main.yml#L72).
