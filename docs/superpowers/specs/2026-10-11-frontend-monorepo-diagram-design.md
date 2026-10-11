# Схема монорепы фронта и удаление замороженной папки `diagrams/bff/` — дизайн

## 1. Зачем

Задача [frontend#44](https://github.com/Cringe-Driven-Development-Team/frontend/issues/44) превращает репозиторий
фронта в монорепу на bun workspaces и Turborepo. Схемы, которая показывает её устройство, нет:

- `modules/2/bff-contract` показывает монорепу только как место, куда Orval пишет файлы;
- `bff/frontend-monorepo` из замороженного варианта «BFF: две VPS» расходится с текущим планом: клиент на
  TanStack, BFF собирается в образ GHCR и отдаёт HTML bootstrap, нет `packages/schemas`. Она путает.

Цель: исполнитель frontend#44 открывает одну схему и видит, какие workspace есть в монорепе, кто кого
импортирует и как Turborepo гоняет задачи. Замороженный вариант «BFF: две VPS» удаляется, старые адреса его
схем ведут на актуальные.

## 2. Решения

1. **Охват — только монорепа.** Генерацию Orval схема не рисует: её показывает `modules/2/bff-contract`, под
   новой схемой — ссылка на неё. CI фронта не рисует: это frontend#4, его дизайна ещё нет.
2. **Место — `diagrams/modules/2/frontend-monorepo.json`.** Папка `modules/2` уже в `HIDDEN_FOLDERS`: схема не
   попадает в «Архитектуру», открывается по адресу `/docs/modules/2/frontend-monorepo.html` и встраивается в
   страницы через `<Diagram>`.
3. **Страница.** На странице трека BFF (`site/modules/2/tracks/bff.md`) — новый раздел «Монорепа фронта» сразу
   после «Как устроен контракт»: `<Diagram name="modules/2/frontend-monorepo" />` и два-три предложения под ней.
4. **Состояние — целевое после модуля №2**: пакеты библиотек уже под `@cdd-team`, вместо `@iredtea/openapi` —
   свой клиент tRPC.
5. **`diagrams/bff/` удаляется целиком** (пять схем), `bff` убирается из `HIDDEN_FOLDERS`.
6. **Старые адреса — переадресацией**, механизмом `PAGE_REDIRECTS` (`scripts/build-index.ts`): пять новых
   записей, цели относительные, как у существующих.

   | Файл | Цель |
   |---|---|
   | `bff/deployment.html` | `../deployment.html` |
   | `bff/ci.html` | `../ci.html` |
   | `bff/cd.html` | `../cd.html` |
   | `bff/infra.html` | `../infra.html` |
   | `bff/frontend-monorepo.html` | `../modules/2/frontend-monorepo.html` |

   Существующие записи `bff/index.html`, `bff/contract.html`, `bff/auth.html` (старые страницы раздела BFF)
   остаются.
7. **Тексты про заморозку**: замороженным остаётся только `diagrams/frozen-k3s/`.

## 3. Содержание схемы

Зоны по цветовой конвенции скилла `eraser-diagrams`:

1. **GitHub** (`purple`): группа «Монорепа фронта» (репозиторий
   `frontend-park-mail-ru/2026_2_Cringe_Driven_Development`), вложенные группы (`plain`):
   - `apps/client` — React-приложение: экраны и сторы;
   - `apps/bff` — Hono, роутер tRPC (`AppRouter`), клиент к Go в `src/go` (генерирует Orval);
   - `packages/schemas` — пакет `@cdd/schemas`: zod-схемы операций Go.
2. **npm** (`green`, внешний реестр): `@cdd-team/react`, `@cdd-team/zustand`, `@cdd-team/trpc-client` — пакеты
   монорепы библиотек `frontend-packages`.
3. **Turborepo** (`white`, ноут или CI): шаги `Activity` — `build`, `lint`, `typecheck`, `test`. Подпись
   группы или текст рядом: сначала задачи зависимостей (`^build`), повторный запуск без изменений берётся из
   кеша.

Связи:

- `apps/client` → `apps/bff`: подпись «import type AppRouter — только типы»;
- `apps/bff` → `packages/schemas`: подпись «схемы входа процедур»;
- `apps/client` → npm: подпись «зависимости»;
- порядок сборки в Turborepo: `packages/schemas` → `apps/bff` → `apps/client` — стрелками между шагами или
  подписью группы, как ляжет без пересечений.

Цвет и стиль стрелок — по конвенции скилла (концы `Activity` — чёрный пунктир). Легенда — массив из
`bun run check`. Узла `client` (браузер) на схеме нет: она о репозитории, не о трафике.

## 4. Что не входит

- Генерация Orval (`bun run sync`, `spec/openapi.json`) — схема `modules/2/bff-contract`.
- CI/CD фронта и BFF — frontend#4.
- Фраза «заморожена в варианте `bff` документации» в `infra/pulumi/README.md:8` — другой репозиторий, отдельный PR
  по просьбе пользователя.
- `diagrams/frozen-k3s/` — остаётся замороженной.

## 5. Документация

- `README.md`: строка `modules/2/frontend-monorepo` в разделе «Модуль №2»; таблица «BFF: две VPS» и абзац про
  её заморозку удаляются; «Архитектур три» → две (MVP и Frozen: k3s); строка 138 про якорь `#bff/ci` —
  пример заменить на `#frozen-k3s/ci`.
- `CLAUDE.md`, «Схемы»: замороженная папка одна — `diagrams/frozen-k3s/`.
- Скилл `.claude/skills/eraser-diagrams/SKILL.md`: то же.
- `site/architecture/index.md`: пункт «BFF на двух VPS» в списке замороженных вариантов удаляется.
- Описание frontend#44: `apps/web` → `apps/client`, ссылка на схему (после мержа).

## 6. Проверка

- Тесты (`bun test`):
  - схема: есть группы `apps/client`, `apps/bff`, `packages/schemas`, узлы пакетов npm и четыре шага Turborepo;
    связи client → bff и bff → schemas; зоны по конвенции (`bun run check`);
  - `PAGE_REDIRECTS` содержит пять новых записей из §2.6; цель каждой — существующая схема (`diagrams/<имя>.json`);
  - `HIDDEN_FOLDERS` не содержит `bff`; файлов в `diagrams/bff/` нет;
  - страница трека BFF: раздел «Монорепа фронта» с `<Diagram name="modules/2/frontend-monorepo" />`;
  - `site/architecture/index.md` не ссылается на `../bff/`;
  - тесты, где `bff/…` служило примером имени схемы из скрытой папки, переходят на `frozen-k3s/…`.
- Цикл скилла: validate → check → warm → render → осмотр PNG.
- `bun run typecheck && bun run test && bun run build`; в `dist/bff/` — пять файлов-переадресаций и три
  прежних.
- Превью ветки в Chrome: схема на странице трека BFF; `/docs/branches/<slug>/bff/ci.html` уводит на
  `ci.html`.

## 7. Проверенные факты

На `main` `035ba69`:

- `diagrams/bff/`: `cd.json`, `ci.json`, `deployment.json`, `frontend-monorepo.json`, `infra.json`.
- `site/.vitepress/diagram-names.ts:2` — `ROOT_NAMES` = `cd, ci, contract, deployment, frontend, infra`; `:6` —
  `HIDDEN_FOLDERS = ["bff", "frozen-k3s", "modules/2"]`.
- `scripts/build-index.ts:71-75` — `PAGE_REDIRECTS` с тремя записями `bff/*`; `:120-121` — `writePageRedirects`;
  `:128` — сообщение «dist/bff/: переадресация … страниц на трек модуля».
- `scripts/build-vitepress.ts:15` — файлы `PAGE_REDIRECTS` защищены от перезаписи VitePress.
- `site/architecture/index.md:13-16` — ссылки на `../bff/*.html`.
- `README.md:34-36`, `:50-58`, `:138` — абзац и таблица «BFF: две VPS», пример якоря `#bff/ci`.
- `CLAUDE.md:25`, `.claude/skills/eraser-diagrams/SKILL.md:12` — «`diagrams/bff/` и `diagrams/frozen-k3s/`
  заморожены».
- Тесты с `bff/…` как примером: `scripts/build-index.test.ts:24,28,64-67,90`, `scripts/diagram-sizes.test.ts:28,32`,
  `scripts/build-vitepress.test.ts:8-19`, `scripts/check-site.test.ts:27,32`.
- `site/modules/2/tracks/bff.md:25` — раздел «Как устроен контракт», `:45` — «Было и стало».
- Опубликованы и отвечают 200: `/docs/ci.html`, `/docs/deployment.html`, `/docs/bff/ci.html`.
- Фронт на `f499d4e` (`package.json`): зависимости `@iredtea/openapi`, `@maninthecoat/react`,
  `@maninthecoat/zustand`; монорепа библиотек (frontend#18) переносит их под `@cdd-team`, свой клиент tRPC —
  frontend#46.
- Страница «Контракт» трека BFF: `orval.config.ts` пишет в `apps/bff/src/go/client.ts` и
  `packages/schemas/src/zod.ts` (пакет `@cdd/schemas`).
