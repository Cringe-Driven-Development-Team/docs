# Shared Diagram Frame and Mermaid Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Вернуть читаемый Mermaid через общую рамку Eraser и явные пары «текст слева, схема справа».

**Architecture:** Выделить Panzoom/fullscreen из `Diagram.vue` в `DiagramFrame.vue`;
Eraser остаётся iframe-адаптером, Mermaid становится SVG-адаптером static renderer.
Markdown fence получает одну рамку автоматически; только авторская `DiagramSection`
связывает пояснение со схемой. Сначала выполнить отдельный план событий личного форка.

**Tech Stack:** VitePress2.0.0-alpha.21, Vue3, Mermaid11, @panzoom/panzoom4.6.2,
TypeScript, Bun, существующий Puppeteer browser CLI. Node>=22.22, Bun>=1.3.

**Spec:** `docs/superpowers/specs/2026-11-02-mermaid-layout-design.md`, утверждена 2026-11-02.

## Global Constraints

- База продукта docs `356ae97ce41eff4f688a8805d3df90e7c4a58913`; ветка `docs/mermaid-layout`.
- Использовать уже изолированный worktree `.claude/worktrees/mermaid-renderer`, не создавать второй.
- Все50 Mermaid sources на14 страницах, текст, ссылки, заголовки/ID и исторические плашки сохраняются.
- На странице fit только по ширине, максимум1; высота рамки максимум70vh. Fullscreen fit по обеим сторонам.
- Обычное колесо листает страницу; Ctrl/⌘+wheel — zoom около указателя; drag — pan.
- Стрелки в фокусе рамки — pan; Tab выходит; кнопки доступны через Enter/Space.
- Без новых зависимостей, npm publish, sticky, копирования/скачивания Mermaid и legacy-режимов.
- Сохранять Mermaid11/strict, lazy queue/cancellation/root cleanup, чтение, Tabs, Group Icons, поиск и маршруты.
- Перед коммитами docs: typecheck, test, modules:check, build. Не сливать PR самостоятельно.

## Review Focus

1. Lazy SVG ещё не готов: исходник смонтирован и виден renderer; ошибка static render видима читателю — Task3.
2. Тема меняется после zoom: размеры измеряются без transform, вид сохраняется, старые callbacks очищаются — Task3.
3. Широкое окно с узким режимом чтения: раскладка зависит от ширины статьи, overflow отсутствует — Task4.
4. Высокая обрезанная схема без мыши: стрелки достигают низа, Tab выходит, fullscreen корректно закрывается — Task2/3.
5. Прямой якорь ниже lazy-пары: reload/SPA/Back сохраняют видимость заголовка без обхода всех схем заранее — Task4.

---

## Файлы и контракты

- `site/.vitepress/theme/DiagramFrame.vue` — только общая рамка/управление/очистка.
- `site/.vitepress/theme/Diagram.vue` — существующий публичный Eraser-адаптер.
- `site/.vitepress/theme/diagram-scale.ts` — существующие функции fit/step/widthChanged плюс тип размеров.
- `site/.vitepress/theme/MermaidFrame.vue`, `mermaid-size.ts` — SVG lifecycle и натуральная геометрия.
- `site/.vitepress/mermaid-fence.ts`, `config.mts` — обёртка каждого Mermaid fence, остальные fence delegates прежние.
- `site/.vitepress/theme/DiagramSection.vue` — явная раскладка двух слотов по container query.
- `site/.vitepress/theme/index.ts`, `custom.css` — регистрация, static renderer, общие/renderer-specific стили.
- `scripts/check-readability.ts` — реальные взаимодействия, lifecycle, все страницы/якоря; без второго browser runner.
- `scripts/mermaid-size.test.ts`, `scripts/mermaid-fence.test.ts` — новые небольшие pure/Markdown проверки.
- `package.json`, `bun.lock` — immutable SHA готового форка.
- 14 Markdown-путей перечислены в Task4; `README.md`, `.agents/skills/docs-site/SKILL.md`
  и синхронизированное `.claude/skills/docs-site/SKILL.md` — актуальная инструкция авторам.

### Task 1: Готовый мост событий форка

**Files:** только репозиторий `/home/oleg/2026_H2/.mermaid-renderer-worktrees/lifecycle`.

