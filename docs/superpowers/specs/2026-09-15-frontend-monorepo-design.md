# Монорепа фронта и BFF, модель релизов

Дата: 2026-09-15. Репозиторий: `Cringe-Driven-Development-Team/docs`.
Статус: frozen. Архитектура k3s заморожена спекой
`docs/superpowers/specs/2026-09-16-mvp-compose-design.md`, схемы лежат в
`diagrams/frozen-k3s/` и не правятся. Была утверждена и реализована в
схемах по плану `docs/superpowers/plans/2026-09-15-frontend-monorepo.md`.

## 1. Цель и рамки

Груминг инфраструктуры сервиса разбит на три части, у каждой своя спека:

1. **Монорепа фронта и BFF, модель релизов.** Эта спека.
2. Наблюдаемость и дежурный агент.
3. Платформа: топология k3s, CI-кластер, раскладка серверов, деплой Go.

Спека описывает, как устроены монорепа клиента и BFF, их CI, CD, откат
и превью, и как это показать на схемах в `diagrams/`. Результат работы по
спеке: новая схема `frontend-monorepo` и правки `ci`, `cd`, `deployment`,
`integrations`. Кода приложения в этом репозитории нет, спека фиксирует
решения для команды и для схем.

Бэкенд остаётся одним блоком `Go API`: продуктовая архитектура вне рамок
груминга и будет описана позже на генераторе сайтов документации.

## 2. Проверенные факты

Проверено 2026-09-14 и 2026-09-15 по репозиториям и документации.

| Что | Версия на дату проверки | Факт, на который опирается спека |
| --- | --- | --- |
| Turborepo | 2.10.13 | bun 1.2+ в статусе Stable; `turbo prune` поддерживает bun-репозитории; есть `--affected` |
| bun workspaces | документация bun, ветка `main` | `--filter` по имени, пути и зависимостям, скрипты в порядке зависимостей; отбора по изменениям в git и кэша задач нет (`docs/pm/filter.mdx`) |
| `bun build --compile` | документация bun, ветка `main` | один исполняемый файл с рантаймом, `--target=bun-linux-x64` (`docs/bundler/executables.mdx`) |
| Vite+ | 0.3.2 | MIT, до 1.0; в документации нет отбора по изменениям в git и удалённого кэша, кэш в CI через GitHub Actions cache |
| tRPC | 11.18.0 | пакет `@trpc/tanstack-react-query`; `httpLink` принимает `FormData`, `File`, `Blob` (`www/docs/server/non-json-content-types.md`) |
| TanStack Router | релиз 2026-09-14 | описание репозитория: «client-first, server-capable»; SSR даёт отдельный TanStack Start |
| Unleash Node SDK | 6.12.1 | правила забираются в фоне, по умолчанию раз в 15 с (`refreshInterval = 15_000`); флаги вычисляются в процессе |
| ingress-nginx | | объявлен к выводу 2025-11-11, поддержка прекращена в марте 2026; рекомендация Kubernetes: Gateway API (https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/) |
| Traefik в k3s | Traefik v3 | Gateway API поддерживается, по умолчанию выключен, включается через `HelmChartConfig` (`providers.kubernetesGateway.enabled: true`) |

Контекст индустрии для модели релизов (§5): платформы, где фронт и сервер
связаны без версионирования, закрывают расхождение версий привязкой
клиента к деплою: Vercel Skew Protection (`x-deployment-id`, cookie
`__vdpl`, перезагрузка при несовпадении) и Cloudflare Workers version
affinity (`Cloudflare-Workers-Version-Key`). Основой в больших продуктах
остаётся совместимость контракта между соседними версиями.

Источники:

- https://vercel.com/docs/skew-protection
- https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/version-affinity/

## 3. Принятые решения

