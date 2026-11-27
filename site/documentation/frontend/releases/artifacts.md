---
title: Состав выпуска
---

# Состав выпуска {#release-assets}

Для воспроизводимой проверки скачайте четыре файла одного тега `release-<полный SHA>`. Выкладка использует точный образ из GHCR и файлы того же SHA из CDN. [Состав](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/release/releases.ts#L323-L351), [выкладка](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/cd.yml#L55-L79).

## Четыре файла Release

| Файл | Что содержит |
| --- | --- |
| `frontend-dist.tar.gz` | Собранный клиент с относительными путями, включая HTML, JS/CSS и PWA. |
| `bff-image.tar.gz` | Gzip от `docker image save` опубликованного образа Linux/amd64. |
| `release.json` | Манифест выпуска с SHA коммита, образом, каталогом ассетов и происхождением. |
| `SHA256SUMS` | SHA-256 трёх файлов из предыдущих строк. |

GitHub отдельно предлагает **Source code (zip/tar.gz)** для скачивания исходников. Скачиваемый комплект виден в [реальном Release](https://github.com/Cringe-Driven-Development-Team/frontend/releases/tag/release-b1baf996fb6753d1a62eab6f874d03dca30faadc). [Формирование архивов](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/release/archives.ts#L21-L114), [правила проверки](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/release/releases.ts#L323-L351).

## Как читать manifest

| Поле | Значение |
| --- | --- |
| `sha`, `assets` | Полный SHA коммита и каталог `releases/<SHA>/`. |
| `image_ref`, `image_id` | Полный адрес образа с registry digest и config digest. |
| `ci_run`, `ci_run_attempt` | Запуск и попытка CI, подготовившая артефакты. |
| `publication_run` | Запуск, завершивший публикацию. |
| `notification` | База отчёта, ссылка на его Summary и номер попытки публикации. База и ссылка могут быть `null`. |

[Тип и проверка полей](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/release/releases.ts#L26-L36), [проверка manifest](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/release/releases.ts#L122-L162).

## Идентификаторы {#sha-digest-и-checksum-—-разные-идентификаторы}

| Что сверять | Где |
| --- | --- |
| Git SHA | Тег Release и метка `org.opencontainers.image.revision` в образе. |
| Registry digest | `image_ref` в manifest и образ в production Deployment. Тег GHCR `sha-<SHA>` годится для поиска. |
| Config digest | `image_id` в manifest и конфигурация загруженного архива. |
| SHA-256 файла | Локальные файлы и `SHA256SUMS`. В CD суммы больших архивов сверяются с digest файлов из API GitHub. |

[Проверка выпуска](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/release/releases.ts#L323-L351), [проверка архива образа](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/release/archives.ts#L74-L114).

## Как скачать и проверить комплект {#download}

1. Откройте [Releases](https://github.com/Cringe-Driven-Development-Team/frontend/releases), найдите нужный тег и сохраните четыре файла из **Assets** в пустой каталог. Для GitHub CLI используйте те же имена:

   ```bash
   release_tag='release-ВСТАВЬТЕ_ПОЛНЫЙ_SHA'
   gh release download "$release_tag" --repo Cringe-Driven-Development-Team/frontend \
     --pattern frontend-dist.tar.gz --pattern bff-image.tar.gz \
     --pattern release.json --pattern SHA256SUMS
   ```

2. В каталоге со скачанными файлами выполните `sha256sum -c SHA256SUMS`. Продолжайте после `OK` для всех трёх файлов.
3. Распакуйте клиент через `mkdir dist && tar -xzf frontend-dist.tar.gz -C dist`. Образ импортируется локально командой `gunzip -c bff-image.tar.gz | docker load`. [Команды владельца](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/docs/release.md#L136-L142).
4. Подставьте `sha` из `release.json` в команду:

   ```bash
   release_sha='ВСТАВЬТЕ_SHA_ИЗ_RELEASE_JSON'
   docker image inspect "ghcr.io/cringe-driven-development-team/bff:sha-$release_sha" \
     --format '{{.Id}} {{index .Config.Labels "org.opencontainers.image.revision"}}'
   ```

   Сверьте revision с SHA. В зависимости от Docker image store допустим `image_id` либо digest из `image_ref`. При расхождении сумм, ID или revision заново скачайте комплект и проверьте выбранный тег. [Проверка архива в CI](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/release/archives.ts#L91-L114).

28.11.2026 в 02:07:55 МСК для [выпуска `b1baf996fb6753d1a62eab6f874d03dca30faadc`](https://github.com/Cringe-Driven-Development-Team/frontend/releases/tag/release-b1baf996fb6753d1a62eab6f874d03dca30faadc) GitHub CLI скачал четыре файла. `sha256sum -c SHA256SUMS` вернул `OK` для обоих архивов и `release.json`. В 02:09:52 МСК распаковка клиента и импорт образа прошли, `docker image inspect` вернул config digest и revision из манифеста.

## Как файлы доходят до браузера

<Diagram name="frontend-release-delivery" />

Caddy передаёт запрос BFF. BFF отдаёт HTML с путями к JS/CSS из `releases/<SHA>/`; CDN получает эти файлы из S3. Публичные файлы PWA входят в образ и выдаются с origin приложения. [Caddy](https://github.com/Cringe-Driven-Development-Team/infra/blob/ab7c4e189a2e346244b420f675adec7ced43557c/ansible/roles/caddy/templates/Caddyfile.j2#L48-L59), [CDN и S3](https://github.com/Cringe-Driven-Development-Team/infra/blob/ab7c4e189a2e346244b420f675adec7ced43557c/pulumi/storage.ts#L162-L171), [сборка образа](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/bff/Dockerfile#L7-L18), [инфраструктура PWA](/documentation/offline/infrastructure).

Ansible получает образ по `image_ref` из GHCR. Архив образа в Release предназначен для скачивания и локальной проверки. [Playbook](https://github.com/Cringe-Driven-Development-Team/infra/blob/ab7c4e189a2e346244b420f675adec7ced43557c/ansible/deploy-bff.yml#L1-L43).

## Что остаётся после очистки {#retention}

После подтверждённого CD в S3 остаются пять каталогов по времени последней записи и каталоги двух защищённых выпусков: последнего успешного production и предыдущего успешного с другим digest. При последней попытке без `success` очистка откладывается. [Retention](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/release/retention.ts#L1-L52), [защищённые выпуски](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/release/deployments.ts#L113-L128), [условие запуска](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/cd.yml#L157-L165).

Перед использованием старого выпуска проверьте доступность CDN-каталога и digest в GHCR отдельно от файлов Release. Retention удаляет только файлы в S3. Восстановление S3 или GHCR из архива требует отдельной операции. [Обработка недоступного выпуска](./troubleshooting#diagnosis).
