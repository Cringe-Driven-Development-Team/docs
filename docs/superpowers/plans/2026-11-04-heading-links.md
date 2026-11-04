# Якоря заголовков — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Выровнять штатный `#` и по его активации копировать полную ссылку с коротким подтверждением, сохранив навигацию.

**Architecture:** Один компонент темы обслуживает существующие ссылки заголовков через делегированный click, Clipboard API и одну подсказку вне заголовков. CSS исправляет только h2 с обнулённым padding внутри DiagramSection. Markdown-генерация, IDs и роутер VitePress сохраняются.

**Tech Stack:** Vue, VitePress 2.0.0-alpha.21, TypeScript, Clipboard API, Bun test, Puppeteer/Chromium.

**Spec:** `docs/superpowers/specs/2026-11-04-heading-links-design.md` — утверждена пользователем.

## Global Constraints

- `#` слева на уровне первой строки; обычные заголовки с padding не сдвигать.
- Копировать абсолютный штатный `href`, включая текущую страницу, query, базу превью и hash; вручную не собирать slug.
- Сохранять родные URL/прокрутку/историю/фокус; modified/middle clicks и другие ссылки не копируют.
- Успех: «Ссылка скопирована», ошибка: «Не удалось скопировать ссылку», длительность 2 секунды.
- Одно сообщение, без сдвига текста и выхода за окно; статус доступен скринридеру.
- Не менять зависимости, схемы, IDs, оглавление, боковое меню и обычные ссылки.
- Работа: `.claude/worktrees/heading-links`, ветка `fix/heading-links`, база `origin/main` на `5c3adb7`.

## Review Focus

1. Router VitePress уже вызывает preventDefault на window capture — копирование не должно пропускать такую обычную активацию; проверить настоящий click и Enter.
2. Старый Clipboard Promise завершается после нового клика или SPA-перехода — не показывать сообщение от старого действия; проверить управляемые отложенные результаты.
3. Нет Clipboard API либо запись отклонена — ошибка вместо ложного успеха, а hash/scroll работают; проверить оба варианта.
4. Многострочный заголовок и край узкого окна — якорь у первой строки, подсказка полностью видна без изменения геометрии; проверить ширину 390px и обе темы.
5. Hash/history/query и база превью — копировать точный href и не менять историю повторным собственным переходом; проверить Back, query, вложенный base и несколько SPA-переходов.

## Карта файлов

- Create: `site/.vitepress/theme/HeadingLinks.vue` — обработчик активации, асинхронный результат, позиция/таймер подсказки, статус и cleanup.
- Modify: `site/.vitepress/theme/index.ts` — добавить компонент рядом с ArticleLoading в существующем `doc-top`.
- Modify: `site/.vitepress/theme/custom.css` — точечное выравнивание и оформление подсказки токенами темы.
- Modify: `scripts/check-readability.ts` — новая секция `anchors`, реальные браузерные регрессии.
- Modify: `README.md` — описать активацию `#` и команду проверки.

## Task 1: Доработать штатные ссылки заголовков

**Interfaces:**
- Consumes: `.vp-doc a.header-anchor` со штатным href; публичные `useRoute().path/query`; существующий slot `doc-top` и наблюдатели браузерных ошибок.
- Produces: компонент `HeadingLinks.vue` без props; `.heading-link-feedback` для видимой подсказки и отдельный постоянный `role="status" aria-live="polite"` вне заголовков.
- Test entry: `checkHeadingLinks(browser: Browser, url: (path: string) => string): Promise<void>` в существующем harness; секция `anchors` доступна отдельно и в полном прогоне.
- Межзадачных интерфейсов нет: задача одна, включает полный пользовательский результат.

- [ ] **1. Написать браузерные регрессии до реализации.**

Включить `anchors` в allowlist/dispatch harness, используя существующий `observe` с начала загрузки. Тестовые страницы — `modules/2/tracks/offline/caching-strategies` (DiagramSection) и `modules/2/tracks/offline/theory` (обычный h2); эти страницы не требуют загрузки внешнего Figma iframe.

`alignmentAndCopy`: 390/2560px × light/dark, обычный и первый h2 в DiagramSection. Дождаться реального SVG/готовности статьи; навести на заголовок и проверить выравнивание верхней границы line box якоря с первой строкой заголовка, учитывая padding/border, допуск 1px. Для переноса ограничить ширину существующего заголовка с пробелами и убедиться, что строк несколько, а якорь остался у первой.

Выдать тестовому context разрешения чтения/записи clipboard через API установленного Puppeteer, активировать страницу и проверить настоящий буфер, не подменяя успешную запись:

```ts
const expected = await page.$eval('h2 .header-anchor', a => (a as HTMLAnchorElement).href);
await page.click('h2 .header-anchor');
assert.equal(await page.evaluate(() => navigator.clipboard.readText()), expected);
assert.equal(new URL(page.url()).hash, new URL(expected).hash);
assert.equal(await page.$eval('.heading-link-feedback', node => node.textContent), 'Ссылка скопирована');
```

`keyboardAndNavigation`: Enter, настоящий hash/scroll/focus, Back, URL с query, SPA туда/обратно. Обернуть реальную запись счётчиком, сохранив оригинал: одна запись на одну активацию после повторных переходов. TOC, обычная ссылка, заголовок вне `#`, modified/middle clicks не увеличивают счётчик; как минимум один настоящий Ctrl-click открывает штатную новую вкладку без копирования.