**Interfaces:**
- Consumes: существующий Vue `renderComplete` и lifecycle базы `9e6c070e5d305086688b9067904061fee7bd6384`.
- Produces: bubbling `vitepress-mermaid:render-complete` на `.mermaid-wrapper`, detail
  `{id:string;success:boolean;error?:unknown}`; опубликованный полный SHA с dist.

- [x] **1. Выполнить связанный план**
  `/home/oleg/2026_H2/.mermaid-renderer-worktrees/lifecycle/docs/superpowers/plans/2026-11-02-mermaid-render-events.md`
  по выбранному владельцем методу, включая RED→GREEN, проверки и review выбранного процесса.
  Результат — конкретные SHA и PR. Не устанавливать в docs незакоммиченный локальный путь.

### Task 2: Общая рамка с сохранением Eraser

**Files:** `DiagramFrame.vue`, `Diagram.vue`, `diagram-scale.ts`, `custom.css`, `scripts/check-readability.ts`.

**Interfaces:**
- Produces: `export type DiagramSize = {width:number;height:number}` в `diagram-scale.ts`.
- Produces: `DiagramFrame` props `{title:string;size:DiagramSize|null}`; slots `default`
  (canvas content, всегда mounted), `status` (при size=null), `footer` (дополнительные ссылки).
  Корень `figure.diagram`, clipped `.diagram__frame`, transformed `.diagram__canvas`;
  кнопки имеют aria-label `Уменьшить`, `Увеличить`, `Вписать`, `На весь экран`.
- Preserves: `<Diagram name="deployment"/>` и остальные имена; root adapter attr
  `data-diagram-kind="eraser"` проходит на figure. Mermaid использует значение `mermaid`.
- Produces: browser helper `checkDiagramFrameInteraction(page:Page, selector:string):Promise<void>`.

- [x] **1. Добавить проверку общей политики в секцию plugins.** Выделить общий helper из
  существующих interaction checks без удаления assert. Сначала использовать Eraser deployment.
  Реальный wheel над центром обычного/увеличенного canvas: `scrollY_after>scrollY_before`,
  transform прежний. Ctrl+wheel: scale изменён, `abs(scrollY_after-scrollY_before)<=1`,
  `visualViewport.scale` прежний. Drag меняет pan. Frame focus+ArrowDown меняет pan,
  страница остаётся на месте; Tab не заперт, Enter/Space активируют кнопки.
  Достичь нижней части высокой схемы стрелками, проверить кнопки/подсказку на390px.

- [x] **2. Получить RED на клавиатурном pan.** После root build выполнить
  `CHROMIUM_PATH=/opt/google/chrome/chrome bun scripts/check-readability.ts plugins`.
  Старый виджет не имеет focusable frame/arrow pan — assertion падает именно на этом.
  Сохранить RED; неизменившееся Eraser-поведение не объявлять новой регрессией.

- [x] **3. Извлечь `DiagramFrame`, используя существующий код и helpers.**
  Перенести refs/Panzoom/ResizeObserver/fullscreen/fallback в общую рамку. Валидный
  size запускает init после DOM tick; size=null не создаёт Panzoom, но default slot остаётся
  в DOM. Pending frame имеет min-height320px, canvas не `display:none`: renderer видит
  исходник и IntersectionObserver. Панель вне clipping; статус поверх pending content.
  При повторном одинаковом size не делать reset; widthChanged — refit, height-only — нет.
  Новый size после готовности обновляет геометрию, сохраняя текущие pan/scale; initial size
  делает fit. При смене размеров обновить minScale по текущей рамке, clamp только если
  прежний scale выходит за допустимый диапазон. Чистый theme rerender не вызывает refit.
  Клавиатурный шаг40px видимого холста, обработка только стрелок при фокусе самого frame;
  на кнопках стрелки не перехватывать. Сохранять min fit/max4/step1.25 из helpers.
  При fullscreen/fallback сохранить и восстановить исходный body overflow, scrollY и фокус;
  exit refit inline. Отменять поздний import/init/rAF при unmount; удалить wheel/observer/listeners/Panzoom.

- [x] **4. Оставить Eraser тонким адаптером.** Передать build-size или null в общую рамку,
  iframe с текущими sandbox/title/loading, shield, missing message и HTML/PNG ссылки оставить
  в `Diagram.vue`. Белый canvas/iframe и shield ограничить Eraser-адаптером, не Mermaid.
  Не менять `diagrams.data.ts`, экспорт HTML/PNG, исходные схемы или маршруты.

