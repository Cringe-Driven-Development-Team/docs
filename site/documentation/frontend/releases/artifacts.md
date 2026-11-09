---
title: Состав выпуска
---

# Состав выпуска {#release-assets}

Один Release соответствует одному полному SHA: тег `release-<40 hex>`, название
`Frontend <короткий SHA>`. Он связывает клиентские файлы и образ BFF и позволяет скачать
весь комплект со страницы GitHub. Версий вида `v1.2.3` у выпусков приложения нет.
[Основание описания](./#основание-описания).

## Четыре файла Release

| Asset | Что внутри | Для чего |
| --- | --- | --- |
| `frontend-dist.tar.gz` | Всё содержимое `apps/client/dist/` с относительными путями: HTML, JS/CSS, PWA | Скачать релизную сборку клиента |
| `bff-image.tar.gz` | Gzip от `docker image save` опубликованного linux/amd64 образа | Загрузить тот же BFF-образ локально без обращения к GHCR |
| `release.json` | SHA, ссылки, digest и сведения исходной сборки/публикации | Проверить состав и происхождение |
| `SHA256SUMS` | SHA-256 трёх файлов выше | Проверить скачанные байты |

Автоматические ссылки GitHub **Source code (zip/tar.gz)** скачивают исходники тега.
Они не заменяют собранный клиент и образ BFF. Состав и проверка заданы
[releases.ts](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/scripts/release/releases.ts#L321-L347) и
[справочником выпуска](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/docs/release.md#L47-L89).

## Как читать manifest

| Поле `release.json` | Значение |
| --- | --- |
| `sha` | Полный SHA коммита; совпадает с тегом Release и меткой образа |
| `image_ref` | `ghcr.io/cringe-driven-development-team/bff@sha256:…` — точный образ |
| `image_id` | Config digest конфигурации образа; не всегда совпадает с Docker `.Id` |
| `assets` | Каталог `releases/<SHA>/` |
| `ci_run`, `ci_run_attempt` | Ссылка на исходный push/main CI и номер попытки, подготовившей артефакты |
| `publication_run` | Запуск, завершивший публикацию |
| `notification.base_sha` | База отчёта о составе изменений или `null` |
| `notification.report_url` | Ссылка на Summary отчёта или `null` |
| `notification.run_attempt` | Номер попытки публикации |

Тип и валидация — [manifest](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/scripts/release/releases.ts#L26-L36) и
[проверка полей](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/scripts/release/releases.ts#L122-L160). Описание Release удобно человеку,
но его можно редактировать; машина доверяет проверенному manifest и связанным объектам API.

## SHA, digest и checksum — разные идентификаторы

| Значение | Что идентифицирует | Что с ним делать |
| --- | --- | --- |
| Git SHA | Коммит исходников | Найти код и тег `release-<SHA>` |
| Тег образа `sha-<SHA>` | Имя в GHCR | Удобно найти образ; тег не заменяет digest |
| Registry digest в `image_ref` | Манифест опубликованного образа | Именно его передать Docker/Ansible для выкатки |
| Config digest / `image_id` | Конфигурацию образа | Сверить config архива; при проверке `docker load` учитывать image store |
| SHA-256 в `SHA256SUMS` | Байты конкретного архива или manifest | Проверить скачанный файл |

Не сравнивайте checksum архива с registry digest: это хеши разных объектов.
При проверке Release CD не скачивает оба больших архива: он сверяет их digest из GitHub API
с `SHA256SUMS`, скачивает и проверяет manifest, его источник CI и тег.
[verifyRelease](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/scripts/release/releases.ts#L321-L347).

## Как скачать и проверить комплект {#download}

Предусловие: выбран опубликованный Release из командного репозитория, есть место для
архива образа и распаковки. Для CLI нужны `gh`, `sha256sum`, `tar`, `gzip`; для загрузки образа — Docker.

::: tabs
== Через GitHub

1. Откройте [Releases](https://github.com/Cringe-Driven-Development-Team/frontend/releases).
2. Выберите нужный тег и раскройте **Assets**.
3. Скачайте четыре файла из таблицы в одну новую папку. Не выбирайте вместо них Source code.
4. Откройте терминал в этой папке и выполните проверку сумм ниже.

== Через CLI

Подставьте полный тег со страницы Release. Новая пустая папка исключает смешивание выпусков.

```bash [Скачивание выпуска]
release_tag='release-ВСТАВЬТЕ_ПОЛНЫЙ_SHA'
mkdir "$release_tag"
cd "$release_tag"
gh release download "$release_tag" --repo Cringe-Driven-Development-Team/frontend \
  --pattern frontend-dist.tar.gz --pattern bff-image.tar.gz \
  --pattern release.json --pattern SHA256SUMS
```

:::

Проверка для обоих способов:

```bash [Проверка скачанных файлов]
sha256sum -c SHA256SUMS &&
mkdir dist &&
tar -xzf frontend-dist.tar.gz -C dist &&
gunzip -c bff-image.tar.gz | docker load
```

Ожидайте `OK` для трёх файлов. При несовпадении остановитесь: не используйте повреждённый
комплект. После `docker load` проверьте ID и метку образа. Метка revision должна совпадать
с `sha` в `release.json`. Значение `.Id` зависит от хранилища Docker: допустимы
`image_id` (config digest) или digest после `@` в `image_ref` (registry/index digest
при containerd image store). Иное значение ID или другая revision означают несовпадение.
Именно эти два варианта принимает [проверка архива в CI](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/scripts/release/archives.ts#L95-L112):

```bash [Проверка загруженного образа]
release_sha='ВСТАВЬТЕ_SHA_ИЗ_RELEASE_JSON'
docker image inspect "ghcr.io/cringe-driven-development-team/bff:sha-$release_sha" \
  --format '{{.Id}} {{index .Config.Labels "org.opencontainers.image.revision"}}'
```

`docker load` импортирует образ, но не запускает приложение и не изменяет production.
Архив не включает production env и секреты. Локальный запуск BFF требует отдельной настройки;
эти команды предназначены для проверки комплекта, не для восстановления прода.

## Как файлы доходят до браузера

<Diagram name="frontend-release-delivery" />

Caddy принимает запрос к `cellestial.ru`; BFF выдаёт HTML с bootstrap и меткой своего SHA.
HTML ссылается на JS/CSS каталога этого выпуска в CDN. CDN берёт недостающие ресурсы из S3;
S3 — источник байтов, CDN — слой доставки и кеширования. Указатель текущего production в S3
не переключается: версию HTML определяет работающий BFF.

Образ берётся из GHCR только при выкладке. Штатный CD не распаковывает `bff-image.tar.gz`
из GitHub Releases. Он использует manifest для выбора digest и Ansible для скачивания образа.
[CD](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/.github/workflows/cd.yml#L50-L132),
[Ansible](https://github.com/Cringe-Driven-Development-Team/infra/blob/a59f8584386810b0b94f5fb23cb72c7ff906f6d7/ansible/deploy-bff.yml#L1-L43).

HTML и публичные PWA-файлы входят в BFF-образ; service worker обслуживается с origin приложения.
JS/CSS приложения доставляются с CDN. Это разные маршруты:
[Dockerfile](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/apps/bff/Dockerfile#L7-L17), [инфраструктура PWA](/documentation/offline/infrastructure).
Бакет и CDN настраивает infra: [S3](https://github.com/Cringe-Driven-Development-Team/infra/blob/a59f8584386810b0b94f5fb23cb72c7ff906f6d7/pulumi/index.ts#L409-L424) и
[CDN-ресурс](https://github.com/Cringe-Driven-Development-Team/infra/blob/a59f8584386810b0b94f5fb23cb72c7ff906f6d7/pulumi/index.ts#L602-L624).

## Что остаётся после очистки {#retention}

После успешного CD retention сохраняет пять последних каталогов S3 по времени последней
записи в каталог, а также ассеты последнего успешного production и предыдущего успешного
с другим digest независимо от возраста. Это порядок очистки S3, не алгоритм выбора CD.
Если последняя попытка production не `success`, очистка откладывается: контейнер мог переключиться.
[retention](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/scripts/release/retention.ts#L1-L52).

Эта очистка не удаляет четыре файла GitHub Release и не является очисткой GHCR.
Наличие архива не гарантирует, что старый выпуск ещё доступен для выкатки: при отсутствии
CDN-файлов или образа CD остановится до VPS. Автоматического восстановления S3/GHCR
из архивов в этом процессе нет. [Диагностика недоступного выпуска](./troubleshooting#diagnosis).
