# BFF: проверенная часть

Проверено 31.10.2026 в 13:11 UTC на [cellestial.ru](https://cellestial.ru) в чистом Chrome:
гостю доступна форма входа, запросы tRPC проходят отдельную проверку CSRF и сессии.
Это свидетельство только гостевого маршрута, а не готовности всего [трека BFF](/modules/2/tracks/bff).

## Что наблюдается на проде

| Сценарий | Результат |
| --- | --- |
| Открыть `/` в чистом браузере | `302` на `/login`, затем `200`, видна форма входа |
| Прочитать bootstrap HTML `/login` | `user: null`, cookie гостю не установлены |
| Из этой страницы вызвать `GET /api/trpc/users.me` без `X-CSRF` | `403`, `appCode: csrf_invalid` |
| Повторить тот же GET с `X-CSRF: 1` | `401`, сообщение «Нет сессии» |
| Вызвать прежний `GET /api/v1/users/me` | `404 Not Found` |

Браузер → BFF: HTML и `/api/trpc/*` — наблюдаемый публичный маршрут. Обычный curl к `/`
без `Accept: text/html` возвращает `404`; это не свидетельство недоступности формы входа.
Результат согласуется с [маршрутизацией BFF](https://github.com/Cringe-Driven-Development-Team/frontend/blob/dd3d11fbeebe5bf1e2b51fdd663a36d1829a4e64/apps/bff/src/app.ts#L34-L55).

Старое описание Double Submit Cookie сохранено по [прежнему адресу CSRF](/security/csrf/)
как история проверки 07.10.2026. Его три cookie и `X-CSRF-Token` не описывают проверенный
гостевой маршрут BFF.

## Релизы и граница доказательства

На момент проверки GitHub Deployments сообщает `success` для следующих production-выкладок:

| Репозиторий | SHA | Свидетельство выкладки |
| --- | --- | --- |
| frontend | `dd3d11fbeebe5bf1e2b51fdd663a36d1829a4e64` | [Deployment 7389948880](https://api.github.com/repos/Cringe-Driven-Development-Team/frontend/deployments/7389948880/statuses), [CD 28.10](https://github.com/Cringe-Driven-Development-Team/frontend/actions/runs/40717708570) |
| backend | `23d3dd9e955424a7634fb0dc49a38af6eb08792c` | [Deployment 7434158986](https://api.github.com/repos/Cringe-Driven-Development-Team/backend/deployments/7434158986/statuses), [CD 30.10](https://github.com/Cringe-Driven-Development-Team/backend/actions/runs/41027513296) |
| infra | `14653763279dab055e3cea47a84a0c531bccf03f` | [Deployment 7458961353](https://api.github.com/repos/Cringe-Driven-Development-Team/infra/deployments/7458961353/statuses), [CD 31.10](https://github.com/Cringe-Driven-Development-Team/infra/actions/runs/41203603237) |

Это SHA из источника выкладки, не измерение версии работающего процесса. Успех deployment
сам по себе не подтверждает пользовательский сценарий; наблюдения выше проверены отдельно.

## Где искать реализацию

Код маршрута **браузер → BFF → Go** принадлежит двум репозиториям:

- [frontend: сборка обработчиков HTML и tRPC](https://github.com/Cringe-Driven-Development-Team/frontend/blob/dd3d11fbeebe5bf1e2b51fdd663a36d1829a4e64/apps/bff/src/bff.ts#L21-L32).
- [Проверка CSRF перед чтением сессии](https://github.com/Cringe-Driven-Development-Team/frontend/blob/dd3d11fbeebe5bf1e2b51fdd663a36d1829a4e64/apps/bff/src/context.ts#L25-L31).
  Код требует `X-CSRF: 1`; для POST дополнительно проверяет `Origin` и `Sec-Fetch-Site`.
  На проде в этой проверке испытаны только два GET из таблицы, не вся матрица защиты.
- [Вызов Go через сессию BFF](https://github.com/Cringe-Driven-Development-Team/frontend/blob/dd3d11fbeebe5bf1e2b51fdd663a36d1829a4e64/apps/bff/src/go/api.ts#L44-L55)
  и [backend на SHA выкладки](https://github.com/Cringe-Driven-Development-Team/backend/tree/23d3dd9e955424a7634fb0dc49a38af6eb08792c).
  Участок BFF → Go здесь подтверждён исходниками, **не проверен авторизованным сценарием на проде**.
- [Локальная разработка frontend и BFF](https://github.com/Cringe-Driven-Development-Team/frontend/blob/dd3d11fbeebe5bf1e2b51fdd663a36d1829a4e64/docs/local-development.md#L1-L11).

## Что ещё нужно проверить

Нет проверяемого свидетельства входа и регистрации, refresh и параллельных запросов,
выхода, открытия и изменения блокнотов, работы после истечения сессии и POST-защиты от чужого
Origin. Нужен прогон с тестовой учётной записью или свидетельство владельца с датой,
релизом и результатами. Эти возможности остаются [планом авторизации](/modules/2/tracks/bff/auth)
и других страниц трека, а не текущими фактами этой страницы.
