---
title: Выкатка
---

[← Трек BFF](../bff) · [Сборка и запуск](./build-and-run) · [Откат](./rollback)

# Выкатка BFF

Готовый выпуск хранится в GitHub Releases. Ручной CD проверяет его, переключает BFF
и фиксирует результат в отдельном production Deployment. Полное описание реализации,
сверенной с кодом 09.11.2026, — в [разделе выкаток](/documentation/frontend/releases/).
Это описание процесса, а не свидетельство нового запуска на production.

## Термины

| Термин | Что означает |
| --- | --- |
| GitHub Release | Опубликованный комплект на теге `release-<полный SHA>`: два архива, `release.json`, `SHA256SUMS` |
| production Deployment | Запись попытки выкатки или отката: целевой SHA, ссылки на выпуск/run и статусы |
| Git SHA | Коммит, из которого собраны клиент и BFF |
| `image_ref` | Точный образ GHCR по registry digest; он отличается от SHA исходников и checksum архива |
| `bff_release_sha` | Вход Ansible: полный SHA, с которым сверяются образ и HTML |
| `bff_image_ref` | Вход Ansible: публичный образ BFF с `@sha256:…` |

[Идентификаторы и manifest](/documentation/frontend/releases/artifacts) объясняют,
как проверить комплект и загрузить сохранённый образ локально.

## Один SHA, два артефакта

Клиент и BFF одного коммита образуют связанный выпуск — см. [сборку и образ](./build-and-run#сборка-и-образ).
BFF содержит серверный бандл, HTML и публичные PWA-файлы. HTML ссылается на неизменяемый
каталог клиента `releases/<SHA>/` в CDN. Версию HTML определяет работающий BFF.

CI проверяет S3/CDN и публичность образа GHCR, затем публикует GitHub Release.
Архивы клиента и BFF позволяют скачать комплект со страницы Release; `release.json`
связывает SHA, digest, каталог ассетов и исходный CI.
[Публикация](/documentation/frontend/releases/publication) и
[скачивание файлов](/documentation/frontend/releases/artifacts#download).

## Путь до production

<Diagram name="modules/2/bff-release" />

1. Оператор запускает CD: пустое поле выбирает выпуск по истории main, полный тег — конкретный Release.
2. До VPS проверяются Release, направление выкатки, анонимное чтение GHCR и CDN-файлы.
3. Создаётся production Deployment целевого SHA; Ansible переключает BFF по digest.
4. Проверяются образ, здоровье, HTML, RPC и CDN; результат записывается в Deployment.

Полные шаги, UI/CLI и условия `success`, `failure`, `error` — в
[инструкции выкатки](/documentation/frontend/releases/deployment).
Гостевой HTML проверяется вместе с [контрактом bootstrap](./bootstrap#контракт).
Ошибка после переключения может оставить новый BFF работающим; автоматического отката нет.

## Где смотреть реализацию {#что-есть-на-исходном-срезе}

Процесс задают [CI](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/.github/workflows/ci.yml#L39-L147),
[CD](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/.github/workflows/cd.yml#L43-L158) и
[deploy-bff.yml](https://github.com/Cringe-Driven-Development-Team/infra/blob/a59f8584386810b0b94f5fb23cb72c7ff906f6d7/ansible/deploy-bff.yml#L1-L43).
Actions использует окружение `production` с `deployment: false`; запись попытки создаёт
сам скрипт с `auto_merge: false`, чтобы её SHA соответствовал выбранному выпуску.
Статусы сохраняют историю с `auto_inactive: false`:
[создание и обновление Deployment](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/scripts/release/github.ts#L185-L230).
