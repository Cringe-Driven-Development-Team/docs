# Схема contract: spec-first через Apidog

Дата: 2026-09-30. Статус: утверждено в чате, ждёт ревью спеки.

## 1. Цель и рамки

Команда работает spec-first: контракт API правится в Apidog, бэк и фронт генерируют
из него код. Сейчас на схемах это видно плохо: Apidog есть только на `ci` (Contract
drift бэка) и на `frontend` (стрелки «типы» и «make generate»). Как меняется
контракт, кто и чем генерирует код, что коммитится и как контракт проверяется в
рантайме, не показано нигде. Фронт на схемах генерирует клиент через openapi-fetch, а
команда решила писать свой генератор и клиент.

В рамках:

- новая схема `diagrams/contract.json`;
- правки `diagrams/frontend.json` и `diagrams/ci.json` под свой пакет `@my/openapi`
  и Contract drift фронта;
- строка `contract` в таблице MVP в README, уточнение строки `ci`.

Вне рамок:

- код пакета, скрипта выгрузки и Contract drift фронта: задача
  [frontend#12](https://github.com/Cringe-Driven-Development-Team/frontend/issues/12),
  слой запросов в духе TanStack Query —
  [frontend#15](https://github.com/Cringe-Driven-Development-Team/frontend/issues/15);
  схемы описывают целевое состояние;
- `deployment`, `cd`, `infra`: Apidog в них не участвует;
- замороженные `diagrams/bff/` и `diagrams/frozen-k3s/`;
- правка прошлых спек. Допущение из `2026-09-29-mvp-single-vps-design.md` §3 («какой
  генератор — на схемах не называется») этой спекой заменяется.

## 2. Проверенные факты

Репа `docs`, `main` на `f338667`:

- `diagrams/frontend.json`: `fe-api-client` «API-клиент · openapi-fetch», `be-oapi`
  «oapi-codegen: strict server», `apidog-spec` «openapi.yaml» в группе «Apidog»
  (green); стрелки `apidog-spec` → `fe-api-client` «типы», `apidog-spec` → `be-oapi`
  «make generate».
- `diagrams/ci.json`: «React repo» с пайплайном «React release» (Install deps → Lint →
  Build → Deploy to NPM → Send to tg), «Frontend repo» только с «CI», «Backend repo» с
  «CI» и «Contract drift (nightly)», группа «NPM Registry» с `@my/react`, стрелка
  `apidog-spec` → `be-generate` «export».
- `scripts/colors.ts`: зона «Рабочее место» — `white`; на `infra` так нарисован
  «Ноут студента» (иконка `laptop`) с Textbox про локальные секреты.
- В `icons.txt` есть `git-branch`, `git-merge`, `book-open`, `file-code`,
  `typescript`, `shield-check`, `npm`, `package`, `laptop`, `go`, `chrome`, `server`.

Репа бэкенда `go-park-mail-ru/2026_2_Cringe_Driven_Development`, `main` на `ba54992`:

- `Makefile`: `generate` = `go run ./cmd/apidog -o internal/api/openapi.yaml`, затем
  `go tool oapi-codegen -config cfg.yaml openapi.yaml` в `internal/api`.
- `cmd/apidog/main.go`: `POST https://api.apidog.com/v1/projects/1382426/export-openapi`,
  заголовки `Authorization: Bearer $APIDOG_TOKEN`, `X-Apidog-Api-Version: 2024-03-28`;
  тело `scope: ALL`, `oasVersion: "3.1"`, `exportFormat: "YAML"`, `branchId` из
  `APIDOG_BRANCH_ID` (без него — `main`). Токен и ветка читаются из окружения или `.env`.
- `go.mod`: `tool github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen`
  (`v2.8.0`); `internal/api/cfg.yaml`: `gorilla-server`, `strict-server`, `models`,
  `embedded-spec` → `api.gen.go`.
- `.gitignore`: `internal/api/openapi.yaml` не коммитится; `api.gen.go` и `cfg.yaml`
  в git.
- `internal/middleware/validator.go`: `oapi-codegen/nethttp-middleware`
  `OapiRequestValidatorWithOptions` проверяет запросы по встроенной спеке.
- `.github/workflows/contract-drift.yml`: `cron: '0 6 * * *'` и `workflow_dispatch`,
  `make generate` с секретом `APIDOG_TOKEN`, падает при `git status --porcelain` не
  пустом.
- README, «Как менять контракт»: источник истины — ветка `main` Apidog, она защищена;
  правки идут через sprint-ветку (имя как у ветки в git, `api-16`) и Merge Request,
  его одобряет администратор ветки; опубликованная документация —
  `https://vb78fyael1.apidog.io/`; в `main` репы попадает только код, сгенерированный
  из `main` Apidog; слияние ресурса перезаписывает его версию в `main` целиком.
- Встроенная спека (`api.GetSwagger()`): OAS `3.1.0`, 7 путей (`/auth/login`,
  `/auth/logout`, `/auth/refresh`, `/auth/register`, `/notebooks`, `/notebooks/{id}`,
  `/users/me`), 6 схем, `bearerAuth` (JWT).

Репа фронтенда `frontend-park-mail-ru/2026_2_Cringe_Driven_Development`, `main` на
`64e4e53`: кода нет, только README и `.github`. Ветка `web-1`: `typescript ^7.0.2`,
`@maninthecoat/react`.

Репа `Cringe-Driven-Development-Team/react`, `main` на `e7c4845`: пакет
`@maninthecoat/react`, публикация скриптами `release:*` через `bun publish`, в
`.github/workflows` только `automation.yml`: пайплайн релиза на `ci` — целевое
состояние.

openapi-typescript 7.13.0 (последний) строит типы через `ts.factory`, в TypeScript 7
его нет: [openapi-typescript#2841](https://github.com/openapi-ts/openapi-typescript/issues/2841)
открыт.

## 3. Принятые решения

| Решение | Почему | Отвергнуто |
| --- | --- | --- |
| Отдельная схема `contract` | процесс spec-first виден целиком на одной странице | только поправить подписи на `frontend` и `ci` |
| Сквозной поток: Apidog → ноут студента → GitHub → NPM → Selectel | видно, где правят контракт, кто генерирует и с каким токеном, что коммитится, как ловится отставание и где контракт проверяется в рантайме | только кодогенерация без ноута и рантайма; цепочка шагов процесса |
| Свой генератор и клиент, один npm-пакет `@my/openapi` в отдельной репе организации | решение команды, как свой React; одна версия генератора и клиента | openapi-typescript + openapi-fetch; код в репе фронта; два пакета в монорепе |
| Фронт выгружает спеку из Apidog сам, скриптом в своей репе, в JSON | фронт не зависит от бэка; JSON читает `JSON.parse` | брать `openapi.yaml` из репы бэка (его там нет, он в `.gitignore`) |
| Генератор не знает про Apidog: файл на входе, `schema.d.ts` на выходе | пакет остаётся универсальным | выгрузка внутри CLI пакета |
| Contract drift фронта, ночной, как у бэка | отставание `schema.d.ts` от Apidog ловится автоматически | только typecheck в CI |
| Имя пакета на схемах — плейсхолдер `@my/openapi` | так же подписан `@my/react` | реальный скоуп npm |

## 4. Схема `contract`

Общее: цвета и легенда по скиллу `eraser-diagrams` (`bun run check`), узел
пользователя — `client`. Узла `telegram` нет. Координаты и точная раскладка — в
плане, здесь состав и связи.

### 4.1 Узлы

- Группа `apidog` «Apidog» (green, иконка `cloud`):
  `apidog-branch` «sprint-ветка api-{n}» (`git-branch`),
  `apidog-main` «main (защищена)» (`git-merge`),
  `apidog-export` «Open API: export-openapi, OAS 3.1» (`file-code`),
  `apidog-docs` «Опубликованная документация» (`book-open`).
- Группа `laptop` «Ноут студента» (white, иконка `laptop`):
  - Textbox `laptop-env`: «`.env` в `.gitignore`: личный `APIDOG_TOKEN`,
    `APIDOG_BRANCH_ID` — для sprint-ветки»;
  - вложенная `be-generate` «make generate (бэк)»: Activity `be-export` «cmd/apidog»,
    `be-codegen` «oapi-codegen»;
  - вложенная `fe-generate` «bun run generate (фронт)»: Activity `fe-export`
    «scripts/apidog.ts», `fe-codegen` «@my/openapi CLI».
- Группа `github` «GitHub» (purple):
  - `repo-backend` «Backend repo» (`go`): `be-code` «api.gen.go: strict server,
    models, embedded spec» (`go`); вложенная `be-drift` «Contract drift (nightly)»:
    `be-drift-generate` «make generate» → `be-drift-compare` «Compare with code»;
  - `repo-frontend` «Frontend repo» (`react`): `fe-schema` «src/api/schema.d.ts»
    (`typescript`), `fe-client` «src/api/client.ts» (`file-code`);
    вложенная `fe-drift` «Contract drift (nightly)»: `fe-drift-generate` «bun run
    generate» → `fe-drift-compare` «Compare with code»;
  - `repo-openapi` «OpenAPI repo» (`package`): `op-package` «@my/openapi: генератор и
    клиент» (`package`).
- Группа `npm-registry` «NPM Registry» (green, `npm`): `npm-openapi` «@my/openapi»
  (`npm`).
- Группа `selectel` «Selectel» (blue), вложенная `vps` «VPS · Docker Compose»
  (`docker`): `caddy` «Caddy» (`server`), `go-api` «Go API · OapiRequestValidator»
  (`go`).
- `client` «Client (браузер)» (`chrome`) вне групп.
- Textbox `rules` «Правила контракта»:
  1. Контракт правят только в sprint-ветке Apidog, `main` защищена, слияние через
     Merge Request.
  2. В `main` репы попадает только код, сгенерированный из `main` Apidog: перед мержем
     PR перегенерировать без `APIDOG_BRANCH_ID`.
  3. Сгенерированный код (`api.gen.go`, `schema.d.ts`) коммитится и руками не правится.
  4. Слияние перезаписывает ресурс в `main` целиком: ревьюер Merge Request сверяет его
     с текущим `main`.
  5. Генератор и клиент фронта — один пакет `@my/openapi`, одна версия.

### 4.2 Связи

Цвет и стиль — по таблице скилла, от концов стрелки.

| От | К | Подпись |
| --- | --- | --- |
| `apidog-branch` | `apidog-main` | Merge Request |
| `apidog-main` | `apidog-docs` | — |
| `apidog-main` | `apidog-export` | — |
| `apidog-export` | `be-export` | YAML |
| `apidog-export` | `fe-export` | JSON |
| `be-export` | `be-codegen` | openapi.yaml |
| `fe-export` | `fe-codegen` | openapi.json |
| `be-codegen` | `be-code` | commit |
| `fe-codegen` | `fe-schema` | commit |
| `fe-schema` | `fe-client` | типы paths |
| `apidog-export` | `be-drift-generate` | main |
| `apidog-export` | `fe-drift-generate` | main |
| `be-drift-generate` | `be-drift-compare` | — |
| `fe-drift-generate` | `fe-drift-compare` | — |
| `op-package` | `npm-openapi` | release |
| `npm-openapi` | `fe-codegen` | CLI |
| `npm-openapi` | `fe-client` | createClient |
| `be-code` | `go-api` | embedded spec |
| `client` | `caddy` | https://site.ru/api/v1 |
| `caddy` | `go-api` | /api/v1/* |

URL документации (`https://vb78fyael1.apidog.io`) на стрелку не ставим: участок между
иконками короткий, URL ломается по буквам; адрес есть в README бэка. Стрелку
`fe-client` → `client` не рисуем: как бандл попадает в браузер, показывают `frontend`
и `cd`.

## 5. Правки `frontend`

- `fe-api-client`: подпись «API-клиент · @my/openapi».
- Новый узел `fe-schema` «schema.d.ts» (`typescript`) в «Frontend repo» перед
  `fe-api-client`; группа и её «CI» расширяются, соседние группы сдвигаются.
- `apidog-spec`: подпись «Контракт · OAS 3.1» вместо «openapi.yaml» (фронт берёт JSON,
  бэк YAML, общий у них контракт).
- Стрелки: `apidog-spec` → `fe-schema` «bun run generate» и `fe-schema` →
  `fe-api-client` «типы paths» вместо `apidog-spec` → `fe-api-client` «типы».
  `apidog-spec` → `be-oapi` «make generate» остаётся.
- `rules`, пункт 1: «Контракт меняется в Apidog; бэк (oapi-codegen) и фронт
  (@my/openapi) генерируют из него код».

## 6. Правки `ci`

- Новая вложенная группа `repo-openapi` «OpenAPI repo» (`package`) в «GitHub» с
  пайплайном `openapi-release` «OpenAPI release»: Install deps → Lint · test → Build →
  Deploy to NPM → Send to tg — по образцу «React release».
- В «NPM Registry» — иконка `npm-openapi` «@my/openapi»; стрелка «Deploy to NPM» →
  `npm-openapi`.
- В «Frontend repo» — вложенная группа `fe-drift` «Contract drift (nightly)»:
  `fe-generate` «bun run generate» → `fe-compare` «Compare with code», как у бэка;
  стрелка `apidog-spec` → `fe-generate` «export».
- `apidog-spec`: подпись «Контракт · OAS 3.1», как на `frontend`.
- Порядок реп сверху вниз: React, OpenAPI, Static, Frontend, Backend, Deployments.
  Static поднимается над Frontend, чтобы стрелки в S3 и из Apidog не пересекали чужие
  репы. «GitHub» растёт по высоте. Стрелка к `telegram` остаётся одна, от группы
  «GitHub».

## 7. README

- В таблицу MVP после `frontend`: `contract` — «Spec-first: контракт в Apidog,
  кодогенерация бэка и фронта, Contract drift».
- Строка `ci`: «GitHub-репозитории, CI-пайплайны, Contract drift, GHCR, NPM, S3».

## 8. Проверка

- Для каждой из трёх схем: `bun run validate`, `bun run check`, `bun run warm`,
  `bun run render`, осмотр PNG по чек-листу скилла (узлы в своих группах, заголовки и
  подписи читаемы, легенда ничего не перекрывает).
- Перед коммитом: `bun run typecheck && bun run test && bun run build`.
- Ветка `feature/contract-diagram`, PR в `main` с разделами «Что», «Решения»,
  «Проверка» и ссылкой на превью
  `https://cringe-driven-development-team.github.io/docs/branches/feature-contract-diagram/`.