| Решение | Почему | Отклонено |
| --- | --- | --- |
| Монорепа на bun workspaces и Turborepo | bun уже менеджер пакетов и рантайм клиента и BFF; Turborepo сам выводит, что правка BFF затрагивает typecheck клиента, и кэширует задачи | pnpm (лишний второй менеджер); только bun workspaces (фильтр по путям пришлось бы вести вручную); Nx (избыточен для двух приложений); Vite+ (до 1.0) |
| Клиент: Vite, React, TanStack Router, TanStack Query, zustand | роутер и кэш данных типизированы вместе с tRPC; контекст роутера принимает данные bootstrap | отдельный API-клиент на ky или axios: tRPC и есть клиент к BFF |
| BFF: bun, Hono, tRPC; рендерит HTML с bootstrap; отдаёт SEO-ручки | убирает моргание интерфейса до проверки авторизации | |
| Образ BFF из `bun build --compile` | образ без `node_modules`, `turbo prune` не нужен | |
| Модель релизов A: один BFF, контракт совместим на релиз назад, BFF выкатывается первым | стандартная практика, одного контейнера BFF хватает | выкатка парой клиент и BFF (второй BFF и липкая маршрутизация); выкатка одним махом |
| Платформа: k3s и Argo CD для BFF и Go, отдельный кластер для CI | декларативная выкатка без простоя, откат через git | Ansible и `compose up`; Kamal |
| Вход трафика: Traefik из k3s с Gateway API, TLS через cert-manager | ingress-nginx выведен; Gateway API рекомендован Kubernetes | Caddy на узлах кластера |

Решения по платформе здесь входные: спека 1 опирается на них и берёт на
схемы минимум (§8). Детали платформы решает спека 3 (§9).

## 4. Монорепа

### 4.1 Структура

```text
apps/
  client/   Vite, React, TanStack Router, TanStack Query, zustand
  bff/      bun, Hono, tRPC
turbo.json
package.json   workspaces: ["apps/*"]
bun.lock
```

- `apps/client` зависит от `apps/bff` как `"bff": "workspace:*"` и
  импортирует из него **только типы**: `import type { AppRouter,
  BootstrapData } from "bff"`. Пакет `bff` отдаёт типы через отдельную
  точку входа, серверный код в бандл клиента не попадает.
- Задачи Turborepo: `lint`, `typecheck`, `test`, `build`. Через
  зависимость пакетов `typecheck` клиента запускается при любой правке
  `apps/bff`.

### 4.2 Серверный bootstrap

BFF рендерит HTML на каждый HTML-запрос:

1. Проверяет сессию в Go API.
2. Вычисляет флаги и определяет релиз клиента для пользователя (§5.4):
   вариант канарейки из Unleash или `stable` из `current.json`.
3. Берёт `index.html` этого релиза.
4. Вставляет в страницу `window.__BOOTSTRAP__ = { user, flags, release }`
   и отдаёт ответ с заголовком `x-release` (§5.3).

На первый HTML-ответ BFF ставит first-party cookie с идентификатором
посетителя. Cookie получают все посетители, до входа и после него. Этот
идентификатор ключ липкости канарейки (§5.4).

Кэширование и цена запроса:

| Данные | Откуда | Как часто сетевой вызов |
| --- | --- | --- |
| флаги и канарейка | Unleash SDK, вычисление локально | периодическая загрузка правил SDK, не на запрос |
| `current.json` | S3 | кэш в памяти, TTL не больше 10 с: меньше периода загрузки правил Unleash SDK (15 с) |
| `index.html` релиза | S3 `releases/{sha}/index.html` | кэш в памяти по `{sha}`, файл релиза не меняется |
| `robots.txt` текущего stable-релиза | S3 `releases/{sha}/robots.txt`, `{sha}` это `stable` из `current.json` | кэш в памяти по `{sha}` |
| сессия | Go API по сети кластера | на каждый HTML-запрос |
| данные для `sitemap.xml` | Go API | кэш с TTL, не на каждый запрос бота |

- HTML персональный: `Cache-Control: private, no-store`, через CDN не идёт.
- JSON в HTML сериализуется с экранированием `<`.
- `user` из bootstrap кладётся в кэш TanStack Query, отдельного запроса
  проверки пользователя при загрузке нет.

### 4.3 Маршруты на входе

| Хост и путь | Куда |
| --- | --- |
| `site.ru` `/api/trpc/*` | BFF |
| `site.ru` `/sitemap.xml` | BFF |
| `site.ru` `/payment-callback` | BFF, как сейчас |
| `site.ru` остальные пути (HTML, `/robots.txt`) | BFF |
| `static.site.ru` | CDN перед S3 |

`robots.txt` лежит в `apps/client/public/` и попадает в сборку релиза.
Поисковики читают его только из корня хоста (RFC 9309), а ассеты релиза
лежат на `static.site.ru/releases/{sha}/`. Поэтому `/robots.txt` на
`site.ru` отдаёт BFF из текущего stable-релиза (`stable` в `current.json`),
а не из релиза, назначенного пользователю. В файле есть строка
`Sitemap: https://site.ru/sitemap.xml`.

