---
title: "GitHub Deployments"
---

[← Обзор трека](../backend-cicd) · [Выкатка](./release) · [Откат](./rollback)

# История GitHub Deployments

::: info План, ещё не внедрено
Здесь описана целевая запись релиза из [backend#42](https://github.com/Cringe-Driven-Development-Team/backend/issues/42).
Текущий workflow уже использует environment `production`, но ещё не записывает
digest образа в собственный Deployment.
:::

## Что хранит запись

GitHub Deployment — запись о попытке развернуть конкретную версию в
`production`. У целевой записи `ref` равен **SHA образа**, а `payload` содержит
полную ссылку `ghcr.io/cringe-driven-development-team/backend@sha256:…`,
digest, действие (`deploy` или `rollback`) и ссылку на run текущей операции:
обычной выкатки или ручного отката. При откате этот run отличается от запуска
CI, который когда-то собрал выбранный образ.
Статусы и ссылка на логи показывают, чем попытка закончилась.

| Поле | Что узнаёт читатель |
| --- | --- |
| `ref` | Из какого коммита собран выбранный образ |
| `payload.image_ref` и digest | Какие именно байты образа выбраны для VPS |
| Действие и run | Обычная это выкатка или откат и где смотреть её запуск |
| Последний статус | Подтверждён ли результат на production |

При ручном откате сам workflow запускается на `main`, но выбранный прежний
образ относится к другому SHA. Поэтому `github.sha` этого запуска нельзя
выдавать за версию API: в новом Deployment `ref` указывает на **целевой SHA**.
Если для одного SHA существуют разные успешные digest, одного SHA для выбора
образа недостаточно; workflow отклоняет неоднозначную цель до VPS.

## Когда появляется success

CD создаёт Deployment для выбранного SHA до переключения API и добавляет
статусы по мере выполнения. `success` ставится после подтверждения образа
запущенного контейнера, его `healthy` и ответа публичного API через HTTPS.
Успех команды Ansible сам по себе ещё не доказывает работу production.
Если контейнер упал позже, прежний `success` остаётся историей проверки в момент выкатки.
Для выбора цели отката этого достаточно; текущую работающую версию он не доказывает.

Если проверка не прошла, запись и карточка указывают этап сбоя и только
подтверждённое состояние; неизвестную версию называют «неизвестно». Ошибка
отправки Telegram-сообщения видна в workflow, но не превращает проверенный
деплой в неуспешный.

## Почему нет двух записей на одну попытку

Сегодня GitHub автоматически создаёт Deployment для job с environment
`production`: это следует из [механизма environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments#how-environments-relate-to-deployments)
и [текущего cd.yml](https://github.com/Cringe-Driven-Development-Team/backend/blob/186b618c492a0f2ace73f9c6b705e69ffa058b27/.github/workflows/cd.yml#L11-L28).
Автоматическая запись привязана к ref запуска и не содержит выбранный digest.

В целевом потоке CD создаёт запись явно через
[GitHub Deployments API](https://docs.github.com/en/rest/deployments/deployments).
Для environment job задаётся `deployment: false`: она сохраняет доступ к
секретам и правилам `production`, а GitHub не создаёт дублирующую запись.
Этот режим описан в [документации environments](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/deploy-to-environment).

После чтения истории релизов можно перейти к [выбору версии для отката](./rollback)
или к [исполнению через Ansible](./ansible).
