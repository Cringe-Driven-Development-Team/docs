# Граф учебного модуля в VitePress (v1) — дизайн

Дата: 2026-10-08. Статус: дизайн утверждён в чате, ждёт ревью спеки.

## 1. Цель

Менторы и студенты команды видят план учебного модуля (месяц разработки) живым графом: кто какой
трек делает, с какой стороны (фронт, бэк, devops), кто из менторов помогает и где треки людей
пересекаются. Граф фильтруется по человеку, направлению и слоям связей, как граф Obsidian. Модули
копятся в архиве на сайте.

Успех: на `https://cringe-driven-development-team.github.io/docs/modules/2026-10/` — граф модуля
октября с 6 людьми и 19 треками из плана, фильтры работают, ссылка с фильтром в адресе открывает тот
же вид; у каждого трека своя страница; `/docs/modules/` — архив модулей; ошибка в данных роняет
сборку с указанием файла и поля.

v1 — только план. Задачи с доски Scrumban (статусы, спринты) — отдельная спека v2.

## 2. Проверенные факты

Репа `docs`, `main` на `07fb9bd`:

- `package.json`: `vitepress` `1.6.4`, `vitepress-plugin-mermaid` `2.0.17`, `typescript` `7.0.2`,
  `@types/bun` `1.4.2` — все в `devDependencies` с точными версиями (кроме `mermaid` `^11`).
  `test` — `bun test`, `typecheck` — `tsc`, `site:vitepress` — `bun scripts/build-vitepress.ts`,
  `build:native` кончается на `site:vitepress && site:check`.
- `tsconfig.json`: `include` — `scripts/**/*.ts`, `site/.vitepress/*.ts`, `site/.vitepress/*.mts`;
  `strict`, `noUncheckedIndexedAccess`. Подпапки `site/.vitepress/` и `site/modules/` сейчас не
  проверяются; `.vue` `tsc` не проверяет.
- `site/.vitepress/config.mts`: `withMermaid(defineConfig({ base: SITE_BASE, cleanUrls: true, … }))`;
  `nav` — «Архитектура» (`/diagrams/`, `target: '_self'`), «Безопасность», «BFF»; `sidebar` по
  префиксам `/bff/` и `/security/csrf/`.
- `site/.vitepress/theme/index.ts`: `extends: DefaultTheme`, `setup()` с переадресацией якорей
  главной и прокруткой к якорю после mermaid; своего `Layout` и компонентов нет.
  `theme/custom.css` — только стили `.mermaid`.
- `site/.vitepress/site.ts`: `SITE_BASE` из `process.env.SITE_BASE`, по умолчанию `/docs/`; превью
  ветки — `/docs/branches/<slug>/`.
- `scripts/build-vitepress.ts`: `node node_modules/vitepress/bin/vitepress.js build site` под Node,
  затем перенос в `dist/` с проверкой конфликтов с файлами схем.
- `scripts/check-site.ts`: проверяет в `dist/` ссылки `<a href>`, `<link>`, `<script src>`,
  `<img src>` и якоря всех страниц VitePress, кроме `branches/` и страниц схем. Видит только HTML,
  отрисованный при сборке.
- `.github/workflows/pages.yml`: в Docker `bun install --frozen-lockfile && bun run typecheck &&
  bun run test && bun run build`, затем `bun run site --main-built`, выкладка `dist/` на Pages.
- `scripts/site-base.test.ts` импортирует `site/.vitepress/site.ts` — тесты в `scripts/` уже
  проверяют код сайта.

Пакет `vitepress@1.6.4` (распакован из npm):

- `createContentLoader` экспортируется из `vitepress` (`dist/node/index.d.ts`); файлы-загрузчики
  данных — `*.data.ts`.
- Тема по умолчанию даёт слот `doc-before` в `Layout`; тёмная тема — класс `dark` на `<html>`,
  состояние — `useData().isDark`.

Организация `Cringe-Driven-Development-Team`, 08.10.2026:

