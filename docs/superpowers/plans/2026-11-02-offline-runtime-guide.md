# Офлайн-режим: актуальная документация — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Способ выполнения пользователь выбирает до начала реализации.

**Goal:** Опубликовать две связанные страницы о хранении SW, кешах, Workbox, сборке и регистрации реализованного офлайн-режима, сохранив второй модуль как историю.

**Architecture:** Новая документация находится в `site/documentation/offline/`; объяснение браузерных механизмов предшествует устройству Cellestial. Шесть Mermaid-схем показывают хранение, зависимости, сборку и выполнение. Учебные страницы сохраняются по прежним адресам и получают только плашки со ссылками на актуальный раздел.

**Tech Stack:** Markdown, VitePress, Mermaid, существующий `vitepress-mermaid-renderer`, Bun tests, browser CLI `scripts/check-readability.ts`.

**Spec:** `docs/superpowers/specs/2026-11-02-offline-runtime-guide-design.md` — утверждена пользователем.

## Global Constraints

- Работа: `/home/oleg/2026_H2/docs/.claude/worktrees/offline-runtime-guide`, ветка `docs/offline-runtime-guide`, база `9c3ce42bcbf040bdf93932e9f2f5ef4941ca6fa5`.
- Прочитать `AGENTS.md`, `.agents/skills/docs-site/SKILL.md` и доступный скилл `mermaid-diagram` до написания схем.
- Две новые страницы: `/documentation/offline/` и `/documentation/offline/build-and-registration`.
- Шесть схем из спеки, таблицы сравнений и короткие поясняющие фрагменты; полного готового конфига и кода SW нет.
- Публичный репозиторий: без реальных IP, CIDR, ключей, cookie, токенов и внутренних адресов.
- Утверждения о коде — ссылки на строки конкретного SHA. Продовые наблюдения — дата/время с часовым поясом, фактический SHA и сценарий; исходники и CI не заменяют проверку поведения.
- Исходная проверенная реализация: frontend `e3b327f58f8ef929afe0403ed7c7487abba2c48d`. Перед свидетельством проверить SHA текущего выпуска и при изменении повторно прочитать соответствующий код.
- Старые страницы, задания, frontmatter, якоря и схемы модуля не переписывать. Редактируется только новая плашка после H1.
- Не изменять тему, renderer Mermaid, frontend, инфраструктуру, OpenWiki и процессы выкладки.
- Перед каждым коммитом выполнить обязательные проверки репозитория. Не обходить хуки.
- PR — в `main`, с разделами «Что», «Решения», «Проверка» и ссылкой на превью. Мерж — по отдельному поручению.

## Review Focus

1. `Disable cache` не описывается как удаление SW/Cache Storage; сохранённый SW не считается постоянно работающим потоком. Проверяется задачей 1: текстовый контракт и схема двух состояний.
2. Граф npm-зависимостей не обещает включение всех пакетов в браузерный бандл; `workbox-window` клиента не назван devDependency. Проверяется задачей 2: таблица сред и явные пометки графа.
3. `virtual:pwa-register` не представлен сетевым URL, а конфигурация Workbox не передаётся регистратору в рантайме. Проверяется задачей 2: две ветви сборки и последовательность регистрации.
4. Плашки модуля сохраняют прежние адреса и учебные ограничения; страницы работают и во вложенной базе превью. Проверяется задачей 3: существующие тесты, новые переходы, собранный HTML и browser CLI.
5. Mermaid вне первого экрана действительно отрисовывается в обеих темах и на мобильной ширине; прежняя проверка BFF не получает новую дату. Проверяется задачами 1 и 3: область свидетельства и целевой обход всех шести схем.

## Карта файлов

