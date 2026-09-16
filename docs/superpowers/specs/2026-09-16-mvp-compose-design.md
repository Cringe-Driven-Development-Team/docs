# MVP на Docker Compose, заморозка архитектуры k3s

Дата: 2026-09-16. Репозиторий: `Cringe-Driven-Development-Team/docs`.
Статус: утверждена, ждёт плана.

## 1. Цель и рамки

Архитектура сервиса делится на две:

1. **MVP на Docker Compose.** Целевая архитектура на ближайшее время, с
   ней идёт вся дальнейшая работа. Описана в этой спеке целиком, а не как
   разница со спекой 1.
2. **Frozen: k3s.** Архитектура из спеки
   `docs/superpowers/specs/2026-09-15-frontend-monorepo-design.md`
   (k3s, Argo CD, Traefik, канарейка, Unleash, превью PR) замораживается:
   схемы переезжают в `diagrams/frozen-k3s/` без изменений, спека и план
   получают пометку frozen. Спеки 2 (наблюдаемость) и 3 (платформа) для
   k3s не пишутся, пока MVP не потребует.

Результат работы по спеке: четыре новые схемы MVP в `diagrams/`,
пять прежних схем в `diagrams/frozen-k3s/`, поддержка подпапок в
пайплайне схем, правки README и скилла. Кода приложения в репозитории нет.

Чего в MVP нет, и это не упущение: канарейки и фиче-флагов (Unleash),
превью PR (Coolify), E2E (Playwright, moon, ReportPortal, Allure),
мониторинга (Grafana, Prometheus, Loki, Tempo, Alloy, Alertmanager,
Node Exporter, Uptime Kuma, App Tracer, Faro), бэкапов Postgres, UI Kit и
Storybook, внешних интеграций (ЮMoney, VK ID, VK Cloud Voice, PostHog,
One Signal, Cloudflare Turnstile, Relative CI), Contract check в CI,
`rollback-lock.json`, k3s, Argo CD, Traefik. Из уведомлений остаётся
только Telegram.

## 2. Факты

Факты о стеке монорепы (Turborepo, bun workspaces, `bun build --compile`,
tRPC, TanStack Router, Unleash SDK) проверены в спеке 1 §2 и здесь не
перепроверялись; спека опирается на них в том же объёме.

Проверено 2026-09-16 на `@eraserlabs/diagrams-cli@0.1.0`:

| Что | Факт |
| --- | --- |
| `render --out-dir` | выходной файл называется по basename входа: `a/x.json` и `b/x.json` дают один `x.html`. Подпапка схем рендерится отдельным вызовом CLI со своим `--out-dir` |
| скрипты пайплайна | `listDiagrams`, `diagramNames`, `check-colors` читают только `diagrams/*.json`, подпапки не видят |

Допущения, которые проверяются при внедрении, а не на схемах: Caddy
выпускает TLS сам; VPS тянет образы из GHCR по токену с правом
`read:packages`; CDN Selectel умеет отдавать заголовки CORS и
`Cache-Control` для `releases/*`.

## 3. Принятые решения

