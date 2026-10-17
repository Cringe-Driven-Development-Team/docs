# Документация публикации фронтовых библиотек — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Развернуть трек front-libs: сравнить npm token и Trusted Publishing, объяснить каскадный релиз и актуализировать описание frontend#18.

**Architecture:** Одна существующая страница VitePress и три Eraser-схемы плана модуля №2. Сначала публикуемое объяснение авторизации, затем цикл релиза и интеграций, затем согласованная с ним редакция issue; задачи последовательные, потому что используют одну страницу и её решения.

**Tech Stack:** Markdown/YAML, VitePress, eraser-diagrams JSON, Bun, Node/Chrome, GitHub CLI.

**Spec:** `docs/superpowers/specs/2026-10-17-front-libs-publishing-design.md` — обязательная основа вместе с этим планом.

## Global Constraints

- «Сохраняем существующий адрес и одну страницу.» URL: `/modules/2/tracks/front-libs`; весь существующий frontmatter остаётся без изменений.
- «Раздел описывает план внедрения для CDD.» Работающий пример TP-Prepare обозначается отдельно.
- «Обновляется только описание задачи; статус, спринт, исполнитель, название и связи задач сохраняются.» Цель: `Cringe-Driven-Development-Team/frontend#18`.
- «Схемы плана не добавляются в корневую страницу «Архитектура» и `ROOT_NAMES`.» Папка `modules/2` уже в `HIDDEN_FOLDERS`.
- «Bun остаётся инструментом установки, тулинга, тестов и сборки.» Для OIDC-публикации документируем npm CLI от `11.5.1` и Node.js от `22.14.0`, GitHub-hosted runner.
- Trusted Publisher каждого пакета: owner `Cringe-Driven-Development-Team`, repository `frontend-packages`, workflow filename `release.yml`, environment только при использовании; разрешить `npm publish`.
- Стартовые версии: React `1.2.0`, Zustand `1.0.0`, OpenAPI `0.2.0`; целевые имена `@cdd-team/react`, `@cdd-team/zustand`, `@cdd-team/openapi`.
- «Публикуемые диапазоны — semver»; `node-workspace` с `updatePeerDependencies: true`; optional peer React и экспорт `./vanilla` сохраняются.
- «Дополнительные тесты, повторяющие статические фразы страницы, не нужны.» Используем существующие проверки, осмотр артефактов и предметную сверку сценариев ниже.
- Реальные секреты, IP и внутренние адреса не добавляются. Код библиотек, npm-настройки, версии пакетов, доска, участники и скиллы вне объёма.
- Исполнение по `AGENTS.md`: SDD в существующем worktree `.claude/worktrees/front-libs-publishing`, ветка `docs/front-libs-publishing`. Коммиты по-русски, PR в `main`.
- Перед каждым коммитом: `bun run modules:check`, `bun run typecheck`, `bun run test`, `bun run build`. Сгенерированные `dist/`, `.eraser/`, снимки доски и временные файлы не коммитятся.

## Review Focus

1. Новый пакет ещё не зарегистрирован: читатель должен отделить разовый bootstrap от автоматического выпуска; ручной сценарий Task 2 проверяет первый и второй релизы.
2. React обновился, исходники Zustand не менялись: читатель должен увидеть зависимый patch и изменение peer, но не обещание runtime-совместимости; матрица Task 2 проверяет также независимый OpenAPI.
3. Workflow не совпадает с доверенным или npm видит постоянный секрет: Task 1 проверяет точные настройки OIDC, отсутствие npm-секрета в новом фрагменте и отдельную роль GitHub-авторизации.
4. Vue интерпретирует YAML или схема непонятна на экране: Task 1/2 проверяют собранные HTML/PNG, буквальное отображение шаблонов, ссылки и все три встраивания.
5. Issue изменили параллельно или правка затронула доску: Task 3 сравнивает свежий снимок, итоговое описание и неизменные метаданные до/после записи.

---

## Карта файлов и границы задач