Ассеты клиент грузит напрямую со `static.site.ru`: в Vite `base` равен
`https://static.site.ru/releases/{sha}/`. Проксирование статики через вход
кластера убирается. Маршруты `site.ru` задаются ресурсами `HTTPRoute`
Gateway API.

`releases/*` на `static.site.ru` отдаются с заголовками
`Access-Control-Allow-Origin: https://site.ru` и
`Cache-Control: public, max-age=31536000, immutable`: Vite подключает
модули с атрибутом `crossorigin`, без CORS-заголовка браузер их не
загрузит.

## 5. Модель релизов

### 5.1 Контракты

Между клиентом и BFF два контракта, оба экспортируются типами из `apps/bff`:

- `AppRouter`: процедуры tRPC, их входы и выходы.
- `BootstrapData`: форма `window.__BOOTSTRAP__`.

Правило: BFF версии N+1 обслуживает клиента N и N+1. Процедуры и поля не
удаляются и не сужаются в том же релизе, в котором клиент перестаёт их
использовать: сначала релиз клиента без использования, потом релиз BFF с
удалением.

### 5.2 Проверка контракта в CI

Шаг «Contract check» на `main` запускается всегда, на PR только если
затронут `apps/bff`:

1. Прочитать `current.json` из S3 и взять SHA `stable`. Если канарейка
   активна, взять и SHA канарейки из варианта флага в Unleash.
2. Если `current.json` нет (релизов ещё не было), шаг пропускается и пишет
   об этом в лог.
3. Для каждого SHA из шага 1 создать отдельный `git worktree` на этом SHA
   и выполнить в нём свой `bun install --frozen-lockfile`.
4. В worktree подменить только `apps/bff` на версию из HEAD вместе с его
   зависимостями и прогнать typecheck `apps/client` этого релиза.
5. Ошибка typecheck роняет сборку. Сообщение называет, какой контракт
   сломан.

Если SHA из шага 1 нет в истории git, шаг падает. Для `--affected` и
worktree на коммитах релизов checkout в CI делается с полной историей
(`fetch-depth: 0`).

Шаг проверяет то, что stable-клиент реально использует, а не всю форму
роутера. Изменения поведения при прежних типах он не ловит (§11).

Обновление tRPC делается в два шага: сначала версия, совместимая со
stable-клиентом, потом остальное. Иначе клиент stable-релиза в worktree
не пройдёт typecheck против нового `apps/bff`.

### 5.3 Версия релиза

- Сборка клиента получает `VITE_APP_RELEASE` = git SHA коммита и
  отправляет его в каждом запросе tRPC заголовком `x-client-release`.
  Заголовок нужен для логов и метрик: какие релизы клиента ещё ходят
  в BFF.
- BFF в каждом ответе отдаёт `x-release`: SHA релиза, который он
  назначил бы этому пользователю сейчас (§5.4).
- Сравнивается релиз клиента с `x-release`, а не с версией образа BFF:
  коммит, затронувший только клиент, BFF не выкатывает (§7), и SHA
  выкаченного образа BFF с релизом клиента совпадать не обязан.
- Логика сравнения живёт в одном собственном tRPC-link.

### 5.4 Канарейка

- Флаг Unleash канарейки клиента содержит вариант с payload
  `{ "release": "{sha}" }` и постепенную выкатку на процент пользователей.
- Липкость по идентификатору посетителя из first-party cookie (§4.2):
  пользователь не прыгает между релизами при перезагрузках. Вход в
  аккаунт релиз не меняет.
- BFF назначает релиз: если флаг канарейки включён для пользователя,
  релиз из payload, иначе `stable` из `current.json`.
- Health check канарейки загружает один чанк релиза со `static.site.ru`:
  так ловится ошибка CORS (§4.3). Превью с `base: /` эту ошибку не ловят.
- Promote: записать `{sha}` в `current.json` как `stable`, прежний `stable`
  перенести в `previous` (§5.6), выключить флаг канарейки.
- Откат: `stable` получает значение `previous`, `previous` не меняется
  (§5.7).
- Прерывание канарейки: выключить флаг, пайплайн падает и пишет в Telegram.

