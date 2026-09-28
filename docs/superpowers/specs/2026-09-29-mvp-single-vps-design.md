# MVP на одной VPS без BFF, заморозка варианта с BFF

Дата: 2026-09-29. Статус: утверждено в чате, ждёт ревью спеки.

## 1. Цель и рамки

В рамках MVP отказываемся от BFF и второй VPS. Остаётся одна VPS в Selectel, на ней
Docker Compose: Caddy, Go API, Postgres. Клиент ходит в Go API напрямую, без
промежуточного слоя. Монорепы на фронте нет: одна репа с клиентом.

Нынешние схемы корня `diagrams/` (две VPS, BFF, монорепа) переезжают в
`diagrams/bff/` и замораживаются так же, как `diagrams/frozen-k3s/`. В корне появляются
новые схемы MVP. Таб `mvp` на сайте остаётся первым и открыт по умолчанию, за ним
`bff`, потом `frozen-k3s`.

В рамках: перенос, пять новых схем, README, CLAUDE.md, скилл `eraser-diagrams`.

Вне рамок:

- Переделка репы `infra` (Pulumi, Ansible) под одну VPS — отдельная задача. До неё
  `infra` описывает две VPS, схемы описывают целевое состояние.
- Код сборки схем (`scripts/`): подпапка становится табом без правок кода.
- Схема `integrations`: внешних сервисов, кроме Apidog, в MVP нет, Apidog виден на
  `ci` и `frontend`.
- Откат бэкенда и откат миграций.

## 2. Проверенные факты

Репа `docs`, `main` на `ffb76da`:

- `scripts/build-index.ts`: `ROOT_TAB = "mvp"` — таб схем корня; дальше по табу на
  подпапку, в порядке имён. Тесты (`scripts/build-index.test.ts`) имена схем корня не
  проверяют, только фикстуры.
- В корне пять схем: `deployment`, `ci`, `cd`, `frontend-monorepo`, `infra`; во всех
  есть BFF или две VPS.

Репа бэкенда `go-park-mail-ru/2026_2_Cringe_Driven_Development`, `main` на `b6e5960`:

- Контракт живёт в облачном Apidog. `make generate`: `go run ./cmd/apidog` выгружает
  `internal/api/openapi.yaml`, затем `oapi-codegen` (`internal/api/cfg.yaml`:
  `gorilla-server`, `strict-server`, `models`, `embedded-spec`).
- `.github/workflows/contract-drift.yml`: раз в сутки (`cron: '0 6 * * *'`) и вручную
  делает `make generate` из Apidog `main` и падает, если код разошёлся с контрактом.
- `.github/workflows/ci.yml`: job `lint` (golangci-lint), `test` (`go mod tidy -diff`,
  `go build`, `go test -race`), `docker` (сборка; на push в `main` — публикация в
  GHCR с тегами `sha-{short}` и `main`, `latest` нет). Шага Telegram в CI нет: на схемах шаг «Send to tg» у всех
  пайплайнов — целевое состояние, как и в варианте с BFF.
- `cmd/main/router.go`: базовый путь API `/api/v1`, health — `/health`.
- `cmd/main/main.go`: миграции goose (`migrations.Up`) выполняются при старте Go API.
- `docker-compose.yml`: сервисы `api` и `db` (`postgres:18-alpine`); авторизация — JWT
  access-токен и refresh-сессия в cookie (`COOKIE_SECURE`).

Репа фронтенда `frontend-park-mail-ru/2026_2_Cringe_Driven_Development`: кода пока нет,
только README и `.github`. Стек клиента берётся из решений в чате (§3).

Репа `infra`, `main` на `125594d`: `pulumi/index.ts` создаёт две VPS (`gateway` с
floating IP и `backend` только в приватной сети), `ansible/site.yml` ставит Caddy на
gateway.

## 3. Принятые решения

| Решение | Почему | Отвергнуто |
| --- | --- | --- |
| Одна VPS: Caddy, Go API, Postgres в Docker Compose | MVP, минимум машин и сетевой конфигурации | две VPS (заморожено в `bff/`) |
| Нет BFF, клиент ходит в `/api/v1` Go API через Caddy на том же origin | один сервис на бэке; same-origin — нет CORS, cookie refresh-сессии работают как есть | BFF на Hono (заморожено в `bff/`); отдельный `api.site.ru` с CORS |
| HTML отдаёт Caddy, проксируя `index.html` из S3 | модель релизов в S3 и откат одной записью остаются | HTML с диска VPS; SPA целиком с CDN |
| Фронт — одна репа, не монорепа | без BFF в монорепе нечего держать рядом с клиентом | монорепа bun workspaces + Turborepo |
| Клиент: React, TanStack Router, zustand; свой API-клиент на openapi-fetch внутри клиента | решение команды | TanStack Query, ky, tRPC |
| Контракт — Apidog, `openapi.yaml` оттуда берут и бэк, и фронт | бэк уже так работает (§2) | контракт в коде BFF (tRPC) |
| Нет `x-release` и автоперезагрузки вкладок | без BFF его некому отдавать; для MVP не нужно | клиент опрашивает `current.json` |
| Вариант с BFF заморожен в `diagrams/bff/` | к нему могут вернуться, но сейчас не правится | удалить; держать живым |

