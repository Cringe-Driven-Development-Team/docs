# Схема контракта BFF в eraser на странице трека — дизайн

## 1. Зачем

На странице трека BFF (`site/modules/2/tracks/bff.md`, раздел «Как устроен контракт») сейчас схема mermaid,
и читатель её не понимает:

- Orval нарисован прямоугольником рядом с BFF и Go, как будто это работающий сервис. На деле это генератор
  кода: команда, которая запускается на ноутбуке или в CI и пишет файлы в репозиторий. В проде его нет.
- На стрелках стоят `goZod` и `goApi` — имена целей из конфига Orval. На странице они больше нигде не
  объясняются.
- Сборку и работу в проде различают только пунктир и сплошная линия.
- Схема нарисована в mermaid, а основной формат схем репозитория — eraser (CLAUDE.md, раздел «Схемы»).

Цель: студент открывает трек BFF и с одной картинки понимает, что генерируется до выкатки и что работает в
проде, и где между ними граница.

## 2. Решения

1. **Формат — eraser**, по скиллу `.claude/skills/eraser-diagrams/SKILL.md`: зоны, цвета, легенда,
   цикл validate → check → warm → render → осмотр PNG.
2. **Место — `diagrams/modules/2/bff-contract.json`.** Схема описывает план модуля №2, а не прод, поэтому в
   раздел «Архитектура» она не попадает (там по тексту сайта только то, как работает прод). Путь повторяет
   адрес страниц модуля: схема публикуется как `/docs/modules/2/bff-contract.html` и `.png`.
3. **Папка `modules/2` — в списке папок вне меню** (`HIDDEN_FOLDERS` в `site/.vitepress/diagram-names.ts`).
   Комментарий списка меняется с «замороженные папки» на «папки вне раздела „Архитектура“: замороженные
   варианты и схемы планов модулей». Отдельный список не заводим: поведение то же — схема не в меню,
   открывается по прямому адресу и встраивается в страницы `<Diagram>`.
4. **Вложенность в два уровня.** `listDiagrams` (`scripts/eraser.ts`) сейчас находит только `*.json` и
   `*/*.json`. Он начинает находить и `*/*/*.json`. Остальной код уже работает с путём папки, а не с одним
   именем: `renderBatches` берёт `dirname` от пути, `diagrams.data.ts` склеивает путь через `join`,
   `htmlPages` и `protectedFiles` берут имена из `diagramNames`. План проверяет каждое из этих мест тестом.
5. **На странице трека** mermaid-блок раздела «Как устроен контракт» заменяется на
   `<Diagram name="modules/2/bff-contract" />`. Под схемой — две-три строки: что слева, что справа и как
   файлы попадают в код. В тексте раздела нет `goZod` и `goApi`.

## 3. Содержание схемы

Четыре зоны по цветовой конвенции скилла, слева направо — как идёт работа:

1. **Apidog** (`green`, внешний сервис): «Контракт Go».
2. **Генерация кода — ноут разработчика или CI** (`white`, рабочее место). Вложенные группы (`plain`):
   - «bun run sync (монорепа фронта)»: шаг «apidog: выгрузка контракта» → файл `spec/openapi.json` →
     шаг «Orval — генератор кода»;
   - «make generate (бэк)»: шаги `cmd/apidog` → `oapi-codegen`.
3. **GitHub** (`purple`): что генерация коммитит.
   - Монорепа фронта: `apps/bff/src/go/client.ts` (клиент к Go) и `packages/schemas/src/zod.ts`
     (zod-схемы, пакет `@cdd/schemas`).
   - Бэкенд: `api.gen.go`.
4. **Прод — VPS в Selectel** (`blue`, наша инфраструктура):
   - BFF (вложенная группа): «Роутер tRPC — проверяет вход zod-схемами» → «Клиент к Go»;
   - Go API.

Узел `client` («Браузер: формы и свой tRPC-клиент») стоит вне групп. Из него идёт стрелка к роутеру tRPC
с подписью `/api/trpc`.

Связи:

- Apidog → `bun run sync` и Apidog → `make generate`;
- Orval → `client.ts`, Orval → `zod.ts`, `oapi-codegen` → `api.gen.go`;
- мостик между зонами: `client.ts` → «Клиент к Go», `zod.ts` → «Роутер tRPC», `api.gen.go` → Go API, все с
  подписью «в сборку»;
