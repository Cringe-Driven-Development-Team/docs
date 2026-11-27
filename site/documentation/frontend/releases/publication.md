---
title: CI и публикация
---

# CI и публикация {#release-publication}

Откройте Actions → CI для push в `main`. Когда **Publish release** закончит публикацию, проверьте тег `release-<полный SHA>` в Releases. Для выкладки выпустите отдельный [запуск CD](./deployment). [Условие публикации](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/ci.yml#L42-L66).

## GitHub Merge Queue {#merge-queue}

1. Дождитесь успешного Check, одобрения frontend-ментора и разрешения обсуждений. Затем нажмите **Merge when ready**. Одобрение ментора обязательно по правилам команды. [Порядок работы](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/docs/release.md#L22-L30), [правила main](https://api.github.com/repos/Cringe-Driven-Development-Team/frontend/rules/branches/main).
2. Дождитесь Check события `merge_group` с действием `checks_requested`. При ошибке откройте лог Check кандидата, исправьте PR, снова проверьте условия первого шага и нажмите **Merge when ready**.
3. После слияния откройте CI события push на `main`: именно этот запуск может опубликовать выпуск. [Триггеры и условия](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/ci.yml#L3-L48).

### Почему кандидат проверяется заново {#merge-queue-recheck}

Check кандидата выполняется на checkout события `merge_group`, поэтому проверяет результат объединения PR с базой очереди. Check на PR относится к ревизии его собственного события. Например, 27.11.2026 в 17:50:27 UTC завершился [Check кандидата](https://github.com/Cringe-Driven-Development-Team/frontend/actions/runs/46044865618) с SHA `b1baf996fb6753d1a62eab6f874d03dca30faadc`. [Checkout CI](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/ci.yml#L3-L40).

## Какие события запускают CI

| Событие | Check | Publish release |
| --- | --- | --- |
| Pull request | Да | — |
| `merge_group` для `main` | Да | — |
| Push в `main` репозитория frontend | Да | После успешного Check |

Check выполняет `bun install --frozen-lockfile`, `bun run contract:verify`, `bun test scripts/release/test apps/bff/test`, `bun run check`, `bun run build` и локальный `docker build`. [Workflow](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/ci.yml#L22-L48).

## Подготовка файлов и образа

1. **Build release** собирает BFF и клиент с `RELEASE_SHA` и `CDN_URL`.
2. **Upload assets** запускает `bun run release upload "$SHA"`. Под тем же ключом загрузчик принимает уже сохранённые одинаковые байты. Конфликт содержимого останавливает шаг. [Загрузчик](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/release/upload.ts#L32-L76).
3. **Release check** запускает `bun run release check "$SHA"` и проверяет `index.html` и его JS/CSS на CDN. [Проверки CDN](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/release/checks.ts#L32-L89).
4. **Publish BFF image** собирает образ с HTML этой сборки, пушит `sha-<SHA>` и сохраняет registry digest. **Anonymous image check** проверяет публичную доступность точного digest и метку ревизии. [Шаги CI](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/ci.yml#L79-L121), [Dockerfile](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/apps/bff/Dockerfile#L7-L18).

## Публикация готового комплекта

После Check на push в `main` выпуск публикует job **Publish release** собственным `GITHUB_TOKEN` с `contents: write`. Для устранения сбоя используйте [повтор исходного CI](#retry). [Условия и права job](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/ci.yml#L45-L66).

1. В **Release report** посмотрите Summary с диапазоном коммитов и связанными задачами.
2. **Register release** запускает `bun run release register "$SHA" "$IMAGE_REF"`, создаёт draft, фиксирует `release.json`, загружает [архивы и суммы](./artifacts), проверяет комплект и публикует Release. [CI](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/ci.yml#L122-L147), [скрипт публикации](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/release/releases.ts#L509-L617).
3. Проверьте опубликованный тег и четыре файла. Отдельно посмотрите шаг карточек. Открытые задачи из отчёта переходят в `Ready for release`. [Статусы задач](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/docs/release.md#L305-L317).

27.11.2026 в 17:52:21 UTC [CI события push](https://github.com/Cringe-Driven-Development-Team/frontend/actions/runs/46045004006) опубликовал [выпуск `b1baf996fb6753d1a62eab6f874d03dca30faadc`](https://github.com/Cringe-Driven-Development-Team/frontend/releases/tag/release-b1baf996fb6753d1a62eab6f874d03dca30faadc). В GitHub Release указан `immutable: true`, в Assets доступны четыре файла.

## Что делает immutable

Публикация фиксирует тег и assets. При использовании выпуска скрипт проверяет `immutable`, коммит тега, имена файлов, суммы и происхождение сборки через GitHub Actions. Для выбора digest используйте manifest: описание Release предназначено для чтения. [Проверка](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/release/releases.ts#L291-L351).

## Повтор и незавершённый draft {#retry}

Для повтора нужен Write-доступ к репозиторию `Cringe-Driven-Development-Team/frontend`. [Повтор запусков Actions](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs).

1. Найдите первый упавший шаг и состояние тега в Releases.
2. Устраните причину по таблице. В исходном запуске CI для push с этим SHA выберите **Re-run failed jobs**. Если нужна только повторная обработка в уже успешном job, откройте **Publish release** и выберите **Re-run job**.
3. Проверьте `Published already`, итог публикации и шаг карточек. [Проверка состояний](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/release/releases.ts#L434-L453), [восстановление draft](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/docs/release.md#L144-L153), [восстановление карточек публикации](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/docs/release.md#L365-L374).

| Состояние | Как продолжить |
| --- | --- |
| Release опубликован | Повтор проверит существующий комплект и обработает карточки с базой из manifest. |
| Draft с `release.json` | Исправьте доступность CDN/GHCR или причину загрузки. Повтор использует зафиксированный состав и восстанавливает недостающие assets. |
| Draft без `release.json` | Сверьте данные S3 и GHCR. После сверки удалите этот draft с правом управления Releases (Write-доступ к `frontend`), затем повторите CI. [Управление Releases в GitHub](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository). |
| Draft отсутствует | Исправьте исходный сбой и повторите job. |

## Очередь и несколько коммитов подряд

Check группируется по ref. Новый коммит PR отменяет его старый запуск; на `main` более новый push может вытеснить ожидающий CI. Publish release, CD, Rollback и операции с карточками сериализуются в `release-board`. Если промежуточный SHA пропустил публикацию, используйте следующий готовый выпуск в направлении истории `main`. [CI concurrency](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/ci.yml#L14-L20), [очередь публикации](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/ci.yml#L59-L66), [очередь CD](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/cd.yml#L33-L41).
