# Задачи с доски Scrumban в графе модуля (v2) — дизайн

Дата: 2026-10-08. Статус: дизайн утверждён в чате; владелец поручил спеку, план и реализацию без промежуточного ревью.
Продолжение: `docs/superpowers/specs/2026-10-08-module-graph-design.md` (v1, влит в PR #26).

## 1. Цель

Граф модуля показывает, как треки двигаются на деле: задачи с доски Scrumban, привязанные к треку,
дают дугу прогресса на узле трека и список в карточке и на странице трека. Задачи привязывают на
груминге одним полем доски «Трек». Задачи спринтов модуля без трека видны отдельным списком —
подсказка к следующему грумингу.

Успех: на `/docs/modules/2026-10/` у трека с задачами — дуга «готово / всего», карточка трека
перечисляет его задачи со статусом, спринтом и исполнителем; под графом — время снимка доски и
списки «Задачи без трека», «Задачи с неизвестным треком»; данные обновляются раз в час днём; токен
с правом записи не попадает в сборку веток; сломанная доска или токен не роняют сайт.

## 2. Проверенные факты

Репа `docs`, `main` на `562b4ae` (влит PR #26, v1):

- `site/modules/`: `people.ts`, `index.md`, `modules.data.ts`, `2026-10/index.md`, `2026-10/tracks/*.md`
  (19 треков). Модель — `site/.vitepress/modules.ts`, чтение — `site/.vitepress/modules-read.ts`,
  компоненты — `site/.vitepress/theme/components/` (`GraphCanvas`, `NodeCard`, `TrackMeta`, `TrackList`,
  `ModuleGraph`, `ModuleList`, `GraphFilters`).
- `.github/workflows/pages.yml`: триггеры `push` (все ветки), `delete`, `workflow_dispatch`;
  `concurrency: pages-main` для `main`; job `build` на `main` — Docker-образ, `bun install
  --frozen-lockfile && bun run typecheck && bun run test && bun run build`, затем `bun run site
  --main-built` (собирает каждую ветку `origin` в своём `git worktree` её же скриптами), выкладка
  `dist/`. Запуски 08.10.2026 — 9–13 минут.
- `scripts/build-site.ts:179`: в worktree ветки копируется кэш иконок `ICON_CACHE_DIR` перед её
  сборкой — так же можно подложить снимок доски.
- `.github/workflows/automation.yml` передаёт `secrets.ADD_TO_PROJECT_PAT` в переиспользуемый
  `Cringe-Driven-Development-Team/.github/.github/workflows/add-to-project.yml@main`; тот токеном
  добавляет карточки на доску (`addProjectV2ItemById`) и закрывает задачи после мержа PR. Секрет
  доступен репе `docs`, права на проект у токена есть.

Доска Scrumban (`orgs/Cringe-Driven-Development-Team/projects/1`), 08.10.2026:

- 99 карточек, все — issues: `frontend` 33, `infra` 22, `2026_2_Cringe_Driven_Development` 18,
  `backend` 12, `react` 6, прочие 8. Статусы: `Done` 77, `Backlog` 17, `Ready` 3, `In progress` 2;
  порядок статусов на доске — `Backlog`, `Ready`, `In progress`, `In review`, `Done`.
- `Sprint` — поле-итерация, недельные спринты: `Sprint 5` с 2026-10-12, `Sprint 6` с 10-19, `Sprint 7`
  с 10-26, `Sprint 8` с 11-02 (длительность 7). У 43 карточек спринта нет; без исполнителя — 25;
  с родителем — 6.
- Поля «Трек» нет (GraphQL `field(name: "Трек")` → `NOT_FOUND`).
- GraphQL отдаёт у issue `stateReason` (`COMPLETED`, `NOT_PLANNED`, `REOPENED`, `DUPLICATE`), `parent`,
  у значения итерации — `title`, `startDate`, `duration`.
- `ProjectV2SingleSelectFieldOptionInput`: `id` (необязательный), `name`, `color`, `description`
  (обязательные). `updateProjectV2Field` принимает `singleSelectOptions` — **полный** список значений
  поля; значение, отправленное без своего `id`, пересоздаётся, и его выбор на карточках теряется.

## 3. Решения

| Решение | Почему |
|---|---|
| На треке — дуга прогресса, задачи — списком в карточке и на странице трека | решение владельца: граф читаем и при сотне задач |
| Поле доски «Трек» — выпадающий список, значения — id треков, пополняется автоматически | решение владельца: выбор без опечаток; значения только добавляются — история прошлых модулей не теряется |
| Модуль задачи — по её спринту и `sprints` модуля | решение владельца: id трека может повториться в следующем модуле |
| Токен — готовый `ADD_TO_PROJECT_PAT`, только в отдельном job из кода `main` | решение владельца: секрет уже есть; сборка веток исполняет код любой ветки и токена не получает |
| Снимок — артефакт workflow, не коммит | решение владельца (подход A): нет шума коммитов и обхода защиты `main` |
| Расписание — раз в час 06:00–23:00 МСК | решение владельца; сборка ~10 минут, минуты Actions публичной репы бесплатны |
| Ошибки доски не роняют сборку | доску правят без ревью; ошибки — списками на странице и в сводке запуска |
| Задача без своего трека берёт трек родителя | по `CONTRIBUTING.md` вторая половина фичи — sub-issue; трек ставят на родителя |

## 4. Данные

### 4.1. Поле «Трек» на доске

Одиночный выбор с именем `Трек`. Значение — id трека (`bff`, `multibranch`, …), `color: GRAY`,
`description` — `title` трека из самого нового модуля, где этот id есть. Множество значений —
объединение id треков всех модулей в `site/modules/*/tracks/`. Значения не удаляются и не
переименовываются; у существующего значения обновляется только `description`.

### 4.2. Спринты модуля — frontmatter `index.md`

```yaml
sprints: [Sprint 5, Sprint 6, Sprint 7, Sprint 8]
```

Необязательное поле; каждое значение — `Sprint <число>`; повторы — ошибка сборки (как остальные
проверки v1, раздел 4.4 спеки v1: `modules/<m>/index.md: sprints — …`). Модуль `2026-10` получает
`[Sprint 5, Sprint 6, Sprint 7, Sprint 8]` (12.10–08.11.2026, подтвердил владелец). Модуль без
`sprints` задач не показывает.

### 4.3. Снимок — `site/modules/board.json` (в `.gitignore`)

```ts
type BoardSnapshot = {
  takenAt: string;                 // ISO-время снимка
  sprints: { title: string; start: string; days: number }[];  // все итерации поля Sprint
  tasks: {
    ref: string;                   // "frontend#28"
    title: string;
    url: string;
    state: "open" | "closed" | "not_planned";   // NOT_PLANNED и DUPLICATE → not_planned
    status: string | null;         // значение Status доски как есть
    sprint: string | null;         // "Sprint 5"
    assignees: string[];           // логины
    track: string | null;          // значение «Трек»
    parent: string | null;         // "frontend#9"
  }[];
};
```

### 4.4. Задача → модуль и трек

1. Трек задачи — её `track`; если пусто — `track` родителя (один уровень).
2. Модуль задачи: если `sprint` задан — модуль, в чьих `sprints` он есть (если таких нет — задача
   ни в один модуль не попадает); если `sprint` пуст — **текущий** модуль: тот, у кого среди
   `sprints` есть спринт, идущий сегодня по датам снимка (`start ≤ сегодня < start + days`, сегодня
   — по Москве на момент сборки); если такого нет — самый новый модуль с `sprints`.
3. В модуле: трек есть → задача трека; трек задан, но такого трека в модуле нет → «Задачи с
   неизвестным треком»; трека нет → «Задачи без трека» (только задачи со `sprint` из `sprints`
   модуля — бэклог без трека сюда не попадает).
4. Прогресс трека: `total` — задачи трека без `not_planned`; `done` — со статусом `Done` или
   закрытые; `active` — `In progress` и `In review`.

### 4.5. Без снимка или с битым снимком

Файла нет — задачи не показываются, на странице модуля «Задачи с доски не загружены». Файл не
читается как JSON или не той формы — то же, плюс предупреждение в лог сборки
(`board.json: <что не так> — задачи не показаны`); сборка идёт дальше.

## 5. Устройство

### 5.1. Модули кода

| Файл | Отвечает за |
|---|---|
| `scripts/board.ts` | CLI задания `board`: `bun scripts/board.ts sync` и `bun scripts/board.ts snapshot <путь>`; GraphQL `https://api.github.com/graphql` с `GH_TOKEN`; проект `Cringe-Driven-Development-Team` №1; постраничное чтение карточек по 100. Чистые функции: `planOptions(existing, tracks)` → полный список `singleSelectOptions` или `null`, если менять нечего; `toSnapshot(items, sprintField, takenAt)` |
| `site/.vitepress/board.ts` | тип `BoardSnapshot`, `parseSnapshot(json)` (форма 4.3, иначе ошибка с текстом), `assignTasks(modules, snapshot, today)` по 4.4, `trackProgress` |
| `site/.vitepress/modules.ts` | поле `sprints` модуля и его проверка; `buildGraph` получает необязательный прогресс треков и кладёт его в узел трека (`progress?: { done; active; total }`) |
| `site/.vitepress/modules-read.ts`, `site/modules/modules.data.ts` | читают `site/modules/board.json`, если он есть (4.5); `Data` получает `board: { takenAt; byModule } \| null` |
| `theme/components/TaskList.vue` | список задач: статус, ссылка `repo#N`, заголовок, спринт, исполнители (имя из `people.ts` или логин); `not_planned` — зачёркнуто в конце; группы по статусу в порядке `In progress`, `In review`, `Ready`, `Backlog`, `Done` |
| `GraphCanvas.vue` | дуга вокруг узла трека: сплошная цвета направления — `done/total`, полупрозрачная — `active/total`, остальное — `--vp-c-divider`; без задач дуги нет |
| `NodeCard.vue` | у трека — «Задачи · N из M готово» и `TaskList` или «Задач пока нет: их привязывают на груминге полем «Трек» на доске»; у человека — «Открытые задачи · N» (исполнитель, не `Done`, не закрыта) |
| `TrackMeta.vue` | «Задачи» с `TaskList` в шапке трека (рендер при сборке) |
| `ModuleGraph.vue` | под графом: «Снимок доски: <дд.мм.гггг, чч:мм> МСК» или «Задачи с доски не загружены»; свёрнутые `<details>` «Задачи без трека · N» и «Задачи с неизвестным треком · N» (пустые не выводятся) |
| `ModuleList.vue` | колонка «Задачи»: `done / total` по всем трекам модуля или «—» без снимка |
| `.github/workflows/pages.yml` | job `board`, расписание, передача снимка в `build` |

### 5.2. Workflow

```yaml
on:
  schedule:
    - cron: "7 3-20 * * *"        # каждый час 06:07–23:07 МСК
jobs:
  board:
    if: github.ref == 'refs/heads/main' && github.event_name != 'delete'
    continue-on-error: true
    steps:
      - checkout main (persist-credentials: false)
      - setup bun (oven-sh/setup-bun, точная версия), bun install --frozen-lockfile
      - bun scripts/board.ts sync          # env GH_TOKEN — секрет ADD_TO_PROJECT_PAT
      - bun scripts/board.ts snapshot board.json
      - upload-artifact board (board.json)
  build:
    needs: board, if: always() && <прежнее условие>
    steps:
      - download-artifact board → site/modules/ (continue-on-error)
      - … как раньше
```

`sync` падает → шаг помечен ошибкой, `snapshot` всё равно идёт (`if: always()` на шаге), в сводку
запуска — строка с причиной. `build-site.ts` копирует `site/modules/board.json` в worktree ветки,
если файл есть, — как кэш иконок. Токен есть только в env двух шагов job `board`.

## 6. Проверка

- `bun test`:
  - `planOptions`: новые id добавляются с `GRAY` и описанием; существующие отправляются со своим
    `id`; ни одно существующее значение не пропадает, даже если трека больше нет в файлах;
    изменилось только описание — отправляется; ничего не изменилось — `null`.
  - `toSnapshot` на сохранённом ответе GraphQL (фикстура из 3–4 карточек: с треком, без, с
    родителем, `NOT_PLANNED`).
  - `parseSnapshot`: верная форма; не JSON; нет `tasks`; задача без `ref`.
  - `assignTasks`: трек от родителя; модуль по спринту; спринт вне всех модулей; задача без
    спринта — в текущий модуль по датам и в самый новый, если текущего нет; `not_planned` вне
    прогресса; «без трека» только из спринтов модуля; «неизвестный трек».
  - `trackProgress`, проверка `sprints` модуля (формат, повтор).
- `bun run typecheck && bun run test && bun run build` — зелёная со снимком и без него.
- Перед первым запуском на настоящей доске: `sync` на одноразовом проекте пользователя с полем
  «Трек», двумя значениями и карточкой с выбранным значением → после `sync` с новым id выбор на
  карточке сохранился. Только потом — настоящая доска.
- Превью ветки: дуги на треках с задачами, карточка трека со списком, «Задачи без трека», время
  снимка; без снимка — надпись. Скриншоты в PR.

## 7. Документация

README, раздел «Модули»: поле «Трек» на доске, `sprints` у модуля, когда обновляются задачи, как
локально получить снимок (`GH_TOKEN=… bun scripts/board.ts snapshot site/modules/board.json`).

## 8. Не входит

- Запись в доску из графа, кроме пополнения значений «Трек».
- Статусы на узлах людей, фильтр по статусу, история прогресса по дням.
- Удаление и переименование значений «Трек».