- Участники: `YarikMix` (Yaroslav Mihalev), `blackHATred` (Aleksandr Batovkin), `ManInTheCoat`
  (Erofey), `iRedTea` (Denis Istratov), `GrayMouse9`, `MrDuckVC`. Соответствие именам команды —
  раздел 4.1, `GrayMouse9` и `MrDuckVC` подтвердил владелец.
- Доска Scrumban (проект №1) публичная, поля `Status`, `Sprint`, `Size`, `Priority`, `Team`,
  `Parent issue` — нужны только v2.

npm, 08.10.2026: `force-graph` `1.51.4` опубликован 16.04.2026, `1.52.0` — 28.09.2026.

## 3. Решения

| Решение | Почему |
|---|---|
| v1 — только план, без доски | решение владельца: задачи заводятся постепенно после грумингов, связь с доской — v2 |
| Люди — имя и GitHub-логин | решение владельца; логин — ключ, по которому v2 свяжет задачи доски с людьми |
| Архив модулей, модуль называется по месяцу: `modules/2026-10/` | решение владельца — архив; имя по месяцу не требует помнить номер |
| Трек — отдельная markdown-страница, данные во frontmatter | решение владельца: у трека будут цель и приёмка, страница попадает в поиск сайта |
| Граф — `force-graph` в Vue-компоненте темы | решение владельца (подход A): вид и поведение прототипа, около 60 КБ; Cytoscape тяжелее, SVG при сборке теряет физику |
| Логика — в чистом `model.ts`, компоненты только рисуют | проверки, граф и фильтры тестируются `bun test` без браузера |
| Список треков текстом под графом рендерится при сборке | работает без JS, попадает в поиск и в `check-site.ts`, доступен экранным читалкам |
| Фильтры — в query-строке адреса | ссылкой на «граф Дениса» можно поделиться |
| Догадки о зависимостях из прототипа в данные не вносятся | это не план владельца; поле `related` есть, владелец заполнит сам |
| Отдельный домен не нужен | данные читаются при сборке, браузер делает только GET статики с Pages |

## 4. Данные

### 4.1. Люди — `site/modules/people.ts`

```ts
export type Person = { login: string; name: string; role: string; area: Area; mentor?: true };
export const PEOPLE: readonly Person[] = [ … ];
```

| login | name | role | area | mentor |
|---|---|---|---|---|
| `YarikMix` | Ярослав | ментор фронта | front | да |
| `blackHATred` | Саша | ментор бэка | back | да |
| `ManInTheCoat` | Ерофей | фронт | front | |
| `iRedTea` | Денис | devops | devops | |
| `GrayMouse9` | Даша | бэк | back | |
| `MrDuckVC` | Валентин | бэк | back | |

`Area` — направления раздела 4.3; `area` человека задаёт цвет его отметки в списке людей, а узел человека на графе нейтральный (`--vp-c-text-2`, с 09.10.2026). Порядок в массиве — порядок
в списке людей на графе.

### 4.2. Модуль — `site/modules/<YYYY-MM>/index.md`

```yaml
---
title: Модуль октября 2026
period: …                    # необязательно, текстом: даты начала и конца
---
<ModuleGraph />
```

Каталог модуля — `YYYY-MM`; другое имя каталога в `site/modules/` — ошибка сборки. У модуля
`2026-10` — `title: Модуль октября 2026`, `period` нет, пока его не задаст владелец.

### 4.3. Трек — `site/modules/<YYYY-MM>/tracks/<id>.md`

> Подтреки (`part_of`) и вложенные подзадачи — [`2026-10-09-subtracks-design.md`](./2026-10-09-subtracks-design.md).

`id` — имя файла без `.md`: латиница в нижнем регистре, цифры, дефис.