| Решение | Почему | Отклонено |
| --- | --- | --- |
| Две архитектуры, k3s заморожена в подпапке схем | k3s и GitOps требуют платформенной работы, которой у MVP нет; наработки не теряются | удалить k3s-схемы; хранить их только в тэге git |
| Docker Compose на двух VPS, Caddy на входе | минимум движущихся частей, TLS и reverse proxy в одном контейнере | k3s; один VPS на всё (Postgres и вход трафика на одной машине) |
| Монорепа и стек спеки 1 без изменений | решения по коду не зависят от платформы | |
| Релизы клиента через `current.json` со `stable` и `previous`, без канарейки | откат за одну запись в S3; всё, что нужно для старых вкладок, остаётся | канарейка через Unleash; релиз в образе BFF |
| Contract check из CI убран, правило совместимости остаётся правилом ревью | оба приложения выкатываются одним прогоном CD, окно расхождения это только старые вкладки | Contract check с worktree (спека 1 §5.2) |
| Deployments repo: Pulumi, Ansible, ansible vault, compose и Caddyfile | инфраструктура кодом уже была в FigJam v3; секреты через vault, а не руками на серверах | `.env` руками на VPS; Argo CD |
| CD через `ansible-playbook` с GitHub-hosted раннеров | playbook идемпотентен, один и тот же для выкатки и отката | ARC на своём кластере; `docker compose` по SSH напрямую |
| Образы в GHCR | есть у GitHub, отдельный реестр не поднимаем | свой Docker Registry |
| Схемы MVP: `deployment`, `ci`, `cd`, `frontend-monorepo`; `integrations` нет | внешних сервисов в MVP нет, путь клиента до Caddy виден на `deployment` | пустая `integrations` |

## 4. Серверы и путь запроса

Selectel: два VPS, S3, CDN, домен `site.ru`.

| VPS | Docker Compose | Роль |
| --- | --- | --- |
| VPS 1 | Caddy, BFF (Hono · bun) | вход трафика, TLS, HTML и `/api/trpc` |
| VPS 2 | Go API, Postgres | данные и бизнес-логика |

Маршруты на входе:

| Хост и путь | Куда |
| --- | --- |
| `site.ru` `/api/trpc/*`, `/sitemap.xml`, остальные пути (HTML, `/robots.txt`) | Caddy (VPS 1) → BFF |
| `static.site.ru` | CDN перед S3 |

- Caddy на VPS 2 нет: снаружи туда никто не ходит. BFF ходит в Go API по
  приватной сети Selectel, S2S-ключ в ansible vault. Go API ходит в
  Postgres внутри compose VPS 2.
- Серверный bootstrap BFF как в спеке 1 §4.2, без флагов: проверить сессию
  в Go API, прочитать `current.json` из S3 (кэш в памяти, TTL не больше
  10 с), взять `index.html` релиза `stable` из `releases/{sha}/` (кэш по
  `{sha}`), вставить `window.__BOOTSTRAP__ = { user, release }`, отдать с
  `x-release` и `Cache-Control: private, no-store`.
- `robots.txt` и `sitemap.xml` отдаёт BFF из `stable`-релиза и из Go API,
  как в спеке 1 §4.3.
- Ассеты клиент грузит напрямую со `static.site.ru`: Vite `base` равен
  `https://static.site.ru/releases/{sha}/`. `releases/*` отдаются с
  `Access-Control-Allow-Origin: https://site.ru` и
  `Cache-Control: public, max-age=31536000, immutable`.

## 5. Монорепа и модель релизов

Структура и стек монорепы из спеки 1 §4.1 без изменений: `apps/client`
(Vite, React, TanStack Router и Query, zustand), `apps/bff` (bun, Hono,
tRPC), bun workspaces, Turborepo с задачами `lint`, `typecheck`, `test`,
`build`. Клиент импортирует из `bff` только типы `AppRouter` и
`BootstrapData`. Образ BFF из `bun build --compile`.

Контракты и версии:

- `BootstrapData` это `{ user, release }`, поля `flags` нет.
- Правило совместимости из спеки 1 §5.1 остаётся: BFF N+1 обслуживает
  клиента N и N+1, процедуры и поля не удаляются в том релизе, где клиент
  перестаёт их использовать. Проверяется на ревью, автоматической проверки
  в CI нет.
- Клиент шлёт `x-client-release`, BFF отвечает `x-release` со `stable` из
  `current.json`. Правила перезагрузки клиента из спеки 1 §5.5 остаются
  целиком: они нужны вкладкам, открытым до релиза.

Хранение релизов в S3:

- `current.json` хранит `{ "stable": "{sha}", "previous": "{sha}" }`.
- `releases/{sha}/` содержит сборку клиента. `release.json` не пишется:
  Contract check нет, записывать нечего.