### 5.5 Перезагрузка клиента

| Ситуация | Действие |
| --- | --- |
| `x-release` отличается от релиза клиента, и запрос упал на контракте (`NOT_FOUND` процедуры, ошибка разбора входа) | перезагрузка сразу |
| `x-release` отличается, запрос успешен | мягкая перезагрузка: при следующем переходе по маршруту и не во время воспроизведения |
| lazy-чанк не загрузился (`vite:preloadError`) | перезагрузка сразу |

- Автоматическая перезагрузка не чаще одного раза на релиз за 10 минут:
  отметка в `sessionStorage`. При повторе клиент не перезагружается, а
  показывает пользователю предложение обновить страницу.
- Состояние плеера (очередь, трек, позиция) хранится через `persist` в
  zustand и переживает перезагрузку.
- TanStack Query перезапрашивает данные при возврате фокуса, поэтому
  старая вкладка узнаёт о новом релизе без отдельного опроса.

### 5.6 Хранение релизов в S3

- `current.json` хранит `{ "stable": "{sha}", "previous": "{sha}" }`.
  Promote записывает новый `stable` и переносит прежний в `previous`.
- Каждый релиз пишет `releases/{sha}/release.json` с SHA BFF, против
  которого прошёл Contract check.

В `releases/` остаются последние 5 релизов. Релизы `stable` и `previous`
из `current.json` и релиз активной канарейки не удаляются никогда. Старые
вкладки догружают чанки своего релиза, поэтому релиз не удаляется сразу
после promote.

### 5.7 Откат

Порядок: сначала канарейка, потом клиент, потом BFF. BFF N не обслуживает
клиента N+1, а BFF N+1 клиента N обслуживает.

1. Выключить флаг канарейки.
2. Переключить `current.json`: `stable` получает значение `previous`,
   `previous` не меняется; health check.
3. Если нужно откатить BFF: `git revert` коммита с тегом образа в
   Deployments repo, дождаться Healthy в Argo CD.
4. Закоммитить в Deployments repo `rollback-lock.json`: по записи на
   каждое откаченное приложение (`client` или `bff`) с его SHA.
5. Сообщение в Telegram.

Второй откат подряд (`stable` уже равен `previous`) делается ручной
правкой `current.json`.

Блокировка после отката, `rollback-lock.json`:

- Ставится при откате и клиента, и BFF.
- Пока блокировка есть, Monorepo CD не выкатывает приложение из неё: для
  `bff` не выкатывает BFF, для `client` не запускает канарейку клиента.
  Запуск падает с сообщением, которое называет блокировку.
- Блокировку снимает PR в Deployments repo с ревью, когда revert или
  исправление уже на `main` монорепы.

### 5.8 Превью PR

Staging есть только у фронта и BFF: превью PR на VPS 7 (Coolify). Go API
один на все окружения.

- Образ превью собирается из BFF и собранного клиента ветки. В режиме
  превью BFF берёт `index.html` и ассеты из своего образа, а не из S3;
  Vite `base` для превью `/`.
- BFF превью ходит в боевой Go API и в Unleash с токеном окружения
  `preview`: флаги превью не влияют на боевые флаги и канарейку.
- Превью получают собственный S2S-ключ к Go API с ограниченными правами.
- Боевая cookie сессии с префиксом `__Host-`: `Secure`, `Path=/`, без
  атрибута `Domain`. Код ветки на поддомене превью не получает боевые
  сессии и не может подменить их своей cookie на `site.ru`. На превью
  пользователь входит отдельно.
- BFF проверяет `Origin` и `Sec-Fetch-Site` на мутациях: поддомены превью
  same-site с `site.ru`, и `SameSite` от CSRF с них не спасает.
- Более сильная альтернатива: превью на отдельном регистрируемом домене.
- Превью не индексируются: BFF в режиме превью отдаёт на `/robots.txt`
  `Disallow: /` и добавляет заголовок `X-Robots-Tag: noindex` ко всем
  ответам.
- Превью работают с боевыми данными. Риск принят (§11).

## 6. CI монорепы

Группа в `ci.json`: «Frontend monorepo · bun workspaces · Turborepo».
Артефакты собираются один раз в CI, CD выкатывает готовое. Исключение:
превью PR, для них Coolify собирает свой образ BFF + клиент из ветки
(§5.8).

