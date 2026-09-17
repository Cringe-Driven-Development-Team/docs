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

Архитектур две. **MVP на Docker Compose** это рабочая, с ней идёт вся
текущая работа. **Frozen: k3s** заморожена в `diagrams/frozen-k3s/`, её
схемы не правятся; дизайн в
`docs/superpowers/specs/2026-09-15-frontend-monorepo-design.md`.

MVP (`diagrams/`):

| Схема | Что показывает |
| --- | --- |
| [deployment](https://cringe-driven-development-team.github.io/docs/deployment.html) | Два VPS в Selectel с Docker Compose, S3/CDN, клиент |
| [ci](https://cringe-driven-development-team.github.io/docs/ci.html) | GitHub-репозитории, CI-пайплайны, GHCR, S3 |
| [cd](https://cringe-driven-development-team.github.io/docs/cd.html) | CD и откат через ansible-playbook из GitHub Actions |
| [frontend-monorepo](https://cringe-driven-development-team.github.io/docs/frontend-monorepo.html) | Монорепа клиента и BFF, контракт tRPC, модель релизов |

Frozen: k3s (`diagrams/frozen-k3s/`):

| Схема | Что показывает |
| --- | --- |
| [deployment](https://cringe-driven-development-team.github.io/docs/frozen-k3s/deployment.html) | VPS в Selectel, k3s, S3/CDN, клиент |
| [ci](https://cringe-driven-development-team.github.io/docs/frozen-k3s/ci.html) | GitHub-репозитории, CI-пайплайны и их цели |
| [cd](https://cringe-driven-development-team.github.io/docs/frozen-k3s/cd.html) | CD через Argo CD, канарейка, превью на Coolify |
| [integrations](https://cringe-driven-development-team.github.io/docs/frozen-k3s/integrations.html) | Внешние сервисы и кто с ними говорит |
| [frontend-monorepo](https://cringe-driven-development-team.github.io/docs/frozen-k3s/frontend-monorepo.html) | Монорепа клиента и BFF, Contract check, канарейка |

Таблицы ведутся вручную: добавил файл в `diagrams/`, добавь строку сюда.
`dist/index.html` собирается автоматически: схемы корня карточками, каждая
подпапка отдельной секцией. Схема из подпапки рендерится в
`dist/<папка>/<name>.html` и `.png`.

### Локально

Нужны bun ≥ 1.3, Node ≥ 22.12 и Google Chrome (или другой Chromium; путь в
переменной `CHROMIUM_PATH`). bun ставит зависимости и запускает скрипты и
тесты. Рендерер eraser-diagrams запускается под Node: под bun он зависает
на запуске Chrome.

bun ставится с https://bun.sh. Без настоящего Node в PATH `bun run render`
и `bun run build` останавливаются с ошибкой, а не зависают.

```bash
bun install
bun run validate   # схема, без браузера; имена иконок он не проверяет
bun run check      # цветовая конвенция и легенды, без браузера
bun run warm       # докачать иконки схем в .eraser/icons, неизвестное имя роняет
bun run render     # dist/<name>.html и .png, подпапки в dist/<папка>/
bun run build      # validate + check + warm + render + dist/index.html
bun run site       # build + превью всех веток origin в dist/branches/
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

CI на pull request валидирует и рендерит схемы, артефакт `diagrams`
содержит `dist/`. Push в `main` публикует `dist/` на Pages. В настройках
репозитория должно стоять Settings → Pages → Build and deployment → Source →
GitHub Actions, иначе job `deploy` падает с «Get Pages site failed»
(для этой репы уже включено).

### Превью веток

Push в любую ветку публикует её схемы по адресу
`https://cringe-driven-development-team.github.io/docs/branches/<slug>/`, где slug это имя
ветки, в котором всё, кроме латиницы, цифр, `.`, `_` и `-`, заменено на
`-`: `feature/new-vps` становится `feature-new-vps`. Список всех превью:
**https://cringe-driven-development-team.github.io/docs/branches/**
Точный адрес ищи в этом списке: при совпадении имён к slug добавляется
короткий SHA.

Push в ветку запускает workflow Pages на `main`. Тот собирает `main` и все
ветки их собственными скриптами (`bun run site`) и публикует единым
сайтом, поэтому превью появляется через несколько минут. После удаления
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

Дизайн: `docs/superpowers/specs/2026-09-12-eraser-diagrams-pipeline-design.md`,
`docs/superpowers/specs/2026-09-13-diagram-colors-and-bun-design.md`,
`docs/superpowers/specs/2026-09-13-branch-previews-design.md`,
`docs/superpowers/specs/2026-09-16-mvp-compose-design.md`.