| Файл | Назначение |
| --- | --- |
| `site/documentation/offline/index.md` | Хранение SW, кеши, DevTools, политика Cellestial, проверенный прод |
| `site/documentation/offline/build-and-registration.md` | Workbox, зависимости, виртуальный модуль, путь от конфига к `/sw.js` |
| `scripts/offline-runtime-pages.test.ts` | Контракт первой страницы |
| `scripts/offline-build-registration-pages.test.ts` | Контракт второй страницы и её схем |
| `scripts/offline-navigation.test.ts` | Меню, взаимные ссылки, входная страница и плашки модуля |
| `site/.vitepress/config.mts` | Один родительский пункт и один дочерний пункт существующей documentationSidebar |
| `site/documentation/index.md` | Краткое резюме офлайн-режима и ссылка на подробности |
| `site/modules/2/tracks/offline.md` и пять существующих подстраниц | Только плашки «Сделано» |

Вспомогательные функции чтения Markdown остаются локальными тестам по образцу `scripts/offline-pages.test.ts`; отдельная библиотека для них не создаётся.

## Подготовка после выбора способа выполнения

- [ ] Продолжить в существующем worktree; не создавать второй и не включать чужие изменения.
- [ ] Выполнить `bun install --frozen-lockfile`, проверить базу через `bun run typecheck && bun run test && bun run modules:check && bun run build`. Существующие 16 тестов офлайн-трека уже прошли при подготовке спеки; это не заменяет полный baseline после установки актуальных зависимостей.
- [ ] После успешных проверок отдельно закоммитить утверждённую спеку и план: `docs(offline): зафиксировать структуру актуальной документации`. Только затем переходить к страницам; это позволяет исполнителям задач коммитить собственные файлы, не захватывая подготовленные документы.

---

### Task 1: Устройство офлайн-режима и браузерное хранение

**Files:**
- Create: `site/documentation/offline/index.md`
- Create: `scripts/offline-runtime-pages.test.ts`

**Interfaces:**
- Consumes: утверждённая спека; публичные источники браузерных механизмов; код и наблюдения frontend на фактическом SHA.
- Produces: самостоятельная страница `/documentation/offline/` с H1 «Офлайн-режим», тремя схемами и собственным свидетельством проверки. Ссылку на будущую вторую страницу пока не добавлять, чтобы промежуточная сборка не имела битых ссылок.

- [x] **Step 1: Сверить источники и зафиксировать продовое свидетельство.**

  Получить HTML с `Accept: text/html`, SHA из `<meta name="release">`, ответы `/sw.js`, `/offline.html` и манифеста. Зафиксировать время через часы инструмента и указать UTC+3. Прочитать исходники на этом SHA через GitHub API с нумерацией строк: `apps/bff/src/public.ts`, `apps/bff/src/app.ts`, `apps/client/src/stores/connection.ts`, `apps/client/public/offline.html` и файлы регистрации из задачи 2.

  В чистом Chrome повторить гостевой сценарий: активная регистрация `/sw.js`, scope `/`, controller страницы, список URL Cache Storage, отказ сети для страницы **и контекста SW**, навигация на `/login`, восстановление сети и «Повторить». Не останавливать продовые серверы и не использовать реальные учётные данные. Для утверждения об установленном окне нужен отдельный прогон через нативный Install с `userChoice.outcome === 'accepted'` и `matchMedia('(display-mode: standalone)').matches === true`; если он не выполнен, явно оставить установку непроверенной. Сохранять только обезличенные результаты, без сессионных значений.

  Первичные источники: Chromium `docs/security/service-worker-security-faq.md`, MDN Service Worker API/Cache API, Chrome DevTools Network reference и описание жизненного цикла SW. Общие браузерные свойства не выдавать за измерения нашего профиля.