- [x] **5. Получить GREEN и commit.** `plugins` проверяет helper, native fullscreen/выход
  кнопкой/Escape, fallback при отклонённом requestFullscreen, resize, Tabs и уход во время import.
  После закрытия scrollY/settings прежние; fullscreen fit учитывает высоту; inline fit её игнорирует.
  `bun run typecheck`, `bun run test`, `bun run modules:check`,
  `CHROMIUM_PATH=/opt/google/chrome/chrome DIAGRAMS_NATIVE=1 bun run build` проходят.
  Коммит `refactor(diagram): выделить общую рамку управления схемами`.

### Task 3: Static Mermaid в общей рамке

**Files:** `MermaidFrame.vue`, `mermaid-size.ts`, `mermaid-fence.ts`, `config.mts`, `index.ts`,
`custom.css`, `package.json`, `bun.lock`, оба новых unit tests, `scripts/check-readability.ts`.

**Interfaces:**
- Consumes: `DiagramFrame` и `DiagramSize` Task2; event Task1 на дочернем wrapper.
- Produces: `MermaidFrame` props `{title?:string}` (default `Mermaid`), default slot содержит
  неизменённый HTML стандартного Mermaid fence; ровно один frame на схему, парность не требуется.
- Produces: `readMermaidSize(svg:SVGSVGElement):DiagramSize|null` из `mermaid-size.ts`.
- Produces: `mermaidFence(md:MarkdownRenderer):void` из `mermaid-fence.ts`, type import из `vitepress`.
  Делегировать сохранённому `md.renderer.rules.fence`; только `token.info.trim()==='mermaid'`
  оборачивать в block `<MermaidFrame>…</MermaidFrame>` с переводами строк.

- [ ] **1. Написать RED для размеров и wrapping.** В Bun pure tests:
  viewBox `0 0 651 1222` даёт `{width:651,height:1222}` независимо от CSS transform;
  fallback положительные absolute width/height attrs, отсутствующий/нулевой/NaN размер даёт null.
  Приоритет валидного viewBox над CSS/процентными attrs. DOM input задавать маленьким structural
  SVG stub с `getAttribute`, не устанавливать jsdom; production helper читает только атрибуты.
  Через `createMarkdownRenderer` проверить один frame на Mermaid, source прежний, обычный
  TypeScript fence не изменён; Markdown внутри `template #diagram` компилируется, heading ID сохранён.
  `bun test scripts/mermaid-size.test.ts scripts/mermaid-fence.test.ts` падает на отсутствующих API.

- [ ] **2. Добавить browser RED новой рамки Mermaid.** В секции mermaid использовать helper
  Task2 для flowchart caching-strategies и sequence auth-scenarios; selector
  `figure[data-diagram-kind="mermaid"]`. Проверить отсутствие собственной панели renderer,
  один canvas/Panzoom на diagram, inline scale=`min(1,frameWidth/naturalWidth)` с tolerance0.01,
  без ограничения высотой. Старый DOM не удовлетворяет контракту; сохранить RED.

- [ ] **3. Подключить подготовленный пакет.** В `package.json` установить Task1 полный SHA,
  обновить lock через Bun; проверить frozen install из чистой копии.
  В `index.ts` зарегистрировать `MermaidFrame`, включить `static:true`, сохранить theme/strict/
  sequence/flowchart настройки. Удалить лишние native Mermaid toolbar/keydown handlers,
  сохраняя корректные русские ошибки нового адаптера и существующий theme watcher.
  В markdown.config подключить `mermaidFence` после текущих Tabs/Group Icons; не менять их renderer.

- [ ] **4. Реализовать адаптер и размеры.** В `MermaidFrame.vue` status сначала
  «Загрузка схемы…» (`role=status`), size=null; listener на собственном DOM ancestor установить
  до запуска factory. На success после nextTick найти SVG внутри target wrapper и измерить
  `readMermaidSize`; неверный размер показать как «Не удалось определить размер схемы».
  На failure показать «Не удалось отрисовать схему» (`role=alert`, `.diagram-error`),
  очистить stale size. Source slot всегда mounted; слушатель не глобальный.
  Успешная следующая попытка снимает ошибку. Не измерять transform/clientRect и не заменять
  children программно: renderer владеет SVG. Late events после unmount игнорировать;
  theme rerender не создаёт новый Panzoom и не сбрасывает view при прежних размерах.
  Убрать Mermaid bottom76px и старое fit CSS; SVG занимает natural size, фон следует теме.

