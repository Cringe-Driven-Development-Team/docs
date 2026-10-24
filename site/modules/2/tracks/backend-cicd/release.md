---
title: "Выкатка"
---

[← Обзор трека](../backend-cicd)

# Выкатка Go API

::: info План, ещё не внедрено
Это целевой поток из [backend#42](https://github.com/Cringe-Driven-Development-Team/backend/issues/42)
и [infra#69](https://github.com/Cringe-Driven-Development-Team/infra/issues/69).
Ниже отдельно указано, что уже делает текущий CI/CD.
:::

## Три идентификатора одного выпуска

| Значение | Для чего нужно |
| --- | --- |
| Полный Git SHA | Называет коммит исходников, по которому CI собрал образ |
| Тег `sha-<полный SHA>` | Даёт человеку читаемое имя версии в GHCR; тег может быть перезаписан |
| `ghcr.io/cringe-driven-development-team/backend@sha256:…` | Указывает на конкретный опубликованный образ; именно эта ссылка идёт в Ansible |

Digest выдаёт шаг публикации образа. Job сборки передаёт его job выкатки через
output GitHub Actions; отдельная таблица в Go API для этого не нужна. Связь
целевого SHA, digest и результата production сохраняется в GitHub Deployment.

## От коммита до запущенного API

1. Push в `main` проходит проверки CI. Job `docker` один раз собирает и публикует
   образ в GHCR с полным SHA-тегом и получает digest опубликованного образа.
2. Если `PRODUCTION_ENABLED` разрешает выкатку, CD job входит в environment
   `production`. Выкатка и ручной откат используют одну concurrency-группу.
3. CD создаёт GitHub Deployment с `ref` исходного полного SHA и digest образа
   в `payload`. Поскольку запись создаётся явно, автоматическая запись от
   environment job отключена.
4. CD вызывает playbook Ansible с `backend_image_ref` по digest. Ansible скачивает
   выбранный образ и запускает API через Compose на VPS.
5. После переключения workflow подтверждает образ запущенного контейнера,
   `healthy` и ответ публичного API через HTTPS. Лишь затем Deployment получает
   `success` и команда видит карточку в Backend / Releases. Если результат нельзя
   подтвердить, статус и карточка не называют выкатку успешной.

Проверка публичного API использует `/api/v1/users/me`: без авторизации ожидаются
JSON и HTTP 401. Подробности о записи результата — в подразделе GitHub
Deployments, а о запуске контейнера — в подразделе Ansible и VPS.

## Что работает сейчас

На зафиксированном исходном состоянии backend CI публикует короткий SHA-тег и
передаёт его в CD: [ci.yml](https://github.com/Cringe-Driven-Development-Team/backend/blob/186b618c492a0f2ace73f9c6b705e69ffa058b27/.github/workflows/ci.yml#L98-L149).
CD уже использует `production` и concurrency-группу, но передаёт Ansible тег:
[cd.yml](https://github.com/Cringe-Driven-Development-Team/backend/blob/186b618c492a0f2ace73f9c6b705e69ffa058b27/.github/workflows/cd.yml#L11-L80).
Переход на digest — часть названных задач, а не свойство этой версии `main`.
