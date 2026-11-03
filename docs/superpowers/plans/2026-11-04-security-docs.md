# Безопасность: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Заменить исторический CSRF актуальным разделом «Безопасность» с CSRF, XSS и CSP-заглушкой.

**Architecture:** Четыре Markdown-страницы под `/documentation/security/` используют существующее дерево VitePress. Старый контент удаляется, опубликованные адреса обслуживаются существующим `PAGE_REDIRECTS`. Источники и границы проверки кратко вынесены в конец страниц CSRF/XSS.

**Tech Stack:** VitePress, Markdown, TypeScript, Bun test, существующий Puppeteer browser CLI; без новых зависимостей.

**Spec:** [Согласованная спека](../specs/2026-11-04-security-docs-design.md).

## Global Constraints

- Рабочий каталог: `/home/oleg/2026_H2/docs/.claude/worktrees/security-docs`, ветка `docs/security-docs` от docs/main `5c14f0c9686672d3771f59be31480cacb7d54824`.
- Все новые страницы находятся под `/documentation/security/`; CSP — заголовок и только `TODO`.
- Старые страницы CSRF удаляются, без архивной копии и истории миграции в новом разделе.
- Основной текст объясняет действующие механизмы; SHA, дата, источник и пределы свидетельства не теряются. Чтение main не объявлять проверкой production-сценария.
- Не менять приложение, инфраструктуру, версии пакетов и содержание планов модулей. В модулях исправить только три ссылки на удалённые страницы.
- OpenWiki не редактировать и не перегенерировать. Старая generated wiki обновляется отдельно по команде владельца.
- Согласованы две Mermaid: проверки CSRF и путь пользовательского текста в XSS, по одной на страницу в DiagramSection. Eraser, новые зависимости и общие абстракции не нужны. Сохранить соседние пункты меню и существующие проверки других разделов.
- Пользователь выбрал superpowers:executing-plans: последовательная реализация самим агентом и одно итоговое независимое ревью.

## Review Focus

1. Старые адреса обоих поколений работают и под `/branches/.../`: проверить все шесть переадресаций (задача 2).
2. CSP с одним TODO не имеет правого оглавления: browser CLI не должен требовать H2 на этой странице (задача 2).
3. Поиск не возвращает удалённые страницы: проверить результат поиска CSRF в собранном сайте (задача 2).
4. Строки с HTML и URL не получают обещаний универсальной санации; проверяется именно React 1.7.0 (задача 1).
5. Данные локальных тестов и прочитанного кода не представлены как успешные авторизованные пробы прода (задача 1, редакторская проверка источников).

## Карта файлов

| Файлы | Назначение |
| --- | --- |
| `site/documentation/security/{index,csrf,xss,csp}.md` | Новые канонические страницы |
| `scripts/security-pages.test.ts` | Содержание, источники, ссылки и отсутствие старых страниц после миграции |
| `site/documentation/csrf/{index,scenarios,checks}.md` | Удаляемые страницы |
| `site/.vitepress/config.mts` | Новое поддерево меню |
| `site/documentation/{index,bff}.md` | Резюме и актуальные ссылки |
| `site/modules/2/tracks/bff/{auth,migration}.md`, `site/modules/2/tracks/front-harness/service-context.md` | Только замена ссылок на текущий CSRF |
| `scripts/build-index.ts`, `scripts/build-index.test.ts`, `scripts/build-vitepress.test.ts` | Шесть redirect-адресов и отсутствие конфликтов выходных файлов |
| `scripts/architecture-page.test.ts`, `scripts/bff-pages.test.ts` | Ожидания меню, главной и удаление требования хранить исторический CSRF |
| `scripts/check-readability.ts` | Реальные переходы, меню, поиск, старые адреса |

Фикстуры `check-site.test.ts`, `check-mermaid.test.ts`, `openwiki-check.test.ts`, использующие
строки `security/csrf` как искусственные пути, не требуют переименования: они не читают удаляемые страницы.

### Task 1: Написать актуальные страницы безопасности

**Files:** создать четыре страницы `site/documentation/security/` и `scripts/security-pages.test.ts`.

**Interfaces:** вход — факты и SHA из спеки; выход — маршруты `/documentation/security/`, `/documentation/security/csrf`, `/documentation/security/xss`, `/documentation/security/csp` для задачи 2.

