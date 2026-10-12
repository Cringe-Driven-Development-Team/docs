# Правила и скиллы docs для Claude Code и Codex — дизайн

## 1. Зачем

Документацию дальше правят агенты команды, в том числе Codex. Сейчас Codex в репозитории не видит ничего из
правил:

- правила репозитория лежат в `CLAUDE.md`, Codex читает `AGENTS.md`;
- единственный скилл `eraser-diagrams` лежит в `.claude/skills/`, Codex ищет скиллы в `.agents/skills/`.

Кроме того, знание о модулях, треках и страницах сайта — то, на чём агенты ошибались последние дни, — не
записано нигде: ни в `CLAUDE.md`, ни в скиллах.

Цель: любой участник команды, открыв репозиторий в Claude Code или в Codex, получает одни и те же правила и
скиллы без установки чего-либо, и знание о модулях и сайте записано в двух скиллах.

## 2. Решения

1. **Правила — `AGENTS.md` в корне**, основной файл. `CLAUDE.md` — строка `@AGENTS.md` и только то, что
   касается Claude. Так рекомендует документация Claude Code («share one file with other coding tools»):
   импорт вместо симлинка, потому что на Windows симлинк без `core.symlinks` превращается в текстовый файл.
2. **Скиллы — в репозитории, не в маркетплейсе `agent-plugins`.** Они описывают скрипты, тесты и frontmatter
   самого docs и меняются вместе с ними; в маркетплейсе каждая правка была бы вторым PR и версии расходились
   бы. Маркетплейс остаётся для скиллов организации, не привязанных к одному репозиторию (`cdd-tasks`,
   pulumi, ansible). Один скилл не держится в двух местах: Codex показал бы его дважды.
3. **Основное место скиллов — `.agents/skills/<имя>/`** (его читает Codex; agentskills.io называет его
   общим соглашением), **`.claude/skills/<имя>/` — побайтовая копия.** Claude Code `.agents/skills/` не
   читает. Симлинк отвергнут из-за Windows: в команде есть участник на Windows (`CLAUDE.md`, «Окружение:
   Windows»), а сломанный симлинк не даёт никакой ошибки.
4. **Синхронизация — скрипт и тест.** `bun run skills:sync` копирует `.agents/skills/` в `.claude/skills/`
   целиком (лишнее в копии удаляет); `bun run test` падает при расхождении и называет файл и команду.
5. **Два новых скилла, а не один:** `docs-modules` (данные модулей и треков) и `docs-site` (страницы
   сайта). Короткие точные описания: агент грузит нужный, а не оба; длинное описание Codex урезает по
   бюджету списка скиллов.
6. **`eraser-diagrams` переезжает без правок текста**; правка его содержимого — не эта задача.

## 3. Состав

### 3.1. `AGENTS.md`

Весь нынешний `CLAUDE.md` (разделы «Проект», «Что где лежит», «Схемы», «Сборка», «Процесс», «Публичный
репозиторий», «Окружение: Windows») с правками:

- заголовок `# AGENTS.md`;
- новый раздел «Скиллы»: где лежат (`.agents/skills/`, копия в `.claude/skills/`), список трёх скиллов с
  одной строкой «когда брать», правило «правка скилла — только в `.agents/skills/`, затем
  `bun run skills:sync`»;
- в «Сборке» или «Процессе»: данные модулей проверяет `module-graph check` — в Claude Code хуком после
  каждой правки, в остальных агентах — pre-commit lefthook при коммите; перед коммитом прогонять
  `bun run modules:check` самому;
- «Схемы»: путь к скиллу — `.agents/skills/eraser-diagrams/SKILL.md`.

### 3.2. `CLAUDE.md`

```markdown
# CLAUDE.md

@AGENTS.md

## Только для Claude Code

- Хук `.claude/settings.json` после каждой правки запускает `module-graph check`.
- Скиллы вызываются как `/<имя>`; Claude читает их копию в `.claude/skills/`, править — `.agents/skills/`.
```

### 3.3. Синхронизация

- `scripts/skills-sync.ts`: экспорт `syncSkills(from = ".agents/skills", to = ".claude/skills")` и
  `diffSkills(from, to): string[]` (список расхождений: нет файла, лишний файл, другое содержимое); запуск
  без аргументов — копирует.
- `package.json`: `"skills:sync": "bun scripts/skills-sync.ts"`.
- `scripts/skills-sync.test.ts`: `diffSkills()` по реальному репозиторию пуст; сообщение при расхождении
  содержит `bun run skills:sync`; юнит-тесты на временных каталогах (новый файл, лишний файл, изменённый
  файл, вложенная папка).
- `.claude/skills/README.md` — «копия `.agents/skills/`, не править; `bun run skills:sync`». Сам `README.md`
  в `diffSkills` не учитывается.

### 3.4. `docs-modules`

Описание: правка данных модулей и треков в `site/modules/` — frontmatter трека и модуля, подзадачи и их
задачи, подтреки, связи; триггеры: «добавь подзадачу», «прилинкуй задачу», «убери подтрек», «переназначь
трек», ошибка `module-graph check`.

Содержание:

- модуль: `index.md`, `title`, `sprints` (по ним задача доски попадает в модуль);
- трек: `title`, `label`, `area`, `do` (логин → сторона), `mentors`, `part_of` (подтрек, один уровень),
  `subtasks` (строка или `{ title, issues, subtasks }`, вложенные — строка или `{ title, issues }`),
  `issues` (`репо#N`; префикс владельца доски и регистр не важны), `related` (`track`, `why`), `pages`;