| Шаг | PR | `main` |
| --- | --- | --- |
| `bun install --frozen-lockfile` | да | всегда |
| `turbo run lint typecheck test` | затронутые пакеты, `--affected` | всегда, все пакеты |
| Contract check (§5.2) | если затронут `apps/bff` | всегда |
| клиент: `vite build`, Send bundle stats в Relative CI | если пакет затронут | всегда |
| BFF: `bun build --compile`, Build image | если пакет затронут | всегда |
| Upload release: клиент и `release.json` в S3 `releases/{sha}/` | | всегда |
| Push image `bff:{sha}` в Docker Registry | | всегда |
| Send to tg | да | всегда |

На PR `turbo run ... --affected` сравнивает с `main`: проверки, Contract
check и сборки идут только для затронутых пакетов. На `main` каждый шаг
CI выполняется безусловно, без `--affected`, Contract check тоже: CI
всегда собирает и публикует оба артефакта (релиз клиента в
`releases/{sha}/` и образ `bff:{sha}`). Приложений два, а упавший или
отменённый прогон не должен терять изменение. Что из этого выкатывать,
решает CD (§7).

Релиз в `releases/{sha}/` не живой, пока на него не указывает
`current.json` или канарейка.

## 7. CD монорепы

Выполняется на ARC-раннерах CI-кластера после зелёного CI на `main`.
Заменяет группы BFF CD, Frontend CD и Frontend Rollback.

Monorepo CD идёт в одной concurrency-группе: запуски встают в очередь,
без cancel-in-progress. Пока канарейка наблюдается, следующий запуск ждёт.

CD решает, что выкатывать, сравнением с выкаченным, а не с предыдущим
коммитом:

- BFF выкатывается, если `apps/bff` в HEAD отличается от коммита
  выкаченного тега `bff`.
- Канарейка клиента запускается, если `apps/client` или `apps/bff`
  отличаются от stable SHA из `current.json`.
- Пока в Deployments repo есть `rollback-lock.json` (§5.7), CD не
  выкатывает приложение из блокировки (BFF или канарейку клиента) и
  падает с сообщением, которое называет блокировку.

**Monorepo CD**

1. Если BFF выкатывается: коммит тега `bff:{sha}` в Deployments repo;
   Argo CD синхронизирует; ждать статус Healthy. Выкатка без простоя и
   проверка готовности обеспечиваются rolling update с readiness-пробой.
2. Если канарейка клиента запускается, строго после шага 1: регистрация
   канарейки (§5.4), health check канарейки, наблюдение, promote, health
   check.
3. Хранение релизов (§5.6).
4. Send to tg.

**Monorepo Rollback**: шаги §5.7.

**Превью PR** на VPS 7: шаги прежние, «Build image» становится
«Build image (BFF + client)», группы называются «PR монорепы открыт» и
«PR монорепы закрыт».

Backend CD и E2E в этой спеке не меняются.

## 8. Схемы

Цвета по конвенции `scripts/colors.ts`. Узел браузера везде имеет
`"id": "client"`, иначе стрелки от него не станут пользовательским
трафиком. Рабочее пространство клиента поэтому получает другой id
(`ws-client`). Легенду каждой изменённой схемы задаёт вывод `bun run check`.

### 8.1 Новая схема `diagrams/frontend-monorepo.json`

**Группы и узлы**

- `github` (purple, «GitHub»)
  - `monorepo` «Frontend monorepo · bun workspaces · Turborepo»
    - `ws-client` «apps/client», иконка `vite`: узлы «React» (`react`),
      «TanStack Router · Query» (`layers`), «zustand» (`package`)
    - `ws-bff` «apps/bff», иконка `bun`: узлы «Hono» (`hono`),
      «tRPC · AppRouter» (`trpc`), «HTML bootstrap · SEO» (`file-code`)
    - `turbo-pipeline` «turbo run --affected»: Activity «bun install»,
      «lint · typecheck · test», «Contract check», «vite build»,
      «bun build --compile», «Build image»
- `ours` (blue, «Наша инфраструктура (Selectel)»)
  - узлы «S3: releases/{sha}/, current.json», «CDN static.site.ru»,
    «Unleash»
  - `vps1` «VPS 1 · k3s» (`kubernetes`): «Traefik · Gateway API»
    (`traefik`), «BFF (Hono · bun)» (`hono`)
  - `vps2` «VPS 2 · k3s» (`kubernetes`): «Go API» (`go`)
