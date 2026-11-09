---
title: Откат
---

[← Трек BFF](../bff) · [Как проходит выкатка](./release) · [Сборка и запуск](./build-and-run)

# Ручной откат BFF

Rollback возвращает сохранённый выпуск без пересборки. Его цель определяется историей
production, а состав проверяется по GitHub Release. Подробные UI/CLI и схема выбора —
в [инструкции отката](/documentation/frontend/releases/rollback).
Описание сверено с кодом 09.11.2026; новый откат на production не выполнялся.

## Как выбрать прежний выпуск

Значения SHA, digest и Deployment — в [терминах](./release#термины).

Если последняя попытка имеет `success`, берётся предыдущий успешный выпуск с другим digest.
После `failure` или `error` выбирается последний успешный выпуск. Незавершённая или неизвестная
последняя попытка, отсутствие цели или неоднозначный digest останавливают выбор до изменения VPS.
Последний success — подтверждённая история проверки, а не датчик текущего состояния контейнера.
[Алгоритм выбора](/documentation/frontend/releases/rollback#target).

## Проверка и переключение

Workflow проверяет Release цели, направление к предку, публичный GHCR digest и CDN.
Затем создаёт отдельный production Deployment с `action=rollback`, передаёт SHA и digest
в Ansible и проверяет результат. BFF возвращает HTML и ссылки на ассеты выбранного SHA.
Ошибка в Ansible может означать частичное переключение; провал Health check после успешного
Switch BFF означает `failure`. Автоматического отката не происходит.

[Проверки результата](/documentation/frontend/releases/deployment#что-проверяет-health-check)
и [диагностика ошибок](/documentation/frontend/releases/troubleshooting#diagnosis).
Реализация — [Rollback](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/.github/workflows/rollback.yml#L40-L143) и
[выбор цели](https://github.com/Cringe-Driven-Development-Team/frontend/blob/319e691b79f81e09dcffabc04941831a5f4b5930/scripts/release/deployments.ts#L52-L143).

## Что остаётся доступным

Retention сохраняет последние пять каталогов клиента в S3, а также ассеты последнего
успешного и предыдущего успешного выпуска с другим digest независимо от возраста.
После неуспешной или незавершённой попытки очистка откладывается. Файлы GitHub Release
этой очисткой не удаляются, но сами по себе не восстанавливают отсутствующие CDN-файлы
или GHCR-образ. [Правила хранения](/documentation/frontend/releases/artifacts#retention).

`SESSION_KEY` берётся из Vault; одинаковый ключ позволяет читать действительную cookie.
Откат BFF не откатывает Go API, миграции и данные PostgreSQL.
[Границы отката](/documentation/frontend/releases/rollback#границы-отката).
