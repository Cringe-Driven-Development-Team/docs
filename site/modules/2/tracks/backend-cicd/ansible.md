---
title: "Ansible и VPS"
---

[← Обзор трека](../backend-cicd) · [Выкатка](./release) · [Откат](./rollback)

# От digest до работающего API

::: info План, ещё не внедрено
Единый контракт backend workflow и Ansible задают [backend#42](https://github.com/Cringe-Driven-Development-Team/backend/issues/42)
и [infra#69](https://github.com/Cringe-Driven-Development-Team/infra/issues/69).
Сейчас playbook принимает тег; ниже описан переход на digest.
:::

## Граница между workflow и Ansible

Backend workflow отвечает за выбор версии: при обычной выкатке берёт digest
только что опубликованного образа, при откате — digest прежнего успешного
production Deployment. До доступа к VPS он проверяет цель в GHCR. В обоих
случаях playbook получает один вход:

```text
backend_image_ref=ghcr.io/cringe-driven-development-team/backend@sha256:<64 hex>
```

Ansible повторно проверяет, что ссылка указывает на разрешённый backend
package и содержит полный digest, а не тег. Это граница ответственности:
workflow выбирает **что** разворачивать, Ansible выполняет **как** разворачивать
на единственной VPS. Токен GHCR и SSH-данные остаются секретами production
environment, их значения не записываются в документацию или карточку.

## Что делает playbook

1. С временной авторизацией GHCR скачивает выбранный образ по digest. Если
   образ недоступен, не переписывает конфигурацию запущенного API; авторизация
   очищается и при ошибке.
2. Передаёт тот же `backend_image_ref` в Compose и запускает API из уже
   скачанного образа. Compose не выбирает заново изменяемый SHA-тег.
3. Ждёт `healthy` контейнера и проверяет публичный API через HTTPS. Для
   `/api/v1/users/me` без авторизации ожидается JSON с HTTP 401.
4. Workflow читает фактически запущенный контейнер и сопоставляет его образ
   с выбранным digest. Только подтверждённый итог становится статусом
   GitHub Deployment и карточкой в Backend / Releases.

Перед переключением таким же наблюдением фиксируется прежний работающий
образ. Значение в `.env` или прежнее Telegram-сообщение не доказывает, какой
контейнер сейчас выполняется. Если VPS недоступна или состояние нельзя
прочитать, результат показывается как «неизвестно», без выдуманного перехода
между версиями.

## Исходное состояние

Сейчас [cd.yml](https://github.com/Cringe-Driven-Development-Team/backend/blob/186b618c492a0f2ace73f9c6b705e69ffa058b27/.github/workflows/cd.yml#L69-L80)
передаёт `backend_image_tag`, а [шаблон Compose](https://github.com/Cringe-Driven-Development-Team/infra/blob/db55a0ac2f9f1b023fb853fe3e8c00d1b0646b7f/ansible/roles/app/templates/compose.yml.j2#L18-L20)
добавляет его к имени образа. [Роль app](https://github.com/Cringe-Driven-Development-Team/infra/blob/db55a0ac2f9f1b023fb853fe3e8c00d1b0646b7f/ansible/roles/app/tasks/main.yml#L5-L59)
пишет Compose-конфигурацию до скачивания образа. Изменение порядка и
входа `backend_image_ref` относится к infra#69; сама карточка релиза и
GitHub Deployment — к backend#42.

Откат образа не меняет схему или данные PostgreSQL.