- В `releases/` остаются последние 5 релизов, `stable` и `previous` не
  удаляются никогда.

Релиз в `releases/{sha}/` не живой, пока на него не указывает
`current.json`.

## 6. Репозитории и CI

Все пайплайны на GitHub-hosted раннерах, уведомление о результате в
Telegram.

| Репо | CI | Артефакты |
| --- | --- | --- |
| Frontend monorepo | `bun install --frozen-lockfile` → `turbo run lint typecheck test` (на PR `--affected`, на `main` все пакеты) → клиент: `vite build` → Upload release (main); BFF: `bun build --compile` → Build image → Push image (main) → Send to tg | S3 `releases/{sha}/`, GHCR `bff:{sha}` |
| Backend repo | Build → Units → Lint → Build image → Push image (main) → Send to tg | GHCR `backend:{sha}` |
| React repo | Install deps → Lint → Build → Deploy to NPM → Send to tg | NPM `@my/react` |
| Static repo | Deploy to S3 → Send to tg | S3 |
| Deployments repo | нет пайплайна; хранит Pulumi configs, ansible roles и playbooks, ansible vault, `docker-compose.yml` и `Caddyfile` для VPS 1 и VPS 2 | |

На `main` монорепы оба артефакта публикуются всегда, как в спеке 1 §6:
упавший прогон не должен терять изменение. На PR превью нет.

## 7. CD и откат

CD это workflow в репозитории приложения: после зелёного CI на `main`
делает checkout Deployments repo и запускает `ansible-playbook` по SSH с
тегом образа. Playbook рендерит `.env` из vault, тянет образ из GHCR,
делает `docker compose up -d`, ждёт health check. Одна concurrency-группа
на репозиторий, без cancel-in-progress.

**Monorepo CD**, порядок строго BFF, потом клиент:

1. Run ansible playbook (VPS 1): pull `bff:{sha}`, compose up, health
   check BFF. Выполняется всегда, даже если коммит затронул только
   клиент: playbook идемпотентен, условная логика не нужна.
2. Promote: записать `{sha}` в `current.json` как `stable`, прежний
   `stable` в `previous`.
3. Health check `site.ru`: HTML отвечает с `x-release` равным `{sha}`, один
   чанк релиза грузится со `static.site.ru` (ловит ошибку CORS).
4. Retention: оставить последние 5 релизов, `stable` и `previous` не
   трогать.
5. Send to tg.

**Backend CD**: Run ansible playbook (VPS 2): pull `backend:{sha}`, run
migrations, compose up → Health check → Send to tg. Миграции идут внутри
playbook, на схеме показаны отдельным шагом для читаемости.

**Monorepo Rollback**, запуск руками (`workflow_dispatch`):

1. Switch release pointer: `stable` получает значение `previous`,
   `previous` не меняется.
2. Health check `site.ru`.
3. Если нужно откатить BFF: Run ansible playbook (VPS 1) с прежним тегом
   образа, health check. Порядок клиент, потом BFF: BFF N+1 обслуживает
   клиента N, обратное не гарантируется.
4. Send to tg.

Второй откат подряд (`stable` уже равен `previous`) делается ручной
правкой `current.json`. `rollback-lock.json` не заводится.

**Backend Rollback**: тот же playbook с прежним тегом образа. Откат
миграций вне рамок MVP.

## 8. Схемы MVP

Цвета по конвенции `scripts/colors.ts`. Узел браузера везде `"id":
"client"`, узел Telegram везде `"id": "telegram"`, иначе стрелки не
станут пользовательским трафиком и уведомлениями. Легенду каждой схемы
задаёт вывод `bun run check`. Иконки: `caddy` в каталоге нет, берётся
`server` с подписью «Caddy»; `ghcr` нет, берётся `docker`; `ansible`,
`pulumi`, `hono`, `bun`, `vite`, `trpc`, `go`, `postgres`, `github`,
`github-actions`, `telegram`, `npm`, `database`, `cloud`, `globe`,
`chrome`, `react`, `layers`, `package`, `file-code`, `box` есть.

