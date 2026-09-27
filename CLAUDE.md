# CLAUDE.md

Документация сервиса Cringe-Driven-Development-Team: архитектурные схемы как код
(eraser-diagrams JSON → HTML и PNG → GitHub Pages). Обзор, команды и таблица схем — `README.md`.

## Схемы

- Правь схемы только по скиллу `.claude/skills/eraser-diagrams/SKILL.md`: формат, цвета, раскладка,
  цикл validate → check → render → осмотр PNG.
- Рабочие схемы MVP — в корне `diagrams/`. `diagrams/frozen-k3s/` заморожена, не правится.
- Схемы описывают целевое состояние. Факты бери из кода, не из памяти: инфраструктура — репозиторий
  `Cringe-Driven-Development-Team/infra` (`pulumi/`, bootstrap-стек `pulumi/bootstrap/`, `ansible/`).
  Каждую подпись и связь сверяй с исходником, связи не выдумывай.
- Новая схема — новая строка в таблице README.

## Сборка

- `bun run render`, `bun run build`, `bun run site` идут в Docker-образе из `Dockerfile`, как в CI:
  Docker Desktop должен быть запущен. Без Docker — `DIAGRAMS_NATIVE=1 bun run <скрипт>`.
- Перед коммитом: `bun run typecheck && bun run test && bun run build`.
- `bun run site` из git worktree в Docker не работает — запускай из основного клона.

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
