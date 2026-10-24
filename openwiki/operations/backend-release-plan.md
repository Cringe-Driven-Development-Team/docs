---
type: workflow
title: План выкладки и отката Go API
description: Целевой поток выпуска образа бэка через GHCR, GitHub Deployments и Ansible, ручной откат и граница с текущим исходным состоянием.
tags: [backend, release, rollback, deployment, ansible]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-24T17:01:28.502Z
sources:
  - id: openwiki-source-97eec6de22a65e701a2efd60
    resource: repo://site/modules/2/tracks/backend-cicd.md
  - id: openwiki-source-1536869ef4619948b98fdbfb
    resource: repo://site/modules/2/tracks/backend-cicd/ansible.md
  - id: openwiki-source-cc4c61bf520e4f3a68b24b1e
    resource: repo://site/modules/2/tracks/backend-cicd/deployments.md
  - id: openwiki-source-81c6a9a702148b134d9b3e5e
    resource: repo://site/modules/2/tracks/backend-cicd/release.md
  - id: openwiki-source-d2c5ee71e51dd1d82d80c017
    resource: repo://site/modules/2/tracks/backend-cicd/rollback.md
generated: { by: "codex", at: "2026-10-24T17:01:28.502Z" }
---

# План релиза бэка во втором модуле

Это **план**, изложенный в [треке «Доработки CI/CD бэка»](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/site/modules/2/tracks/backend-cicd.md#L1-L15) и [дизайн-документе](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/docs/superpowers/specs/2026-10-24-backend-release-module-design.md#L1-L9). Он связывает задачи backend#42 и infra#69; страницы модуля не подтверждают, что поток уже реализован или работает в production. Для факта реализации нужен актуальный код компонентов, для состояния production — проверка стенда. [Правила источников](../concepts/sources.md).

## Как должен проходить выпуск

После проверок CI job `docker` должен один раз собрать и опубликовать образ Go API в GHCR. Полный Git SHA обозначает исходный коммит; тег `sha-<полный SHA>` служит для поиска; digest фиксирует опубликованный артефакт. Output сборки передаёт digest в CD, а для запуска Ansible получает `backend_image_ref` с **digest**, потому что тег может быть перезаписан. Отдельная таблица в Go API для связи SHA и образа в этом плане не предусмотрена. [Выкатка: идентификаторы и шаги](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/site/modules/2/tracks/backend-cicd/release.md#L15-L37).

Если `PRODUCTION_ENABLED` допускает запуск, CD входит в environment `production`; выкатка и ручной откат используют одну concurrency-группу. CD явно создаёт GitHub Deployment с `ref` **целевого SHA** и digest образа в `payload`. Для environment job план предусматривает `deployment: false`, чтобы автоматическая запись GitHub не дублировала явную. Статус `success` появляется лишь после проверки образа фактически запущенного контейнера, состояния `healthy` и ответа публичного API через HTTPS; успешное исполнение Ansible само по себе недостаточно. [Выкатка](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/site/modules/2/tracks/backend-cicd/release.md#L27-L45), [Deployments](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/site/modules/2/tracks/backend-cicd/deployments.md#L38-L58).

Граница ответственности проходит по `backend_image_ref`: workflow выбирает и проверяет образ, Ansible повторно проверяет backend package и полный digest, скачивает образ **до** изменения Compose-конфигурации, затем запускает API. Плановая проверка `/api/v1/users/me` без авторизации ожидает JSON и HTTP 401. Значения секретов и параметры доступа остаются в production environment. [Ansible и VPS](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/site/modules/2/tracks/backend-cicd/ansible.md#L15-L43).

## Ручной откат и границы результата

Оператор должен запустить Rollback workflow на `main` и указать полный SHA прежней версии. Кандидат берётся из **успешного production Deployment**, а не из последнего коммита или Telegram-сообщения. До доступа к VPS workflow проверяет SHA, digest разрешённого package и доступность образа; при разных успешных digest для одного SHA отклоняет неоднозначную цель. Telegram-кнопка только открывает workflow. [Выбор прежнего релиза](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/site/modules/2/tracks/backend-cicd/rollback.md#L15-L27).

После предварительной проверки откат использует тот же playbook и те же условия подтверждения, что обычная выкатка. SHA запуска workflow на `main` не равен обязательно SHA выбранного старого образа; в новом Deployment `ref` должен указывать на **целевой SHA образа**. При сбое карточка показывает только подтверждённое состояние либо «неизвестно» и ссылку на логи. Сбой отправки уведомления не меняет уже проверенный результат выкатки. Автоматический откат не входит в план; откат образа не откатывает схему и данные PostgreSQL. [Откат и исходы](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/site/modules/2/tracks/backend-cicd/rollback.md#L29-L56), [запись Deployment](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/site/modules/2/tracks/backend-cicd/deployments.md#L15-L36).

## Что подтверждено на исходных снимках

Сам модуль приводит [backend CI на `186b618…`](https://github.com/Cringe-Driven-Development-Team/backend/blob/186b618c492a0f2ace73f9c6b705e69ffa058b27/.github/workflows/ci.yml#L98-L149): он публикует короткий SHA-тег и передаёт тег в CD. [CD на том же SHA](https://github.com/Cringe-Driven-Development-Team/backend/blob/186b618c492a0f2ace73f9c6b705e69ffa058b27/.github/workflows/cd.yml#L11-L80) уже использует `production` и concurrency-группу, но передаёт Ansible `backend_image_tag`. [Шаблон Compose infra на `db55a0a…`](https://github.com/Cringe-Driven-Development-Team/infra/blob/db55a0ac2f9f1b023fb853fe3e8c00d1b0646b7f/ansible/roles/app/templates/compose.yml.j2#L18-L20) использует тег, а [роль app](https://github.com/Cringe-Driven-Development-Team/infra/blob/db55a0ac2f9f1b023fb853fe3e8c00d1b0646b7f/ansible/roles/app/tasks/main.yml#L5-L59) записывает конфигурацию перед скачиванием образа. Эти закреплённые версии описывают исходное состояние на указанных SHA; они не устанавливают состояние нынешнего `main` или production. [Раздел исходного состояния](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/site/modules/2/tracks/backend-cicd/ansible.md#L51-L60).

Для деталей читайте [четыре подстраницы трека](https://github.com/Cringe-Driven-Development-Team/docs/blob/d20a0f0d6d80462569c761d2e2d9cdc1defbcee6/site/modules/2/tracks/backend-cicd.md#L40-L49). О документированной текущей инфраструктуре см. [архитектуру MVP](../architecture/mvp.md); о других планах уведомлений — [разработку и алерты](development-alerts.md); о статусе модулей — [работу с сайтом](../documentation/site-and-modules.md).
