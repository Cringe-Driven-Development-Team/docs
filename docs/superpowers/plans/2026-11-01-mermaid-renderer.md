# Миграция интерактивных схем Mermaid — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Заменить старый Mermaid-плагин интерактивным renderer, устранить краткую ошибку загрузки и проверить якоря.

**Architecture:** Обычные Mermaid fences VitePress обрабатывает `vitepress-mermaid-renderer` из существующей темы. Штатные компоненты дают масштабирование и fullscreen; существующий browser CLI проверяет весь жизненный цикл. Ожидание Mermaid перед коррекцией якоря изменяется только после воспроизведения проблемы с новым DOM/lazy rendering.

**Tech Stack:** Bun ≥1.3, Node ≥22.22.0, VitePress `2.0.0-alpha.21`, Vue, Mermaid 11, `vitepress-mermaid-renderer` `1.2.3`, Puppeteer.

**Spec:** [Утверждённая спека](../specs/2026-11-01-mermaid-renderer-design.md).

## Global Constraints

- Worktree: `/home/oleg/2026_H2/docs/.claude/worktrees/mermaid-renderer`, ветка `docs/mermaid-renderer`, исходная база `1d5b72e6e3101375663df1c322e21dec93efdc5d`.
- Спека утверждена; пользователь выбрал superpowers:executing-plans.
- Mermaid остаётся на версии 11; `securityLevel: strict`, перенос длинных сообщений сохраняются.
- Штатные увеличение, уменьшение, сброс вида, перемещение и fullscreen; подписи кнопок по-русски. Копирование и скачивание не добавлять.
- Исходники схем, Markdown страниц, данные модулей, маршруты и ID заголовков сохраняются.
- Eraser/Diagram, его iframe и `@panzoom/panzoom`, Tabs, Group Icons, FullWidth и сохранённый узкий режим остаются рабочими.
- Ошибки не скрывать CSS или подавлением ошибок; не добавлять универсальный адаптер или новую панель. Форк разрешён прямым поручением пользователя 2026-11-02 (Task 3).
- Для root и nested base нужны соответствующие сборки. Без Docker — `DIAGRAMS_NATIVE=1`; это не Docker CI.
- PR130 завершён, его задачи не повторять. Новый PR не сливать без поручения; OpenWiki не регенерировать.

## Review Focus

1. Ошибка появилась и исчезла в одном цикле JavaScript: наблюдатель должен сохранить её после удаления узла; отрицательная самопроверка в задаче 1.
2. Reload сбрасывает накопленные в window ошибки и неверно заданную тему: наблюдения переживают навигацию в Node, тема сохраняется в localStorage; проверки в обеих задачах.
3. Непосещённые lazy-блоки остаются исходным кодом: нулевая выборка `.mermaid` не означает готовность; полный обход и якоря в задаче 2.
4. Смена темы или уход со страницы происходят во время render/fullscreen: не должно оставаться старых схем, overlay или отложенного scroll; тест задачи 2.
5. Масштаб/полноэкранный режим на узком экране: кнопки доступны клавиатурой, схема не расширяет документ, выход сохраняет место и настройки чтения; тест задачи 2.

## Файлы и границы

- `scripts/check-readability.ts`: существующий CLI, новая секция `mermaid`, наблюдение временных ошибок, интерактивность, адаптация lazy-обхода и проверок якорей.
- `package.json`, `bun.lock`: замена зависимости; `mermaid` и `@mermaid-js/mermaid-cli` без смены major.
- `site/.vitepress/config.mts`: убрать `withMermaid` и прежний блок `mermaid`, сохранить остальной config.
- `site/.vitepress/theme/index.ts`: инициализация renderer, смена темы, необходимая корректировка существующего `scrollToHashAfterMermaid(): () => void`.
- `site/.vitepress/theme/custom.css`: только Mermaid-правила, соответствующие новому DOM и интерактивному viewport.
- `.agents/skills/docs-site/SKILL.md`, зеркало `.claude/skills/docs-site/SKILL.md`: актуальные правила Mermaid/browser CLI.
- Новые производственные модули и отдельное browser-приложение не нужны; тесты исходных страниц и `scripts/check-mermaid.ts` сохраняются.