- [x] **Step 2: Написать контракт страницы.**

  В `scripts/offline-runtime-pages.test.ts` через `bun:test` и `readFileSync` добавить тесты:
  - frontmatter и H1; порядок H2: «Где хранится Service Worker», «Три механизма хранения», «Disable cache и обновление SW», «Как работает Cellestial», «Проверка на проде», «Границы проверки»;
  - таблица различает `HTTP-кеш`, `Установленный Service Worker`, `Cache Storage`; схема различает сохранённую регистрацию и работающий контекст;
  - политика включает `offline.html`, `manifest.webmanifest`, персональный HTML, RPC и ассеты SPA; личные ответы не сохраняются в Cache Storage;
  - есть `Disable cache`, `Update on reload`, объяснение Request/Response и независимости HTTP-кеша от Cache Storage;
  - в свидетельстве присутствуют фактический полный SHA, дата, часовой пояс и явные непроверенные сценарии;
  - ровно три Mermaid-блока по содержанию спеки, без готового кода SW и чувствительных значений.

  Образец одного утверждения:

  ```ts
  const md = readFileSync('site/documentation/offline/index.md', 'utf8');
  expect(md).toContain('Cache Storage');
  expect(md).toContain('Disable cache');
  expect(md).toContain('manifest.webmanifest');
  ```

- [x] **Step 3: Проверить красный результат.**

  Run: `bun test scripts/offline-runtime-pages.test.ts`.
  Expected: тесты падают из-за отсутствующей страницы. Не считать ошибку установки зависимостей подтверждением красного теста.

- [x] **Step 4: Написать страницу и три схемы.**

  Сначала краткий ответ и граница подтверждённого. Общая теория — с первичными источниками; Cellestial — со ссылками на код SHA выпуска. Схемы: три хранилища; сохранённый SW и запускаемый по событиям контекст; навигация NetworkOnly с офлайн-подстановкой только при сетевом отказе. Не приравнивать HTTP 503 к отказу сети. Сохранность данных браузера не обещать бессрочной.

- [x] **Step 5: Проверить и зафиксировать часть.**

  Run: `bun test scripts/offline-runtime-pages.test.ts scripts/offline-pages.test.ts`.
  Expected: новая страница и прежние 16 тестов учебного трека проходят.
  Перед коммитом: `bun run typecheck && bun run test && bun run modules:check && bun run build`.
  Commit: `docs(offline): описать хранение SW и проверенный офлайн-режим`.

### Task 2: Workbox, виртуальный модуль и связь через `/sw.js`

**Files:**
- Create: `site/documentation/offline/build-and-registration.md`
- Create: `scripts/offline-build-registration-pages.test.ts`

**Interfaces:**
- Consumes: адрес первой страницы из задачи 1; тот же фактический SHA для согласованного описания кода.
- Produces: `/documentation/offline/build-and-registration`, H1 «Сборка и регистрация SW», три схемы; ссылка на обзор `/documentation/offline/` без якоря.

- [x] **Step 1: Подтвердить пути, версии и связи пакетов.**

  На SHA выпуска прочитать `apps/client/src/serviceWorker.ts`, `apps/client/src/main.tsx`, `apps/client/vite.config.prod.ts`, `apps/client/vite/shared.ts`, `apps/client/vite/plugins.ts`, `apps/client/package.json` и соответствующие записи `bun.lock`.

  Проверить package.json опубликованных версий `vite-plugin-pwa`, `workbox-build`, `workbox-window` и использованных модулей Workbox. Для исходного проверенного выпуска это `vite-plugin-pwa@2.0.0` и Workbox `7.4.1`; не переносить значения на другой SHA без сверки. Объяснение виртуального модуля сверить с реализацией `resolveId`/`load` и регистратора в соответствующей версии плагина, а генерацию — с документацией `generateSW`.

- [x] **Step 2: Написать контракт второй страницы.**

  В `scripts/offline-build-registration-pages.test.ts` проверить:
  - порядок H2: «Семейство Workbox», «Прямые и транзитивные зависимости», «Что делает vite-plugin-pwa», «Виртуальный модуль регистрации», «Как связаны сборка и регистрация», «Где настроен SW в Cellestial», «Что выполняется в браузере»;
  - таблица пакетов отличает сборку, страницу и SW; включает `workbox-build`, `workbox-window`, `workbox-core`, `workbox-routing`, `workbox-strategies`, `workbox-precaching`;
  - граф npm-зависимостей содержит клиент → `workbox-window`, клиент → `vite-plugin-pwa`, плагин → build/window, build → модули Workbox; группы остальных установленных пакетов явно помечены как сокращение;
  - текст объясняет `dependencies`, `devDependencies`, `bun.lock` и то, что все установленные пакеты не становятся браузерным бандлом;
  - есть импорт `registerSW` из `virtual:pwa-register`, реальные пути конфигов и связь через `/sw.js`;
  - три схемы: зависимости, две ветви сборки, регистрация/precache; в последовательности browser/BFF/Cache Storage представлены раздельно;
  - нет полного `VitePWA({...})` или реализации SW, публичные ссылки на код закреплены SHA.