```yaml
---
title: Multi-branch деплой фронта и стейджинг бэка через Coolify
label: Multi-branch + стейджинг (Coolify)   # подпись на графе; без него — title
area: devops                                 # front | back | devops | fullstack | team
do:                                          # логин → сторона: front | back | devops | team
  iRedTea: devops
help: [YarikMix, blackHATred]                # необязательно; теперь mentors — 2026-10-09-mentors-design.md
subtasks:                                    # необязательно, строки
  - …
related:                                     # необязательно
  - track: ai-review
    why: Агентам Stagehand нужен стенд ветки
---

## Цель
…
```

Подписи направлений: `front` — «Фронт», `back` — «Бэк», `devops` — «DevOps», `fullstack` —
«Фронт + бэк», `team` — «Инструменты команды». Подписи сторон: «фронт», «бэк», «devops», «команда».

### 4.4. Проверки при сборке

> Подтреки (`part_of`) и вложенные подзадачи — [`2026-10-09-subtracks-design.md`](./2026-10-09-subtracks-design.md).

Нарушение — исключение с текстом `<путь от site/>: <поле> — <что не так>`, сборка падает. Проверки:

1. `title`, `area`, `do` есть; `do` не пустой.
2. `area` и каждая сторона в `do` — из списков раздела 4.3.
3. Каждый логин из `do` и `help` есть в `PEOPLE`; один логин не стоит и в `do`, и в `help`. *(`help` заменено на `mentors`, см. `2026-10-09-mentors-design.md`.)*
4. У трека с `area: fullstack` в `do` есть сторона `front` и сторона `back`.
5. `related[].track` — существующий трек того же модуля, не сам трек; `why` — непустая строка.
6. `id` трека — по шаблону раздела 4.3; каталог модуля — `YYYY-MM`.
7. В `PEOPLE` логины уникальны, `area` — из списка раздела 4.3.

### 4.5. Наполнение модуля 2026-10

Только frontmatter, без текста. `help` — менторы, помогающие треку (теперь поле `mentors`, см. `2026-10-09-mentors-design.md`); поле `side` у исполнителей —
в скобках.

| id | title (label) | area | do | help | subtasks |
|---|---|---|---|---|---|
| `react` | React | front | ManInTheCoat (front) | YarikMix | refs; Поддержка SVG; Portal API; Вынос фронтовых библиотек в монорепу и автопубликация в npm через release-phase |
| `monaco` | Monaco editor | front | ManInTheCoat (front) | | |
| `adaptive` | Адаптивность | front | ManInTheCoat (front) | | |
| `offline` | Офлайн-режим | front | ManInTheCoat (front) | | |
| `pwa` | PWA | front | ManInTheCoat (front) | | |
| `lighthouse` | Lighthouse — аудит от Google (Lighthouse) | front | ManInTheCoat (front) | | |
| `profile` | Профиль пользователя | fullstack | ManInTheCoat (front), GrayMouse9 (back) | | |
| `file-search` | Поиск по файлу | fullstack | ManInTheCoat (front), MrDuckVC (back) | | |
| `bff` | BFF | fullstack | iRedTea (front), MrDuckVC (back) | | tRPC; Turborepo + bun workspaces; Orval |
| `notebook-vps` | Автоподнятие VPS под каждый новый блокнот (Авто-VPS под блокнот) | devops | iRedTea (devops) | blackHATred | |
| `multibranch` | Multi-branch деплой фронта и стейджинг бэка через Coolify (Multi-branch + стейджинг (Coolify)) | devops | iRedTea (devops) | YarikMix, blackHATred | |
| `xss` | XSS | front | iRedTea (front) | | |
| `2fa` | 2FA | fullstack | iRedTea (front), GrayMouse9 (back) | | |
| `file-exec` | Исполнение файлов | fullstack | iRedTea (front), GrayMouse9 (back) | | |
| `backend-refactor` | Рефакторинг репозитория бэка (Рефакторинг репы бэка) | back | MrDuckVC (back) | blackHATred | |
| `backend-cicd` | Доработки CI/CD бэка | devops | MrDuckVC (devops) | | Откаты |
| `ai-review` | Автоматизированное ИИ-код-ревью (ИИ-код-ревью) | team | YarikMix (team) | | Код-ревью PR; Тестирование агентами на стенде через Stagehand |
| `apidog-alerts` | Алерты в Apidog | team | YarikMix (team) | | |
| `telegram-alerts` | Telegram-алерты: с GitHub Actions на GitHub webhooks (Telegram-алерты через webhooks) | team | YarikMix (team) | | |

