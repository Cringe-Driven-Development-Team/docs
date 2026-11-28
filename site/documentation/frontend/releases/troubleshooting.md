---
title: Ошибки и уведомления
---

# Ошибки и уведомления {#release-troubleshooting}

Откройте первый упавший шаг Actions и найдите связанный production Deployment. Сбой после сохранённого `success` устраняйте на уровне упавшего шага. [Условия завершения CD](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/cd.yml#L138-L165).

## Где искать свидетельства {#diagnosis}

1. В [Actions](https://github.com/Cringe-Driven-Development-Team/frontend/actions) откройте лог первого упавшего шага и Summary.
2. Сверьте тег и `release.json` в [Releases](https://github.com/Cringe-Driven-Development-Team/frontend/releases). Целевой SHA берите из **Ready release** или **Rollback target**.
3. Найдите [production Deployment](https://github.com/Cringe-Driven-Development-Team/frontend/deployments) по run и сверьте статус, целевой SHA и digest. При сбое после начала переключения проверьте фактическую версию сайта и логи BFF. [Запись попытки](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/release/deployments.ts#L166-L210).

| Шаг или симптом | Диагностика и восстановление |
| --- | --- |
| Check прошёл, выпуска нет | Проверьте событие. Publish release запускается после Check на push в `main`. Для сбоя публикации используйте [повтор](./publication#retry). |
| Ready release или Rollback target | Сверьте тег, immutable-комплект, provenance или историю цели. При незавершённой попытке выясните её итог. |
| Anonymous image check | Проверьте доступность заявленного digest без учётных данных, видимость пакета и метку ревизии. Повторите после устранения причины. |
| Release check | Проверьте HTML и JS/CSS соответствующего каталога CDN, MIME и CORS. Исправьте доступность перед повтором. |
| Switch BFF | Найдите последнее действие Ansible, проверьте образ и состояние BFF/Caddy. После диагностики повторите CD либо выполните [Rollback](./rollback). |
| Health check | Найдите несовпавшую [публичную пробу](./deployment#что-проверяет-health-check). Проверьте её зависимость. Если нужен возврат к подтверждённому выпуску, проверьте [цель Rollback](./rollback#target). |
| Production result | Сверьте лог записи и статусы Deployment. Если `success` отсутствует, установите фактическое состояние до следующей операции. |
| Update release issues после `success` | Исправьте ошибку GitHub API или карточек и выполните [восстановление](#reconcile-issues). |
| Retention после `success` | Проверьте лог и доступность S3. Следующий подтверждённый CD снова запустит retention. |
| Старый Release скачивается, но проверки его отвергают | Проверьте доступность образа GHCR и каталога CDN. [Правила хранения](./artifacts#retention). |

[Check и Publish release](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/ci.yml#L22-L121), [CD](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/cd.yml#L55-L165), [выбор отката](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/release/deployments.ts#L54-L110).

## Почему функционал есть, а выкатка красная

| Запись production | Как читать |
| --- | --- |
| `failure` | Переключение прошло, публичные проверки не подтвердили результат. |
| `error` | Проверка результата не завершилась успешно и Switch BFF не отмечен успешным. Возможна частичная смена версии. |
| Записи нет | Workflow остановился до Production record. |
| `success` | Публичные пробы прошли и результат записан. Проверьте карточки и retention при красном workflow. |

[Условие Production result](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/cd.yml#L117-L165).

## Восстановление карточек {#reconcile-issues}

Для ручного запуска Reconcile release issues нужен Write-доступ к `Cringe-Driven-Development-Team/frontend`. [Ручной запуск Actions](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

1. В логе **Update release issues** узнайте, что не записалось. Проверьте доступ GitHub к проекту, наличие карточки и целевой опции Status. После успешного Close API карточка ещё может показывать прежний Status.
2. Если CD или Rollback уже получил `success`, откройте [Actions → Reconcile release issues](https://github.com/Cringe-Driven-Development-Team/frontend/actions/workflows/reconcile-issues.yml). На ветке `main` передайте `deployment_id` **исходной успешной попытки**.
3. Проверьте **Recover release issues** и Summary. Workflow восстановит актуальный эффект по исходному диапазону без новой сборки и выкатки. Если последняя попытка ещё не подтверждена, сначала восстановите production.
4. Для сбоя карточек публикации [повторите исходный CI опубликованного SHA](./publication#retry). [Workflow восстановления](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/reconcile-issues.yml#L3-L44), [правила восстановления](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/docs/release.md#L337-L374).

## Что означает каждое сообщение

| Сообщение | Источник | Что проверить |
| --- | --- | --- |
| PR в очереди | `pull_request.enqueued` | Check кандидата в Actions. |
| Выпуск готов | `release.published` после проверки webhook | Тег и assets в Release. Кнопка «Выкатить» открывает workflow CD. |
| Начало и итог выкатки или отката | `deployment_status` | Статусы одной попытки `production`. |
| Ошибка до записи результата | `workflow_job.completed` | Первый упавший шаг Actions. |

[Обработчик и события](https://github.com/Cringe-Driven-Development-Team/.github/blob/372930293656411505315fb09d271c97ab904b13/services/webhook-alerts/README.md#L853-L875), [карточки и ссылки](https://github.com/Cringe-Driven-Development-Team/.github/blob/372930293656411505315fb09d271c97ab904b13/services/webhook-alerts/README.md#L944-L957). Сведения о канале уведомлений сверены по инструкции владельца.

## Почему список задач большой

| Операция | База отчёта |
| --- | --- |
| Публикация | Предыдущий опубликованный first-parent предок. |
| CD | Последний подтверждённый production. Серия неуспешных попыток оставляет базу прежней. |
| Rollback | Изменения между целью отката и предыдущим подтверждённым production. |

При неполном отчёте смотрите ошибку сбора состава в Summary. Успех сборки, проверки сайта и записи карточек подтверждается соответствующими шагами. [Расчёт диапазона](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/release/report.ts#L235-L285), [частичные ошибки](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/docs/release.md#L337-L344).

## Release есть, а ready в Telegram нет

1. Проверьте, что тег опубликован и содержит [полный комплект](./artifacts).
2. В [настройках webhook организации](https://github.com/organizations/Cringe-Driven-Development-Team/settings/hooks) проверьте подписку `release` и delivery `release.published`. Нужны права администратора либо доступ через создавшее webhook приложение.
3. После успешного приёма HTTP проверьте очередь и логи worker webhook-сервиса на VPS3. Сверьте границу release-контракта в SQLite: до установки границы ready не отправляется, публикации до неё отсекаются.
4. После устранения причины проверьте доставку исходного события по [инструкции владельца](https://github.com/Cringe-Driven-Development-Team/.github/blob/372930293656411505315fb09d271c97ab904b13/services/webhook-alerts/README.md#L958-L972).