## Подготовка после выбора способа

- [x] Прочитать спеку, этот план и AGENTS.md; создать журнал выбранного процесса, отметить стартовый SHA и состояние задач. Старые журналы PR130 не восстанавливать.
- [x] Проверить чистоту относительно известных файлов спеки/плана и свежий origin/main. Чужие worktrees и диагностические артефакты не трогать.
- [x] Выполнить `bun install --frozen-lockfile`, затем baseline `bun run typecheck`, `bun run test`, `bun run modules:check` и `DIAGRAMS_NATIVE=1 bun run build`. Зафиксировать результаты; не выдавать известный browser-баг за новую регрессию.

### Task 1: Проверка кратких ошибок на всей загрузке

**Files:** Modify/Test: `scripts/check-readability.ts`.

**Interfaces:**
- Consumes: существующие `observe(page: Page)`, `Browser`, `Page`, `artifacts`, `label` и `SITE_BASE`.
- Produces: локальный `observeMermaidErrors(page: Page): Promise<MermaidError[]>`, где `MermaidError = { url: string; time: number; message: string; html: string }`; возвращённый массив пополняется на стороне Node через события console, а не хранится только в перезагружаемом window.
- Produces: `checkMermaid(browser: Browser, url: (path: string) => string): Promise<void>` и секцию CLI `mermaid`; после задачи 2 эта же секция проверяет интерактивность.

Именованные browser-кейсы `transientErrorObserver`, `transientErrorSurvivesReload` и
`validDiagramsNeverShowError` закрепляют следующие assertions после доставки событий в Node:

```ts
assert.equal(finalErrorNodes, 0); // тестовый error SVG уже удалён в том же JS task
assert(events.some(event => event.message.includes('Syntax error in text')));
assert(events.length > eventsBeforeReload); // второй маркер после настоящего reload
assert.deepEqual(productErrors, []); // только реальные страницы, без тестовых маркеров
```

- [x] **1. Добавить наблюдатель и отрицательную самопроверку.** Зарегистрировать слушатель до `evaluateOnNewDocument`; MutationObserver видит добавленные/удалённые поддеревья и изменения текста, фиксирует `.error-icon`, `.error-text` и видимое сообщение ошибки renderer. Проверять mutation records, а не только текущий document. В отдельной тестовой странице синхронно добавить/удалить error SVG и убедиться, что ошибка записана при пустом финальном DOM. При реальной перезагрузке этой страницы массив должен сохранить предыдущее событие и поймать новое. Этот тестовый массив не смешивать с ошибками продуктового сценария.
- [x] **2. Проверить чувствительность.** Команда `CHROMIUM_PATH=/opt/google/chrome/chrome bun scripts/check-readability.ts mermaid` сначала подтверждает самопроверку. Временное отключение обработки mutation records должно уронить кейс добавления/удаления; восстановить наблюдатель после проверки. Сломанные схемы в `site/` не добавлять.
- [x] **3. Добавить продуктовый сценарий.** Для `modules/2/tracks/offline/caching-strategies#networkonly` задать `vitepress-theme-appearance` до приложения, проверить действительный dark/light после `goto` и настоящего `page.reload()`. Наблюдать начиная с document-start, дождаться конечных схем, сохранить события и финальное состояние в `artifacts`. Пустые console/page errors не заменяют проверку error DOM.
- [x] **4. Получить RED на текущем плагине.** На root-сборке из baseline запустить `mermaid`: самопроверка PASS, продуктовый сценарий FAIL на кратком error DOM при успешной конечной отрисовке. Сохранить лог и временные метки. Если баг не воспроизвёлся, использовать уже сохранённый диагностический `probe.ts` как указатель сценария, не ослаблять assertion и не утверждать, что RED получен.
- [x] **5. Проверить и зафиксировать тестовый инструмент.** `bun run typecheck`, `bun run test`, `bun run modules:check`, `DIAGRAMS_NATIVE=1 bun run build` проходят; известный RED browser-регрессии фиксируется отдельно как ожидаемый результат до задачи 2. Коммит: `test(mermaid): ловить краткие ошибки при загрузке`. При SDD пройти отдельное ревью задачи перед продолжением.

