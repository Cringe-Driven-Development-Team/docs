---
title: CI и публикация
---

# CI и публикация {#release-publication}

CI проверяет изменения и подготавливает выпуск. Публикация делает доступными файлы и образ,
но не переключает BFF на сайте. Чтобы запустить готовый выпуск, нужен отдельный [CD](./deployment).
Срез реализации и границы проверки — в [обзоре](./#основание-описания).

<DiagramSection>

## GitHub Merge Queue {#merge-queue}

Merge Queue — очередь слияния PR в `main`. Зелёный Check отдельного PR ещё не показывает,
что его изменения совместимы с другими PR, которые успеют попасть в `main` раньше него.
Очередь проверяет именно такое сочетание: актуальный `main`, изменения предшествующих
PR и текущий PR. Автору не приходится обновлять свою ветку после каждого чужого слияния.

GitHub создаёт временную ветку с префиксом `gh-readonly-queue/main/` и запускает
событие `merge_group` с типом `checks_requested`. В нашем frontend оно вызывает тот же
job `Check`: линтер, типы, тесты, сборку клиента/BFF и локальную сборку Docker-образа.
Обязательная проверка выполняется на SHA кандидата, а не просто повторяет проверку
исходной ветки PR. [Механика GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue),
[события и Check в CI](https://github.com/Cringe-Driven-Development-Team/frontend/blob/6e57840f24e60666caddbf963102ae3ce4ef46bd/.github/workflows/ci.yml#L3-L37).

<template #diagram>

```mermaid
%% Sequence: проверка кандидата разрешает merge; публикация зависит от отдельного main CI.
sequenceDiagram
    autonumber
    participant queue as Merge Queue
    participant ci as GitHub Actions / CI
    participant main as main
    participant release as GitHub Release
    queue->>queue: Собрать кандидата: main + PR перед ним + текущий PR
    queue->>ci: merge_group / checks_requested
    ci->>ci: Check кандидата
    alt Обязательные проверки прошли
        ci-->>queue: Успех
        queue->>main: Слить PR
        main->>ci: push в main
        ci->>ci: Check коммита main
        opt Check main прошёл и запуск дошёл до Publish release
            ci->>release: Подготовить, проверить и опубликовать комплект
        end
    else Проверка не прошла или истёк таймаут
        queue->>queue: Исключить PR, перестроить зависимых кандидатов
        Note over queue,main: Этот PR не слит в main
    end
    Note over ci,release: merge_group не публикует выпуск<br>CD запускается отдельно вручную
```

</template>

После успешных обязательных проверок очередь допускает слияние. Получившийся push
в `main` запускает отдельный CI, а `Publish release` разрешён только после его Check.
Сам по себе SHA временного кандидата не означает, что Release с таким SHA существует:
источником готового выпуска служит опубликованный Release для коммита `main`.
Проверки `merge_group` не загружают релизные файлы в S3 и не публикуют образ в GHCR.
[Условие Publish release](https://github.com/Cringe-Driven-Development-Team/frontend/blob/6e57840f24e60666caddbf963102ae3ce4ef46bd/.github/workflows/ci.yml#L39-L65).

На **09.11.2026** правила frontend требуют `Check`, допускают до **двух кандидатов
на проверке одновременно**, но сливают **по одному PR**. Включён `ALLGREEN`: каждый элемент
очереди должен пройти обязательные проверки; таймаут ожидания их результата — **60 минут**.
Параллелизм проверок и число PR в одном слиянии — разные ограничения.
[Правила main через GitHub API](https://api.github.com/repos/Cringe-Driven-Development-Team/frontend/rules/branches/main).
Это описание настроек, а не новый прогон очереди или выкатки приложения.

</DiagramSection>

<DiagramSection>

### Почему кандидат проверяется заново {#merge-queue-recheck}

Пусть в очереди сначала PR A, затем PR B. Кандидат A содержит `main + A`, а кандидат B —
`main + A + B`: B проверяется уже с учётом ожидаемого слияния A. Если проверка A падает
и GitHub исключает A, прежний кандидат B больше не соответствует будущему `main`.
GitHub создаёт для B нового кандидата `main + B` и запрашивает проверки заново.
Даже зелёный результат прежнего кандидата B не подтверждает эту новую комбинацию.

<template #diagram>

```mermaid
%% Flowchart: удаление A меняет состав кандидата B, поэтому требуется новая проверка.
flowchart TD
    base["Исходный main"] --> first["Кандидат A: main + A"]
    base --> second["Кандидат B: main + A + B"]
    first --> failed["Check A не прошёл"]
    failed --> removed["A исключён из очереди"]
    second --> obsolete["Прежний кандидат B<br>больше не подходит"]
    removed --> obsolete
    obsolete --> rebuilt["Новый кандидат B: main + B"]
    rebuilt --> checked{"Новые проверки B прошли?"}
    checked -->|Да| merged["B может быть слит без A"]
    checked -->|Нет| rejected["B не сливается"]
    classDef error fill:#fecaca,stroke:#b91c1c,color:#374151
    classDef decision fill:#fef3c7,stroke:#b45309,color:#374151
    classDef success fill:#a7f3d0,stroke:#047857,color:#374151
    class failed,removed,obsolete,rejected error
    class checked decision
    class merged success
```

</template>

Ошибка обязательной проверки, конфликт с целевой веткой или таймаут могут исключить
PR из очереди. Это отказ на этапе слияния, а не ошибка публикации Release или выкатки:
изменения этого PR ещё не попали в `main` через очередь.
[Разбор неуспешной проверки у GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue#failing-ci).

</DiagramSection>

## Какие события запускают CI

| Событие | Check | Publish release |
| --- | --- | --- |
| Pull request | Линтер, типы, тесты, сборка, локальная сборка BFF-образа | Не запускается |
| Кандидат merge queue | Те же проверки кандидата | Не запускается |
| Push в `main` командного frontend | Те же проверки | После успешного Check |

[ci.yml](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/.github/workflows/ci.yml#L1-L65) задаёт эти условия. Образ в Check остаётся
на runner; релизный образ публикуется в отдельном job. Учебный репозиторий получает копию
`main` через course-sync после Check, независимо от результата Publish release.
Синхронизация репозитория сама по себе не выкатывает сайт.

## Подготовка файлов и образа

1. `Published already` ищет выпуск SHA: уже опубликованный проверяет, у draft читает
   зафиксированный состав, а для отсутствующего разрешает сборку.
2. `Build release` задаёт `RELEASE_SHA` и `CDN_URL`, собирает клиент и BFF. В HTML попадают
   метка выпуска и ссылки на JS/CSS его CDN-каталога.
3. `Upload assets` записывает dist в `releases/<SHA>/` в S3. Сначала ресурсы, последним
   `index.html`. При повторе завершённого каталога байты сверяются: другой сборкой тот же SHA
   не заменяется. Подробности — [upload.ts](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/scripts/release/upload.ts#L32-L78).
4. `Release check` читает HTML и связанные JS/CSS с CDN, проверяет адреса, MIME и CORS.
5. `Publish BFF image` собирает образ с серверным бандлом, HTML и публичными PWA-файлами,
   публикует `ghcr.io/cringe-driven-development-team/bff:sha-<SHA>` и получает digest.
6. `Anonymous image check` проверяет чтение точного образа без credentials и метку коммита.
   VPS также скачивает его анонимно, поэтому package должен быть публичным.
7. `Register release` создаёт полный комплект GitHub Release, проверяет и публикует его.

Порядок задан [шагами CI](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/.github/workflows/ci.yml#L75-L147), состав контейнера —
[Dockerfile](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/apps/bff/Dockerfile#L1-L19). Релизная сборка не повторяется в CD.

<DiagramSection>

## Публикация готового комплекта

До публикации архива CI уже проверил рабочие источники доставки: S3/CDN и GHCR.
Затем он оформляет скачиваемый комплект на странице Release. Черновик не является
доступным для CD выпуском.

<template #diagram>

```mermaid
%% Sequence: подготовка артефактов, затем атомарная граница готовности Release.
sequenceDiagram
    autonumber
    participant ci as CI / Publish release
    participant storage as S3 / CDN
    participant registry as GHCR
    participant releases as GitHub Releases
    ci->>ci: Собрать клиент и BFF одного SHA
    ci->>storage: Загрузить releases/SHA/
    ci->>storage: Проверить HTML, JS, CSS
    ci->>registry: Push BFF, получить digest
    ci->>registry: Проверить анонимное чтение
    ci->>releases: Создать draft на точном SHA
    ci->>releases: release.json, два архива, SHA256SUMS
    ci->>releases: Проверить комплект draft
    ci->>releases: Опубликовать
    ci->>releases: Перечитать и проверить immutable Release
    Note over ci,releases: Готовность не означает выкатку на production
```

</template>

Сначала загружается `release.json`: после него состав draft зафиксирован.
Архив клиента проверяется против dist, архив BFF — через config digest и `docker load`.
Каждый asset должен быть строго меньше 2 GiB. После publish повторно читается Release
и проверяются неизменяемость, тег, четыре asset, суммы и происхождение сборки.
[Проверка и публикация](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/scripts/release/releases.ts#L508-L616).

</DiagramSection>

## Что делает immutable

Публикация должна происходить при включённых immutable releases репозитория.
Проверка CD отвергает Release без `immutable: true`. GitHub защищает asset и связанный тег
от изменения; название и описание остаются редактируемыми. Поэтому состав проверяется
по manifest и данным API, а не по тексту release notes.
[Проверка Release](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/scripts/release/releases.ts#L321-L347),
[правила GitHub](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases).

<DiagramSection>

## Повтор и незавершённый draft {#retry}

Повтор успешной публикации проверяет существующий выпуск и пропускает её без создания
новой версии. У draft с manifest недостающий комплект восстанавливается из сохранённых
S3-файлов и точного GHCR digest; исходные `ci_run` и `ci_run_attempt` сохраняются,
`publication_run` и сведения попытки публикации обновляются.

<template #diagram>

```mermaid
%% State: состояние Release, а не состояние job или production.
stateDiagram-v2
    direction TB
    state "Release отсутствует" as absent
    state "Draft без manifest" as emptyDraft
    state "Draft с зафиксированным составом" as fixedDraft
    state "Published immutable" as published
    [*] --> absent
    absent --> emptyDraft: Артефакты проверены, создать draft
    emptyDraft --> fixedDraft: Сохранить release.json
    note right of fixedDraft: Повтор продолжает загрузку assets
    fixedDraft --> published: Комплект проверен, publish
    note right of published: Повтор проверяет и пропускает публикацию
    emptyDraft --> absent: После ручной сверки удалить незавершённый draft
```

</template>

Проверки состояний — [published](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/scripts/release/releases.ts#L429-L453) и
[draftManifest](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/scripts/release/releases.ts#L350-L364). После ошибки job:

1. Откройте `Publish release`, найдите первый упавший шаг и страницу draft/Release.
2. Если draft имеет `release.json`, после устранения причины используйте **Re-run jobs**:
   сохранённый состав позволяет продолжить без новой релизной сборки.
3. Если draft не имеет `release.json`, сначала ответственный за выпуск сверяет S3 и GHCR.
   Только для этого незавершённого draft допустимо ручное удаление через страницу Release
   или `gh release delete "$release_tag" --repo Cringe-Driven-Development-Team/frontend`,
   затем повтор CI. Не применяйте эту команду к опубликованному выпуску.
4. Если publish выполнился, но ответ потерялся, сначала перечитайте Release: повторная
   проверка может подтвердить готовность. Красный job не заменяет проверку опубликованного объекта.

</DiagramSection>

<DiagramSection>

## Очередь и несколько коммитов подряд

В процессе есть три разных механизма ожидания:

| Механизм | Что упорядочивает | Назначение |
| --- | --- | --- |
| GitHub Merge Queue | PR и проверяемые сочетания изменений | Допустить совместимые изменения в `main` |
| Concurrency workflow CI: <code v-pre>ci-${{ github.ref }}</code> | Запуски CI одного ref | Ограничить одновременные запуски; новый коммит PR отменяет его прежний CI |
| Concurrency job: `release-board` | Publish release, CD, Rollback и обработчик закрытия задач | Последовательно менять каталог выпусков, production и статусы задач |

<template #diagram>

```mermaid
%% Flowchart: очередь слияния, concurrency CI и общая очередь операций имеют разные объекты.
flowchart TD
    prs["Pull requests"] --> mergeQueue["Merge Queue<br>проверка сочетаний и слияние"]
    mergeQueue --> push["Push в main"]
    push --> workflow["CI данного ref<br>concurrency workflow"]
    workflow -->|Check прошёл| publish["Job Publish release"]
    publish --> board["release-board<br>одна операция за раз"]
    operations["Ручной CD / Rollback<br>или обработчик issues.closed"] --> board
    board --> result["Публикация выпуска,<br>попытка выкатки или обновление задач"]
    classDef trigger fill:#fed7aa,stroke:#c2410c,color:#374151
    classDef queue fill:#ddd6fe,stroke:#7c3aed,color:#374151
    class prs,push,operations trigger
    class mergeQueue,workflow,board queue
```

</template>

Concurrency workflow действует на весь запуск CI, включая ожидание и выполнение
Publish release. Проверки кандидатов Merge Queue имеют отдельные ref и поэтому
не используют одну общую группу с main CI.

Publish release, CD, Rollback и обработчик закрытия задач используют общую job concurrency
`release-board`, `cancel-in-progress: false`, `queue: max`. Check работает независимо.
Очередь сериализует операции; её порядок не является порядком версий.

У самого CI есть ещё concurrency по ref: идущий main CI не отменяется, но более новый
ожидающий main CI может вытеснить предыдущий. Поэтому не каждый промежуточный коммит
обязательно получит Release. Поздний коммит содержит предыдущие изменения;
[выбор CD](./deployment#selection) опирается на историю кода, а не на очередность загрузок.
[Concurrency в CI](https://github.com/Cringe-Driven-Development-Team/frontend/blob/6e57840f24e60666caddbf963102ae3ce4ef46bd/.github/workflows/ci.yml#L14-L65).

</DiagramSection>

После публикации обновляются карточки задач. Уведомление о готовом выпуске отправляет
webhook-сервис по `release.published`; отдельный `on: release` workflow не требуется.
Если карточка или уведомление не появились, переходите к [диагностике](./troubleshooting#diagnosis).
