<h1 align="center">Документация и архитектура проекта «Colab» команды «Cringe Driven Development»</h1>

<p align="center">
<a href="https://docs.cellestial.ru/"><img src="https://img.shields.io/badge/Сайт-5C73E7?style=for-the-badge&logo=vitepress&logoColor=white" alt="Сайт документации"></a>
<a href="https://docs.cellestial.ru/architecture/"><img src="https://img.shields.io/badge/Архитектура-EC2C40?style=for-the-badge&logo=eraser&logoColor=white" alt="Диаграммы архитектуры"></a>
<a href="https://docs.cellestial.ru/modules/"><img src="https://img.shields.io/badge/Модули-2EA44F?style=for-the-badge&logo=roadmapdotsh&logoColor=white" alt="Планы модулей"></a>
<a href="https://github.com/orgs/Cringe-Driven-Development-Team/projects/1"><img src="https://img.shields.io/badge/Доска_задач-1F6FEB?style=for-the-badge&logo=github&logoColor=white" alt="Доска задач"></a>
<br>
<a href="https://github.com/frontend-park-mail-ru/2026_2_Cringe_Driven_Development"><img src="https://img.shields.io/badge/Фронтенд-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="Репозиторий фронтенда"></a>
<a href="https://github.com/go-park-mail-ru/2026_2_Cringe_Driven_Development"><img src="https://img.shields.io/badge/Бэкенд-00ADD8?style=for-the-badge&logo=go&logoColor=white" alt="Репозиторий бэкенда"></a>
<a href="https://github.com/Cringe-Driven-Development-Team"><img src="https://img.shields.io/badge/Организация-24292E?style=for-the-badge&logo=github&logoColor=white" alt="Организация команды"></a>
</p>

<p align="center"><img src=".github/assets/nanami.gif" alt="" width="426"></p>