- [ ] **5. Проверить ошибки и lifecycle в browser CLI.** Test-only DOM fixture со сломанным
  Mermaid source обязана получить видимый alert, а затем корректный source — живую схему;
  fixture errors хранить отдельно от product errors, не подавлять реальные события.
  Lazy offscreen source рисуется при посещении, начальный visible source не зависает.
  Zoom→theme→theme сохраняет scale/pan и natural size, SVG actor fill действительно меняется.
  Двухпальцевый pinch через CDP touch events меняет transform схемы, не browser scale;
  обычный touch-scroll вне frame продолжает листать страницу. Resize только высоты
  сохраняет view, смена ширины выполняет refit; повторные ready не накапливают геометрию.
  Быстрый SPA во время initial/lazy render, повторные заходы и Tabs не накапливают roots/listeners:
  counts соответствуют только текущим mounted components; callbacks detached frames не срабатывают.
  Сохранить document-start transient-error observer и его negative self-check без ослабления.

- [ ] **6. GREEN и commit.** Новые Bun tests, `typecheck/test/modules:check/build` как Task2,
  затем `CHROMIUM_PATH=/opt/google/chrome/chrome bun scripts/check-readability.ts mermaid plugins`.
  В desktop2560×1440/mobile390×844 проверить light/dark, drag/pinch/keyboard/fullscreen/fallback,
  очистку overlay, page scroll, кнопки и геометрию flowchart/sequence. Коммит
  `fix(mermaid): использовать общую рамку вместо встроенного управления`.

### Task 4: Явные пары всех страниц, инструкция авторам и полная приёмка

**Files:** `DiagramSection.vue`, `index.ts`, `custom.css`, `scripts/check-readability.ts`,
`README.md`, `.agents/skills/docs-site/SKILL.md` и его зеркало; следующие14 страниц:

```text
site/documentation/csrf/index.md                              1
site/documentation/csrf/scenarios.md                         15
site/documentation/offline/build-and-registration.md         3
site/documentation/offline/index.md                          3
site/modules/2/tracks/backend-cicd.md                         1
site/modules/2/tracks/bff/auth-scenarios.md                    7
site/modules/2/tracks/bff/contract.md                          1
site/modules/2/tracks/bff/infrastructure.md                    1
site/modules/2/tracks/bff/migration.md                         2
site/modules/2/tracks/bff/release.md                           1
site/modules/2/tracks/bff/rollback.md                          1
site/modules/2/tracks/offline/architecture.md                  4
site/modules/2/tracks/offline/caching-strategies.md             5
site/modules/2/tracks/offline/theory.md                        5
```

**Interfaces:**
- Produces: `DiagramSection` без props, default slot — текст, named slot `diagram` — схема.
  Авторская запись: block `<DiagramSection>`, Markdown заголовка/текста, block
  `<template #diagram>` с исходным Mermaid fence, закрытие template, пояснение после
  схемы при необходимости, закрытие DiagramSection. Между HTML и Markdown пустые строки.
- Container `.diagram-section` задаёт inline-size containment; дочерний layout при
  доступных >=1040px имеет columns `minmax(280px,1fr) minmax(651px,1.35fr)`, gap40px;
  иначе один столбец. Оба children min-width0. Не вводить viewport-only breakpoint/sticky.

- [ ] **1. Browser RED раскладки.** На caching-strategies/StaleWhileRevalidate в FullWidth
  2560px проверить text.right<=diagram.left, общий верх; при frameWidth>=651 scale≈1,
  SVG651×1222 остаётся натуральным независимо от70vh clipping. На390px и сохранённом
  узком режиме3 текст выше схемы, `scrollWidth<=clientWidth+1`. Без DiagramSection
  двух колонок нет. До правок сохранить source blocks, текстовые heading IDs/links по базе
  в ignored `.superpowers/mermaid-layout/` для последующего сравнения, без постоянных frozen hashes.

