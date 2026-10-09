# Быстрая проверка треков: `modules:check`, хук агента, pre-commit, CI

## 1. Цель

Ошибка в данных трека (`site/modules/**`) видна за секунду, а не после полной сборки на минуты: агенту —
сразу после правки файла, человеку — при коммите, в PR — до Docker-сборки. Проверка та же, что делает
сборка, второй реализации нет.

Готово, когда:

- `bun run modules:check` проверяет все модули и печатает `modules ok: <N> модул…, <M> треков` или ошибку
  сборки и код выхода 1;
- агент в Claude Code после правки файла в `site/modules/` получает ошибку в ответ на правку;
- `git commit` с файлами из `site/modules/` не проходит при ошибке в треках;
- в CI на PR проверка — отдельный шаг до Docker-сборки.

## 2. Проверенные факты

`main`, коммит `ba59f64`.

- `readModules(modulesDir)` (`site/.vitepress/modules-read.ts`) читает и проверяет все модули; ошибки —
  `ModuleDataError` с текстом `<файл от site/>: <поле> — <что не так>`. На 35 треках — 91 мс, с запуском
  bun — около 0,4 с.
- Git-хуков в репозитории нет; `.claude/` содержит только `skills/`, `settings.json` нет.
- CI (`.github/workflows/ci.yml`) на PR: сборка Docker-образа, затем в контейнере
  `bun install --frozen-lockfile && bun run typecheck && bun run test && bun run build`.
- В Docker-образе есть git (`Dockerfile:8-12`); `pages.yml:45` делает `bun install` на раннере.
- bun не запускает `postinstall` зависимостей без `trustedDependencies`, а скрипт `prepare` корневого
  `package.json` запускает.
- lefthook в npm: `2.1.14` (14.09.2026) — последняя версия старше двух недель.
- Хук Claude Code `PostToolUse` получает JSON на stdin (`tool_input.file_path`); код выхода 2 отдаёт stderr
  агенту как ответ на действие.

## 3. Решения

- Скрипт `scripts/modules-check.ts`, без своей логики проверки: вызывает `readModules`.
- Режим `--hook` для Claude Code: читает stdin, берёт `tool_input.file_path`; если путь не содержит
  `/site/modules/` — выход 0 молча. Иначе проверяет каталог `…/site/modules` из этого же пути (так работает
  и в worktree), при ошибке — текст в stderr и код 2, при успехе — молча 0.
- `.claude/settings.json` в репозитории: `PostToolUse`, matcher `Edit|Write|MultiEdit`, команда
  `bun "$CLAUDE_PROJECT_DIR/scripts/modules-check.ts" --hook`.
- pre-commit — lefthook `2.1.14` (точная версия в `devDependencies`), `lefthook.yml`: команда
  `bun run modules:check` при `glob: "site/modules/**"`. Установка хуков — `"prepare": "lefthook install"`.
- CI: в `ci.yml` до сборки образа — `oven-sh/setup-bun`, `bun install --frozen-lockfile`,
  `bun run modules:check`.
- CLAUDE.md, раздел «Сборка»: «Треки (`site/modules/**`) проверяет `bun run modules:check` — за секунду;
  у агента — хук после правки».

## 4. Проверка

- Тесты `scripts/modules-check.test.ts` на временном каталоге модулей: успех — строка `modules ok` и код 0;
  сломанный трек — текст ошибки и код 1; `--hook` с путём вне `site/modules` — код 0 без вывода; с путём к
  сломанному треку — код 2 и ошибка в stderr; с путём к исправному — код 0 без вывода.
- `bun run typecheck && bun run test`.
- Вручную: правка трека с ошибкой — хук агента вернул ошибку; `git commit` такого трека остановлен
  lefthook; коммит без файлов `site/modules` — без проверки.
- CI на PR: шаг `modules:check` зелёный.

## 5. Не входит

- Команда `module-graph check` в пакете `@tp-prepare/vitepress-module-graph` — его спека; здесь её
  предшественник в репозитории документации.
- Проверка тестов и схем в pre-commit.
