---
title: Откат
---

# Откат {#release-rollback}

Запустите **Rollback** из `main`, чтобы восстановить подходящий подтверждённый выпуск из истории `production`. Перед запуском проверьте последнюю попытку, ожидаемый SHA и доступность [комплекта](./artifacts#retention). Для ручного запуска нужен Write-доступ к `Cringe-Driven-Development-Team/frontend`. [Ручной запуск Actions](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow). [Workflow](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/rollback.yml#L3-L64).

## Как выбирается цель {#target}

1. Откройте [production Deployments](https://github.com/Cringe-Driven-Development-Team/frontend/deployments) и найдите последнюю попытку.
2. Определите ожидаемую цель, затем сверяйте её с логом **Rollback target**.

| Статус последней попытки | Цель |
| --- | --- |
| `success` | Предыдущий успешный Deployment с другим digest. |
| `failure` или `error` | Последний успешный Deployment. |
| Попытка не завершена, цель отсутствует или целевому SHA соответствуют разные digest | Workflow останавливается до изменений на VPS. |

Скрипт сверяет цель с её Release и проверяет направление к предку. При восстановлении допустим тот же SHA. Затем проверяет GHCR и CDN. [Выбор цели](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/release/deployments.ts#L54-L110), [сверка Release](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/release/deployments.ts#L139-L164), [шаги Rollback](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/rollback.yml#L48-L64).

27.11.2026 в 19:43:58 UTC [Rollback run](https://github.com/Cringe-Driven-Development-Team/frontend/actions/runs/46058681997) прочитал последнюю [попытку 8117981490](https://api.github.com/repos/Cringe-Driven-Development-Team/frontend/deployments/8117981490/statuses) с SHA `bfab8a485c78412a814b3765d10ef83a6267deed` и статусом `error`. Он выбрал предыдущий подтверждённый [выпуск](https://github.com/Cringe-Driven-Development-Team/frontend/releases/tag/release-b1baf996fb6753d1a62eab6f874d03dca30faadc) `b1baf996fb6753d1a62eab6f874d03dca30faadc`. В 19:45:23 UTC новая [попытка 8118066244](https://api.github.com/repos/Cringe-Driven-Development-Team/frontend/deployments/8118066244/statuses) получила `success` после Health check. [Код workflow этого run](https://github.com/Cringe-Driven-Development-Team/frontend/blob/bfab8a485c78412a814b3765d10ef83a6267deed/.github/workflows/rollback.yml#L48-L148).

## Запуск Rollback

1. Откройте [Actions → Rollback](https://github.com/Cringe-Driven-Development-Team/frontend/actions/workflows/rollback.yml). Выберите **Run workflow** и ветку `main`. Цель задаётся историей, поэтому поля с тегом нет. [Вход workflow](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/rollback.yml#L3-L5).
2. Запустите workflow или выполните эквивалентную команду:

   ```bash
   gh workflow run rollback.yml --repo Cringe-Driven-Development-Team/frontend --ref main
   ```

3. Проверьте в **Rollback target** SHA, digest и причину выбора. После **Switch BFF** дождитесь **Health check** и **Production result**. В Deployments найдите запись `action=rollback` с целевым SHA и статусом `success`. [Шаги операции](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/rollback.yml#L107-L148).
4. Проверьте **Update release issues**. Удаляемые из production изменения получают `Rollback from production` без переоткрытия задач. При сбое используйте [исходный ID](./troubleshooting#reconcile-issues). [Статусы](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/docs/release.md#L312-L317).

## Границы отката

Playbook восстанавливает образ BFF по digest, вместе с HTML и ссылками на клиентские файлы его SHA. Go и PostgreSQL остаются на своих версиях. Действующие cookie читаются при сохранении ключа сессии из Vault. [Playbook](https://github.com/Cringe-Driven-Development-Team/infra/blob/ab7c4e189a2e346244b420f675adec7ced43557c/ansible/deploy-bff.yml#L1-L43), [границы операции](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/docs/release.md#L214-L229).

## Если откат не прошёл

| Где остановился | Что делать |
| --- | --- |
| Rollback target | Уточните статус последней попытки и наличие подходящей цели. |
| Check release direction | Сверьте направление. Чтобы снова применить потомка после отката к предку, используйте [CD](./deployment). |
| Anonymous image check или Release check | Проверьте digest в GHCR и каталог CDN. |
| Switch BFF или Health check | Проверьте фактически запущенный образ и первый упавший тест. Используйте [диагностику](./troubleshooting#diagnosis) перед повтором. |

[Направление](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/docs/release.md#L319-L323), [шаги и условие результата](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/rollback.yml#L48-L64), [Production result](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/rollback.yml#L107-L148).