Допущение: фронт генерирует типы для API-клиента из того же экспорта Apidog. Какой
генератор — на схемах не называется.

## 4. Сервер и путь запроса

| Путь | Куда |
| --- | --- |
| `site.ru` `/api/v1/*` | Caddy → Go API |
| `site.ru`, остальные пути | Caddy → S3, `index.html` текущего релиза |
| `static.site.ru` | CDN ← S3, чанки `releases/{sha}/` |

- На VPS снаружи открыт только Caddy (TLS, Let’s Encrypt). Go API и Postgres только во
  внутренней сети Compose.
- Go API ходит в Postgres, миграции при старте.

## 5. Модель релизов клиента

- `releases/{sha}/` — сборка клиента, `current.json` — `{ "stable": "{sha}", "previous": "{sha}" }`.
- Promote копирует `releases/{sha}/index.html` в корневой `index.html` бакета и
  записывает `{sha}` в `current.json` как `stable`, прежний `stable` в `previous`.
  Caddy проксирует корневой `index.html`.
- Автоперезагрузки нет: открытая вкладка живёт на чанках своего релиза. В `releases/`
  остаются последние 5 релизов, `stable` и `previous` не удаляются.
- Совместимость: Go API N+1 обслуживает клиента N — ручки и поля не удаляются в том
  релизе, где клиент перестаёт их использовать. Проверяется на ревью контракта в Apidog.
- Откат клиента: `stable` ← `previous`, корневой `index.html` ← `index.html` релиза
  `previous`.

## 6. Перенос и заморозка

- `git mv diagrams/{deployment,ci,cd,frontend-monorepo,infra}.json diagrams/bff/`,
  содержимое файлов не меняется. Адреса страниц сменятся на
  `…/docs/bff/<name>.html`.
- README: абзац про архитектуры — теперь три: рабочая **MVP: одна VPS**, замороженные
  **BFF: две VPS** (`diagrams/bff/`) и **Frozen: k3s**. Таблица MVP переписывается под
  новые схемы, добавляется таблица `bff` с прежними описаниями и новыми адресами.
- CLAUDE.md и скилл: `diagrams/bff/` заморожена, как `diagrams/frozen-k3s/`.

## 7. Схемы MVP

Общее: цвета и легенда по скиллу (`bun run check`), `client` — узел пользователя,
`telegram` — узел Telegram. Иконки как в прежних схемах: Caddy — `server`, S3 —
`database`, CDN — `cloud`, домен — `globe`, клиент — `chrome`, образы и Compose —
`docker`. Хостнеймы — плейсхолдеры `site.ru`, `static.site.ru`, кроме `infra`, где
домен реальный, как сейчас.

### 7.1 `deployment`

- `client` «Client (браузер)» вне групп.
- Группа «Selectel» (blue): вложенная группа «VPS · Docker Compose» с `vps-caddy`
  «Caddy», `vps-go` «Go API», `vps-postgres` «Postgres»; вне VPS — `s3` «S3:
  releases/{sha}/, index.html, current.json», `cdn` «CDN static.site.ru», `domain`
  «site.ru».