### Task 2: Интерактивный renderer, lazy-схемы и проверенная навигация

**Files:** Modify: все перечисленные в разделе «Файлы и границы», включая CLI задачи 1.

**Interfaces:**
- Consumes: `observeMermaidErrors(page)` и секцию `mermaid` задачи 1, `useData().isDark` VitePress.
- Uses: `createMermaidRenderer(options)`, `renderer.setToolbar(options)`, штатный CSS `vitepress-mermaid-renderer/css`. Проверить API по установленному пакету `1.2.3`, не придумывать методы отключения lazy rendering.
- Preserves: публичный Theme и сигнатуру `scrollToHashAfterMermaid(): () => void`; новые экспортируемые адаптеры не вводить.

Browser-кейсы `interactiveFlowchartAndSequence`, `lazyDiagramsRenderOnVisit`,
`hashSurvivesLazyLayout` и `fullscreenPreservesReaderState` проверяют результаты действий:

```ts
assert.notEqual(transformAfterZoom, transformBeforeZoom);
assert.notDeepEqual(positionAfterDrag, positionBeforeDrag);
assert.equal(transformAfterReset, initialTransform);
assert.equal(renderedSourceCount, 44);
assert.equal(remainingMermaidCodeBlocks, 0);
assert(headingTop >= navbarBottom - 1 && headingTop < viewportHeight);
assert(documentWidth <= viewportWidth + 1);
assert.equal(fullscreenAfterExit, false);
assert.deepEqual(readerSettingsAfterExit, readerSettingsBefore);
assert(Math.abs(scrollAfterExit - scrollBeforeFullscreen) <= 1);
```