Подзадачи BFF — со стороны фронта (Денис); это пишется в тексте страницы трека одной строкой.
`related` пустой у всех треков.

## 5. Устройство

### 5.1. Модули кода

| Файл | Отвечает за | Зависит от |
|---|---|---|
| `site/modules/people.ts` | список людей (раздел 4.1) | — |
| `site/.vitepress/modules.ts` | чистые функции: frontmatter → `Track`, проверки 4.4, узлы и рёбра графа, фильтр, query-строка ↔ фильтр, нагрузка людей | `people.ts` |
| `site/.vitepress/modules-read.ts` | Node: обходит `site/modules/*/`, читает `index.md` и `tracks/*.md` через `gray-matter`, вызывает `modules.ts`; отдаёт `Module[]` | `modules.ts`, `gray-matter` |
| `site/modules/modules.data.ts` | загрузчик данных VitePress: `watch` — `./*/index.md`, `./*/tracks/*.md`; `load` — `readModules()` | `modules-read.ts` |
| `site/.vitepress/config.mts` | пункт меню «Модули» → `/modules/`; `sidebar['/modules/']` из `readModules()`: модуль → «Граф» и треки по `title` | `modules-read.ts` |
| `theme/components/ModuleGraph.vue` | граф (`<ClientOnly>`), панель фильтров, карточка узла; под графом — `TrackList` | данные загрузчика, `modules.ts` |
| `theme/components/TrackList.vue` | треки модуля текстом по направлениям: название-ссылка, исполнители со стороной, помощники; рендерится при сборке | данные загрузчика |
| `theme/components/TrackMeta.vue` | шапка страницы трека: направление, исполнители, помощники, подзадачи, связи, ссылка «На графе модуля»; плашка «Описание ещё не написано», если текста нет | данные загрузчика |
| `theme/components/ModuleList.vue` | архив: модули от новых к старым — название, период, число треков и людей | данные загрузчика |
| `site/modules/index.md` | страница архива: `<ModuleList />` | — |
| `theme/index.ts` | регистрирует компоненты; `Layout` с `TrackMeta` в слоте `doc-before` на страницах `modules/*/tracks/*` | — |
| `theme/custom.css` | токены цветов направлений для светлой темы и `.dark` | — |

Чтение файлов вынесено в `modules-read.ts`, потому что оно нужно двоим — загрузчику и `config.mts`
(меню строится до загрузчиков). Встроенный `createContentLoader` для этого не подходит: в конфиге
его нет.

`force-graph` и `gray-matter` — точные версии в `devDependencies` и `bun.lock`; версия выбирается
при написании плана среди опубликованных не меньше двух недель назад (`gray-matter` сейчас приходит
только транзитивно от VitePress).
`tsconfig.json` `include` расширяется на `site/.vitepress/**/*.ts` и `site/modules/**/*.ts`.

### 5.2. Граф

> Подтреки (`part_of`) и вложенные подзадачи — [`2026-10-09-subtracks-design.md`](./2026-10-09-subtracks-design.md).

`ModuleGraph` берёт модуль по пути страницы (`modules/<YYYY-MM>/`). Внутри `<ClientOnly>`
`force-graph` грузится через `import()` в `onMounted`: библиотека обращается к `window` и не
переживает рендер при сборке.

