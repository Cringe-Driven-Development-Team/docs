# CLAUDE.md

Документация сервиса Cringe-Driven-Development-Team: архитектурные схемы как код
(eraser-diagrams JSON → HTML и PNG → GitHub Pages). Обзор, команды и таблица схем — `README.md`.

## Проект

Проект учебный, реальных пользователей нет. Защиты — около четырёх за семестр; между ними прод можно
ломать: переключать разом, без поэтапной миграции и совместимости со старыми клиентами. К защите прод
должен работать.

## Что где лежит

- Модули (`site/modules/`) — то, что ещё не сделано: план модуля, треки и проектные документы треков.
- Остальные разделы сайта и схемы корня — как работает прод сейчас; утверждения о коде — со ссылкой на
  файл и строку на конкретном SHA.
- Трек сделан — его страницы не правятся: это история «что планировали». Сверху плашка
  `::: info` «Сделано. Как работает сейчас — [раздел]», а прод описывается или переписывается в разделе
  вне модулей.

## Схемы

- Правь схемы только по скиллу `.claude/skills/eraser-diagrams/SKILL.md`: формат, цвета, раскладка,
  цикл validate → check → render → осмотр PNG.
- Рабочие схемы MVP — в корне `diagrams/`. `diagrams/bff/` и `diagrams/frozen-k3s/` заморожены, не правятся.
- Схемы корня описывают прод. Факты бери из кода, не из памяти: инфраструктура — репозиторий
  `Cringe-Driven-Development-Team/infra` (`pulumi/`, bootstrap-стек `pulumi/bootstrap/`, `ansible/`).
  Каждую подпись и связь сверяй с исходником, связи не выдумывай.
- Новая схема — новая строка в таблице README; схема корня — ещё имя в `ROOT_NAMES`
  (`site/.vitepress/diagram-names.ts`) и раздел с `<Diagram>` на `site/architecture/index.md`
  (тесты `scripts/build-index.test.ts`, `scripts/architecture-page.test.ts`).

## Сборка

- `bun run render`, `bun run build`, `bun run site` идут в Docker-образе из `Dockerfile`, как в CI:
  Docker Desktop должен быть запущен. Без Docker — `DIAGRAMS_NATIVE=1 bun run <скрипт>`.
- Перед коммитом: `bun run typecheck && bun run test && bun run build`.
- Треки (`site/modules/**`) проверяет `bun run modules:check` — за секунду; у агента — хук после правки (`bun node_modules/@tp-prepare/vitepress-module-graph/dist/cli.mjs check --hook`; без установленного пакета молчит).
- `bun run site` из git worktree в Docker не работает — запускай из основного клона.
- Сайт — VitePress в `site/` (главная `/docs/`), схемы — страница `/docs/architecture/`. Новая страница — файл в
  `site/` и пункт `sidebar` в `site/.vitepress/config.mts`; утверждения о коде — со ссылкой на файл и строку
  на конкретном SHA.
- Модули — `site/modules/`: люди в `people.yaml`, настройки графа в `module-graph.yaml`, модуль — каталог с номером (`2`), трек — `tracks/<id>.md`; формат и
  проверки — [README пакета](https://github.com/TP-Prepare/frontend-packages/blob/main/packages/vitepress-module-graph/README.md) и `docs/superpowers/specs/2026-10-09-vitepress-module-graph-design.md` §4. Подстраницы трека —
  `tracks/<id>/<page>.md` и список `pages` во frontmatter трека
  (`docs/superpowers/specs/2026-10-08-bff-into-module-design.md` §5). Меню модулей строится само.

## Процесс

- Спеки — `docs/superpowers/specs/YYYY-MM-DD-<тема>-design.md`, планы —
  `docs/superpowers/plans/YYYY-MM-DD-<тема>.md`, по-русски; в спеке раздел «Проверенные факты».
- Работа в отдельной ветке и git worktree в `.claude/worktrees/<имя>` (игнорируется git).
  PR в `main`, в PR — ссылка на превью ветки.
- Коммиты по-русски: `тип(область): что сделано`, типы `feat`, `fix`, `docs`, `ci`, `chore`.
  Описание PR — разделы «Что», «Решения», «Проверка».
- С плагином superpowers новая фича или схема идёт так: brainstorming → спека → план → SDD.

## Публичный репозиторий

Никаких реальных IP, CIDR, токенов и внутренних адресов — ни в схемах, ни в документах.

## Окружение: Windows

- Bash-инструмент — Git Bash. MSYS переписывает пути в аргументах: `docker run -v …` из шелла
  запускай с `MSYS_NO_PATHCONV=1`. `scripts/docker.ts` передаёт аргументы Docker напрямую, ему не нужно.
- Рендерер eraser-diagrams работает только под Node (под bun Chrome зависает) — скрипты это учитывают.
- `LF will be replaced by CRLF` при коммите — норма для этой машины.