- [x] **1. Добавить проверки требуемой интерактивности, получить RED.** Расширить секцию `mermaid`: у flowchart на caching-strategies и sequence на `modules/2/tracks/bff/auth-scenarios` проверить доступные кнопки, изменение transform при увеличении/уменьшении, возврат после сброса и изменение положения при drag. Fullscreen открывается реальным кликом, закрывается кнопкой и Escape; после выхода место страницы и значения настроек чтения прежние. На старом плагине нет нужных кнопок — проверка падает по этой причине, а не из-за таймаута загрузки ресурсов.
- [x] **2. Заменить интеграцию.** Удалить `vitepress-plugin-mermaid`, добавить точно `vitepress-mermaid-renderer@1.2.3`, обновить lockfile через Bun. Убрать старый wrapper/config; вызвать factory из темы с `static: false`, `startOnLoad: false`, `securityLevel: 'strict'`, `sequence: { wrap: true, useMaxWidth: false }`, `flowchart: { useMaxWidth: false }`, темой `dark/default` по `isDark`. Обновлять singleton при смене темы через штатный API; не инициализировать повторно на каждом render компонента. Подключить CSS до собственных правил. Для fullscreen использовать штатный `dialog`-режим, доступный и на мобильном экране; проверить Escape и фокус. Настроить увеличение, уменьшение, сброс, fullscreen и русские подписи через toolbar API; отключить copy/download. Изменить Mermaid CSS под viewport без ограничения fullscreen; правила Eraser не трогать.
- [x] **3. Проверить загрузку и тему.** Запустить типы, тесты, сборку и секцию `mermaid`; кратких ошибок нет, обе диаграммы интерактивны. Повторить смену темы во время отрисовки, быстрый SPA-уход и переход из fullscreen: корректная конечная тема, без оставшихся overlay и ошибок. Если ранний autorun сохраняется, измерить порядок import/initialize и минимально исправить его в интеграции; не обходить ошибку подавлением или форком. Проверить `site:dev` на CommonJS/hydration errors; `optimizeDeps.include` сохранять, пока проверка не докажет ненужность.
- [x] **4. Адаптировать полный обход схем.** В `checkPages` прокручивать последовательно до исходных Mermaid fences и созданных wrappers, дождаться SVG каждой посещённой схемы; финально ровно 44 исходных блока отрисованы, исходных Mermaid code blocks не осталось, error events пусты, overflow нет. Подключить наблюдатель задачи 1 до навигации также к страницам секций pages/scroll/plugins; перед закрытием проверять накопленные ошибки всех переходов. Ввести локальный helper `visitMermaidDiagrams(page: Page, expected: number): Promise<void>` только в CLI и использовать в существующих ожиданиях, которым действительно нужны все схемы. Не прокручивать страницу таким helper перед проверкой положения якоря. Установить темы через storage, а не один DOM-класс; desktop 2560×1440, mobile 390×844.
- [x] **5. Измерить якоря, получить отдельный RED при дефекте.** Сначала выполнить существующий `scroll` и добавить прямой/reload/SPA/Back на `caching-strategies#networkonly`, якорь ниже схем, быстрый сменившийся переход и намеренную wheel/touch/keyboard-прокрутку. Записать временной ряд `scrollY`, высоты документа и координат заголовка до/после lazy render; viewport height хранить отдельным полем. После стабилизации заголовок виден ниже navbar, ширина сохранена. Если исходный hook не проходит, сохранить RED до его правки.
- [x] **6. При необходимости минимально исправить hook и получить GREEN.** Учитывать ещё не заменённые fences и текущие rendering-контейнеры, ограниченное ожидание и отмену. Не ждать готовности всех offscreen-схем; корректировать якорь по релевантным изменениям layout, затем прекращать наблюдение при стабилизации/отмене/смене URL. Пустой список `.mermaid` не означает готовность при оставшихся fences. Сохранить очистку таймеров/слушателей и приоритет действий читателя. Если измерения не требуют правки, оставить hook и приложить подтверждающий результат.
- [x] **7. Выполнить итоговую локальную проверку.** `bun run typecheck`, `bun run test`, `bun run modules:check`, `DIAGRAMS_NATIVE=1 bun run build`; затем `CHROMIUM_PATH=/opt/google/chrome/chrome bun scripts/check-readability.ts mermaid pages scroll plugins hierarchy`. В интерактивных/якорных кейсах покрыть обе темы и размеры 2560×1440/390×844, fresh FullWidth и сохранённый узкий режим (3), переключение темы и Tab/Enter/Escape; сохранить screenshots и JSON. Кнопки находятся внутри viewport, подписи flowchart/sequence не обрезаны. Существующие plugins/hierarchy подтверждают Eraser, Tabs, Group Icons и обычные ссылки без hover-popup. Не запускать тяжёлую секцию title при отсутствии изменений бренда.
- [x] **8. Проверить nested base соответствующей сборкой.** `SITE_BASE=/branches/docs-mermaid-renderer/ DIAGRAMS_NATIVE=1 bun run build`; затем `SITE_BASE=/branches/docs-mermaid-renderer/ CHROMIUM_PATH=/opt/google/chrome/chrome bun scripts/check-readability.ts mermaid pages scroll plugins hierarchy`. Результат тот же, URL и ресурсы остаются внутри base. Одной смены env у root dist недостаточно. Не устанавливать глобальный Cache-Control header и не вводить подавление ошибок ради CDN/старого favicon.
- [x] **9. Обновить активный guide и зафиксировать.** В `.agents/skills/docs-site/SKILL.md` описать renderer и новую секцию CLI, lazy-обход и document-start наблюдение; использовать writing-skills для правки скилла. Выполнить `bun run skills:sync`, проверить зеркало и установленную копию `/home/oleg/.codex/skills/docs-site/SKILL.md` с сохранением параллельных изменений. Повторить необходимые typecheck/test/modules/build перед коммитом после последней правки; не повторять browser-матрицу, если изменён только текст guide. Обновить журнал, записать покрытие приёмки и оставшиеся ограничения. Коммит: `fix(mermaid): подключить интерактивный renderer`. При SDD пройти отдельное ревью задачи.

### Task 3: Форк renderer и исправление lifecycle (поручение 2026-11-02)

Пользователь разрешил форк после независимого Important finding и уточнил владельца — личный аккаунт YarikMix; исполнение остаётся inline executing-plans. Это завершение оставшегося исправления, задачи 1/2 не повторять.

**Files:** форк `/home/oleg/2026_H2/.mermaid-renderer-worktrees/lifecycle`: `src/MermaidRenderer.ts`, `src/MermaidDiagram.vue`, `src/composables/useMermaidRenderer.ts`; соответствующие `tests/MermaidRenderer.test.ts`, `tests/components/MermaidDiagram.test.ts`, `tests/composables/useMermaidRenderer.test.ts`; `package.json`, `bun.lock`, `.gitignore`, `README.md`, собранный `dist/`. Docs: `package.json`, `bun.lock`, `scripts/check-readability.ts` и эта спека/план.

