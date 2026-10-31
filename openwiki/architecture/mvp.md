---
type: architecture
title: Проверенный маршрут BFF и границы архитектуры
description: Гостевой маршрут браузер → BFF, свидетельства production-выкладок и граница проверки участка BFF → Go на 31 октября 2026 года.
tags: [architecture, bff, production, evidence]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-31T13:49:52.870Z
sources:
  - id: openwiki-source-644e9151128f44f1b3e1fd7f
    resource: repo://site/architecture/index.md
  - id: openwiki-source-4f5bdd77990b98e5f7081f26
    resource: repo://site/documentation/bff.md
generated: { by: "codex", at: "2026-10-31T13:49:52.870Z" }
---

# Проверенный маршрут BFF

Каноническое свидетельство — проверка **31.10.2026 в 13:11 UTC** на [cellestial.ru](https://cellestial.ru) в чистом Chrome. Она подтверждает гостевой маршрут браузер → BFF: HTML и `/api/trpc/*`. Ниже пересказ этого свидетельства, а не новая проверка стенда. [Источник: site/documentation/bff.md, строки 3–19](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/documentation/bff.md#L3-L19).

## Что проходит от браузера до BFF

| Действие гостя | Наблюдаемый результат |
| --- | --- |
| Открыть `/` в чистом браузере | `302` на `/login`, затем `200` и форма входа |
| Прочитать bootstrap HTML `/login` | `user: null`, cookie не установлены |
| Вызвать `GET /api/trpc/users.me` без `X-CSRF` | `403`, `appCode: csrf_invalid` |
| Повторить GET с `X-CSRF: 1` | `401`, «Нет сессии» |
| Вызвать `GET /api/v1/users/me` | `404 Not Found` |

Обычный curl к `/` без `Accept: text/html` возвращает `404`; такой запрос не воспроизводит браузерное открытие формы. Таблица и это условие зафиксированы в [site/documentation/bff.md, строки 9–19](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/documentation/bff.md#L9-L19). Порядок отказов подробнее разобран на странице [безопасности BFF](security-bff.md).

## Какие выкладки зафиксированы

На момент той же проверки источник сообщает `success` в GitHub Deployments для трёх production-выкладок. Это SHA из системы выкладки, а не измерение версии работающего процесса. [Источник: site/documentation/bff.md, строки 25–36](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/documentation/bff.md#L25-L36).

| Компонент | SHA выкладки | Свидетельство |
| --- | --- | --- |
| frontend | `dd3d11fbeebe5bf1e2b51fdd663a36d1829a4e64` | [Deployment 7389948880](https://api.github.com/repos/Cringe-Driven-Development-Team/frontend/deployments/7389948880/statuses), [CD 28.10](https://github.com/Cringe-Driven-Development-Team/frontend/actions/runs/40717708570) |
| backend | `23d3dd9e955424a7634fb0dc49a38af6eb08792c` | [Deployment 7434158986](https://api.github.com/repos/Cringe-Driven-Development-Team/backend/deployments/7434158986/statuses), [CD 30.10](https://github.com/Cringe-Driven-Development-Team/backend/actions/runs/41027513296) |
| infra | `14653763279dab055e3cea47a84a0c531bccf03f` | [Deployment 7458961353](https://api.github.com/repos/Cringe-Driven-Development-Team/infra/deployments/7458961353/statuses), [CD 31.10](https://github.com/Cringe-Driven-Development-Team/infra/actions/runs/41203603237) |

## Где заканчивается проверенный маршрут

Реализацию HTML и tRPC документ связывает с [frontend/apps/bff/src/bff.ts на SHA frontend](https://github.com/Cringe-Driven-Development-Team/frontend/blob/dd3d11fbeebe5bf1e2b51fdd663a36d1829a4e64/apps/bff/src/bff.ts#L21-L32). Для участка BFF → Go он указывает [apps/bff/src/go/api.ts на том же SHA](https://github.com/Cringe-Driven-Development-Team/frontend/blob/dd3d11fbeebe5bf1e2b51fdd663a36d1829a4e64/apps/bff/src/go/api.ts#L44-L55) и [backend на SHA выкладки](https://github.com/Cringe-Driven-Development-Team/backend/tree/23d3dd9e955424a7634fb0dc49a38af6eb08792c). Это указатели из канонического документа; при обновлении wiki текущий main этих репозиториев отдельно не исследовался. **Авторизованный участок BFF → Go не подтверждён продовым сценарием.** [Источник: site/documentation/bff.md, строки 38–49](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/documentation/bff.md#L38-L49).

Для входа, регистрации, refresh, параллельных запросов, выхода, блокнотов, истечения сессии и POST-защиты от чужого Origin в корпусе нет проверяемого свидетельства. Это граница знания, а не вывод об отказе этих функций. [Источник: site/documentation/bff.md, строки 51–57](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/documentation/bff.md#L51-L57).

Общую инфраструктуру нельзя достроить по сохранённым схемам: страница архитектуры не считает `deployment`, `cd`, `frontend` и `contract` текущей моделью, а `ci` и `infra` целиком не сверялись при этой проверке. Их связи здесь не используются как доказательство действующего прода. [Источник: site/architecture/index.md, строки 7–16](https://github.com/Cringe-Driven-Development-Team/docs/blob/06110c81c5fa0972ad1171d2213dfc7866a5b020/site/architecture/index.md#L7-L16).

За подробностями реализации переходи к [владельцу компонента](../concepts/sources.md); для выбора темы — к [карте документации](../quickstart.md).
