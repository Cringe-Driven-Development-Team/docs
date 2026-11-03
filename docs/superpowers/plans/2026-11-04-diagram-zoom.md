# Исправление зума и переполнения схем — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eraser не показывает внутренние скроллы, обе схемы уменьшаются ниже начального размера, «Вписать» показывает весь холст.

**Architecture:** Сохраняем общий `DiagramFrame` и текущую отрисовку iframe/SVG. Разделяем начальный масштаб по ширине, полный обзор и границу ручного зума. Отступы HTML Eraser обнуляем в существующей обработке результатов render.

**Tech Stack:** Vue, TypeScript, VitePress, `@panzoom/panzoom@4.6.2`, Eraser CLI, Bun test, Puppeteer/Chromium.

**Spec:** `docs/superpowers/specs/2026-11-04-diagram-zoom-design.md` — утверждена 04.11.2026.

## Global Constraints

- Начальный масштаб по ширине, максимум 100%; существующая высота рамки и раскладка сохраняются.
- Минимум ручного зума — 10%, либо полный обзор, если ему нужно менее 10%; максимум 400%.
- «Вписать» использует обе фактические стороны рамки и не увеличивает выше 100%.
- Ctrl/⌘ + колесо и pinch масштабируют схему; обычное колесо прокручивает страницу.
- Не менять зависимости, исходники схем, шрифты, PNG, sandbox, форк Mermaid, лоадер или дизайн панели.
- Отдельная HTML-страница схемы сохраняет прокрутку; не добавлять `overflow:hidden` для маскировки переполнения.
- Работа в `.claude/worktrees/diagram-zoom`, ветка `fix/diagram-zoom`; коммиты по-русски.

## Review Focus

1. Огромный холст с полным обзором менее 10% остаётся доступен целиком — unit `minimumScale` и браузерная проверка геометрии после fit.
2. Повторное измерение Mermaid/смена темы после ручного уменьшения не поднимает масштаб обратно к начальному — browser regression с theme + height-only resize.
3. Полный экран и выход не оставляют старую границу зума/заблокированную страницу — существующие native/fallback/Escape проверки плюс уменьшение после выхода.
4. Нижняя и правая подписи Eraser доступны, а отдельный HTML прокручивается — проверка размеров документа в iframe и реальной прокрутки отдельной страницы.
5. Загрузка статьи/якорь и поздний Panzoom import не возвращают ошибочное вписывание по высоте при открытии — существующие loading/scroll/plugins и отдельная проверка начального масштаба до нажатия fit.

## Карта файлов

- `site/.vitepress/theme/diagram-scale.ts`: чистые расчёты границ масштаба.
- `site/.vitepress/theme/DiagramFrame.vue`: применение начального/полного масштаба и единого минимума Panzoom.
- `scripts/label-slack.ts`: существующая постобработка сгенерированного HTML, включая сохранение запаса подписей.
- `scripts/diagram-scale.test.ts`, `scripts/label-slack.test.ts`: регрессии расчётов и обработки файлов.
- `scripts/check-readability.ts`: проверки реальных документов и управления общим просмотрщиком.
- `README.md`: коротко уточнить смысл начального размера, кнопки fit и ручного уменьшения.

## Task 1: Исправить границы масштаба и документ Eraser

**Files:** Все файлы из карты выше; новых продуктовых модулей не требуется.

**Interfaces:**
- Consumes: `fitScale(frameWidth, canvasWidth, frameHeight?, canvasHeight?): number`, `fitOffset(width, height, scale)`, `stepScale(current, direction, min)`, `padHtmlOutputs(batch: RenderBatch): Promise<void>`.
- Produces: `minimumScale(fullFit: number): number`, возвращает `Math.min(0.1, fullFit)`; существующие сигнатуры сохраняются. Общая рамка задаёт этот минимум всем каналам зума.
- Новых интерфейсов между задачами нет: одна задача включает полный пользовательский результат.

- [ ] **1. Добавить unit-регрессии до реализации.**

В `diagram-scale.test.ts`:

```ts
test('readable start, full fit and manual minimum are independent', () => {
  expect(fitScale(1145, 1055)).toBe(1);
  const full = fitScale(1145, 1055, 910, 1805);
  expect(full).toBeCloseTo(910 / 1805, 8);
  expect(minimumScale(full)).toBe(.1);
  expect(stepScale(full, -1, minimumScale(full))).toBeLessThan(full);
  expect(minimumScale(.04)).toBe(.04);
  expect(stepScale(.11, -1, minimumScale(full))).toBe(.1);
  expect(stepScale(4, 1, minimumScale(full))).toBe(4);
});
```

В `label-slack.test.ts` добавить async-тест `padHtmlOutputs resets margins without clipping the standalone document`: временный HTML с `<head>`, холстом 1376×852 и существующей подписью; вызвать реальный `padHtmlOutputs`, проверить CSS `html,body{margin:0;padding:0}`, неизменные размеры/содержимое холста, отсутствие добавленных `overflow:hidden`/scripts и сохранение запаса ширины подписи. Временный каталог удалять в `finally`.

- [ ] **2. Запустить unit-тесты и зафиксировать RED.**

Run: `bun test scripts/diagram-scale.test.ts scripts/label-slack.test.ts`.
Expected: FAIL из-за отсутствия нового расчёта/обнуления отступов, остальные старые тесты не сломаны.

- [ ] **3. Добавить браузерные регрессии контракта.**

