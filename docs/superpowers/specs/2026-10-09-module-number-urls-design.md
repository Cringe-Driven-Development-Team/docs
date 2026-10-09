# Номер модуля в адресе: `/modules/2/` вместо `/modules/2026-10/`

## 1. Цель

Модуль называется «Модуль №2», а в адресе — `2026-10`. Делаем адрес по номеру: `/docs/modules/2/`,
`/docs/modules/2/tracks/bff`. Старые ссылки из чатов и закладок продолжают работать.

Готово, когда:

- каталог модуля — `site/modules/2/`, номер модуля — целое число от 1;
- модули упорядочены по номеру, от новых к старым, и `10` идёт раньше `9`;
- каждая страница старого `/modules/2026-10/…` переадресует на ту же страницу `/modules/2/…` с якорем;
- старые страницы `/bff/…` ведут сразу на `/modules/2/…`, без двойной переадресации.

## 2. Проверенные факты

`main`, коммит `a2577df`.

- `site/.vitepress/modules.ts:79-87`: `MODULE_ID = /^\d{4}-(0[1-9]|1[0-2])$/`, `checkModuleId` с ошибкой
  `<id> — нужен формат YYYY-MM`; вызывается в `parseModule` (`:234`) и `readModules`.
- `site/.vitepress/modules-read.ts:57`: модули сортируются `b.id.localeCompare(a.id)` — для номеров это
  строковое сравнение.
- `site/.vitepress/config.mts:18`: `cleanUrls: true` — страница `tracks/bff.md` открывается как
  `tracks/bff`, GitHub Pages отдаёт `tracks/bff.html`.
- `scripts/build-index.ts:68-98`: `PAGE_REDIRECTS` (три страницы `/bff/` → `../modules/2026-10/tracks/…`,
  цели относительные — работают и в превью веток), `renderPageRedirect` (переадресация с якорем,
  `noindex`, ссылка без JS), `writePageRedirects(dist)`; вызывается из `scripts/build-site.ts:263`.
- Ссылки на `/modules/2026-10/` в тексте сайта: `site/security/csrf/{index,checks,scenarios}.md:4`.
- В задачах организаций `Cringe-Driven-Development-Team` и `frontend-park-mail-ru` поиск
  `modules/2026-10` ничего не находит.
- Доска: задачи раскладываются по модулям через спринты (`board.ts`), а не через id модуля;
  «задача без спринта между модулями — в самый новый» зависит от порядка модулей.
- README: `site/modules/<YYYY-MM>/`, `/docs/modules/<YYYY-MM>/` (`README.md:128-140`).

## 3. Решения

- Номер — имя каталога (`site/modules/2/`). Отдельного поля во frontmatter нет: один источник.
- Заголовок «Модуль №2» остаётся во frontmatter `index.md`, из номера не выводится.
- Переезды модулей — список `MODULE_MOVES = [{ from: "2026-10", to: "2" }]` в `scripts/build-index.ts`.
  Заглушки строятся по собранному `dist/modules/<to>/`: на каждый `.html` — файл с тем же путём под
  `dist/modules/<from>/`. Новая страница трека получает старый адрес сама, список вручную не ведётся.
- Цель заглушки — относительная, без `.html`; `index.html` → каталог (`../2/`, `../../2/tracks/bff/`).
- Старые спеки и планы с `2026-10` не правим: это история.

## 4. Изменения

- `modules.ts`: `MODULE_ID = /^[1-9]\d*$/`; ошибка `modules/<id>: каталог — <id> — нужен номер модуля: 1, 2, 3…`.
- `modules-read.ts`: сортировка `Number(b.id) - Number(a.id)`.
- `build-index.ts`: `MODULE_MOVES`; `moduleRedirects(dist, moves): { file: string; target: string }[]` —
  по файлам `dist/modules/<to>/**/*.html`; `writePageRedirects` пишет и их. `PAGE_REDIRECTS` для `/bff/`
  ведут на `../modules/2/…`.
- `git mv site/modules/2026-10 site/modules/2`.
- Ссылки в `site/security/csrf/*.md` и README — на `2` и `<номер>`.
- Тесты: фикстуры с `2026-10` / `2026-11` → `2` / `3` (даты спринтов `2026-10-12` и т. п. не трогаем).

## 5. Проверка

- Тесты: `checkModuleId` принимает `1`, `2`, `10` и отвергает `0`, `02`, `2026-10`, `drafts`; порядок
  модулей `10, 9, 2`; `moduleRedirects` на временном `dist` — пути и относительные цели для `index.html`,
  страницы трека и подстраницы; `PAGE_REDIRECTS` ведут на `modules/2`.
- `bun run typecheck && bun run test && DIAGRAMS_NATIVE=1 bun run build` — `site ok`.
- Chrome на локальной сборке (сервер как Pages, под `/docs/`): `/docs/modules/2026-10/`,
  `/docs/modules/2026-10/tracks/bff`, `/docs/modules/2026-10/tracks/bff/auth#…` и `/docs/bff/auth`
  попадают на `/docs/modules/2/…` с тем же якорем; граф и меню на `/docs/modules/2/`.

## 6. Не входит

- Номер модуля в настройках будущего пакета `@tp-prepare/vitepress-module-graph` — его спека.
- Правка ссылок в чатах и чужих репозиториях: их закрывают заглушки.