Узлы — люди, треки, подзадачи; рёбра — «делает» (сплошное), «помогает» (пунктир; теперь «ментор», см. `2026-10-09-mentors-design.md`), «часть» (трек →
подзадача), «связано» (`related`, точки). Цвет узла трека и подзадачи — направление трека; узел
человека — нейтральный (`--vp-c-text-2`), чтобы человек не читался как трек; ментор — с кольцом. Цвета: `--vp-c-bg`, `--vp-c-text-1`, `--vp-c-text-2`,
`--vp-c-divider`, `--vp-c-brand-1` и пять токенов направлений из `custom.css`; при смене `isDark`
цвета перечитываются.

Поведение — как в прототипе от 08.10:

- наведение подсвечивает узел и соседей (у человека — ещё подзадачи его треков), остальное гаснет;
- клик открывает карточку: у трека — исполнители со стороной, помощники, подзадачи, связи и
  ссылка «Открыть страницу трека»; у человека — что делает, где помогает, с кем работает;
- список людей с полоской нагрузки (треки и помощь); клик — фильтр по человеку, можно несколько;
- фильтр направлений, переключатели «Подзадачи», «Помощь менторов», «Связи между треками»;

> Помощники, «где помогает», «помощь» в нагрузке и переключатель «Помощь менторов» теперь называются
> «Менторы», «Ментор · N», «ментор в N» и «Менторы» — см. `2026-10-09-mentors-design.md` §6.
- поиск по названиям подсвечивает совпадения;
- кнопка «Вписать», `Escape` закрывает карточку, `prefers-reduced-motion` отключает анимацию
  камеры.

Фильтр в адресе: `?people=iRedTea,GrayMouse9&area=devops,fullstack&hide=subtasks,help,related`. *(Слой `help` теперь `mentors`, см. `2026-10-09-mentors-design.md`.)*
Неизвестные значения игнорируются. Фильтр пишется через `history.replaceState`.

### 5.3. Ошибки

- Данные: исключение раздела 4.4 роняет `vitepress build`, `bun run build` и CI.
- Модуль без треков: вместо графа — «В модуле пока нет треков. Добавьте файл в
  `site/modules/<YYYY-MM>/tracks/`».
- `force-graph` не загрузился: на месте графа — «Граф не загрузился, ниже — список треков»;
  `TrackList` есть всегда.

## 6. Проверка

- `bun test` — тесты `modules.ts` в `scripts/modules.test.ts`: разбор frontmatter; каждая проверка
  4.4 — случай, где проходит, и где падает с ожидаемым текстом; узлы и рёбра на модуле из трёх
  треков; фильтры по человеку, направлению, слоям и их сочетаниям; query-строка → фильтр → строка;
  нагрузка людей. Тест `modules-read.ts` на временном каталоге: читает модуль, падает на чужом имени
  каталога.
- `bun run typecheck && bun run test && bun run build` (в Docker) — зелёная; `check-site` проверяет
  ссылки `TrackList` и `ModuleList` на страницы треков и модулей.
- Руками в агентском Chrome на превью ветки `/docs/branches/<slug>/modules/2026-10/`: граф
  появился, наведение и карточка, фильтр по Денису, адрес с фильтром открывает тот же вид, ссылка
  карточки ведёт на страницу трека, шапка трека и плашка, архив `/modules/`; светлая и тёмная тема;
  ширина 375 px. Скриншоты — в PR.
- В PR — ссылка на превью ветки.

## 7. Документация

- `CLAUDE.md`, раздел «Сборка»: модули — `site/modules/`, формат и проверки — эта спека, разделы 4.3
  и 4.4.
- `README.md`: раздел «Модули» — как завести модуль, трек и человека, пример frontmatter.

## 8. Не входит

- Задачи с доски Scrumban, их статусы, спринты и поле «Трек» на доске — спека v2.
- Разбивка по неделям, статусы треков.
- Правка данных из графа, отдельные страницы людей.
- Тексты «Цель / Что сделать / Приёмка» для 19 треков — пишут менторы.
- Вики-ссылки Obsidian (`[[…]]`) в тексте треков.