- [x] **1. Подготовить worktree и подтвердить исходное состояние.** Прочитать AGENTS и docs-site; `bun install --frozen-lockfile`, `bun run typecheck`, `bun run test`. Не менять lockfile. Проверить исходное состояние перед дальнейшими правками.
- [x] **2. Добавить проверки страниц и запустить их до создания контента.** В `security-pages.test.ts` читать файлы напрямую, как в `bff-pages.test.ts`. Зафиксировать наличие четырёх страниц, точное тело CSP `# CSP\n\nTODO`, ссылки обзора на три подраздела, ключевые механизмы и полные SHA источников. Команда: `bun test scripts/security-pages.test.ts`; ожидается падение из-за отсутствующих файлов.
- [x] **3. Написать страницы.** Обзор: краткие обязанности браузера/BFF/Go и три ссылки. CSRF: угроза, HttpOnly/Secure/SameSite cookie, `X-CSRF: 1` на всех RPC, строгий Origin для POST, условная проверка Sec-Fetch-Site, отказ `403 csrf_invalid` до Go, серверная граница `X-BFF-Key`/Bearer. Объяснить, почему фиксированный заголовок не секрет и почему HttpOnly не решает CSRF. Не обещать защиту от исполняющегося внутри страницы XSS.
- [x] **4. Дописать XSS и источники.** Объяснить безопасную сериализацию JSON внутри script, `JSON.parse(textContent)`, `createTextNode`/`nodeValue`, фактические места вывода Cell/NotebookCard/ProfileMenu. Go хранит строки как данные; HTML-подобный source не нужно портить санацией. Отдельно указать пределы HTML/URL и то, что Markdown сейчас выводится текстом. CSP-страница остаётся только TODO; если режим CSP упоминается на XSS, назвать его Report-Only, не блокировкой.
- [x] **4а. Добавить две Mermaid.** CSRF: X-CSRF → POST? → Origin → Sec-Fetch-Site → сессия/процедура; каждый отказ ведёт к 403 до Go, GET проходит только обязательную проверку заголовка. XSS: ответ Go → ветви безопасной сериализации bootstrap или RPC JSON → данные клиента → текстовые DOM-узлы. В схеме не приписывать HTML-санацию JSON и не обещать исполнение CSP. Встроить по одной схеме через DiagramSection.
- [x] **5. Проверить факты и границы утверждений.** Перечитать файлы на SHA из спеки через GitHub для точных line-ссылок. Кратко указать дату/результаты существовавших браузерных проб и локальных тестов, не писать дневник. Не выдавать backend/infra main за подтверждённую работающую версию. Любые дополнительные production-пробы фиксировать как новые свидетельства; при отсутствии проверки сохранить обозначенный предел. Не выполнять разрушительных проверок и не заводить данные пользователя без необходимости.
- [x] **6. Проверить содержание.** Дополнить тест проверкой отсутствия реальных IP/секретов, полного SHA в GitHub blob-ссылках, корректного представления HTML в Markdown. Зафиксировать порядок H2 после редакторского выбора заголовков. Для каждой добавленной внутренней ссылки с fragment проверить её наличие и заголовок-цель. Не закреплять тестами случайную пунктуацию текста. `bun test scripts/security-pages.test.ts` → PASS; вручную сверить Review Focus 4–5 с источниками.
- [x] **7. Проверить и зафиксировать этап.** `bun run typecheck`, `bun run test`, `bun run build` (без Docker: `DIAGRAMS_NATIVE=1 bun run build`) → успех. Проверить обе Mermaid через существующий check-mermaid и рендер с визуальным осмотром. Посмотреть собранный текст, включая примеры `</script>`. Коммит: `docs(security): описать текущую защиту CSRF и XSS`. Включить согласованную спеку и этот план, если ещё не закоммичены. Провести ревью по выбранному пользователем способу исполнения; переход к следующему этапу — без паузы по последней явно вызванной инструкции executing-plans.

### Task 2: Заменить старый раздел, навигацию и проверки переходов

**Files:** удалить старые три страницы; изменить остальные файлы карты; дополнить `scripts/security-pages.test.ts`.

**Interfaces:** использовать четыре маршрута задачи 1. Сохранять интерфейс `PAGE_REDIRECTS: readonly { file: string; target: string }[]` и `renderPageRedirect(target: string)`; новый механизм redirects не нужен.

