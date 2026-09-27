# Рендер схем в Docker: локально как в CI

Дата: 2026-09-27. Репозиторий: `Cringe-Driven-Development-Team/docs`, ветка `feature/docker-render`.
Статус: на ревью. После утверждения план пишется скиллом `writing-plans`.

## 1. Цель

Локальная сборка схем даёт те же `dist/*.png` и `dist/*.html`, что CI и Pages: ревьюер видит ровно
то, что опубликуется. Сейчас локальный рендер (Chrome на Windows) и CI (Chrome раннера на Linux)
меряют текст по-разному, и HTML расходится.

Критерий успеха: для одного коммита `dist/` локальной сборки и артефакт `diagrams` из CI совпадают
побайтно по `*.html` и попиксельно по `*.png`.

Не цель: одинаковый вид схемы в браузерах зрителей — это лечит запас ширины подписей
(`scripts/label-slack.ts`, PR #8), не Docker.

## 2. Проверенные факты

Проверено 2026-09-27.

- Рендерер `@eraserlabs/diagrams-cli` 0.1.0 запускает браузер через `playwright-core` 1.61.1
  (`bun.lock`), путь к нему — `--chromium-path`, иначе `$CHROMIUM_PATH`, иначе автопоиск.
- Образ `mcr.microsoft.com/playwright:v1.61.1-noble`
  (`sha256:5b8f294aff9041b7191c34a4bab3ac270157a28774d4b0660e9743297b697e48`, ~930 МБ):
  Ubuntu 24.04.4, Node 24.17.0, npm 11.13, git и curl есть, bun и unzip нет, пользователь root.
  Chromium: `/ms-playwright/chromium-1228/chrome-linux64/chrome`, Google Chrome for Testing
  149.0.7827.55. `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright`.
- CI (`ci.yml`) и Pages (`pages.yml`, job `build`): `ubuntu-latest`, `setup-bun` 1.3.13, `setup-node` 22,
  `CHROMIUM_PATH=/usr/bin/google-chrome` — Chrome раннера, обновляется вместе с образом раннера.
- `scripts/build-site.ts` собирает превью каждой ветки её же скриптами (`bun install`, `bun run build`)
  во временном каталоге, после `git fetch` из `origin`. Локальный `origin` — SSH
  (`git@github.com:…`), репозиторий публичный.
- Локально у владельца Docker Desktop на WSL2. Собирает схемы локально только он.

## 3. Решения

- Образ из `Dockerfile` в корне репозитория, без реестра: локально `docker build`, в CI сборка из
  того же файла с кэшем GitHub Actions.
- Локально `bun run render`, `bun run build`, `bun run site` всегда идут через Docker.
  `validate`, `check`, `warm`, `index`, `test`, `typecheck` остаются нативными: браузер им не нужен.
- Внутри контейнера те же команды работают нативно (без Docker в Docker).
- Аварийный выход: `DIAGRAMS_NATIVE=1` — рендер на хосте, как до этой правки.

## 4. Образ

`Dockerfile`:

- `FROM mcr.microsoft.com/playwright:v1.61.1-noble` — тег совпадает с версией `playwright-core`
  в `bun.lock` (проверяет тест, §8).
- bun 1.3.13 через `npm install -g bun@1.3.13` (в образе есть npm, нет unzip).
- `ln -s /ms-playwright/chromium-*/chrome-linux64/chrome /usr/local/bin/chromium` — путь с номером
  сборки прячется за постоянным.
- `ENV CHROMIUM_PATH=/usr/local/bin/chromium DIAGRAMS_IN_CONTAINER=1`.
- git: `safe.directory '*'` (репозиторий смонтирован с чужим владельцем) и
  `url."https://github.com/".insteadOf "git@github.com:"` — `build-site.ts` в контейнере тянет
  ветки публичного репозитория по HTTPS, без SSH-ключей.
- `.dockerignore` исключает всё: `Dockerfile` ничего не копирует, контекст сборки пустой.

## 5. Локальный запуск: `scripts/docker.ts`

`package.json`:

| Скрипт | Было | Стало |
|---|---|---|
| `render` | `bun scripts/eraser.ts render -f html && … -f png` | `bun scripts/docker.ts render` |
| `build` | `validate && check && warm && render && index` | `bun scripts/docker.ts build` |
| `site` | `bun scripts/build-site.ts` | `bun scripts/docker.ts site` |
| `render:native`, `build:native`, `site:native` | — | прежние команды; `build:native` вызывает `render:native` |

`bun scripts/docker.ts <script> [args…]`:

1. Если `DIAGRAMS_IN_CONTAINER=1` или `DIAGRAMS_NATIVE=1` — запускается `bun run <script>:native
   [args…]` здесь же, без Docker; код выхода пробрасывается.
2. Иначе проверка `docker info`. Не отвечает — сообщение
   `Docker не запущен: запусти Docker Desktop или DIAGRAMS_NATIVE=1 bun run <script>` и код 2.
3. `docker build -t docs-render:<первые 12 символов sha256 Dockerfile> .` — тег по
   содержимому, смена `Dockerfile` даёт новый образ, повторная сборка берётся из кэша.
   Контекст — корень репо, `.dockerignore` исключает всё.
4. `docker run --rm -v <корень репо>:/work -v docs-render-node-modules:/work/node_modules -w /work
   <образ> bash -c "bun install --frozen-lockfile && bun run <script>:native <args…>"`.
   `node_modules` для Linux живут в именованном томе и не смешиваются с виндовыми; `.eraser/icons` и
   `dist/` — в смонтированном репо, общие с хостом. Код выхода контейнера пробрасывается.

Аргументы в `bash -c` экранируются. Команды `docker.ts` строит чистыми функциями, спавн — тонкая
обёртка, как в `scripts/eraser.ts`.

## 6. CI и Pages

`ci.yml`, job `build`, и `pages.yml`, job `build`:

- убрать `setup-bun`, `setup-node`, `CHROMIUM_PATH`;
- `docker/setup-buildx-action@v3`, затем `docker/build-push-action@v6` с `load: true`,
  `tags: docs-render:ci`, `cache-from: type=gha`, `cache-to: type=gha,mode=max`;
- кэш `.eraser/icons` — как сейчас;
- один шаг `docker run --rm -v "$PWD:/work" -w /work docs-render:ci bash -c "bun install
  --frozen-lockfile && bun run typecheck && bun run test && bun run build"`; в Pages ещё
  `&& bun run site --main-built`. Внутри `DIAGRAMS_IN_CONTAINER=1`, поэтому `build` и `site`
  работают нативно;
- загрузка артефактов и деплой — как сейчас. Файлы в `dist/` принадлежат root, раннер одноразовый.

Ветки без этой правки при сборке превью рендерятся своими старыми скриптами внутри того же
контейнера и получают Chromium образа через `CHROMIUM_PATH` из `ENV`.

## 7. Ошибки

- Docker не запущен или не установлен — §5 п. 2, без трассировки.
- `docker build` или `docker run` упал — код выхода пробрасывается, вывод Docker виден как есть.
- `DIAGRAMS_NATIVE=1` без Chrome на хосте — поведение прежнее (CLI сам сообщает, что браузер не найден).

## 8. Проверка

Тесты `scripts/docker.test.ts` (bun test, без Docker):

- `DIAGRAMS_IN_CONTAINER=1` и `DIAGRAMS_NATIVE=1` → нативная команда `bun run <script>:native …`;
- иначе → аргументы `docker build` и `docker run` (тег по хэшу, тома, рабочий каталог, команда);
- экранирование аргументов в `bash -c`;
- текст ошибки при недоступном Docker;
- тег `FROM` в `Dockerfile` равен версии `playwright-core` из `bun.lock`.

Приёмка:

1. Локально: `bun run build` через Docker, `bun run test`, `bun run typecheck`.
2. CI на ветке зелёный, артефакт `diagrams` скачан.
3. sha256 всех `dist/**/*.html` локально и в артефакте совпадают; `dist/**/*.png` совпадают
   побайтно, при расхождении байтов — попиксельно.
4. Pages после слияния собирает `main` и превью веток, включая ветку без этой правки.
5. `DIAGRAMS_NATIVE=1 bun run render` работает как до правки.

## 9. Документация

- README, раздел «Локально»: для рендера нужен запущенный Docker Desktop; bun и Node на хосте нужны
  для остальных скриптов и запуска `docker.ts`; Chrome на хосте нужен только с `DIAGRAMS_NATIVE=1`.
- `.claude/skills/eraser-diagrams/SKILL.md`, цикл правки: `bun run render` требует запущенного
  Docker; `CHROMIUM_PATH` — только для нативного режима.

## 10. Вне рамок

Реестр образов (GHCR), `container:` на уровне job, изменения схем, обновление Playwright.