- [ ] **2. Добавить компонент и разметить14 страниц.** Зарегистрировать `DiagramSection`,
  реализовать два слота/container query. Каждую из50 схем включить в явную пару с её
  пояснениями. В theory включить относящийся к схеме текст после SVG в default slot;
  в migration две отдельные пары под одним исходным heading, не дублировать заголовок.
  Сохранить literal Mermaid, формулировки, ссылки, frontmatter, levels/ID и исторические баннеры.
  Финальный следующий раздел расположен ниже всей пары. Непарный fence из Task3 продолжает работать.

- [ ] **3. Актуализировать авторскую инструкцию.** Прочитать `superpowers:writing-skills`
  перед правкой docs-site, выполнить его проверку на сценарии автора пары. README и guide:
  explicit slot пример, static SVG/shared Panzoom, wheel/keyboard, fit70vh/fullscreen,
  lazy ожидание и актуальные DOM/browser selectors. `bun run skills:sync`; установленную
  `/home/oleg/.codex/skills/docs-site/SKILL.md` обновить с сохранением параллельных изменений.
  Не править AGENTS/CLAUDE и не генерировать OpenWiki.

- [ ] **4. Приёмка содержимого и якорей.** Сравнение с baseline подтверждает все50 исходников
  и ID/links. `pages` получает пути через `mermaidFiles()` и ожидает ровно50 SVG после lazy visit,
  без raw Mermaid pre/errors/overflow. Прямой hash, reload, SPA/Back и hash ниже высокой пары
  проверять ДО lazy traversal, обе темы, fresh/сохранённые режимы; действия читателя отменяют
  автокоррекцию. При регрессии scroll hook сначала записать отдельный RED/координаты/тайминг,
  затем минимально исправить `scrollToHashAfterMermaid`, иначе оставить его как есть.

- [ ] **5. Итоговые root/nested проверки и commit.** Выполнить typecheck/test/modules:check,
  root build с `CHROMIUM_PATH=/opt/google/chrome/chrome DIAGRAMS_NATIVE=1 bun run build`,
  затем `CHROMIUM_PATH=/opt/google/chrome/chrome bun scripts/check-readability.ts mermaid pages scroll plugins hierarchy`.
  Повторить соответствующую nested сборку и CLI с `SITE_BASE=/branches/docs-mermaid-layout/`.
  CLI использует matching dist; root dist с подменённым env недостаточен. Сохранить логи,
  screenshots и JSON document-start ошибок. Проверить обе темы, desktop/mobile, reading mode,
  кнопки/геометрию, anchors, Eraser/Tabs/icons/search; `title` не запускать без изменения бренда.
  `git diff --check`; коммит `feat(docs): разместить пояснения рядом со схемами`.

## Завершение выбранного процесса

- [ ] Провести предусмотренное выбранным skill независимое ревью docs и fork diff и исправить findings.
  При SDD review каждой задачи обязателен; итоговое ревью его не заменяет.
- [ ] По `cdd-tasks`/`docs-site` открыть docs PR в main с «Что», «Решения», «Проверка» и
  `https://docs.cellestial.ru/branches/docs-mermaid-layout/modules/2/tracks/offline/caching-strategies#stalewhilerevalidate`.
  Проверить current head/base/diff и обязательный CI; дождаться настоящего Pages deploy.
- [ ] В `/branches/` подтвердить ветку/SHA, на опубликованном превью проверить обе темы,
  обычный wheel/Ctrl zoom/drag/fullscreen и прямой якорь с document-start observer.
  Сохранить результат; dispatch или локальная сборка не доказывают готовность preview.
- [ ] Отдать ссылки docs/fork PR, SHA, результаты приёмки и непроверенное; без merge.
  Реальные Safari/iPhone/Firefox не объявлять проверенными по мобильной эмуляции Chromium.
  Обновить/завершить журнал выбранного процесса, не переисполнять завершённый PR132.

## Самопроверка плана

2026-11-02: требования спеки распределены по Task1–4; пять Review Focus имеют regression
assertions в соответствующих задачах. Проверены совпадение имени/detail события между
репозиториями, DiagramSize/slots/selectors между задачами, все14 путей и сумма50 fences.
Независимая реализация и проверки продукта ещё не начаты; следующий шаг — выбор исполнения владельцем.