**Interfaces:** публичные `createMermaidRenderer`/toolbar/strict/Mermaid11 сохраняются. Форк сам освобождает программно созданные Vue roots; docs использует существующий factory, без парковки DOM и подавления ошибок. Пакет устанавливается по SHA GitHub-форка с уже собранным dist, без npm-публикации и сборки библиотеки у потребителя.

- [x] **1. Baseline и RED.** В новом изолированном worktree установить frozen dependencies и выполнить существующие `bun run test`, `bun run lint`, `bun run build`. Добавить тесты: удаление wrapper снимает callbacks компонента; завершение async mounted после unmount не добавляет callbacks/ResizeObserver; queued render после unmount не вызывается; последовательные render одного элемента получают исходный код, а не SVG предыдущего render; SPA route event не допускает параллельные Mermaid run. Посмотреть ожидаемые FAIL до исходных правок. Реальная docs lifecycle-регрессия уже RED (20/10 и 13/8).
- [x] **2. Минимальные исходные исправления.** Renderer отслеживает созданные roots, размонтирует detached и освобождает все roots при destroy; не монтирует disconnected source nodes. Async mounted проверяет disposal после await. Composable отменяет работу удалённого компонента, проверяет актуальность перед Mermaid run, подготавливает source внутри сериализованной задачи. Route change не сбрасывает активную глобальную promise-chain. Публичный API не расширять.
- [x] **3. GREEN форка.** Узкие новые тесты и весь `bun run test`, `bun run lint`, `bun run build` успешны; форматировать только изменённые исходники/тесты. Версия `1.2.3-cdd.1`, repository/bugs указывают на форк, README объясняет происхождение и lifecycle fixes; авторство/MIT сохранить. Собранный dist хранить в Git для воспроизводимой SHA-зависимости. Коммит с исходниками, тестами и dist, push ветки форка, проверить фактический SHA и открыть PR в main форка; без автоматического merge.
- [x] **4. Подключить docs и проверить.** Установить fork по полному SHA; проверить frozen install без локальных ссылок на worktree. Root и соответствующий nested build, новая lifecycle-регрессия (повторные SPA/initial-lazy leave, только handlers текущих схем), обе темы/размеры/reading mode, отсутствие краткого error DOM. Повторить затронутые scroll/plugins проверки, типы, unit suite, modules и build. Исходники всех 44 схем остаются теми же; прежние pages-прогоны и исходный source check сохраняют доказательство их валидности.
- [x] **5. Завершить fix pass.** Записать RED→GREEN по Important finding и результаты всего suite в ledger, сохранить ссылки/SHA форка и docs. Зафиксировать docs, завершить task-done. Повторное code review того же finding не запрашивать; финальный gate — регрессия и green suite. Затем исходный блок завершения: docs PR, CI, реальный Pages preview и live probe; не сливать docs без поручения.

## Завершение

- [x] Выполнить итоговое независимое ревью выбранного процесса; исправления проверить по затронутым сценариям. Не подменять им ревью каждой задачи при SDD.
- [ ] По cdd-tasks/docs-site открыть PR в main с разделами «Что», «Решения», «Проверка» и ссылкой `https://docs.cellestial.ru/branches/docs-mermaid-renderer/modules/2/tracks/offline/caching-strategies#networkonly`. Перед push проверить актуальную базу, head и diff, отсутствие посторонних изменений.
- [ ] Дождаться обязательного CI и действительного main Pages build/deploy: dispatch сам по себе не доказывает превью. В `/branches/` проверить строку ветки и SHA, на опубликованном превью повторить краткую ошибку/интерактивность/якорь с document-start наблюдением. Слияние не выполнять без отдельного поручения.
- [ ] Отчёт: что изменено, результаты и ссылки на PR/превью, отдельно непроверенное. Не объявлять исчезновение всех layout jumps, если измерения этого не доказывают; журнал завершить/архивировать по выбранному процессу.
