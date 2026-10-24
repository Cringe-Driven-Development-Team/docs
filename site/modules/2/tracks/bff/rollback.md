---
title: Откат
---

[← Трек BFF](../bff) · [Как проходит выкатка](./release) · [Серверный bootstrap](./bootstrap)

# Ручной откат BFF

::: info План, ещё не внедрено
Это целевой ручной workflow из [frontend#4](https://github.com/Cringe-Driven-Development-Team/frontend/issues/4)
и контракт образа из [infra#74](https://github.com/Cringe-Driven-Development-Team/infra/issues/74).
Сейчас [rollback.yml](https://github.com/Cringe-Driven-Development-Team/frontend/blob/495981555390f39995bd3ab296b1f6a6e37577c8/.github/workflows/rollback.yml#L1-L53)
меняет S3-указатель; он ещё не возвращает образ BFF.
:::

## Как выбрать прежний выпуск

В начале ручного отката workflow через Ansible делает **чтение состояния VPS без изменений**. В проекте
Compose `/opt/cellestial` он получает ID запущенного контейнера сервиса `bff` командой
`docker compose ps --status=running -q bff` и требует ровно один ID. Затем `docker inspect` этого
контейнера возвращает `Config.Image` — ссылку, с которой контейнер создали, — и `Image` — локальный
ID используемого образа, а также `State.Health.Status`. Ссылка должна иметь вид
`ghcr.io/cringe-driven-development-team/bff@sha256:…`.
Команда `docker image inspect` по **этой ссылке** должна вернуть тот же локальный image ID. Так
workflow связывает digest из ссылки с образом работающего контейнера. Локальный image ID и digest
GHCR — разные идентификаторы; сравнивать их строки напрямую нельзя.

Полученный digest workflow сопоставляет с `image_ref` в истории успешных production Deployments и
находит предыдущий успешный Deployment с **другим** digest. У записи `ref` — полный SHA выбранного
BFF, в `payload` — точный `image_ref` и каталог ассетов. Успешный `release-artifacts` Deployment
связывает тот же SHA с исходным CI run и CDN-путём. Сообщение Telegram, запись Deployment и
текущая строка в `.env` показывают намерение или прошлый результат, но не заменяют чтение контейнера.

Если запущенного BFF нет, контейнеров несколько, ссылка не закреплена digest, локальные image ID
расходятся, работающий образ не сопоставляется с историей, нет прежнего успешного выпуска или цель
неоднозначна, workflow останавливается до изменения VPS и сообщает подтверждённое состояние. Здоровье
контейнера показывается отдельно: нездоровый BFF всё ещё можно опознать и откатить.

Шаги чтения опираются на команды [Compose ps](https://docs.docker.com/reference/cli/docker/compose/ps/)
и [Docker inspect](https://docs.docker.com/reference/cli/docker/inspect).

## Проверка и переключение

```mermaid
flowchart TD
    START["Оператор запускает ручной workflow"] --> CONTAINER["VPS: Compose ps находит один работающий bff"]
    CONTAINER --> ACTUAL["Docker inspect: Config.Image и Image; сверить локальный image ID"]
    ACTUAL --> MATCH{"Образ найден в истории Deployments?"}
    MATCH -- "Нет" --> STOP["Остановиться; сообщить фактическое состояние"]
    MATCH -- "Да" --> PREV["Выбрать предыдущий success с другим digest"]
    PREV --> TARGET{"Цель однозначна?"}
    TARGET -- "Нет" --> STOP
    TARGET -- "Да" --> CHECK["Сверить release-artifacts, GHCR digest, SHA и CDN"]
    CHECK --> READY{"Выпуск доступен?"}
    READY -- "Нет" --> STOP
    READY -- "Да" --> DEP["Создать Deployment для старого SHA"]
    DEP --> ANS["Тот же deploy-bff.yml: digest и SHA"]
    ANS --> VERIFY["Проверить образ, healthy, HTML, RPC и CDN"]
    VERIFY --> OK{"Проверки прошли?"}
    OK -- "Да" --> SUCCESS["Deployment success; подтвердить переход"]
    OK -- "Нет" --> FAILURE["Deployment failure; сообщить известное состояние"]
```

1. В общей с CD и retention группе `production` сверить целевой SHA и digest с успешным
   `release-artifacts` Deployment, проверить доступность digest в GHCR, совпадение
   `org.opencontainers.image.revision` с SHA и сохранность JS/CSS в CDN. Старый тег или S3-указатель
   не заменяют эти проверки.
2. Создать новый GitHub Deployment для **целевого старого SHA**, с действием `rollback`, точным
   `image_ref`, каталогом ассетов и ссылкой на run отката. SHA запуска workflow на `main` не является
   версией BFF. Автоматическую запись от environment job отключить; для старого SHA задать
   `auto_merge: false`.
3. Передать `bff_image_ref` и `bff_release_sha` в тот же `deploy-bff.yml`, что используется при
   обычной выкатке. Ansible скачивает образ до изменения Compose, запускает BFF с его прежним HTML
   и ждёт `healthy`. Go при этом не переключается.
4. После переключения сверить образ контейнера с выбранным digest, метку выпуска и bootstrap в
   публичном HTML, защищённый RPC и доступность ассетов этого SHA. Только тогда новый Deployment
   получает `success`, а уведомление показывает подтверждённый переход. При ошибке workflow
   сообщает этап сбоя и известное фактическое состояние; неизвестную версию называет «неизвестно».

Откат не происходит автоматически. Кнопка «Откатить» в Telegram лишь открывает страницу ручного
workflow. Провал проверки после переключения не превращается в успех из-за того, что команда Ansible
завершилась без ошибки.

## Что остаётся доступным

Retention сохраняет последние пять клиентских выпусков, а сверх них ассеты фактически запущенного
BFF и предыдущего успешного Deployment независимо от возраста. Если состояние VPS неизвестно,
потенциально нужные ассеты не удаляются. Иначе старый образ сможет вернуться, но его HTML будет
ссылаться на уже удалённые JS/CSS.

`SESSION_KEY` при обычной выкатке и откате остаётся прежним, поэтому действующая сессионная cookie
читается новым запуском BFF. Откат BFF не откатывает Go API, миграции и данные PostgreSQL;
совместимость выбранного BFF с текущим Go оценивается отдельно.