- [ ] **1. Обновить ожидания миграции.** В `architecture-page.test.ts` ожидается родитель «Безопасность» со ссылкой `/documentation/security/`, `collapsed: true`, дети CSRF/XSS/CSP в этом порядке. В `security-pages.test.ts` проверить отсутствие трёх старых Markdown-файлов и ссылок на старые адреса в `site/**/*.md`. Удалить из `bff-pages.test.ts` требование исторической плашки и неиспользуемые `CSRF_PAGES`/`TIP` (проверить все использования). Сохранить проверки свидетельств BFF, не относящиеся к удаляемому разделу.
- [ ] **2. Зафиксировать шесть redirects в тестах.** Три `security/csrf/{index,scenarios,checks}.html` получают цель `../../documentation/security/csrf`; три `documentation/csrf/{index,scenarios,checks}.html` — `../security/csrf`. Обновить exact-list в `build-index.test.ts` и список исключений в `build-vitepress.test.ts`. Проверить через `new URL(target, oldUrl)` и существующий helper выполнения redirect результат `/documentation/security/csrf` под `/` и `/branches/security-docs/`, включая `.html` и сохранение fragment. Команда: `bun test scripts/security-pages.test.ts scripts/architecture-page.test.ts scripts/bff-pages.test.ts scripts/build-index.test.ts scripts/build-vitepress.test.ts`; до реализации ожидается FAIL на старом меню/файлах/redirects.
- [ ] **3. Выполнить миграцию.** Удалить старые страницы, заменить их ветку меню, обновить `PAGE_REDIRECTS`. На главной заменить историческое описание краткой ссылкой на «Безопасность», на BFF — ссылкой на новый CSRF. В трёх перечисленных страницах модулей заменить только URL, не переписывать план. Повторить `rg -n 'documentation/csrf|security/csrf' site scripts`: старые адреса допустимы в redirects, их тестах и независимых фикстурах, но не как актуальные ссылки страниц.
- [ ] **4. Актуализировать browser CLI.** В `checkHierarchy` заменить routes/links/parent/headings на новое дерево, сохранить проверки desktop/mobile, клавиатуры, reload/Back и SPA-переходов. Проверить всех трёх детей; CSP не обязан иметь H2/правое оглавление. В moves проверить все шесть CSRF-адресов, отдельно от сохраняющихся якорей architecture/project-context. Старые fragment CSRF сохраняются механизмом redirect, но не требуют существования удалённых исторических заголовков. Поиск CSRF должен открывать новую страницу и не содержать старые routes. Обновить и прочие реальные обращения к удалённым CSRF-страницам в CLI (включая loading и Mermaid cases), не сокращая покрытие соседних страниц.
- [ ] **5. Прогнать целевые тесты.** Повторить команду шага 2 → PASS; `bun run modules:check` → PASS после замены ссылок модулей.
- [ ] **6. Собрать и проверить корневой сайт.** `bun run typecheck`, `bun run test`, `bun run build` → успех; доступный native fallback тот же. Найти установленный Chrome и запустить `CHROMIUM_PATH='<фактический путь>' bun scripts/check-readability.ts hierarchy scroll loading pages`. Проверить текст, навигацию и поиск, отсутствие старого описания в индексе VitePress. Не считать сохранённую generated OpenWiki обновлённой.
- [ ] **7. Проверить вложенную базу.** Собрать с `SITE_BASE=/branches/security-docs/` и тем же выбранным Docker/native способом; затем `SITE_BASE=/branches/security-docs/ CHROMIUM_PATH='<фактический путь>' bun scripts/check-readability.ts hierarchy scroll loading pages`. Ожидается PASS; ссылки и все шесть redirects остаются в этой базе.
- [ ] **8. Зафиксировать результат этапа.** `git diff --check`, просмотр diff без посторонних изменений. Коммит: `docs(security): заменить исторический CSRF актуальным разделом`. Ревью по выбранному способу исполнения, затем отчёт пользователю о страницах, проверках и отдельно не обновлённой OpenWiki. Перед публикацией/PR следовать соответствующим правилам репозитория; после согласованного слияния проверить успешную Pages-публикацию и реальные адреса.

## Самопроверка плана

- [x] Страницы, содержание, источники и ограничения спеки покрыты задачей 1.
- [x] Удаление истории, меню, входные страницы, ссылки и шесть старых адресов покрыты задачей 2.
- [x] Учтены зависящие от удалённых страниц тесты и browser CLI, включая отсутствие оглавления у TODO.
- [x] Пределы scope сохранены: две согласованные Mermaid, без Eraser, новых зависимостей, правок приложения и регенерации wiki.
- [x] Способ реализации выбран пользователем: superpowers:executing-plans.
