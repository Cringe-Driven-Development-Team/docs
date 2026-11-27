---
title: Выкатки Frontend
---

# Выкатки фронта {#release-overview}

Push в `main` запускает проверки и публикацию выпуска. Для переключения сайта оператор отдельно запускает **CD**. Результат переключения проверяйте по Health check и статусу соответствующего Deployment в `production`. [CI](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/ci.yml#L3-L49), [CD](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/cd.yml#L3-L41), [проверка результата](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/cd.yml#L117-L156).

## Кто за что отвечает

| Участник | Результат |
| --- | --- |
| GitHub Actions | Check проверяет коммит, Publish release собирает и публикует выпуск, CD и Rollback применяют выбранный выпуск. [CI](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/ci.yml#L22-L65), [CD](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/cd.yml#L47-L79), [Rollback](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/rollback.yml#L40-L64). |
| GitHub Releases | Тег и [четыре файла](./artifacts) фиксируют состав и происхождение выпуска. [Проверка комплекта](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/release/releases.ts#L323-L351). |
| GHCR и Selectel S3/CDN | GHCR отдаёт образ BFF по digest, CDN доставляет клиентские файлы из каталога выпуска в S3. [Публикация образа и ассетов](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/ci.yml#L83-L121). |
| Ansible и GitHub Deployments | Ansible переключает BFF, Actions сохраняет целевой SHA и итог попытки. [Playbook](https://github.com/Cringe-Driven-Development-Team/infra/blob/ab7c4e189a2e346244b420f675adec7ced43557c/ansible/deploy-bff.yml#L1-L43), [итог операции](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/cd.yml#L117-L148). |

## От коммита до production

<span id="маршрут-чтения"></span>

<Diagram name="frontend-release-lifecycle" />

1. Дождитесь Check на push в `main` и успешной [публикации](./publication).
2. Возьмите тег опубликованного выпуска и запустите [CD](./deployment).
3. Сверьте SHA выбранного выпуска с записью `production` и её результатом.
4. При сбое откройте [таблицу диагностики](./troubleshooting#diagnosis). Для возврата к подтверждённому выпуску проверьте [правило выбора цели Rollback](./rollback#target).

## Какие результаты различать

| Свидетельство | Что зафиксировано |
| --- | --- |
| Check успешен | Коммит прошёл проверки, включая сборку BFF-образа на runner. [Check](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/ci.yml#L22-L40). |
| Появился published immutable Release | В GitHub зафиксирован проверенный комплект. [Публикация](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/scripts/release/releases.ts#L509-L617). |
| Health check успешен и Deployment имеет `success` | Проверки выбранного выпуска на сайте прошли, результат записан. [CD](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/cd.yml#L138-L148). |
| Update release issues успешен | Автоматика обработала карточки по отчёту операции. Сбой карточек после `success` исправляется по исходному Deployment ID. [Порядок обновления](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/cd.yml#L142-L165), [восстановление](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/reconcile-issues.yml#L3-L44). |

## Основание описания

Команды и параметры сверены по [CI](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/ci.yml#L3-L65), [CD](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/cd.yml#L3-L41) и [Rollback](https://github.com/Cringe-Driven-Development-Team/frontend/blob/68ffe99600f8ea66765972c6bf963c47aafad626/.github/workflows/rollback.yml#L3-L56) из `main` frontend. Примеры взяты из записей GitHub за 27.11.2026. Выпуск [`b1baf996fb6753d1a62eab6f874d03dca30faadc`](https://github.com/Cringe-Driven-Development-Team/frontend/releases/tag/release-b1baf996fb6753d1a62eab6f874d03dca30faadc) опубликован в 17:52:21 UTC, подтверждён [CD](./deployment#как-подтвердить-результат) в 18:31:31 UTC и восстановлен [Rollback](./rollback#target) в 19:45:23 UTC.