| Ответственность | Создать | Изменить |
| --- | --- | --- |
| Task 1: token/OIDC | `diagrams/modules/2/front-libs-npm-token.json`, `diagrams/modules/2/front-libs-trusted-publishing.json` | `site/modules/2/tracks/front-libs.md` после существующего frontmatter, `README.md` таблица «Модуль №2» |
| Task 2: релиз/проверки/bootstrap | `diagrams/modules/2/front-libs-release.json` | Та же страница после сравнения, та же таблица README |
| Task 3: ТЗ | Временные `$env:TEMP/front-libs-issue18-before.json`, `front-libs-issue18-body.md`, `front-libs-issue18-after.json` | Только body GitHub issue `Cringe-Driven-Development-Team/frontend#18` |
| Передача | Нет новых продуктовых файлов | Галочки выполнения в этом плане; PR, CI и превью |

Тестовые/инфраструктурные файлы не меняются. При обнаружении настоящего дефекта проверок сначала установить причину и отдельно определить необходимую правку; не ослаблять проверки под материал.

## Подготовка окружения исполнителя

- [x] Прочитать spec, этот план, `AGENTS.md`, `.agents/skills/docs-site/SKILL.md`, `docs-modules/SKILL.md`, `eraser-diagrams/SKILL.md`. Перед Task 3 прочитать актуальный `cdd-tasks` из `Cringe-Driven-Development-Team/agent-plugins`: `plugins/cdd-tasks/skills/cdd-tasks/SKILL.md`, и организационный `CONTRIBUTING.md`.
- [x] Проверить `git status --short` и `git branch --show-current`: учесть чужие изменения, работать в указанной ветке без пересоздания worktree. Зависимости уже установлены.
- [x] Для этой Windows-среды использовать Git Bash для shell-тестов и нативную сборку, поскольку Docker daemon не запущен:

```powershell
$env:PATH = 'C:\Program Files\Git\bin;' + $env:PATH
$env:DIAGRAMS_NATIVE = '1'
$env:CHROMIUM_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:PUPPETEER_EXECUTABLE_PATH = $env:CHROMIUM_PATH
```

Проверка на этапе плана: 239 тестов и 17 схем; числа справочные, не новые assertions. Сборка и проверка ссылок прошли. Markdown в worktree уже имеет LF. При проблемах окончаний строк сравнить содержимое с HEAD, не менять глобальный Git config и не откатывать чужую работу.

### Task 1: Сравнение авторизации и две схемы

**Files:** четыре пути Task 1 из карты.

**Interfaces:**
- Consumes: spec «Что переносим и зачем», «Сравнение способов публикации», схемы 1–2; текущий frontmatter; `icons.txt`, `scripts/colors.ts`.
- Produces: разделы `## Что переносим и зачем`, `## Два способа публикации`, `### Публикация с npm-токеном`, `### Trusted Publishing через OIDC`, `### Сравнение`.
- Produces: `<Diagram name="modules/2/front-libs-npm-token" />` и `<Diagram name="modules/2/front-libs-trusted-publishing" />`; JSON/HTML/PNG с этими basename, две строки README.