### 8.1 `diagrams/deployment.json`

- `client` «Client (браузер)» вне групп.
- `selectel` (blue, «Selectel», `cloud`):
  - `vps1` (plain, «VPS 1 · Docker Compose», `docker`): `vps1-caddy`
    «Caddy» (`server`), `vps1-bff` «BFF (Hono · bun)» (`hono`)
  - `vps2` (plain, «VPS 2 · Docker Compose», `docker`): `vps2-go` «Go API»
    (`go`), `vps2-postgres` «Postgres» (`postgres`)
  - `s3` «S3: releases/{sha}/, current.json» (`database`), `cdn`
    «CDN static.site.ru» (`cloud`), `domain` «site.ru» (`globe`)

| От | К | Подпись |
| --- | --- | --- |
| `client` | `vps1-caddy` | https://site.ru: HTML, /api/trpc |
| `client` | `cdn` | https://static.site.ru |
| `vps1-caddy` | `vps1-bff` | |
| `vps1-bff` | `vps2-go` | S2S: сессия, данные, sitemap |
| `vps1-bff` | `s3` | index.html, current.json |
| `s3` | `cdn` | static |
| `vps2-go` | `vps2-postgres` | |

### 8.2 `diagrams/ci.json`

- `github` (purple, «GitHub», `github`):
  - `repo-react` «React repo» (`react`) → группа «React release»: Install
    deps → Lint → Build → Deploy to NPM → Send to tg
  - `repo-frontend` «Frontend monorepo · bun workspaces · Turborepo»
    (`react`) → группа «CI» в два ряда: `bun install` → `turbo: lint ·
    typecheck · test` → ветка клиента `vite build` → Upload release (main)
    → Send to tg; ветка BFF `bun build --compile` → Build image → Push
    image (main) → Send to tg
  - `repo-backend` «Backend repo» (`go`) → группа «CI»: Build → Units →
    Lint → Build image → Push image (main) → Send to tg
  - `repo-static` «Static repo» (`box`) → группа «Static»: Deploy to S3 →
    Send to tg
  - `repo-deployments` «Deployments repo» (`ansible`): узлы «Pulumi
    configs» (`pulumi`), «ansible roles / playbooks» (`ansible`), «ansible
    vault» (`ansible`), «docker-compose.yml» (`docker`), «Caddyfile»
    (`server`)
- `npm-registry` (green, «NPM Registry», `npm`): `npm-react` «@my/react»
- `ghcr` (green, «GHCR», `docker`): `reg-bff` «bff:{sha}», `reg-backend`
  «backend:{sha}»
- `s3` «S3» (`database`), `telegram` «Telegram» (`telegram`) вне групп

Связи пайплайна с внешними системами (пунктир по конвенции): Deploy to
NPM → `npm-react`; Upload release → `s3` «releases/{sha}/»; Push image
(монорепа) → `reg-bff`; Push image (бэкенд) → `reg-backend`; Deploy to
S3 → `s3`; `github` → `telegram` «Send to tg».

### 8.3 `diagrams/cd.json`

- `actions` (purple, «GitHub Actions», `github-actions`):
  - «Monorepo CD»: Run ansible playbook → Health check BFF → Promote to
    stable → Health check → Retention: 5 релизов → Send to tg
  - «Monorepo Rollback»: Switch release pointer → Health check → Run
    ansible playbook → Health check → Send to tg
  - «Backend CD»: Run ansible playbook → Run migrations → Health check →
    Send to tg
- `deployments-repo` «Deployments repo» (`ansible`) вне групп
- `selectel` (blue, «Selectel», `cloud`): `vps1` «VPS 1 · Docker Compose»
  (`docker`), `vps2` «VPS 2 · Docker Compose» (`docker`), `s3` «S3»
  (`database`)