В `checkDiagramFrameInteraction(page, selector)` до первого нажатия fit проверить начальный масштаб `min(1, frameWidth/canvasWidth)`. После fit проверить масштаб по двум сторонам и все четыре края холста внутри рамки с допуском 1px. «−» и Ctrl+wheel вниз уменьшают ниже fit при сохранении scroll/browser scale; многократные «−» достигают `min(.1, fullFit)`; «+» снова увеличивает. В существующем touch-тесте проверить также pinch внутрь, с теми же границами.

Для высокой Mermaid после уменьшения переключить тему и изменить только высоту окна: масштаб остаётся выбранным, если он не ниже нового допустимого минимума. Существующую проверку повторного fit назвать восстановлением полного обзора, не начального вида.

В проверке Eraser в секции `plugins` добавить после загрузки iframe: `scrollWidth <= innerWidth`, `scrollHeight <= innerHeight`, computed margin/padding `0px`; нижний/правый край root canvas доступен. Для отдельного HTML открыть новую страницу малого размера, дождаться шрифтов и проверить положительную доступную прокрутку и фактический сдвиг `scrollX/scrollY` после `scrollTo`. Не отключать наблюдатели ошибок и не расширять исключения favicon.

- [ ] **4. Воспроизвести браузерный RED на исходной сборке.**

Подготовить подходящий исходный `dist` обычной native-сборкой этой ветки либо использовать исходную сборку того же SHA без подмены исходников.

Run: `CHROMIUM_PATH=/usr/bin/google-chrome bun scripts/check-readability.ts mermaid plugins` с логом в workspace плана.
Expected: FAIL нового утверждения полного обзора/уменьшения или документа Eraser. Читать первую причину падения, не менять старые проверки ради GREEN.

- [ ] **5. Внести минимальную реализацию.**

`diagram-scale.ts`: экспортировать `minimumScale(fullFit: number): number`; сохранять существующий расчёт `fitScale` с необязательной высотой и предел `MAX_SCALE = 4`.

`DiagramFrame.vue`: внутри компонента выделить `resetView(whole: boolean): void`; `fitToFrame(): void` вызывает полный обзор. Первичная инициализация и смена ширины вызывают читаемый вид по ширине, в fullscreen — полный обзор; существующий `scheduleFit` сохраняет этот смысл при входе/выходе. При любом расчёте минимум берётся из полного обзора, а не стартового масштаба. Передать один минимум в `Panzoom.setOptions` и `stepScale`. При повторном измерении размера обновлять минимум, сохраняя пользовательский масштаб и pan, пока они допустимы. Не менять обработку обычного колеса, фокус и очистку слушателей.

`padHtmlOutputs`: при записи HTML после существующего `padLabelWidths` вставить в head обнуление margin/padding для html/body. Не менять root canvas, не скрывать overflow и не добавлять JS. Расширить комментарий существующего этапа обработки; не переименовывать pipeline/файлы ради этой правки.

README: описать различие открытия, полного обзора и ручного масштаба.

- [ ] **6. Проверить unit GREEN и типы.**

Run: `bun test scripts/diagram-scale.test.ts scripts/label-slack.test.ts && bun run typecheck`.
Expected: все выбранные тесты PASS, typecheck exit 0.

- [ ] **7. Собрать и проверить итоговый продукт.**

Run: `DIAGRAMS_NATIVE=1 CHROMIUM_PATH=/usr/bin/google-chrome bun run build`, затем `bun run modules:check && bun run test`.
Expected: build/site:check, modules и полная unit suite PASS; built PNG/root-canvas тест не пропущен.

Run: `CHROMIUM_PATH=/usr/bin/google-chrome bun scripts/check-readability.ts loading mermaid pages scroll plugins`.
Expected: PASS на поддерживаемых этой проверкой профилях: обе темы, широкие/мобильные экраны, весь исходный Mermaid, начальный вид/fit/minus/pinch, Eraser HTML, native/fallback fullscreen, lifecycle/late import, обычная прокрутка, якоря и лоадер. Новые регрессии не маскируются ожиданиями, меняющими реальное действие пользователя. Осмотреть скриншоты высокой Mermaid и Eraser после fit; записать непроверенные платформы.

Повторять широкую матрицу только при новых изменениях/падениях; исправления из финального ревью покрывать целевыми регрессиями плюс unit suite. Nested build не обязателен: URL/base-код не меняется; опубликованное превью проверяет реальную вложенную базу.

- [ ] **8. Зафиксировать результат задачи.**

Run: `git diff --check`, затем commit изменённых продуктовых файлов/тестов/README: `fix(схемы): разрешить уменьшение и убрать внутренние скроллы`.
Expected: чистый diff-check и успешный commit; журнал содержит RED→GREEN и фактические результаты команд.

## Завершение

- [ ] Финальное ревью и исправления по выбранному пользователем способу выполнения; не сливать PR без поручения.
- [ ] Открыть PR в `main` с разделами «Что», «Решения», «Проверка» и ссылкой на ветку `fix-diagram-zoom` в `/branches/`.
- [ ] Дождаться обязательных CI и фактической Pages-сборки. Сверить опубликованный SHA; проверить реальное превью: высокая Mermaid, Eraser, «Вписать», уменьшение и обычный скролл, без изменения страницы 2FA в чужой ветке.
- [ ] Передать пользователю PR, превью и ограничения проверок.

Самопроверка плана: все пункты спеки покрыты задачей 1; новые сигнатуры согласованы,
каждый Review Focus закреплён проверкой. Реализация ещё не начата.
