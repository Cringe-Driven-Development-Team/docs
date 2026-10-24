# AGENTS.md

Документация сервиса Cringe-Driven-Development-Team: архитектурные схемы как код
(eraser-diagrams JSON → HTML и PNG → GitHub Pages). Обзор, команды и таблица схем — `README.md`.
Где искать актуальный общепроектный контекст и владельцев сведений — [страница «Контекст проекта»](https://docs.cellestial.ru/project-context).

## Проект

У проекта нет живых пользователей; преподаватели проверяют прод примерно раз в месяц.
Между проверками допустимы временная недоступность и несовместимость фронта и бэка
после выкладки одной стороны. Не добавляй по своей инициативе в задачи, планы,
приёмку или код поддержку старого API/клиента, legacy-режимы, поэтапное
переключение, безостановочный деплой и требования высокого uptime. Делай это
только по прямому требованию владельца для конкретной задачи.

Если фронт и бэк можно реализовать и проверить локально по согласованному
целевому контракту, работай над ними независимо. Временная поломка прода
между выкладками не создаёт связи `Blocked by`; проверь интеграцию после обеих
задач. К преподавательской проверке прод должен работать.

## Что где лежит

- Модули (`site/modules/`) — то, что ещё не сделано: план модуля, треки и проектные документы треков.
- Остальные разделы сайта и схемы корня — как работает прод сейчас; утверждения о коде — со ссылкой на
  файл и строку на конкретном SHA.
- Трек сделан — его страницы не правятся: это история «что планировали». Сверху плашка
  `::: info` «Сделано. Как работает сейчас — [раздел]», а прод описывается или переписывается в разделе
  вне модулей.

## Схемы

- Правь схемы только по скиллу `.agents/skills/eraser-diagrams/SKILL.md`: формат, цвета, раскладка,
  цикл validate → check → render → осмотр PNG.
- Рабочие схемы MVP — в корне `diagrams/`. `diagrams/frozen-k3s/` заморожена, не правится.
- Схемы плана модуля — в `diagrams/modules/<N>/`, папка в `HIDDEN_FOLDERS` (`site/.vitepress/diagram-names.ts`),
  на страницу модуля — `<Diagram name="modules/<N>/<имя>" />`.
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
- Треки (`site/modules/**`) проверяет `bun run modules:check` (`module-graph check`) — за секунду.
  В Claude Code хук запускает `check --hook` после правки файла модуля. В Codex хук
  `.codex/hooks.json` проверяет все модули после `apply_patch` и shell-команд; запуск и доверие —
  [README](./README.md#работа-в-codex). Оба хука молчат при успехе и без установленного пакета.
  Pre-commit `lefthook` проверяет модули при коммите. Перед коммитом прогони `bun run modules:check` сам.
- `bun run site` из git worktree в Docker не работает — запускай из основного клона.
- Сайт — VitePress в `site/` (главная `/`), схемы — страница `/architecture/`. Новая страница — файл в
  `site/` и пункт `sidebar` в `site/.vitepress/config.mts`; утверждения о коде — со ссылкой на файл и строку
  на конкретном SHA.
- Модули — `site/modules/`: люди в `people.yaml`, настройки графа в `module-graph.yaml`, модуль — каталог с номером (`2`), трек — `tracks/<id>.md`; формат и
  проверки — [README пакета](https://github.com/TP-Prepare/frontend-packages/blob/main/packages/vitepress-module-graph/README.md) и `docs/superpowers/specs/2026-10-09-vitepress-module-graph-design.md` §4. Подстраницы трека —
  `tracks/<id>/<page>.md` и список `pages` во frontmatter трека
  (`docs/superpowers/specs/2026-10-08-bff-into-module-design.md` §5). Меню модулей строится само.

## Процесс

- Для задач этого репозитория спеки — `docs/superpowers/specs/YYYY-MM-DD-<тема>-design.md`,
  планы реализации — `docs/superpowers/plans/YYYY-MM-DD-<тема>.md`, по-русски;
  в спеке раздел «Проверенные факты». Спеки и планы задач других репозиториев
  размещай в соответствующих репозиториях рядом с работой.
- Работа в отдельной ветке и git worktree в `.claude/worktrees/<имя>` (игнорируется git).
  PR в `main`, в PR — ссылка на превью ветки.
- Коммиты по-русски: `тип(область): что сделано`, типы `feat`, `fix`, `docs`, `ci`, `chore`.
  Описание PR — разделы «Что», «Решения», «Проверка».
- С плагином superpowers новая фича или схема идёт так: brainstorming → спека → план → SDD.

## Скиллы

- Скиллы лежат в `.agents/skills/` (их читает Codex и другие агенты); `.claude/skills/` — побайтовая копия для
  Claude Code.
- Правка скилла — только в `.agents/skills/<имя>/`, затем `bun run skills:sync`; `bun run test` падает, если
  копия разошлась.
- Где держать скилл — в репозитории, в маркетплейсе `agent-plugins` или у себя: `docs/skills-placement.md`.
- `eraser-diagrams` — править схемы в `diagrams/`: формат, цвета, раскладка, цикл validate → check → render.
- `docs-modules` — править данные модулей и треков в `site/modules/` (подзадачи, задачи, подтреки, связи,
  ошибки `module-graph check`).
- `docs-site` — править страницы сайта VitePress в `site/`: новые страницы и подстраницы трека, схемы на
  странице, переезды, PR и превью.

## Публичный репозиторий

Никаких реальных IP, CIDR, токенов и внутренних адресов — ни в схемах, ни в документах.

## Окружение: Windows

- Bash-инструмент — Git Bash. MSYS переписывает пути в аргументах: `docker run -v …` из шелла
  запускай с `MSYS_NO_PATHCONV=1`. `scripts/docker.ts` передаёт аргументы Docker напрямую, ему не нужно.
- Рендерер eraser-diagrams работает только под Node (под bun Chrome зависает) — скрипты это учитывают.
- `LF will be replaced by CRLF` при коммите — норма для этой машины.

## Правила проекта для OpenWiki

Wiki — производное представление документации; канонический текст остаётся в `docs`.
Исправления начинают с исходника. Перед использованием wiki проверь свежесть клона
и выполни `bun run wiki:check --against <SHA>` с актуальным SHA `docs/main`.
Устаревшую wiki используй только как указатель путей: каждое нужное утверждение сверь
с каноническим документом на актуальном SHA, а факты о реализации — с кодом компонента.
Если wiki недоступна или путь исчез, ищи напрямую в `docs`. Модули и старые планы
остаются планами, пока реализация не проверена по коду.

Обновление wiki запускается только по явной локальной команде владельца.
CI только проверяет wiki PR; таймеров и автоматической генерации нет.
Предложение о scheduled workflow в управляемом блоке ниже здесь не применяется.
Блок сохранён в формате OpenWiki 0.7.2, чтобы генератор не менял исходные инструкции.
Изменение `AGENTS.md` или `CLAUDE.md` при генерации считается ошибкой запуска:
эти файлы меняют отдельно как исходники, затем обновляют wiki.

<!-- OPENWIKI:START -->

## OpenWiki

This repository has a generated `openwiki/` evidence index. It is optional just-in-time context, not required startup reading.

- Do not enumerate, preload, or search wikis at task start. Use retrieval when the user asks for it, when unfamiliar architecture or dependency behavior materially affects the task, or when source inspection leaves an important uncertainty. Stop once the question is grounded.
- When those conditions apply and OpenWiki retrieval tools are available, use `openwiki_search` for just-in-time context and `openwiki_read` for the relevant complete sections. If search returns `workspace_required`, ask which listed workspace to use and retry with its ID.
- Use `openwiki_list_workspaces` or `openwiki_list_wikis` when workspace membership itself needs to be discovered.
- If the retrieval tools are unavailable, read `openwiki/quickstart.md` and follow its links to the relevant pages.
- Treat source code and tests as authoritative. A brief's unknowns and review items are verification gaps, not automatic requirements.
- Prefer the narrowest quiet validation that proves the changed behavior. Preserve complete failure output.

The scheduled OpenWiki GitHub Actions workflow refreshes the repository wiki. Do not hand-edit generated OpenWiki pages unless explicitly asked; prefer updating source code/docs and letting OpenWiki regenerate.

<!-- OPENWIKI:END -->