**Содержание:** [Контекст проекта](https://docs.cellestial.ru/project-context) · [Диаграммы](#диаграммы) · [Локально](#локально) · [Как править](#как-править) ·
[Сайт](#сайт) · [Модули](#модули) · [Превью веток](#превью-веток)

[OpenWiki — тематический указатель](https://github.com/Cringe-Driven-Development-Team/docs/blob/main/openwiki/quickstart.md).
Wiki — производное представление документации. Канонический текст остаётся в `docs`;
найденное утверждение сверяй с исходником на актуальном SHA. Wiki обновляется локально только по команде владельца.

## Диаграммы

Архитектурные схемы как код. Исходники в `diagrams/*.json`,
`diagrams/<папка>/*.json` и `diagrams/modules/<N>/*.json` в формате
[eraser-diagrams](https://github.com/eraserlabs/eraser-diagrams), рендер
в HTML и PNG, публикация на GitHub Pages:
**https://docs.cellestial.ru/**

Пайплайн перенесён из [YarikMix/diagrams](https://github.com/YarikMix/diagrams)
(коммит `e8fd4bb`). Спеки и планы в `docs/superpowers/` написаны до переноса,
адреса в них старые.

Архитектур две. **MVP: одна VPS** это рабочая, с ней идёт вся текущая
работа: одна VPS с Caddy, Go API и Postgres, фронт ходит в Go API напрямую;
дизайн в `docs/superpowers/specs/2026-09-29-mvp-single-vps-design.md`.
**Frozen: k3s** заморожена в `diagrams/frozen-k3s/`, её схемы не правятся;
дизайн в `docs/superpowers/specs/2026-09-15-frontend-monorepo-design.md`.

MVP (`diagrams/`):

| Схема | Что показывает |
| --- | --- |
| [deployment](https://docs.cellestial.ru/deployment.html) | Одна VPS в Selectel: Caddy, Go API, Postgres; S3/CDN, клиент |
| [ci](https://docs.cellestial.ru/ci.html) | GitHub-репозитории, CI-пайплайны, Contract drift, GHCR, S3 |
| [cd](https://docs.cellestial.ru/cd.html) | CD фронта через S3, откат, выкладка статики в бакет статики за CDN, CD бэка через ansible-playbook |
| [frontend](https://docs.cellestial.ru/frontend.html) | Репа клиента, контракт из Apidog, модель релизов |
| [contract](https://docs.cellestial.ru/contract.html) | Spec-first: контракт в Apidog, кодогенерация бэка и фронта, Contract drift |
| [infra](https://docs.cellestial.ru/infra.html) | Проекты Selectel, стейт Pulumi, домен; Pulumi и Ansible с ноута студента |

Frozen: k3s (`diagrams/frozen-k3s/`):

| Схема | Что показывает |
| --- | --- |
| [deployment](https://docs.cellestial.ru/frozen-k3s/deployment.html) | VPS в Selectel, k3s, S3/CDN, клиент |
| [ci](https://docs.cellestial.ru/frozen-k3s/ci.html) | GitHub-репозитории, CI-пайплайны и их цели |
| [cd](https://docs.cellestial.ru/frozen-k3s/cd.html) | CD через Argo CD, канарейка, превью на Coolify |
| [integrations](https://docs.cellestial.ru/frozen-k3s/integrations.html) | Внешние сервисы и кто с ними говорит |
| [frontend-monorepo](https://docs.cellestial.ru/frozen-k3s/frontend-monorepo.html) | Монорепа клиента и BFF, Contract check, канарейка |

Модуль №2 (`diagrams/modules/2/`) — план, а не прод: в «Архитектуру» не попадает, папка в `HIDDEN_FOLDERS`
(`site/.vitepress/diagram-names.ts`), схема встраивается на страницу модуля через
`<Diagram name="modules/2/<имя>" />`:

| Схема | Что показывает |
| --- | --- |
| [bff-contract](https://docs.cellestial.ru/modules/2/bff-contract.html) | Контракт BFF: официальный tRPC модуля №2, генерация Go-клиента и схем, HTML bootstrap из локального шаблона |
| [bff-bootstrap](https://docs.cellestial.ru/modules/2/bff-bootstrap.html) | Первый HTML: общая с RPC сессия, пользователь или гость, безопасный JSON в локальном шаблоне и HTML 503 |
| [bff-csrf-client](https://docs.cellestial.ru/modules/2/bff-csrf-client.html) | CSRF своего клиента: статический заголовок, cookie браузера, проверки до сессии и вызова Go |
| [bff-csrf-foreign](https://docs.cellestial.ru/modules/2/bff-csrf-foreign.html) | Атака с чужого сайта: форма с 415/403, остановка fetch на preflight и случай same-site поддомена |
| [bff-csrf-navigation](https://docs.cellestial.ru/modules/2/bff-csrf-navigation.html) | Внешний GET HTML: Lax-cookie, общая сессия и BootstrapData до первого рендера |
| [frontend-monorepo](https://docs.cellestial.ru/modules/2/frontend-monorepo.html) | Монорепа фронта: workspace, общие типы, командные и официальные npm-пакеты, Vite и Bun build, упаковка общего образа |
| [front-libs-npm-token](https://docs.cellestial.ru/modules/2/front-libs-npm-token.html) | Публикация с npm-токеном: владелец, GitHub Secrets, env job и npm registry |
| [front-libs-trusted-publishing](https://docs.cellestial.ru/modules/2/front-libs-trusted-publishing.html) | Trusted Publishing: GitHub OIDC identity, проверка repo/workflow и краткоживущие npm-права |
| [front-libs-release](https://docs.cellestial.ru/modules/2/front-libs-release.html) | Каскадный релиз React → Zustand: CI, независимые версии, GitHub Releases и публикация в npm |

Схемы MVP показаны на странице «Архитектура» (`/architecture/`) живыми карточками:
масштаб кнопками и Ctrl/⌘ + колесо, щипок, перетаскивание, полный экран (компонент
`site/.vitepress/theme/Diagram.vue`). Добавил схему в корень `diagrams/` — добавь строку в таблицу,
имя в `ROOT_NAMES` (`site/.vitepress/diagram-names.ts`: по нему берутся размеры и переадресуются
старые якоря) и раздел `## <имя>` с `<Diagram name="<имя>" />` на `site/architecture/index.md`:
тесты `scripts/build-index.test.ts` и `scripts/architecture-page.test.ts` упадут, если чего-то нет. Схема из подпапки
рендерится в `dist/<папка>/<name>.html` и `.png`. Замороженная `frozen-k3s/`
(`HIDDEN_FOLDERS` в `site/.vitepress/diagram-names.ts`) в меню не показывается, её схемы
открываются по ссылкам из таблицы выше.

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
bun run build      # validate + check + warm + render + переадресация индекса + VitePress + site:check; в Docker
bun run site:dev   # dev-сервер для правок: http://localhost:5173/ (известная ошибка fastdom — ниже)
bun run site       # build + превью всех веток origin в dist/branches/; в Docker
bun run icons      # обновить icons.txt из каталога иконок Eraser
bun run test
bun run typecheck  # строгая проверка типов скриптов
bun run skills:sync # копия скиллов .claude/skills из .agents/skills; правь скиллы только в .agents/skills
```

#### Работа в Codex

Запускай новую сессию из корня клона `docs` или его git worktree: так Codex обнаружит
инструкции, скиллы и проектный хук `.codex/hooks.json`. Зависимости должны быть установлены
через `bun install`. Из корня репозитория:

```bash
codex
```

Открой `/hooks`, проверь и разреши хук «Проверка модулей» из `.codex/hooks.json`.
Проект должен быть доверенным. Codex запоминает доверие к определению хука;
после его изменения понадобится повторная проверка. Правила подключения —
[официальная документация Codex](https://learn.chatgpt.com/docs/hooks).

В проверенном Codex CLI 0.162.1 определения хуков для linked worktree берутся
из основного клона. При первом добавлении хука обнови основную копию после мержа:
пока `.codex/hooks.json` есть только в worktree, Codex его не обнаружит.
Сама команда проверяет файлы текущего worktree. В старой ветке, где ещё нет
`scripts/codex-modules-hook.ts`, она молча пропускает проверку.

Хук запускает установленный `module-graph check` после `apply_patch` и shell-команд,
потому что shell тоже может менять файлы. Он проверяет все `site/modules/`, включая
связи после удаления и переименования файлов. При успехе молчит; при ошибке передаёт
её агенту через stderr с кодом выхода 2. Без установленного пакета проверка молча
пропускается — хук не скачивает зависимости.

Скрипт `scripts/codex-modules-hook.ts` определяет корень по своему расположению,
поэтому проверяет текущий worktree и работает при запуске команды из подкаталога.
Он использует обычный `check`: режим `check --hook` ожидает `tool_input.file_path`
Claude Code, тогда как Codex передаёт `tool_input.command`.

Хук Claude Code остаётся в `.claude/settings.json`. Проверка перед коммитом —
`bun run modules:check`; установленный через `bun install` pre-commit lefthook также
проверяет изменения модулей.

#### Офлайн-чтение на macOS

Для чтения всей документации со схемами собери статическую копию в `dist/`, затем запусти
локальный сервер. Нужны установленные зависимости (`bun install`) и Chrome Beta. Первую подготовку
и сборку делай с интернетом: могут докачиваться зависимости и иконки.

Из корня клона (например, `~/projects/cdd-docs`) собери документацию через установленный браузер:

```bash
cd ~/projects/cdd-docs

DIAGRAMS_NATIVE=1 \
CHROMIUM_PATH="/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta" \
bun run build
```

Если установлен обычный Google Chrome, укажи вместо этого
`CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`.

После успешной сборки запусти готовую копию:

```bash
bunx vite preview --host 127.0.0.1 --port 4173 --strictPort
```

Открой **http://127.0.0.1:4173/**. Пока сервер работает, страницы, поиск, графы модулей и схемы
доступны без интернета. Внешние ссылки на GitHub и другие сайты требуют сети. Остановка сервера —
Ctrl+C в терминале. Если порт 4173 занят, останови прежний сервер или выбери другой порт.

Пересобирай после обновления документации. Для повторного чтения той же копии достаточно команды
`bunx vite preview`: Docker и повторный рендер схем не нужны.

Этот способ обходит две известные ошибки текущей конфигурации:

- **Белый экран в `bun run site:dev`** с ошибкой `fastdom.js … does not provide an export named 'default'`:
  Mermaid в dev-режиме неправильно подключает `fastdom`. В статической сборке ошибка не воспроизводится.
- **Ошибка сборки Docker на ARM64** `executable doesn't exist at /usr/local/bin/chromium`:
  Dockerfile ищет браузер в `chrome-linux64/chrome`, а в ARM64-образе он лежит в `chrome-linux/chrome`.
  Команда с `DIAGRAMS_NATIVE=1` и `CHROMIUM_PATH` выше использует браузер на хосте.

### Как править

Диаграммы правит агент (правила — `AGENTS.md`) по скиллу
`.agents/skills/eraser-diagrams/SKILL.md`: изменить JSON, `bun run validate`,
`bun run check`, `bun run render`, посмотреть PNG, поправить координаты.
Цвета групп и стрелок задаёт конвенция, её проверяет `bun run check`. Координаты
абсолютные, автораскладки узлов нет. Имена иконок в `icons.txt`.
Рендер автономен: в `dist/*.html` нет `file://` и внешних `src`,
`<link>`, `@import`, `url()`; ссылки `https://…` допустимы только внутри
`<a href>` (CLI делает их из подписей стрелок).

Правила для агентов в этом репозитории — `AGENTS.md` (Claude Code подключает его через `CLAUDE.md`).

CI на pull request валидирует и рендерит схемы, артефакт `diagrams`
содержит `dist/`. Push в `main` публикует `dist/` на Pages. В настройках
репозитория должно стоять Settings → Pages → Build and deployment → Source →
GitHub Actions, иначе job `deploy` падает с «Get Pages site failed»
(для этой репы уже включено).

### Сайт

Главная `https://docs.cellestial.ru/` — документация на
[VitePress](https://vitepress.dev/): исходники страниц в `site/`, конфиг и меню в
`site/.vitepress/config.mts`. Схемы — в меню «Архитектура» (`/architecture/`), их файлы —
по адресам `/<name>.html` и `.png`. Старый индекс `/diagrams/` — переадресация:
`#contract` ведёт на `/architecture/#contract`, `#frozen-k3s/ci` — на `/frozen-k3s/ci.html`; так же
главная переводит старые ссылки `/#contract`.

`bun run build` после рендера схем собирает VitePress (`bun run site:vitepress`) и переносит
его в `dist/`: если файл VitePress совпал с файлом схемы, сборка падает, а не затирает схему.
Затем `bun run site:check` проверяет ссылки (и `<iframe src>` карточек схем), якоря и картинки
страниц VitePress. Новая страница — файл в `site/` и пункт в `sidebar` конфига. Mermaid-схемы в Markdown:
`sequenceDiagram`, участники с короткими ASCII-алиасами, без `;` и `#` в сообщениях.

### Модули

План учебного модуля (месяц разработки) — граф «люди — треки — подзадачи» на
`/modules/<номер>/`, страница на каждый трек и архив `/modules/`. Данные лежат в
`site/modules/`, меню модулей собирается из файлов само. Ошибка в данных роняет сборку и
называет файл и поле.

Модули — план: что ещё не сделано и будет реализовано, вместе с проектными документами треков.
Остальные разделы сайта и схемы корня описывают, как работает прод. Сделанный трек остаётся в архиве
модуля как история, а прод описывается в разделе вне модулей.

- **`site/modules/people.yaml`** — люди: GitHub-логин, имя, роль, направление
  (`front`, `back`, `devops`, `fullstack`, `team`), `mentor: true` у менторов.
- **`site/modules/module-graph.yaml`** — настройки графа и доски (организация, проект, поля). Формат и CLI —
  [README пакета](https://github.com/TP-Prepare/frontend-packages/blob/main/packages/vitepress-module-graph/README.md).
- **Модуль** — каталог `site/modules/<номер>/` (`2`, `3`, …) с `index.md`: во frontmatter `title`,
  необязательный `period` и `aside: false`, в тексте `<ModuleGraph />`.
- **Трек** — файл `site/modules/<номер>/tracks/<id>.md`, `id` — строчная латиница, цифры и дефис:

  ```yaml
  ---
  title: Multi-branch деплой фронта и стейджинг бэка через Coolify
  label: Multi-branch + стейджинг (Coolify)   # подпись на графе; без него — title
  area: devops                                 # front | back | devops | fullstack | team
  do:                                          # логин → сторона: front | back | devops | team
    iRedTea: devops
  mentors: [YarikMix, blackHATred]             # необязательно; только люди с mentor: true в people.yaml
  subtasks:                                    # необязательно: строка или { title, issues }
    - Откаты
    - title: Стенд ветки
      issues: [infra#12]                       # номера задач с доски, видны в карточке подзадачи
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
- **Подстраницы трека** — когда одной страницы мало: файлы `tracks/<id>/<page>.md` с `title` во
  frontmatter и список во frontmatter трека, он же задаёт порядок:

  ```yaml
  pages: [contract, auth]
  ```

  Подстраницы появляются в меню под треком и строкой «Документы» в шапке трека. Файл без записи в
  `pages` или запись без файла роняют сборку.

В `vitepress dev` новый трек появится на графе сразу, а в меню — после перезапуска
dev-сервера. Формат и проверки — [README пакета](https://github.com/TP-Prepare/frontend-packages/blob/main/packages/vitepress-module-graph/README.md) и `docs/superpowers/specs/2026-10-09-vitepress-module-graph-design.md` §4.

#### Задачи с доски

Граф показывает прогресс треков по задачам доски GitHub Projects. Привязка задачи к треку — поле
«Трек» на доске: его значения создаёт `./node_modules/.bin/module-graph board sync` по файлам треков. У модуля
во frontmatter `index.md` список `sprints` (например `sprints: [Sprint 5, Sprint 6]`) определяет,
к какому модулю относится задача по её спринту.

Снимок доски собирает отдельный job `board` в workflow Pages: на каждый запуск на `main` и по
расписанию раз в час (`7 3-20 * * *`, UTC). Токен `ADD_TO_PROJECT_PAT` получает только этот job,
который выполняет код из `main`; сборка веток токена не видит и берёт готовый снимок. Если job
упал или пропущен, сайт всё равно собирается и публикуется, только без прогресса.

Ссылки на задачи из репозиториев организации доски выглядят как `репо#N`, из чужих организаций —
`владелец/репо#N`. `sync` читает значения поля «Трек» и заменяет весь список целиком: значение,
добавленное руками в интерфейсе доски за ту секунду между чтением и записью, пропадёт вместе с
выбором на карточках, поэтому новые треки добавляйте файлами, а не в интерфейсе доски.

Локально снимок получают так:

```sh
GH_TOKEN="$(gh auth token)" ./node_modules/.bin/module-graph board snapshot site/modules/board.json
```

Файл `site/modules/board.json` в git не попадает.

### Превью веток

Push в любую ветку публикует её сайт и схемы по адресу
`https://docs.cellestial.ru/branches/<slug>/`, где slug это имя
ветки, в котором всё, кроме латиницы, цифр, `.`, `_` и `-`, заменено на
`-`: `feature/new-vps` становится `feature-new-vps`. Список всех превью:
**https://docs.cellestial.ru/branches/**
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