| От | К | Подпись |
| --- | --- | --- |
| `client` | `vps-caddy` | https://site.ru: HTML, /api/v1 |
| `client` | `cdn` | https://static.site.ru |
| `vps-caddy` | `vps-go` | /api/v1/* |
| `vps-caddy` | `s3` | index.html |
| `vps-go` | `vps-postgres` | — |
| `s3` | `cdn` | static |

### 7.2 `ci`

Группа «GitHub» (purple):

- «Frontend repo», пайплайн «CI»: bun install → lint · typecheck · test → vite build →
  Upload release (main) → Send to tg.
- «Backend repo», пайплайн «CI»: golangci-lint → go test -race → Build image → Push
  image (main) → Send to tg. Пайплайн «Contract drift (nightly)»: make generate →
  Compare with code.
- «React repo» и «Static repo» — без изменений против `bff/ci`.
- «Deployments repo»: Pulumi configs, ansible roles / playbooks, ansible vault,
  docker-compose.yml, Caddyfile — одна VPS.

Вне GitHub: группа «GHCR» (green) с `backend:sha-{short}`, группа «NPM Registry»
(green) с `@my/react`, группа «Apidog» (green) с `openapi.yaml`, `s3`, `telegram`.

| От | К | Подпись |
| --- | --- | --- |
| Upload release (main) | `s3` | releases/{sha}/ |
| Push image (main) | `backend:sha-{short}` | tags: sha-{short}, main |
| `openapi.yaml` | make generate | export |
| Deploy to NPM | `@my/react` | — |
| Deploy to S3 | `s3` | — |
| группа GitHub | `telegram` | Send to tg |

### 7.3 `cd`

Группа «GitHub Actions» (purple):

- «Frontend CD»: Promote to stable → Health check → Retention: 5 релизов → Send to tg.
  Health check: `site.ru` отдаёт HTML нового `{sha}`, один чанк грузится с
  `static.site.ru`.
- «Frontend Rollback» (`workflow_dispatch`): Switch release pointer → Health check →
  Send to tg.
- «Backend CD»: Run ansible playbook → Health check → Send to tg. Миграции при старте
  Go API, отдельного шага нет.

Вне групп: `deployments-repo`, группа «Selectel» (blue) с `vps` «VPS · Docker Compose»
и `s3`, `ghcr`, `telegram`.

| От | К | Подпись |
| --- | --- | --- |
| Promote to stable | `s3` | index.html, current.json |
| Retention: 5 релизов | `s3` | releases/ |
| Switch release pointer | `s3` | index.html, current.json |
| Run ansible playbook | `deployments-repo` | playbook, vault |
| Run ansible playbook | `vps` | ssh: pull backend:sha-{short}, compose up |
| `vps` | `ghcr` | pull |
| группа GitHub Actions | `telegram` | Send to tg |

### 7.4 `frontend` (вместо `frontend-monorepo`)

- Группа «GitHub» (purple), вложенная «Frontend repo»: `fe-react` «React»,
  `fe-router` «TanStack Router», `fe-zustand` «zustand», `fe-api-client` «API-клиент ·
  openapi-fetch»; пайплайн: bun install → lint · typecheck · test → vite build.
  Рядом вложенная «Backend repo» с `be-oapi` «oapi-codegen: strict server».
- Группа «Apidog» (green): `apidog-spec` «openapi.yaml».
- `client`, группа «Selectel» (blue): `s3`, `cdn`, вложенная «VPS · Docker Compose» с
  `caddy` и `go-api`.
- Textbox «Правила выкатки»:
  1. Контракт меняется в Apidog; бэк и фронт генерируют код из `openapi.yaml`.
  2. Go API N+1 обслуживает клиента N: ручки и поля не удаляются в том же релизе.
  3. Автоперезагрузки нет, вкладка живёт на чанках своего релиза.
  4. В S3 последние 5 релизов, `stable` и `previous` не удаляются.
  5. Откат клиента: `stable` ← `previous`, `index.html` ← релиз `previous`.

| От | К | Подпись |
| --- | --- | --- |
| `apidog-spec` | `fe-api-client` | типы |
| `apidog-spec` | `be-oapi` | make generate |
| vite build | `s3` | releases/{sha}/ (main) |
| `client` | `caddy` | https://site.ru: HTML, /api/v1 |
| `client` | `cdn` | https://static.site.ru |
| `caddy` | `go-api` | /api/v1/* |
| `caddy` | `s3` | index.html |
| `s3` | `cdn` | static |

### 7.5 `infra`

Как нынешняя `infra`, кроме проекта `pulumi-cellestial`:

- одна `vps` «VPS · floating IP, Caddy + Let’s Encrypt, Docker Compose» вместо VPS 1 и
  VPS 2;
- связь `dns-zone` → `vps` «cellestial.ru → floating IP», `ansible` → `vps` «ssh под
  deploy»;
- связи VPS 1 → VPS 2 (ProxyCommand) нет.

## 8. Приёмка

- `bun run typecheck && bun run test && bun run build` проходят.
- PNG каждой новой схемы осмотрен: узлы не накладываются, всё внутри своих групп,
  подписи читаемы, легенда ничего не перекрывает.
- Файлы в `diagrams/bff/` побайтно равны прежним в корне.
- `dist/index.html`: табы `mvp`, `bff`, `frozen-k3s`, `mvp` открыт.
- PR в `main` со ссылкой на превью ветки.

## 9. Риски

- Внешние ссылки на `…/docs/deployment.html` и соседние теперь ведут на новую
  архитектуру, а не на BFF. Принимается: это рабочая архитектура.
- Без автоперезагрузки старая вкладка может жить дольше 5 релизов и потерять чанки
  при ленивой загрузке маршрута. Для MVP принимается.
- `infra` до отдельной задачи расходится со схемой `infra`.
