---
title: Выкатка
---

[← Трек BFF](../bff) · [Серверный bootstrap](./bootstrap) · [Откат](./rollback)

# Выкатка BFF

::: info План, ещё не внедрено
Ниже — целевой поток из [frontend#4](https://github.com/Cringe-Driven-Development-Team/frontend/issues/4)
и [infra#74](https://github.com/Cringe-Driven-Development-Team/infra/issues/74). Слитый
[infra PR #71](https://github.com/Cringe-Driven-Development-Team/infra/pull/71) подготовил сервис BFF
и entrypoint с тегом; выпуск по digest и история Deployments ещё предстоят.
:::

## Один SHA, два артефакта

Один коммит даёт два связанных артефакта. Образ BFF содержит серверный бандл и HTML-шаблон.
В этом HTML ссылки на JS/CSS ведут в неизменяемый каталог `releases/<полный SHA>/` на CDN.
Браузеру HTML отдаёт работающий BFF; загрузка ассетов в CDN сама по себе версию приложения не меняет.

| Идентификатор | Роль |
| --- | --- |
| Полный Git SHA | Коммит клиента и BFF; человек выбирает выпуск по нему |
| Тег `sha-<полный SHA>` | Помогает найти образ в GHCR, но может быть перезаписан |
| `ghcr.io/cringe-driven-development-team/bff@sha256:…` | Точный образ для выкатки и отката |
| `releases/<полный SHA>/` | Ассеты, которые загрузит HTML этого образа |

CI получает digest при публикации образа и записывает полный SHA в
`org.opencontainers.image.revision`. После проверки GHCR и CDN он последним шагом публикует
неизменяемую запись готового выпуска: полный SHA, `image_ref` по digest, каталог ассетов и ссылку на
исходный CI run. Например, это `releases/<sha>/release.json`; повторная сборка того же SHA не должна
молча заменить запись или ассеты. Такая запись позволяет выкатить даже выпуск, который ещё ни разу
не был в production. GitHub Deployments хранят другую историю — попытки переключения production.

## Путь до production

```mermaid
flowchart LR
    CI["CI: клиент и BFF одного SHA"] --> CDN["S3/CDN: ассеты releases/SHA/"]
    CI --> GHCR["GHCR: образ BFF по digest"]
    CDN --> READY["Готовый выпуск: SHA, digest, ассеты"]
    GHCR --> READY
    READY --> CD["CD: проверки до VPS"]
    CD --> DEP["GitHub Deployment: целевой SHA"]
    DEP --> ANS["Ansible: bff_image_ref + bff_release_sha"]
    ANS --> VPS["VPS: BFF отдаёт HTML"]
    VPS --> CHECK["Образ, healthy, HTML, RPC, CDN"]
    CHECK --> RESULT["Статус Deployment и уведомление"]
```

1. На PR CI проверяет и собирает монорепу без публикации. После проверок `main` он загружает ассеты
   в CDN, публикует образ с HTML того же SHA в GHCR и только затем помечает выпуск готовым. Ошибка
   любого шага запрещает CD.
2. CD получает выбранный полный SHA, читает запись готового выпуска и до изменения VPS проверяет
   доступность точного digest, совпадение SHA образа и HTML, а также CDN-ассеты.
3. CD создаёт GitHub Deployment в `production`: `ref` равен **SHA выбранного образа**, в `payload`
   лежат `image_ref`, каталог ассетов, действие `deploy` и ссылка на текущий CD run. Для исторического
   SHA используется `auto_merge: false`, чтобы GitHub не пытался объединить его с `main`.
4. Workflow вызывает зафиксированную ревизию `deploy-bff.yml` с `bff_image_ref` и
   `bff_release_sha`. Целевой контракт [infra#74](https://github.com/Cringe-Driven-Development-Team/infra/issues/74)
   скачивает образ по digest до изменения Compose, проверяет SHA образа, переключает только BFF и
   подтверждает его `healthy`. Выбранный образ Go сохраняется; Caddy ведёт браузер к BFF.
5. Workflow сверяет фактически запущенный образ с выбранным digest, публичный гостевой HTML с одним
   bootstrap `{ user: null }` и меткой SHA, ответ защищённого RPC и доступность JS/CSS своего выпуска.
   Только после этих проверок Deployment получает `success`. Ошибка Telegram-уведомления не отменяет
   подтверждённый результат выкладки.

CI job загрузки ассетов и jobs CD/rollback используют environment `production` для действующих
ограничений и секретов, но отключают его автоматический Deployment через `deployment: false`.
Иначе GitHub записал бы «успех production» уже при загрузке файлов в CDN или связал ручной откат
с SHA запуска workflow. Явная запись отражает проверенный результат на VPS.

## Что есть на исходном срезе

На frontend `495981555390f39995bd3ab296b1f6a6e37577c8`
[CI](https://github.com/Cringe-Driven-Development-Team/frontend/blob/495981555390f39995bd3ab296b1f6a6e37577c8/.github/workflows/ci.yml#L35-L66)
загружает ассеты в S3 с `environment: production`, а
[CD](https://github.com/Cringe-Driven-Development-Team/frontend/blob/495981555390f39995bd3ab296b1f6a6e37577c8/.github/workflows/cd.yml#L16-L55)
переключает S3-указатель. На infra `175e37ae77ae3b495ab7dd29c5d41a23e25aec50`
[deploy-bff.yml](https://github.com/Cringe-Driven-Development-Team/infra/blob/175e37ae77ae3b495ab7dd29c5d41a23e25aec50/ansible/deploy-bff.yml#L1-L33)
принимает `bff_image_tag`. Эти ссылки описывают исходное состояние, а не готовый поток выше.
