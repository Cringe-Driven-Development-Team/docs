---
title: Выкатки фронта
---

# Выкатки фронта {#release-overview}

Выпуск фронта связывает клиент и BFF одного коммита. CI собирает и публикует его,
а человек отдельно запускает CD, чтобы переключить production. Здесь можно проследить
этот путь, скачать файлы, выполнить выкатку или откат и найти причину ошибки.

## Маршрут чтения

| Страница | Что узнаете и сможете сделать |
| --- | --- |
| [CI и публикация](./publication) | Как Merge Queue проверяет PR перед слиянием, как коммит становится выпуском и что делать после обрыва публикации |
| [Состав выпуска](./artifacts) | Где находятся файлы, что означают SHA/digest и как скачать комплект |
| [Выкатка](./deployment) | Как запустить CD, выбрать выпуск и проверить результат |
| [Откат](./rollback) | Как штатный Rollback выбирает цель и когда он остановится |
| [Ошибки и уведомления](./troubleshooting) | Где искать свидетельства и почему красный CD не всегда означает старый код на сайте |

## Кто за что отвечает

| Сервис | Что хранит или выполняет | Где смотреть |
| --- | --- | --- |
| GitHub Actions | Выполняет Check, Publish release, CD и Rollback; хранит логи и Summary запусков | [Actions](https://github.com/Cringe-Driven-Development-Team/frontend/actions) |
| GitHub Releases | Каталог готовых выпусков: тег, описание, два архива, manifest и суммы | [Releases](https://github.com/Cringe-Driven-Development-Team/frontend/releases) |
| GitHub Deployments | Записи отдельных попыток выкатки/отката и их статусы; ссылки на выпуск и run | [Deployments](https://github.com/Cringe-Driven-Development-Team/frontend/deployments) → `production` |
| GHCR | Публичный Docker-образ BFF; CD скачивает точный образ по digest | [Пакет bff](https://github.com/orgs/Cringe-Driven-Development-Team/packages/container/package/bff) |
| Selectel S3 | Файлы клиента в каталоге `releases/<полный SHA>/` | Путь `assets` в `release.json` |
| CDN | Доставляет ресурсы из S3 по адресам `https://cdn.cellestial.ru/releases/<SHA>/…` и кеширует их | Network браузера, шаг Release check |
| Gateway: Caddy и BFF | Caddy принимает запрос; выбранный контейнер BFF выдаёт HTML и обслуживает API клиента | [Сайт](https://cellestial.ru), шаги Switch BFF и Health check |

Release содержит скачиваемые файлы. Deployment содержит метаданные операции — архивов в нём нет.
Actions запускает код, который связывает эти сущности через отдельные API Releases и Deployments.
В нашем проекте это TypeScript-команды `bun run release …` из
[CLI выпуска](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/scripts/release/index.ts#L1-L43), а не встроенная в GitHub логика Cellestial.

## От коммита до production

<Diagram name="frontend-release-lifecycle" />

1. [Merge Queue](./publication#merge-queue) проверяет PR вместе с актуальным `main` и
   предшествующими PR. Успешные проверки допускают слияние, но ещё не создают Release.
2. После Check на push в `main` job Publish release подготавливает клиент и BFF одного SHA.
3. Файлы загружаются в S3, образ — в GHCR; проверяются CDN и анонимное чтение образа.
4. CI публикует GitHub Release с полным комплектом файлов.
5. Человек запускает CD. Он выбирает и проверяет Release, создаёт production Deployment,
   запускает Ansible и проверяет результат через публичный сайт.
6. Статус Deployment фиксирует результат попытки. Webhook-сервис готовит уведомление Telegram.

Связи подтверждены [CI](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/.github/workflows/ci.yml#L39-L147),
[CD](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/.github/workflows/cd.yml#L43-L158) и
[обработчиком уведомлений](https://github.com/Cringe-Driven-Development-Team/.github/blob/372930293656411505315fb09d271c97ab904b13/services/webhook-alerts/README.md#L853-L862).

## Какие результаты различать

**Зелёный Check** означает прохождение проверок, но не публикацию и не выкатку.
**Опубликованный Release** означает готовый комплект. **Успешный production Deployment**
означает, что проверки конкретной попытки прошли. Фактическую работу сайта позже проверяют отдельно.

Метка GitHub **Latest** не показывает текущий production и не определяет выбор нашего CD.
Если B продолжает A, выпуск B уже содержит изменения A: это полная сборка коммита,
а не патч, который нужно соединять с архивом A. [Как CD выбирает выпуск](./deployment#selection).

## Основание описания

Раздел сверён с исходниками 09.11.2026: frontend
[`319e691`](https://github.com/Cringe-Driven-Development-Team/frontend/tree/319e691b79f81e09dcffabc04941831a5f4b5930),
infra [`a59f858`](https://github.com/Cringe-Driven-Development-Team/infra/tree/a59f8584386810b0b94f5fb23cb72c7ff906f6d7),
webhook-сервис [`3729302`](https://github.com/Cringe-Driven-Development-Team/.github/tree/372930293656411505315fb09d271c97ab904b13).
Это чтение реализации, не новый прогон выкатки, отката или доставки уведомлений на production.
Конкретные файлы и строки указаны рядом с объяснениями. Основной технический справочник —
[docs/release.md фронтенда](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/docs/release.md#L23-L44).