- [x] **Step 3: Проверить красный результат.**

  Run: `bun test scripts/offline-build-registration-pages.test.ts`.
  Expected: отсутствие страницы, не ошибка окружения.

- [x] **Step 4: Написать страницу.**

  Граф зависимостей описывает установку npm-пакетов; схемы сборки и выполнения отдельно показывают состав браузерного кода. Не называть зависимости самого плагина devDependencies проекта. Минимальный фрагмент импорта и таблица ключей заменяют полный готовый конфиг.

  В двух ветвях сборки `workbox` через `workbox-build` создаёт `dist/sw.js`, а виртуальный модуль создаёт регистратор в SPA. В рантайме `registerSW` использует `workbox-window` и браузерный API; браузер получает SW с BFF, а SW сохраняет офлайн-комплект в Cache Storage. `inlineWorkboxRuntime` относится к коду внутри SW, а не к запрету отдельного чанка `workbox-window` на странице.

- [x] **Step 5: Проверить и зафиксировать часть.**

  Run: `bun test scripts/offline-build-registration-pages.test.ts scripts/offline-runtime-pages.test.ts scripts/offline-pages.test.ts`.
  Expected: обе страницы и исторический материал проходят проверки.
  Перед коммитом: `bun run typecheck && bun run test && bun run modules:check && bun run build`.
  Commit: `docs(offline): связать Workbox сборку и регистрацию SW`.

### Task 3: Навигация, учебная история и проверка собранного сайта

**Files:**
- Modify: `site/.vitepress/config.mts`
- Modify: `site/documentation/index.md`
- Modify: `site/documentation/offline/index.md`
- Modify: `site/modules/2/tracks/offline.md`
- Modify: `site/modules/2/tracks/offline/theory.md`
- Modify: `site/modules/2/tracks/offline/caching-strategies.md`
- Modify: `site/modules/2/tracks/offline/architecture.md`
- Modify: `site/modules/2/tracks/offline/deployment.md`
- Modify: `site/modules/2/tracks/offline/checks.md`
- Create: `scripts/offline-navigation.test.ts`

**Interfaces:**
- Consumes: обе страницы и их адреса из задач 1–2.
- Produces: вложенный пункт меню, взаимные ссылки, вход с обзорной страницы и шести страниц модуля, готовый проверенный раздел.

- [ ] **Step 1: Написать тесты навигации и истории.**

  Проверить в `scripts/offline-navigation.test.ts`: наличие двух адресов в существующей `documentationSidebar`; ровно один родитель «Офлайн-режим» со ссылкой и дочерней ссылкой «Сборка и регистрация SW»; взаимные ссылки страниц; ссылку входной документации; плашку `::: info Сделано` сразу после H1 каждого из шести файлов модуля с двумя ссылками.

  Историю проверяют прежние тесты `scripts/offline-pages.test.ts` и сравнение diff: меняется только вставленный блок плашки. Не менять `pages` frontmatter. Новые внутренние ссылки использовать без якорей; если они понадобятся, добавить пары ссылка/заголовок в тест согласно `docs-site`.

- [ ] **Step 2: Убедиться, что тесты падают до изменений.**

  Run: `bun test scripts/offline-navigation.test.ts`.
  Expected: отсутствующие ссылки/плашки/пункт меню.