- `ghcr` «GHCR» (`docker`), `telegram` «Telegram» вне групп

| От | К | Подпись |
| --- | --- | --- |
| Run ansible playbook (CD) | `deployments-repo` | playbook, vault |
| Run ansible playbook (CD) | `vps1` | ssh: pull bff:{sha}, compose up |
| Run ansible playbook (Rollback) | `vps1` | ssh: prev tag |
| Run ansible playbook (Backend) | `vps2` | ssh: pull backend:{sha}, compose up |
| `vps1` | `ghcr` | pull |
| `vps2` | `ghcr` | pull |
| Promote to stable | `s3` | current.json |
| Retention | `s3` | releases/ |
| Switch release pointer | `s3` | current.json |
| `actions` | `telegram` | Send to tg |

Стрелки от Activity к группе VPS и от группы VPS к GHCR: первая по
конвенции пунктир, вторая «прочие связи». Если рендер покажет, что три
стрелки playbook → VPS 1 и VPS 2 путаются, план объединяет их в одну
подпись на стрелку.

### 8.4 `diagrams/frontend-monorepo.json`

Как текущая схема, минус Contract check, Unleash, Traefik и k3s:

- `github` (purple) → `monorepo` с `ws-client` (React, TanStack Router ·
  Query, zustand), `ws-bff` (Hono, tRPC · AppRouter, HTML bootstrap · SEO)
  и `turbo-pipeline` «turbo run --affected»: `bun install` → `lint ·
  typecheck · test` → `vite build`; `lint · typecheck · test` → `bun build
  --compile` → Build image.
- `ghcr` (green, «GHCR»): `reg-bff` «bff:{sha}».
- `client` вне групп.
- `ours` (blue, «Наша инфраструктура (Selectel)»): `cdn` «CDN
  static.site.ru», `s3` «S3: releases/{sha}/, current.json», `vps1` «VPS 1
  · Docker Compose» с `caddy` «Caddy» (`server`) и `bff` «BFF (Hono ·
  bun)», `vps2` «VPS 2 · Docker Compose» с `go-api` «Go API».
- `Textbox` «Правила выкатки»: 1. BFF N+1 выкатывается первым, клиент
  после health check; 2. BFF N+1 обслуживает клиентов N и N+1, проверка на
  ревью; 3. Ответ BFF несёт `x-release`: при ошибке контракта перезагрузка
  сразу, иначе мягко, не чаще раза в 10 минут; 4. В S3 последние 5
  релизов, `stable` и `previous`; 5. Откат: `stable` ← `previous`, потом
  BFF прежним тегом.

Связи: `ws-client` → `ws-bff` «import type AppRouter, BootstrapData»;
`vite build` → `s3` «releases/{sha}/ (main)»; Build image → `reg-bff`;
`client` → `caddy` «https://site.ru: HTML, /api/trpc»; `client` → `cdn`
«https://static.site.ru»; `s3` → `cdn` «static»; `caddy` → `bff`; `bff` →
`go-api` «S2S: сессия, данные, sitemap»; `bff` → `s3` «index.html,
current.json».

## 9. Структура репозитория и пайплайн схем

### 9.1 Frozen

- `git mv` пяти файлов `diagrams/*.json` в `diagrams/frozen-k3s/` без
  правок содержимого. Валидация и проверка цветов проходят на них уже
  сейчас и должны проходить после переноса.
- Спека `2026-09-15-frontend-monorepo-design.md` и план
  `2026-09-15-frontend-monorepo.md` получают в шапке строку «Статус:
  frozen. Архитектура k3s заморожена спекой
  `2026-09-16-mvp-compose-design.md`, схемы в `diagrams/frozen-k3s/`».
  Остальной текст не меняется.

### 9.2 Подпапки в пайплайне