- `registry` (green, «Docker Registry»): узел «bff:{sha}» (`docker`)
- узел `client` «Client (браузер)» вне групп
- `Textbox` с правилами выкатки: BFF первым; контракт совместим на релиз
  назад; Contract check в CI; `x-release`: при ошибке контракта
  перезагрузка сразу, иначе мягко, не чаще раза в 10 минут (§5.5);
  канарейка липкая по id посетителя из cookie BFF; последние 5 релизов в
  S3; откат: выключить канарейку, клиент, потом BFF

**Связи**

| От | К | Подпись |
| --- | --- | --- |
| `ws-client` | `ws-bff` | import type AppRouter, BootstrapData |
| bun install | lint · typecheck · test | |
| lint · typecheck · test | Contract check | |
| Contract check | vite build | |
| Contract check | bun build --compile | |
| bun build --compile | Build image | |
| Contract check | S3 | current.json: stable sha |
| vite build | S3 | releases/{sha}/ (main) |
| Build image | bff:{sha} | |
| `client` | Traefik | https://site.ru: HTML, /api/trpc |
| `client` | CDN | https://static.site.ru |
| S3 | CDN | static |
| Traefik | BFF | |
| BFF | Go API | S2S: сессия, данные, sitemap |
| BFF | S3 | index.html, current.json |
| BFF | Unleash | SDK: флаги, канарейка |

Строка в таблице схем `README.md`: «frontend-monorepo | Монорепа клиента и
BFF, контракт tRPC, модель релизов».

### 8.2 `diagrams/ci.json`

- Группа `repo-frontend`: заголовок «Frontend monorepo · bun workspaces ·
  Turborepo».
- Группа `fe-ci`: шаги §6. Шаги «detect affected» и «Build» заменяются.
  Две ветки после Contract check: клиент (vite build → Send bundle stats
  → Upload release (main)) и BFF (bun build --compile → Build image →
  Push image (main)); обе сходятся в Send to tg.
- Новые связи: Contract check → S3 «current.json»; Upload release → S3
  «releases/{sha}/»; Push image → `reg-bff`. Связь Send bundle stats →
  Relative CI остаётся.
- Группа `fe-ci` становится выше на 100 под второй ряд шагов; всё, что
  ниже монорепы, и узлы справа от неё (Docker Registry, S3, Telegram)
  сдвигаются вниз на 100.

### 8.3 `diagrams/cd.json`

- Удаляются группы `bff-cd` (с `ansible-playbook`), `frontend-cd`,
  `frontend-rollback`, их шаги и связи, узел Relative CI.
- Новая группа «Monorepo CD» в `vps5`: Commit bff:{sha} → Wait Argo CD:
  Healthy → Register as canary → Health check (canary) → Наблюдение →
  Promote to stable → Health check → Retention: 5 релизов → Send to tg.
  Куда коммит, показывает стрелка в Deployments repo.
- Новая группа «Monorepo Rollback» в `vps5`: Disable canary flag →
  Switch release pointer → Health check → Revert bff tag → Wait Argo CD:
  Healthy → Send to tg. Условие отката BFF описано в §5.7. Коммит
  `rollback-lock.json` (§5.7) на схеме не показан.
- Группа E2E, узлы moon и ReportPortal и группа `vps7` поднимаются на
  200 на место удалённых групп, высота `vps5` становится 600.
- Новая группа `github` (purple) с узлом «Deployments repo» (`github`) и
  узел «Argo CD (прод-кластер)» (`argo`) вне групп: где он работает,
  решает спека 3. Ширина группы `github` 280, чтобы подпись «Deployments
  repo» не обрезалась.
- Связи: Commit bff:{sha} → Deployments repo; Wait Argo CD → Argo CD;
  Argo CD → Deployments repo «sync»; Register as canary → Unleash
  «variant: {sha}»; Promote → S3 «current.json»; Retention → S3
  «releases/»; Disable canary flag → Unleash «flag off»; Switch release
  pointer → S3 «current.json»; Revert bff tag → Deployments repo «git
  revert»; Wait Argo CD (откат) → Argo CD.
- Группы превью в `vps7`: заголовки «PR монорепы открыт» и «PR монорепы
  закрыт», шаг «Build image (BFF + client)».

### 8.4 `diagrams/deployment.json`

