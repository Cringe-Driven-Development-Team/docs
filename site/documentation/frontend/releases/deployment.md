---
title: Выкатка
---

# Выкатка {#release-deployment}

Запустите **CD** с ветки `main`, когда нужный выпуск опубликован. Операция считается подтверждённой после успешного Health check и записи `success` для целевого SHA в `production`. Для ручного запуска нужен Write-доступ к `Cringe-Driven-Development-Team/frontend`. Для environment `production` настроено только ограничение ветки `main`. [Ручной запуск Actions](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow), [защита environment](https://api.github.com/repos/Cringe-Driven-Development-Team/frontend/environments/production), [политика веток production](https://api.github.com/repos/Cringe-Driven-Development-Team/frontend/environments/production/deployment-branch-policies). [Workflow](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/cd.yml#L3-L41), [условие успеха](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/cd.yml#L138-L156).

## Какой выпуск будет выбран {#selection}

| Поле `release` | Что выбирает CD |
| --- | --- |
| Тег `release-<полный SHA>` | Указанный опубликованный выпуск после проверки. |
| Пустое | Первый опубликованный обычный Release при обходе first-parent истории обновлённого `origin/main`. |

Выбор происходит после ожидания очереди. Смотрите тег и SHA в **Ready release**. Если кандидат отсутствует или его проверка не проходит, CD останавливается до изменений на сервере. Дата публикации и GitHub Latest в выбор не входят. Допустим тот же SHA или потомок последнего подтверждённого production. [Выбор](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/release/releases.ts#L370-L432), [направление](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/release/deployments.ts#L21-L38), [обновление main](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/cd.yml#L55-L71).

## Запуск CD

1. Откройте [Actions → CD](https://github.com/Cringe-Driven-Development-Team/frontend/actions/workflows/cd.yml), нажмите **Run workflow** и выберите `main`.
2. Вставьте тег для точной цели или оставьте `release` пустым. Через GitHub CLI команда для точной цели выглядит так:

   ```bash
   release_tag='release-ВСТАВЬТЕ_ПОЛНЫЙ_SHA'
   gh workflow run cd.yml --repo Cringe-Driven-Development-Team/frontend \
     --ref main -f "release=$release_tag"
   ```

   Для выбора по истории `main` опустите параметр `-f`. [Вход workflow](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/cd.yml#L3-L9).

3. В новом run сравните SHA в **Ready release** с ожидаемой целью. Запомните ID из **Production record**. [Шаг выбора](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/cd.yml#L55-L71), [запись попытки](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/cd.yml#L117-L124).

## Проверки и переключение

| Шаг | Результат |
| --- | --- |
| Ready release, Check release direction | Проверены тег, immutable-комплект и происхождение выпуска, подтверждено направление по Git. [Workflow](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/cd.yml#L55-L71). |
| Anonymous image check, Release check | Публичный GHCR digest доступен с нужной revision; HTML и связанные JS/CSS доступны на CDN. [Workflow](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/cd.yml#L72-L79), [проверки CDN](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/release/checks.ts#L32-L89). |
| Production record, Switch BFF | Создан Deployment `in_progress`. Playbook из `main` infra обновил BFF на gateway и проверил запущенный образ и здоровье. [CD](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/cd.yml#L80-L86), [запуск Ansible](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/cd.yml#L117-L134), [playbook](https://github.com/Cringe-Driven-Development-Team/infra/blob/ab7c4e189a2e346244b420f675adec7ced43557c/ansible/deploy-bff.yml#L1-L43). |
| Health check, Production result | Проверен сайт, результат записан в тот же Deployment. После успешного результата идут обновление карточек и retention. [CD](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/cd.yml#L138-L165). |

## Что проверяет Health check

| Проба | Ожидаемый ответ |
| --- | --- |
| `/login` без сессии | Метка выбранного SHA, ровно один bootstrap с `user: null`, `Cache-Control: private, no-store`. |
| JS/CSS из HTML | Каталог выбранного SHA на CDN, корректный MIME и CORS для JS. |
| `GET /api/users/me` без сессии | HTTP 401 и `UNAUTHORIZED`. |
| `GET /api/unknown` | HTTP 404 без HTML. |
| `POST /api/auth/login` со случайными данными | HTTP 400, `BAD_REQUEST`, `appCode=invalid_credentials`. |

[Реализация проб](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/release/checks.ts#L32-L60), [публичный Health check](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/release/checks.ts#L97-L184).

## Как подтвердить результат

1. Проверьте **Health check** и **Production result** в Actions.
2. Откройте [Deployments](https://github.com/Cringe-Driven-Development-Team/frontend/deployments), найдите запись `production` того же run и проверьте `success`, SHA и `image_ref` из manifest. Для автоматической сверки доступен API GitHub. [Запись и итог](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/release/deployments.ts#L166-L210).
3. Отдельно проверьте **Update release issues**. Карточки выпуска переходят в `Done` после подтверждения, открытые задачи из отчёта закрываются как completed. Если шаг упал после записанного `success`, восстановите карточки по [исходному ID](./troubleshooting#reconcile-issues). [Статусы задач](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/docs/release.md#L305-L317), [условие обновления](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/cd.yml#L142-L156).

Проверенный пример за 27.11.2026. Из [Release](https://github.com/Cringe-Driven-Development-Team/frontend/releases/tag/release-b1baf996fb6753d1a62eab6f874d03dca30faadc) с SHA `b1baf996fb6753d1a62eab6f874d03dca30faadc` перейдите в [CD run](https://github.com/Cringe-Driven-Development-Team/frontend/actions/runs/46049795274) и [Deployment 8116868408](https://api.github.com/repos/Cringe-Driven-Development-Team/frontend/deployments/8116868408/statuses). В 18:31:31 UTC Health check прошёл и попытка получила `success`. Карточки обработаны отдельным шагом в 18:32:56 UTC.

28.11.2026 в 02:09:07 МСК запрос `GET /login` с `Accept: text/html` и без cookie вернул метку
`b1baf996fb6753d1a62eab6f874d03dca30faadc`, один гостевой bootstrap с `{"user":null}`
и ссылки на CDN-каталог того же SHA. [Публичная страница](https://cellestial.ru/login), [заголовки и проверки в Health check](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/release/checks.ts#L119-L151).