- [ ] **Step 3: Добавить навигацию и плашки.**

  Родитель меню имеет `text`, `link`, `collapsed` и `items` одного ребёнка. В документации-входе добавить небольшое резюме со ссылкой; дату прежней проверки BFF не менять. В шести файлах модуля добавить одинаковый видимый блок со ссылками на обзор и сборку/регистрацию. Исторические формулировки ниже плашки сохранить буквально.

- [ ] **Step 4: Выполнить обязательные проверки.**

  Run: `bun test scripts/offline-navigation.test.ts scripts/offline-runtime-pages.test.ts scripts/offline-build-registration-pages.test.ts scripts/offline-pages.test.ts`.
  Затем: `bun run typecheck && bun run test && bun run modules:check && bun run build`.
  Expected: ноль ошибок Markdown/ссылок/Mermaid/типов/тестов. Для `bun run build` использовать Docker; `DIAGRAMS_NATIVE=1` — только при недоступности Docker.

- [ ] **Step 5: Проверить страницы в браузере.**

  Run: `CHROMIUM_PATH=/usr/bin/google-chrome bun scripts/check-readability.ts hierarchy scroll pages`.

  Убедиться, что новые страницы входят в обход; существующий CLI может содержать фиксированный список, тогда выполнить дополнительный целевой Puppeteer-прогон без добавления общего фреймворка. Открыть каждый новый URL в dark/light с reload, на ширинах 390 и 1440. Прокрутить к каждому из шести Mermaid-блоков, дождаться SVG и проверить отсутствие ошибки и переполнения страницы. Проверить фактическую тему, а не только значение настройки.

  Проверить переход из модуля на обе страницы и вложенность меню. По общему `SITE_BASE` собрать и проверить также `/branches/docs-offline-runtime-guide/`; готовый `dist` не переиспользовать после смены базы без пересборки. Сохранённую узкую настройку чтения не сбрасывать ради прохождения проверки.

- [ ] **Step 6: Самопроверка и коммит интеграции.**

  Сверить пять пунктов Review Focus и все пункты спеки. Проверить, что ссылки на код используют реальный SHA/строки; вывод об установке окна соответствует фактически выполненному прогону; старые документы не выданы за текущую реализацию.
  Commit: `docs(offline): подключить раздел и сохранить историю второго модуля`.

- [ ] **Step 7: Завершить выбранный процесс ревью и подготовить PR.**

  При SDD — ревью каждой задачи и итоговое ревью ветки; при executing-plans — предусмотренное им итоговое независимое ревью. Замечания исправить и повторить затронутые проверки. До PR ещё раз сверить актуальный diff и статус ветки.

  Заголовок PR: `docs(offline): описать хранение и регистрацию service worker`.
  Описание: «Что», «Решения», «Проверка» и превью `https://docs.cellestial.ru/branches/docs-offline-runtime-guide/documentation/offline/`.
  После push проверить реальный список превью и запуск Pages: одна зелёная job `dispatch` не доказывает публикацию. Ограничение бюджета превью сообщить отдельно от результата локальной сборки. Без поручения не мержить.

## Самопроверка плана

- [x] Обе новые страницы, шесть схем, таблицы и короткие фрагменты покрыты задачами 1–2.
- [x] Свидетельство прода отделено от общих объяснений и исходников; ограничения явно сохраняются.
- [x] Настройки, виртуальный модуль, npm-зависимости и выполнение SW разведены по назначению.
- [x] Все новые адреса и файлы зафиксированы; последовательность задач не создаёт битых промежуточных ссылок.
- [x] Навигация и шесть плашек покрыты задачей 3; историческое содержание не переписывается.
- [x] Тесты, сборка, темы, мобильная ширина, lazy Mermaid и база превью включены в проверки.
- [x] План не меняет код приложения, инфраструктуру, OpenWiki, renderer и правила публикации.

## Состояние передачи

Спека утверждена. Пользователь выбрал `superpowers:executing-plans`; выполнение ведётся по задачам с журналом и итоговым независимым ревью.
