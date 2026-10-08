# docs

Документация сервиса Cringe-Driven-Development-Team.

## Диаграммы

Архитектурные схемы как код. Исходники в `diagrams/*.json` и
`diagrams/<папка>/*.json` в формате
[eraser-diagrams](https://github.com/eraserlabs/eraser-diagrams), рендер
в HTML и PNG, публикация на GitHub Pages:
**https://cringe-driven-development-team.github.io/docs/**

Пайплайн перенесён из [YarikMix/diagrams](https://github.com/YarikMix/diagrams)
(коммит `e8fd4bb`). Спеки и планы в `docs/superpowers/` написаны до переноса,
адреса в них старые.

Архитектур три. **MVP: одна VPS** это рабочая, с ней идёт вся текущая
работа: одна VPS с Caddy, Go API и Postgres, фронт ходит в Go API напрямую;
дизайн в `docs/superpowers/specs/2026-09-29-mvp-single-vps-design.md`.
**BFF: две VPS** заморожена в `diagrams/bff/`, её схемы не правятся; дизайн
в `docs/superpowers/specs/2026-09-16-mvp-compose-design.md`. **Frozen: k3s**
заморожена в `diagrams/frozen-k3s/`, её схемы не правятся; дизайн в
`docs/superpowers/specs/2026-09-15-frontend-monorepo-design.md`.

MVP (`diagrams/`):

| Схема | Что показывает |
| --- | --- |
| [deployment](https://cringe-driven-development-team.github.io/docs/deployment.html) | Одна VPS в Selectel: Caddy, Go API, Postgres; S3/CDN, клиент |
| [ci](https://cringe-driven-development-team.github.io/docs/ci.html) | GitHub-репозитории, CI-пайплайны, Contract drift, GHCR, S3 |
| [cd](https://cringe-driven-development-team.github.io/docs/cd.html) | CD фронта через S3, откат, выкладка статики в бакет статики за CDN, CD бэка через ansible-playbook |
| [frontend](https://cringe-driven-development-team.github.io/docs/frontend.html) | Репа клиента, контракт из Apidog, модель релизов |
| [contract](https://cringe-driven-development-team.github.io/docs/contract.html) | Spec-first: контракт в Apidog, кодогенерация бэка и фронта, Contract drift |
| [infra](https://cringe-driven-development-team.github.io/docs/infra.html) | Проекты Selectel, стейт Pulumi, домен; Pulumi и Ansible с ноута студента |

BFF: две VPS (`diagrams/bff/`):

| Схема | Что показывает |
| --- | --- |
| [deployment](https://cringe-driven-development-team.github.io/docs/bff/deployment.html) | Два VPS в Selectel с Docker Compose, S3/CDN, клиент |
| [ci](https://cringe-driven-development-team.github.io/docs/bff/ci.html) | GitHub-репозитории, CI-пайплайны, GHCR, S3 |
| [cd](https://cringe-driven-development-team.github.io/docs/bff/cd.html) | CD и откат через ansible-playbook из GitHub Actions |
| [frontend-monorepo](https://cringe-driven-development-team.github.io/docs/bff/frontend-monorepo.html) | Монорепа клиента и BFF, контракт tRPC, модель релизов |
| [infra](https://cringe-driven-development-team.github.io/docs/bff/infra.html) | Проекты Selectel, стейт Pulumi, домен; две VPS |

Frozen: k3s (`diagrams/frozen-k3s/`):

| Схема | Что показывает |
| --- | --- |
| [deployment](https://cringe-driven-development-team.github.io/docs/frozen-k3s/deployment.html) | VPS в Selectel, k3s, S3/CDN, клиент |
| [ci](https://cringe-driven-development-team.github.io/docs/frozen-k3s/ci.html) | GitHub-репозитории, CI-пайплайны и их цели |
| [cd](https://cringe-driven-development-team.github.io/docs/frozen-k3s/cd.html) | CD через Argo CD, канарейка, превью на Coolify |
| [integrations](https://cringe-driven-development-team.github.io/docs/frozen-k3s/integrations.html) | Внешние сервисы и кто с ними говорит |
| [frontend-monorepo](https://cringe-driven-development-team.github.io/docs/frozen-k3s/frontend-monorepo.html) | Монорепа клиента и BFF, Contract check, канарейка |

Таблицы ведутся вручную: добавил файл в `diagrams/`, добавь строку сюда.
`dist/diagrams/index.html` собирается автоматически: внизу страницы табы, как листы
в Google Sheets. Первый таб `mvp` это схемы корня, он открыт по умолчанию,
дальше по табу на подпапку. Схема из подпапки рендерится в
`dist/<папка>/<name>.html` и `.png`. Замороженные `bff/` и `frozen-k3s/` на
индекс не попадают (`HIDDEN_FOLDERS` в `scripts/build-index.ts`), их схемы
открываются по ссылкам из таблиц выше. Пока других подпапок нет, табов на
индексе нет, там список схем `mvp`.

### Локально

Нужны bun ≥ 1.3, Node ≥ 22.12 и запущенный Docker Desktop. `bun run render`,
`bun run build` и `bun run site` работают в образе из `Dockerfile` (Chromium, шрифты
и Node той же версии, что в CI), поэтому локальный `dist/` совпадает с CI. Первый
запуск собирает образ, дальше он берётся из кэша. Остальные скрипты работают на хосте.

Docker не запущен — рендер остановится с подсказкой. Рендер на хосте, как раньше:
`DIAGRAMS_NATIVE=1 bun run render`; для него нужен Google Chrome (или другой
Chromium, путь в `CHROMIUM_PATH`) и настоящий Node в PATH.

```bash
bun install
bun run validate   # схема, без браузера; имена иконок он не проверяет
bun run check      # цветовая конвенция и легенды, без браузера
bun run warm       # докачать иконки схем в .eraser/icons, неизвестное имя роняет
bun run render     # dist/<name>.html и .png, подпапки в dist/<папка>/; в Docker
bun run build      # validate + check + warm + render + индекс схем + VitePress + site:check; в Docker
bun run site:dev   # VitePress локально: http://localhost:5173/docs/
bun run site       # build + превью всех веток origin в dist/branches/; в Docker
bun run icons      # обновить icons.txt из каталога иконок Eraser
bun run test
bun run typecheck  # строгая проверка типов скриптов
```

### Как править

Диаграммы правит агент Claude Code по скиллу
`.claude/skills/eraser-diagrams/SKILL.md`: изменить JSON, `bun run validate`,
`bun run check`, `bun run render`, посмотреть PNG, поправить координаты.
Цвета групп и стрелок задаёт конвенция, её проверяет `bun run check`. Координаты
абсолютные, автораскладки узлов нет. Имена иконок в `icons.txt`.
Рендер автономен: в `dist/*.html` нет `file://` и внешних `src`,
`<link>`, `@import`, `url()`; ссылки `https://…` допустимы только внутри
`<a href>` (CLI делает их из подписей стрелок).

Правила для агента Claude Code в этом репозитории — `CLAUDE.md`.

CI на pull request валидирует и рендерит схемы, артефакт `diagrams`
содержит `dist/`. Push в `main` публикует `dist/` на Pages. В настройках
репозитория должно стоять Settings → Pages → Build and deployment → Source →
GitHub Actions, иначе job `deploy` падает с «Get Pages site failed»
(для этой репы уже включено).

### Сайт

Главная `https://cringe-driven-development-team.github.io/docs/` — документация на
[VitePress](https://vitepress.dev/): исходники страниц в `site/`, конфиг и меню в
`site/.vitepress/config.mts`. Индекс схем открывается из меню «Архитектура»
(`/docs/diagrams/`), сами схемы — по прежним адресам `/docs/<name>.html` и `.png`.
Старые ссылки на карточки вида `/docs/#contract` главная переводит на `/docs/diagrams/#contract`.

`bun run build` после рендера схем собирает VitePress (`bun run site:vitepress`) и переносит
его в `dist/`: если файл VitePress совпал с файлом схемы, сборка падает, а не затирает схему.
Затем `bun run site:check` проверяет ссылки, якоря и картинки страниц VitePress и индекса
схем. Новая страница — файл в `site/` и пункт в `sidebar` конфига. Mermaid-схемы в Markdown:
`sequenceDiagram`, участники с короткими ASCII-алиасами, без `;` и `#` в сообщениях.

### Модули

План учебного модуля (месяц разработки) — граф «люди — треки — подзадачи» на
`/docs/modules/<YYYY-MM>/`, страница на каждый трек и архив `/docs/modules/`. Данные лежат в
`site/modules/`, меню модулей собирается из файлов само. Ошибка в данных роняет сборку и
называет файл и поле.

- **Человек** — строка в `site/modules/people.ts`: GitHub-логин, имя, роль, направление
  (`front`, `back`, `devops`, `fullstack`, `team`), `mentor: true` у менторов.
- **Модуль** — каталог `site/modules/<YYYY-MM>/` с `index.md`: во frontmatter `title`,
  необязательный `period` и `aside: false`, в тексте `<ModuleGraph />`.
- **Трек** — файл `site/modules/<YYYY-MM>/tracks/<id>.md`, `id` — строчная латиница, цифры и дефис:

  ```yaml
  ---
  title: Multi-branch деплой фронта и стейджинг бэка через Coolify
  label: Multi-branch + стейджинг (Coolify)   # подпись на графе; без него — title
  area: devops                                 # front | back | devops | fullstack | team
  do:                                          # логин → сторона: front | back | devops | team
    iRedTea: devops
  help: [YarikMix, blackHATred]                # необязательно
  subtasks:                                    # необязательно
    - Откаты
  related:                                     # необязательно: связь с треком этого модуля
    - track: ai-review
      why: Агентам Stagehand нужен стенд ветки
  ---

  ## Цель
  …
  ```

  Заголовок, исполнителей, подзадачи и связи страница трека показывает сама — в тексте
  `# Заголовок` не нужен. Пока текста нет, на странице плашка «Описание ещё не написано».
  У трека `fullstack` нужны исполнители со стороны `front` и `back`.

В `vitepress dev` новый трек появится на графе сразу, а в меню — после перезапуска
dev-сервера. Формат и проверки — `docs/superpowers/specs/2026-10-08-module-graph-design.md`.

#### Задачи с доски

Граф показывает прогресс треков по задачам доски GitHub Projects. Привязка задачи к треку — поле
«Трек» на доске: его значения создаёт `bun scripts/board.ts sync` по файлам треков. У модуля
во frontmatter `index.md` список `sprints` (например `sprints: [Sprint 5, Sprint 6]`) определяет,
к какому модулю относится задача по её спринту.

Снимок доски собирает отдельный job `board` в workflow Pages: на каждый запуск на `main` и по
расписанию раз в час (`7 3-20 * * *`, UTC). Токен `ADD_TO_PROJECT_PAT` получает только этот job,
который выполняет код из `main`; сборка веток токена не видит и берёт готовый снимок. Если job
упал, сайт собирается без прогресса.

Локально снимок получают так:

```sh
GH_TOKEN="$(gh auth token)" bun scripts/board.ts snapshot site/modules/board.json
```

Файл `site/modules/board.json` в git не попадает.

### Превью веток

Push в любую ветку публикует её сайт и схемы по адресу
`https://cringe-driven-development-team.github.io/docs/branches/<slug>/`, где slug это имя
ветки, в котором всё, кроме латиницы, цифр, `.`, `_` и `-`, заменено на
`-`: `feature/new-vps` становится `feature-new-vps`. Список всех превью:
**https://cringe-driven-development-team.github.io/docs/branches/**
Точный адрес ищи в этом списке: при совпадении имён к slug добавляется
короткий SHA.

Push в ветку запускает workflow Pages на `main`. Тот собирает `main` и все
ветки их собственными скриптами (`bun run site`) и публикует единым
сайтом, поэтому превью появляется через несколько минут. В проверках PR эта сборка не видна: её ведёт отдельный запуск Pages
на `main` (вкладка Actions). Pages кэширует страницы на 10 минут: если превью
не обновилось, обнови страницу с Ctrl+F5. После удаления
ветки её превью исчезает при следующем запуске. Ветка, которая не
собралась, остаётся в списке с пометкой «не собралась» и шагом, на котором
упала. Слитые ветки лучше удалять: каждая добавляет время сборки.

Ветка, созданная до появления этого workflow в `main`, начнёт обновлять
превью только после того, как в неё попадёт свежий
`.github/workflows/pages.yml` из `main`.

Сборка превью выполняет код каждой ветки в том же job, который публикует
сайт. Поэтому ветка может изменить весь опубликованный сайт до следующего
деплоя из `main`. Писать ветки в репозиторий могут только участники с
правом push. Локально `bun run site` делает `git fetch --prune` всех веток
`origin`.

Из git worktree (`.claude/worktrees/…`) `bun run site` в Docker не работает: `.git` там ссылается на
путь хоста, которого нет в контейнере. Запускай его из основного клона или `DIAGRAMS_NATIVE=1 bun run site`.

Дизайн: `docs/superpowers/specs/2026-09-12-eraser-diagrams-pipeline-design.md`,
`docs/superpowers/specs/2026-09-13-diagram-colors-and-bun-design.md`,
`docs/superpowers/specs/2026-09-13-branch-previews-design.md`,
`docs/superpowers/specs/2026-09-16-mvp-compose-design.md`,
`docs/superpowers/specs/2026-09-27-docker-render-design.md`.