- как задача попадает на граф: поле «Трек» на доске — у трека, `issues` — у подзадачи; спринт задачи — по
  `sprints` модуля;
- удаление или слияние трека: ссылки `related` из других треков, `pages`, тест нагрузки людей
  (`modules-data.test.ts`: число треков и `[doing, mentoring]`);
- проверка: `bun run modules:check`, `bun test scripts/modules-data.test.ts`; правка `scripts/modules-data.test.ts`
  вместе с данными;
- чего не делать: менять статусы и спринты задач на доске без просьбы (уведомления в Telegram) — со ссылкой
  на скилл `cdd-tasks`.

### 3.5. `docs-site`

Описание: правка страниц сайта VitePress в `site/` — новые страницы и подстраницы трека, схемы на странице,
переезды и удаления страниц, PR и превью; триггеры: «добавь страницу», «встрой схему», «удали раздел»,
«почему превью нет», текст пропал на собранной странице.

Содержание:

- подстраница трека: `tracks/<id>/<page>.md`, `title` во frontmatter, `pages` трека задаёт порядок;
- схема на странице — `<Diagram name="<имя>" />`; схемы плана модуля — `diagrams/modules/<N>/`;
- ловушки VitePress:
  - `{{ … }}` в тексте вне блоков кода съедает Vue — `<code v-pre>…</code>`;
  - `:$` и `:слово:` внутри HTML-тега становятся эмодзи — двоеточие сущностью `&#58;`;
  - битые якоря сборка не ловит — тест на заголовок-цель;
- тесты страниц: образец `scripts/bff-pages.test.ts` — порядок разделов, ключевые имена, отсутствие
  секретов и IP, якоря ссылок;
- переезд и удаление: `PAGE_REDIRECTS` (`scripts/build-index.ts`), относительные цели; старые якоря индекса
  схем — `LEGACY_FOLDERS` (`site/.vitepress/diagram-names.ts`);
- факты о коде других репозиториев — ссылкой на файл и строку на конкретном SHA, сверка через
  `gh api repos/<репо>/contents/<путь>?ref=<sha>`;
- PR: «Что / Решения / Проверка», ссылка на превью `…/docs/branches/<slug>/`; сборка Pages собирает `main` и
  превью всех живых веток, бюджет 30 минут; влитые ветки удаляются сами; если превью не собралось —
  проверка на проде после мержа.

### 3.6. `eraser-diagrams`

Переезжает: `.claude/skills/eraser-diagrams/SKILL.md` → `.agents/skills/eraser-diagrams/SKILL.md`, копия
обратно в `.claude/skills/` скриптом. Ссылки на путь скилла в `README.md` и `AGENTS.md` — на
`.agents/skills/`.

## 4. Что не входит

- Перенос скиллов в `agent-plugins`; правки `cdd-tasks`.
- Хуки Codex (проверка модулей — pre-commit lefthook).
- Правка текста `eraser-diagrams`.

## 5. Проверка

- `bun run typecheck && bun run test && bun run build`; тест синхронизации зелёный.
- Видимость: свежий `claude -p` и `codex exec` в чистом worktree перечисляют `eraser-diagrams`,
  `docs-modules`, `docs-site`.
- Работа скиллов — отложенные задачи: по три на `docs-modules` и `docs-site`, взятые из реальных случаев
  11–12.10 (привязка задачи к подзадаче, удаление подтрека, шаблон Ansible в тексте страницы и т. п.).
  Каждая — без скилла (RED) и со скиллом (GREEN), в `claude -p` и в `codex exec`, в чистом worktree.
  Список задач и критерии хранятся вне репозитория (рабочая папка исполнения): иначе агент найдёт их в
  `docs/superpowers/` и прочитает ответ. Примеры в тексте скиллов не совпадают с отложенными задачами.
- Прогоны идут в worktree от `main` без этой ветки: эта спека и план содержат ответы (`v-pre`, `issues` у
  подзадачи). RED — `main` как есть; GREEN — тот же `main` плюс только `.agents/skills/` и `.claude/skills/`
  из ветки, без `docs/superpowers/`.

## 6. Проверенные факты

- docs `main` `0158ac6`:
  - `CLAUDE.md` — 69 строк, разделы «Проект», «Что где лежит», «Схемы», «Сборка», «Процесс», «Публичный
    репозиторий», «Окружение: Windows»;
  - `.claude/skills/eraser-diagrams/SKILL.md` — единственный скилл, ~14 КБ; `.agents/` нет;
  - `.claude/settings.json` — хук PostToolUse на `Edit|Write|MultiEdit` запускает `module-graph check --hook`;
  - `lefthook.yml` — pre-commit `modules-check` по `site/modules/**`, `bun run modules:check`;
  - `package.json`: `test` — `bun test`, `typecheck` — `tsc`, `modules:check` — `module-graph check`.
- Claude Code: скиллы — `~/.claude/skills`, `.claude/skills`, плагины; `.agents/skills` не читает; `AGENTS.md`
  читает сам только без `CLAUDE.md`; `@AGENTS.md` в `CLAUDE.md` — рекомендованный способ
  (code.claude.com/docs/en/skills, …/memory).
- Codex: скиллы — `~/.agents/skills`, `<репо>/.agents/skills`; читает `AGENTS.md` (до 32 КиБ); сканирует
  скиллы рекурсивно; один скилл в двух местах показывает дважды (openai/codex#22626)
  (developers.openai.com/codex/skills, learn.chatgpt.com/docs/agent-configuration/agents-md).
- Исследование 12.10.2026: `scratchpad/research-official.md`, `scratchpad/research-community.md` сессии.