- [x] **Step 1: Сверить источники и термины.** Проверить закреплённые в spec package.json трёх библиотек и [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/), [npm access tokens](https://docs.npmjs.com/about-access-tokens/). Если факты изменились после spec, явно отметить дату и уточнение, не выдумывать состояние CDD. Утверждения о коде — ссылка на конкретные SHA и строки из spec.
- [x] **Step 2: Написать вводную и сравнение.** Таблица текущих и целевых имён; общий workspace и две разные роли release-please/авторизации. Старый способ представить как подход, а не установленный старый CI команды. Цепочка `NPM_TOKEN` в GitHub Secrets → env `NODE_AUTH_TOKEN` → npm CLI; текущие granular tokens вместо совета создавать classic tokens. Новый способ: job → GitHub OIDC identity → npm-проверка repo/workflow → краткоживущие права → npm publish.
- [x] **Step 3: Добавить компактные YAML-фрагменты job.** В обоих публикация через npm CLI; в старом показать передачу Secrets в `NODE_AUTH_TOKEN` и настройку npm registry authentication, которая читает эту переменную: одного env недостаточно. Пример строки `.npmrc` — `//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}` в fenced code без настоящего секрета. Для OIDC указать `runs-on: ubuntu-latest`, `contents: read`, `id-token: write`, `npm publish --access public` и контекст рабочего каталога выпущенного пакета. Показать только существенную часть job; предварительную установку/сборку на Bun и версии Node/npm объяснить рядом, не выдавать фрагмент за полный workflow. В новом фрагменте нет `NPM_TOKEN`/`NODE_AUTH_TOKEN`; GitHub-права release-please описаны отдельно. Все шаблоны GitHub Actions — внутри fenced YAML.
- [x] **Step 4: Создать две Eraser-схемы и встроить их.** Первая: `client` владельца/рабочее место white, GitHub purple с Secrets и job, npm green с созданием токена и registry. Вторая: GitHub purple с job/OIDC, npm green с Trusted Publisher, краткоживущими правами и публикацией. Связи и короткие подписи строго передают цепочки Step 2. Поля, цвета, сетка 20, одна Legend справа шириной 340 — по skill; имена иконок сначала подтвердить через `rg` в `icons.txt`. Добавить две строки README со ссылками `https://docs.cellestial.ru/modules/2/<basename>.html`.
- [x] **Step 5: Проверить артефакты.** По порядку `bun run validate`, `bun run check`, `bun run warm`, `bun run render`. Ожидается отсутствие ошибок, оба HTML и PNG в `dist/modules/2/`. Открыть оба PNG инструментом просмотра: нет наложений, обрезки, неверной зоны и перекрытой легенды. После исправлений повторить цикл.
- [x] **Step 6: Выполнить предметную проверку авторизации (Review Focus 3).** Проследить в тексте и каждой схеме, кто выпускает identity и кто даёт npm-права. На новом фрагменте проверить точные owner/repo/filename, per-package настройку, Allow npm publish и отсутствие постоянного npm-секрета; объяснение должно показывать, почему другой workflow не получает право. Таблица содержит источник полномочий, хранение, срок, отзыв/обслуживание, настройку пакета/workflow и ограничения runner/CLI. OIDC не обещает проверку совместимости кода.
- [x] **Step 7: Проверить сайт и закоммитить.** Запустить обязательные четыре проверки из Global Constraints; ожидается exit 0. В `dist/modules/2/tracks/front-libs.html` проверить буквальное отображение YAML, таблицу, две схемы; `site:check` внутри build проверяет реальные ссылки/iframe. `git diff --check`, затем добавить только четыре пути Task 1 и commit `docs(front-libs): сравнены npm token и trusted publishing`.

### Task 2: Цикл релиза, совместимость и первоначальная публикация

**Files:** три пути Task 2 из карты.

**Interfaces:**
- Consumes: страница, схема авторизации и имена из Task 1; spec «Цикл релиза и независимые версии», «Проверка совместимости», «Первоначальная настройка и проверка результата», схема 3.
- Produces: разделы `## Как проходит релиз`, `## Что проверяет CI`, `## Первоначальная настройка`, `## Как проверить результат и восстановить выпуск`, `## Работающий пример и источники`.
- Produces: `<Diagram name="modules/2/front-libs-release" />`, JSON и третья строка README; один законченный трек без подстраниц.

- [x] **Step 1: Сверить пример и возможности release-please.** Прочитать TP-Prepare PR #19 и workflow из spec, конфиг/публикационный скрипт на SHA `00e8548745e6f04933f798a73f9c395c1eb4febd`; сверить `node-workspace` в официальном manifest-releaser.md. Ссылки на реализацию закрепить SHA/строками, не переносить пример как описание уже работающего CDD.
- [x] **Step 2: Написать цикл релиза.** Feature PR/CI → merge main → release-please/release PR → проверки и merge release PR → теги/GitHub Releases → сборка и публикация только `paths_released`, React прежде Zustand. Явно отделить GitHub Release от успешного npm publish. Независимые версии, один release PR, распределение изменений по путям, scope сам по себе пакет не выбирает; показать минимальный fenced JSON `node-workspace` с `updatePeerDependencies: true`.
- [x] **Step 3: Объяснить проверку интеграции.** Обычная dependency TP-примера и optional peer CDD — разные связи. В CDD сохранить локальную dev-связь, optional peer и vanilla; публикуемые диапазоны semver. CI: сборка, типы, runtime React/Zustand и установка tarball в чистый проект выполняются до публикации. Сборка не доказывает работу хуков; изменение peer не гарантирует breaking-совместимость; тесты потребителя сохраняются.
- [x] **Step 4: Описать bootstrap и восстановление.** Права npm-организации, repository metadata, новые имена, стартовые версии, разовая регистрация через ручную публичную публикацию и исходные GitHub Release-теги, согласованные с будущим manifest/config. Затем Trusted Publisher каждого пакета и следующий автоматический релиз. Bun для установки/проверок/сборки, совместимый Node/npm CLI для OIDC. Дать команды `npm view @cdd-team/<package> version` с конкретными тремя именами и сценарий установки React/Zustand в отдельный проект. При частичном выпуске сверить реальные версии, не публиковать повторно существующую name/version и завершить отсутствующую публикацию; учесть задержку npm-метаданных.
- [x] **Step 5: Создать третью схему и встроить.** GitHub purple: PR/CI с проверкой связки, release-please, общий release PR с независимыми версиями, GitHub Releases и publish job. npm green: React → Zustand; нейтральный потребитель после публикации. OpenAPI обозначить неизменившимся, без публикации в данном сценарии. При падении CI переход к выпуску отсутствует. Добавить README-строку, выполнить validate → check → warm → render, открыть PNG `dist/modules/2/front-libs-release.png` и исправить читаемость.
- [x] **Step 6: Пройти матрицу сценариев (Review Focus 1–2).** Сверить текст, таблицу и схему с ожидаемыми результатами ниже. Это предметная проверка материала, не запуск новых релизов/публикаций:

| Условие | Ожидаемое объяснение |
| --- | --- |
| Новый scope/имена | Разовый bootstrap 1.2.0 / 1.0.0 / 0.2.0 и исходные теги; следующий выпуск через workflow |
| Только fix React | React 1.2.0 → 1.2.1; Zustand 1.0.0 → 1.0.1, peer ^1.2.1 и CHANGELOG; OpenAPI 0.2.0 прежний |
| Только fix Zustand | Выпускается только Zustand; React/OpenAPI не получают релиз |
| Только docs/test без breaking и без накопленных релизных изменений | Новый release PR не создаётся |
| Несовместимый runtime при успешной сборке | Его ловит соответствующий интеграционный тест; каскад версий не доказывает совместимость |
| React опубликован, Zustand нет | Проверить npm, восстановить только отсутствующий выпуск; существующую версию не перезаписывать |

- [x] **Step 7: Проверить полную страницу (Review Focus 4).** Обязательные четыре проверки; `dist/modules/2/tracks/front-libs.html` содержит все разделы и три корректных iframe, новые якоря сверяются с реально сгенерированными id. Открыть страницу из локального HTTP-сервера в браузере/через доступный browser-tool; при отсутствии browser-tool проверить скриншотом headless Chrome. Нет пропавшего YAML/Vue-текста, обрезанных схем, ссылок вне base; root-архитектура не получила схемы плана. Сравнить frontmatter с HEAD до Task 1 — идентичен.
- [x] **Step 8: Закоммитить.** `git diff --check`; добавить только три пути Task 2, commit `docs(front-libs): описаны каскадный релиз и первоначальная публикация`.

### Task 3: Актуализация body frontend#18

**Files:** только внешнее issue и три временных файла из карты; новых tracked-файлов не требуется.

**Interfaces:**
- Consumes: окончательная страница Task 2, spec «Актуализация issue frontend#18», свежие body/метаданные issue.
- Produces: обновлённое ТЗ с заголовками «Цель», «Что сделать», «Приёмка», «Зависимости», «Не входит»; title, state, assignees, labels и projectItems сохраняются.

- [x] **Step 1: Снять свежую исходную версию.** `gh issue view 18 --repo Cringe-Driven-Development-Team/frontend --json title,body,state,assignees,labels,projectItems,updatedAt,url`; сохранить UTF-8 JSON в before-файл. Прочитать заново, не использовать только старую копию из spec.
- [x] **Step 2: Подготовить точную редакцию в body-файле.** Сохранить авторскую историю, playground React, общие конфиги/scripts/CI, переименование, независимые версии/CHANGELOG/теги, merge-коммиты и границы потребителя/playgrounds/будущих пакетов. Исправить OpenAPI: исходный `@iredtea/openapi`, `0.2.0`; добавить старое имя к отложенному deprecate. Разнести существующие требования и следующие дополнения по чекбоксам «Что сделать»:
  - `node-workspace`/`updatePeerDependencies: true`, optional peer/vanilla, локальная dev-связь и публикуемый semver;
  - runtime-интеграция React/Zustand и установка собранных архивов в чистый проект в CI;
  - GitHub OIDC без постоянного npm-секрета, точные настройки из Global Constraints;
  - документированные baseline/bootstrap/теги, затем автоматические релизы;
  - только `paths_released`, последовательный порядок зависимостей, остановка при ошибке и восстановление частичного выпуска;
  - README с ролями Bun/npm/release-please и ссылкой `https://docs.cellestial.ru/modules/2/tracks/front-libs`.
- [x] **Step 3: Дополнить приёмку и зависимости.** Сценарии Task 2, зелёные проверки/интеграция/архивы, порядок и OIDC в workflow, `npm view` и чистая установка. Сценарий docs/test уточнить отсутствием breaking и накопленных изменений. Репозиторий уже создан; npm-права и per-package доверие — оставшиеся предпосылки. Разовый ручной bootstrap допустим, автоматическую публикацию проверять на следующем выпуске.
- [x] **Step 4: Сверить готовую редакцию со spec и свежим issue (Review Focus 5).** Прочитать body-файл целиком, проверить сохранение всех требований и ссылок оригинала. Повторно запросить `updatedAt`/body; если отличаются от before, учесть чужую редакцию и пересобрать before/body. Убедиться, что body описывает реализацию библиотек, а не только эту документационную работу. Дополнительное согласие на уже порученное изменение body не требуется.
- [x] **Step 5: Применить редакцию.** `gh issue edit 18 --repo Cringe-Driven-Development-Team/frontend --body-file "$env:TEMP/front-libs-issue18-body.md"`. Не использовать строковую сборку shell-команды, не добавлять комментарии и не править проект/назначения.
- [x] **Step 6: Проверить readback.** Повторить Step 1 в after-файл. Сравнить body с подготовленным текстом с нормализацией только окончаний строк, а title/state/assignees/labels/projectItems — с before. Ожидается полное совпадение body и неизменность метаданных. При постороннем изменении выяснить причину; не откатывать чужую правку автоматически. Отдельный Git-коммит для внешней операции не нужен.

## Завершение ветки

- [x] Отметить выполненные шаги плана; проверить `git diff --check`, финальный diff к `origin/main` и отсутствие временных/сгенерированных файлов. Запустить обязательные проверки перед коммитом обновлённого плана.
- [x] Выполнить целостное независимое ревью ветки по spec через `superpowers:requesting-code-review` в рамках SDD. Проверить разделение плана CDD/примера TP, фактологию, три картинки, сохранение frontmatter и границ #18. Исправления проверять по затронутой области; после новых изменений повторить обязательные проверки перед их коммитом.
- [ ] Push ветки и PR выполнять при наличии актуального поручения пользователя; подготовка страницы и правка body #18 уже поручены. Описание PR: «Что», «Решения», «Проверка», `Part of Cringe-Driven-Development-Team/frontend#18` и превью `https://docs.cellestial.ru/branches/docs-front-libs-publishing/modules/2/tracks/front-libs`. Не закрывать issue реализации.
- [ ] Если ветка отправлена, проверить CI и запуск Pages на main, затем превью трека и обе схемы авторизации/схему релиза. Если Pages сообщает time budget, указать это отдельно от успешной локальной сборки, не заявлять непроверенное превью готовым.

## Самопроверка плана

Покрытие spec: содержание/сравнение и схемы 1–2 → Task 1; независимые версии, совместимость, bootstrap, восстановление и схема 3 → Task 2; все поправки body → Task 3; проверки/PR/границы → Global Constraints и завершение. Интерфейсы схем совпадают с встраиваниями и README. Пять Review Focus имеют проверки в Step 6 Task 1, Step 6–7 Task 2 и Step 4/6 Task 3. Новые статические тесты и изменения продуктового кода не запланированы.
## Результат выполнения

Задачи 1–3 выполнены: страница и три схемы готовы, body frontend#18 обновлено с точным readback и сохранением полных метаданных проекта. Все три ревью задач одобрены; итоговое независимое ревью ветки — Ready to merge: Yes, без блокеров и новых замечаний.

Локально прошли 239 тестов, проверка типов и модулей, нативная сборка 20 схем и проверка ссылок сайта. PNG и собранная страница проверены в Chrome. Сохраняется известное предупреждение о размере Rollup chunk; продуктовых изменений сборки в этой работе нет. Публикация ветки, удалённый CI и превью относятся к оставшемуся завершению ветки.