Один уровень подпапок в `diagrams/`. Имя схемы это путь без `.json`
относительно `diagrams/`: `ci`, `frozen-k3s/ci`.

- `scripts/eraser.ts`: `listDiagrams` возвращает файлы по папкам;
  `validate` вызывает CLI один раз со всеми файлами (выхода нет,
  коллизий нет); `render` вызывает CLI по одному разу на папку с
  `--out-dir dist/<папка>` (для корня `dist`). Опция `--out-dir` из
  скрипта перекрывает `outDir` конфига.
- `scripts/build-index.ts`: `diagramNames` возвращает имена с подпапкой.
  `renderIndex` группирует: схемы корня без заголовка секции, каждая
  подпапка отдельной секцией `<h2>` с именем папки; ссылки и `img` по
  относительному пути `frozen-k3s/ci.html`.
- `scripts/check-colors.ts`: обходит `diagrams/**/*.json`, в сообщениях
  печатает путь с подпапкой.
- `scripts/build-site.ts`: использует `diagramNames` и `renderIndex`, для
  веток ничего не меняется, ветки собираются своими скриптами.
- Тесты: `listDiagrams` и `diagramNames` на дереве с подпапкой; `renderIndex`
  с секцией; `check-colors` на файле в подпапке; аргументы `render` для
  двух папок.
- `.gitignore`, workflow CI и Pages не меняются: `dist/` целиком уходит
  в артефакт и на Pages.

### 9.3 Документация

- README: таблица схем делится на «MVP» (четыре схемы) и «Frozen: k3s»
  (пять схем, адреса `…/frozen-k3s/<name>.html`), абзац про подпапки и
  что frozen-схемы не правятся.
- `.claude/skills/eraser-diagrams/SKILL.md`: имя схемы может содержать
  подпапку, `dist/<папка>/<name>.png`; `diagrams/frozen-k3s/` не
  правится, новые схемы кладутся в корень.

## 10. Вне рамок

- Продуктовая архитектура, контракт BFF и Go API, схема данных.
- Всё, что перечислено в §1 как отсутствующее в MVP: наблюдаемость, E2E,
  превью, флаги, бэкапы, интеграции.
- Содержимое Deployments repo: playbook, роли, конфиги Pulumi. Спека
  фиксирует только, что там лежит.
- Возврат к k3s: когда и как, решается отдельной спекой на основе frozen.

## 11. Приёмка

- `diagrams/` содержит `deployment.json`, `ci.json`, `cd.json`,
  `frontend-monorepo.json` по §8 и `frozen-k3s/` с пятью прежними файлами.
- `bun run typecheck`, `bun run test`, `bun run build` проходят;
  `bun run check` печатает `colors ok: 9 diagrams`.
- `dist/` содержит четыре схемы MVP в корне и пять в `frozen-k3s/`,
  `dist/index.html` показывает обе секции.
- PNG четырёх схем MVP проверены глазами по скиллу `eraser-diagrams`.
- README и SKILL.md обновлены по §9.3, спека и план k3s помечены frozen.
- Превью ветки на Pages собирается.

## 12. Риски

- **Один VPS на входе и один на данных.** Отказ любого кладёт сайт.
  Принято для MVP.
- **Нет бэкапов Postgres.** Потеря диска VPS 2 это потеря данных.
  Принято для MVP, первый кандидат на следующую спеку.
- **Совместимость контракта только на ревью.** Правка BFF, ломающая
  старые вкладки, дойдёт до пользователей; их спасает перезагрузка по
  `x-release`.
- **Playbook выполняется на каждый коммит `main`.** Перезапуск BFF с тем
  же образом даёт короткий простой BFF, пока контейнер поднимается. Если
  это заметно, playbook начинает сравнивать тег с запущенным.
- **Нет мониторинга.** Об отказе узнаём от пользователей или из health
  check CD. Принято для MVP.