`feedbackLifecycle`: одна подсказка, исчезает после 2 секунд, повторный клик обновляет срок; сообщение/tooltip не меняют размеры заголовка и текст оглавления. Прямоугольник подсказки внутри viewport; semantic live status присутствует, tooltip не забирает фокус. Для denied/missing API и отложенных/out-of-order результатов подменять только эту внешнюю границу: запрет записи сохраняет hash/scroll и показывает ошибку, поздний результат прошлого клика/страницы не возвращает старое сообщение. Не ослаблять глобальные error-наблюдатели.

- [ ] **2. Получить исходный браузерный RED.**

После настройки существующих зависимостей собрать только VitePress для исходного состояния; выбранным страницам не нужны raw-HTML Eraser. Это диагностическая сборка, не итоговая проверка всего dist.

Run: `bun run site:vitepress`.
Expected: успешная сборка страниц без продуктовых изменений.

Run: `CHROMIUM_PATH=/usr/bin/google-chrome bun scripts/check-readability.ts anchors` с логом в workspace плана.
Expected: FAIL нового требования выравнивания/копирования, по реальной причине. Не заменять проверку буфера имитацией успешного Clipboard API.

- [ ] **3. Реализовать `HeadingLinks.vue` и подключить его.**

На mounted добавить один делегированный обработчик click; до unmount удалить его, таймер и слушатели scroll/resize. Фильтровать только штатные якоря внутри `.vp-doc`, левую кнопку без Ctrl/Meta/Shift/Alt; Enter/касание используют обычный click. Не проверять `defaultPrevented` как запрет копирования: VitePress router уже выставляет его на window capture. Не вызывать собственные preventDefault/stopPropagation/router.go.

Запускать `navigator.clipboard.writeText(anchor.href)` в пользовательском действии, обрабатывать отсутствие API и rejection. Номер последнего действия/сброс на route path/query и unmount защищают от старых Promise; собственное изменение hash подтверждение не сбрасывает.

Видимую подсказку вывести вне заголовков через Teleport; отдельный постоянный live status сообщает результат. После обновления DOM измерить подсказку и поставить рядом с актуальным прямоугольником якоря; ограничить координаты viewport с отступом 8px. Пока сообщение активно, scroll/resize обновляют позицию. Таймер 2000ms; сообщение не получает фокус и не перехватывает указатель. Использовать токены существующей темы.

В `index.ts` slot `doc-top` возвращает оба компонента, сохраняя ArticleLoading. В CSS добавить правило для `.diagram-section__text > h2:first-child .header-anchor` с `top: 0`; не переопределять все h2 глобально. README обновить по итоговому поведению.

- [ ] **4. Проверить GREEN, типы и сборку.**

Run: `bun run typecheck && bun run modules:check && bun run test`.
Expected: PASS всего существующего набора. Отдельных unit-тестов на текст CSS/шаблона или DOM-моков не добавлять: новый контракт проверяется реальным браузером.

Run: `DIAGRAMS_NATIVE=1 CHROMIUM_PATH=/usr/bin/google-chrome bun run build`.
Expected: build/site:check PASS, без потери существующих схем/страниц.

Run: `CHROMIUM_PATH=/usr/bin/google-chrome bun scripts/check-readability.ts anchors scroll loading`.
Expected: PASS нового контракта, существующих hash/history/focus и готовности статьи. Осмотреть скриншоты выравнивания и успеха/ошибки на широком/узком экранах.

- [ ] **5. Проверить вложенный base без повторного рендера неизменённых схем.**

После корневого full build сохранить root-артефакты; переcобрать страницы для вложенной базы, используя уже отрисованные HTML/PNG:

Run: `SITE_BASE=/branches/heading-links/ bun run site:vitepress`.
Expected: PASS; `build-vitepress.ts` перезаписывает только свои прошлые файлы, размеры и raw-HTML/PNG схем сохранены.

Run: `SITE_BASE=/branches/heading-links/ CHROMIUM_PATH=/usr/bin/google-chrome bun scripts/check-readability.ts anchors`.
Expected: PASS с настоящими скопированными URL, начинающимися с origin + `/branches/heading-links/`, русским hash и query; прямой переход/SPA/история сохраняются. Не запускать несвязанный полный Mermaid/Figma обход.

- [ ] **6. Зафиксировать результат задачи.**

Run: `git diff --check`, затем `git add site/.vitepress/theme/HeadingLinks.vue site/.vitepress/theme/index.ts site/.vitepress/theme/custom.css scripts/check-readability.ts README.md` и commit `feat(якоря): выровнять ссылки и добавить копирование`.
Expected: diff-check чистый, commit успешен; журнал содержит фактический RED→GREEN и результаты проверок. Финальный task-done запускает полную `bun run test`.

## Завершение

- [ ] Ревью и один проход исправлений по выбранному пользователем способу выполнения; не сливать PR без поручения.
- [ ] Проверить актуальный main/конфликты; сохранить изменения соседних задач, если потребуется интеграция, и перепроверить затронутый контракт.
- [ ] Открыть PR в main с разделами «Что», «Решения», «Проверка», ссылкой на превью `fix-heading-links`.
- [ ] Дождаться обязательных CI и реальной Pages-публикации; сверить SHA и проверить на превью выравнивание, реальный clipboard, hash/scroll и подсказку.
- [ ] Передать PR/превью и ограничения платформенных проверок.

Самопроверка: вся утверждённая спека покрыта задачей 1; сигнатуры и селекторы согласованы; каждый Review Focus имеет регрессию. Реализация ещё не начата.