- в проде: роутер → клиент к Go → Go API (`/api/v1`).

Цвет и стиль стрелок задаёт конвенция скилла по их концам. Легенда — тот массив, который напечатает
`bun run check`.

Подписи — обычными словами. Никаких `goZod` и `goApi` на схеме.

## 4. Что не входит

- `diagrams/contract.json` в «Архитектуре». Она описывает прежний путь (фронт генерирует клиент из OpenAPI
  через `@my/openapi`). Обновить её или заморозить — отдельное решение.
- Mermaid «Источники правды» на подстранице «Контракт» и схемы «Было и стало» на странице трека.
- Конфиг Orval на подстранице «Контракт»: имена `goApi` и `goZod` там уместны, это код.

## 5. Документация

- `README.md`: таблица схем — раздел «Модуль №2» со строкой `modules/2/bff-contract`; абзац про исходники —
  что схемы плана модуля лежат в `diagrams/modules/<N>/` и в «Архитектуру» не попадают.
- `CLAUDE.md`, раздел «Схемы»: та же строка.
- Скилл `eraser-diagrams`: «Новые схемы кладутся в корень `diagrams/`», схемы плана модуля — в
  `diagrams/modules/<N>/`.

## 6. Проверка

- Тесты (`bun test`):
  - `listDiagrams` находит `diagrams/a/b/x.json`;
  - `renderBatches` кладёт её в `dist/a/b/`;
  - `HIDDEN_FOLDERS` содержит `modules/2`, схемы из неё не попадают в индекс «Архитектуры»;
  - страница трека BFF: в разделе «Как устроен контракт» есть `<Diagram name="modules/2/bff-contract" />`,
    нет блока mermaid; в `bff.md` нет `goZod` и `goApi`;
  - схема: есть узлы Orval, `@cdd/schemas`, Go API, узел `client`; зоны по конвенции (`bun run check`).
- Цикл скилла: validate → check → warm → render → осмотр PNG глазами.
- `bun run typecheck && bun run test && DIAGRAMS_NATIVE=1 bun run build` — без конфликтов `build-vitepress`
  в `dist/modules/2/`.
- Превью ветки в Chrome: схема на странице трека видна, масштаб и кнопка «HTML» работают; в меню
  «Архитектура» её нет.

## 7. Проверенные факты

На `main` `880ce28`:

- `scripts/eraser.ts:23-28` — `listDiagrams` ищет только `*.json` и `*/*.json`.
- `scripts/eraser.ts:35-40` — `renderBatches` берёт `dirname(relative(dir, file))`, папка `a/b` даёт
  `dist/a/b`.
- `site/.vitepress/diagram-names.ts:2,5` — `ROOT_NAMES` (схемы «Архитектуры») и `HIDDEN_FOLDERS = ["bff",
  "frozen-k3s"]` с комментарием «Замороженные папки».
- `site/.vitepress/theme/diagrams.data.ts:21-29` — размеры: `ROOT_NAMES` плюс PNG из каждой папки
  `HIDDEN_FOLDERS` через `join(dist, folder)`.
- `site/.vitepress/theme/Diagram.vue:14-15` — HTML и PNG схемы: `withBase(/${name}.html)` и `.png`.
- `scripts/build-index.ts:14-16` — индекс исключает схемы, чьё имя начинается с `${folder}/` из
  `HIDDEN_FOLDERS`.
- `scripts/build-vitepress.ts:13,19,35` — `protectedFiles` и `mergeConflicts`: сборка падает, если файл
  VitePress совпал с файлом схемы.
- `scripts/check-site.ts:15-21` — `htmlPages` пропускает страницы схем по `diagramNames`.
- `site/modules/2/tracks/bff.md:24-57` — раздел «Как устроен контракт»: mermaid с `goZod` и `goApi`.
- `site/modules/2/tracks/bff/contract.md:54-57` — `bun run sync` = выгрузка `apidog` в
  `spec/openapi.json` + Orval; `:71-85` — цели `goApi` (`apps/bff/src/go/client.ts`) и `goZod`
  (`packages/schemas/src/zod.ts`); `:24-26` — Go: `make generate` = `cmd/apidog` и `oapi-codegen`.
- `.claude/skills/eraser-diagrams/SKILL.md:10-12, 101-139` — новые схемы в корне; зоны и цвета, легенда.