- `vps1`: заголовок «VPS 1 · k3s», иконка `kubernetes`. Узел
  `vps1-caddy` заменяется на `vps1-gateway` «Traefik · Gateway API»
  (`traefik`). Узел `vps1-bff`: «BFF (Hono · bun)».
- `vps2`: заголовок «VPS 2 · k3s», иконка `kubernetes`. Узел `vps2-caddy`
  и связь от него удаляются.
- Связи:

  | От | К | Подпись | Изменение |
  | --- | --- | --- | --- |
  | `client` | `vps1-gateway` | https://site.ru: HTML, /api/trpc | вместо `client → vps1-caddy` |
  | `vps1-gateway` | `vps1-bff` | | вместо `vps1-caddy → vps1-bff` |
  | `vps1-caddy` | `cdn` | proxy pass static | удаляется |
  | `vps1-bff` | `vps2-go` | S2S: сессия, данные, sitemap | подпись |
  | `vps1-bff` | `s3` | index.html релиза | без изменений |
  | `vps1-bff` | `vps8-unleash` | | без изменений |
  | `vps7-coolify` | `vps2-go` | превью | новая |
  | `vps7-coolify` | `vps8-unleash` | превью: env preview | новая |

  Подписи BFF → S3 и BFF → Unleash на обзорной схеме остаются прежними:
  при раскладке `deployment` обе стрелки идут вертикально, и длинные
  подписи налезают на соседние узлы (проверено рендером). Полные подписи
  есть на `frontend-monorepo`.

### 8.5 `diagrams/integrations.json`

Узел `caddy-vps1` заменяется на `gateway-vps1` «Traefik (VPS 1)»
(`traefik`), связи от `client` и от ЮMoney переводятся на него. Подпись
связи от `client`: «https://site.ru: HTML, /api/trpc».

## 9. Вне рамок

- Продуктовая архитектура и декомпозиция бэкенда.
- Контракт и HTTP-клиент между BFF и Go API.
- Спека 2: наблюдаемость (метрики приложений, логи и трейсы, Faro),
  дежурный агент.
- Спека 3: control plane k3s и снапшоты etcd, узлы и метки, сеть кластера,
  cert-manager, Postgres вне кластера, CI-кластер на VPS 5, деплой и
  миграции Go через Argo CD, место Argo CD, Unleash, Uptime Kuma, Grafana
  и остальных VPS, судьба Caddy на VPS 3 и VPS 4.

## 10. Приёмка

- Схемы §8 изменены, `frontend-monorepo.json` добавлена, строка в
  `README.md` есть.
- `bun run typecheck`, `bun run test`, `bun run build` проходят.
- PNG каждой изменённой схемы проверены глазами по скиллу
  `eraser-diagrams`: узлы не накладываются, узлы внутри своих групп,
  подписи читаемы, легенда ничего не перекрывает.
- Превью ветки на Pages собирается.

## 11. Риски

- **Превью на боевых данных.** Код любой ветки работает с боевым Go API
  с поддомена `site.ru`. Возможны подброс cookie на `site.ru` (cookie
  tossing), CSRF с поддоменов превью, которые same-site с `site.ru`, и
  злоупотребление S2S-ключом превью, который получает код ветки.
  Смягчение: боевая cookie сессии с префиксом `__Host-`, проверка
  `Origin` и `Sec-Fetch-Site` на мутациях в BFF, собственный S2S-ключ
  превью с ограниченными правами, отдельный вход на превью, отдельное
  окружение Unleash. Более сильная альтернатива: превью на отдельном
  регистрируемом домене.
- **Проверка контракта только по типам.** Смена смысла поля при прежнем
  типе проходит проверку. Смягчение: правило §5.1 и ревью.
- **Вкладки старше предыдущего релиза** получают ошибку контракта и
  перезагружаются сразу, возможен обрыв воспроизведения.
- **Задержка SDK Unleash.** Включение и выключение канарейки доходит до BFF
  за период загрузки правил, по умолчанию до 15 с. Health check канарейки
  начинается не раньше этого срока.
- **Один вход трафика на VPS 1.** Отказ VPS 1 кладёт сайт, как и сейчас;
  решается в спеке 3.
- **`bun build --compile` и нативные зависимости.** Пакет BFF с нативным
  модулем может не собраться в один бинарник; сейчас Hono и tRPC на чистом
  JS.
