# Ширина чтения до первого отображения — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Устранить переход из узкой раскладки в выбранную ширину после hard reload.

**Architecture:** Самодостаточный синхронный head-скрипт читает существующие настройки
Nolebase и применяет его классы и CSS-переменные при появлении body, до первого
отображения. После этого управление остаётся у плагина. Проверка измеряет видимые
кадры собранного сайта, включая время до запуска Vue и отложенные обновления плагина.

**Tech Stack:** VitePress 2.0.0-alpha.21, Vue 3, Enhanced Readabilities 2.21.1,
TypeScript, Bun, существующий Puppeteer runner.

**Spec:** `docs/superpowers/specs/2026-11-04-reading-width-first-paint-design.md` — утверждена владельцем.

## Global Constraints

- Работа: `.claude/worktrees/reading-width`, ветка `fix/reading-width-first-paint`, база `5c14f0c`.
- Без сохранённого выбора сразу действует FullWidth. Валидные настройки не сбрасываются.
- Сохранённые Original, FullWidth и оба регулируемых режима сохраняют смысл и настройки читателя.
- Недопустимые значения и недоступный localStorage не ломают страницу.
- Новый общий загрузчик, новые зависимости и изменение дизайна не требуются.
- Текущий загрузчик Mermaid и коррекция якорей сохраняют своё назначение.
- Основной сайт и вложенный branch base; обе темы и мобильная раскладка. Без JavaScript текст доступен.
- Форк разрешён при необходимости, но не входит в начальное решение; существенное дублирование плагина — повод пересмотреть механизм.
- Владелец выбрал superpowers:executing-plans для этого плана.

## Review Focus

1. Заблокированный localStorage: bootstrap и проверка готовности Mermaid не бросают исключение.
2. Испорченный режим: начальный fallback совпадает с состоянием после mounted, без второго скачка.
3. Проценты вне диапазона и округление: начальное значение совпадает с обновлением плагина через 1000 мс.
4. Смена режима через меню после загрузки: ранний скрипт не удерживает старый класс и не сбрасывает выбор.
5. Граница 1440 px и возврат с mobile: responsive-правила совпадают с плагином, выбранные проценты не теряются.

---

### Task 1: Применять настройки чтения до первого кадра

**Files:**
- Create: `site/.vitepress/theme/reading-layout.ts` — только ранняя инициализация Nolebase.
- Modify: `site/.vitepress/config.mts` — дополнительный head-скрипт перед загрузчиком статьи.
- Modify: `site/.vitepress/theme/article-loading.ts` — безопасное чтение настроек в `widthsReady`.
- Modify/Test: `scripts/check-readability.ts` — секция `width` и её вызов в существующем runner.
- Modify: `README.md` — команда проверки `width` и краткое описание раннего применения ширины.
- `theme/index.ts`, `custom.css` и lockfile сохраняют существующую конфигурацию; менять их только при доказанной необходимости.

**Interfaces:**
- Consumes: ключи `vitepress-nolebase-enhanced-readabilities-layout-switch-mode`,
  `vitepress-nolebase-enhanced-readabilities-{page,content}-layout-max-width`;
  режимы 1/3/4/5, классы и CSS-переменные установленной версии Nolebase.
- Produces: `readingLayoutHeadScript(): string` — сериализуемая функция без Vue и внешних runtime bindings;
  `checkReadingWidth(browser: Browser, url: (path: string) => string): Promise<void>` — браузерная приёмка.
- Артефакты — существующий READABILITY_ARTIFACTS_DIR, файлы `${label}-width-*.json/png`.

- [x] **1. Подготовить baseline.** Прочитать спеку и выбранный execution skill, завести его журнал.
  Установить зависимости через `bun install --frozen-lockfile` в worktree; выполнить
  `bun run typecheck`, `bun run test`, `bun run modules:check`. При сбое сохранить полный вывод
  и отделить исходную проблему от исправления. Общий основной checkout не менять.

- [x] **2. Добавить браузерный RED.** Зарегистрировать `width` в CLI и реализовать
  `checkReadingWidth` на странице без Mermaid `documentation/project-context`.
  Наблюдение установить через evaluateOnNewDocument: каждый rAF сохраняет время,
  видимость и `{left,width}` статьи, content-container, sidebar и nav container,
  body class, обе CSS-переменные, viewport и first-contentful-paint.
  Сравнивать кадры начиная с первого отображения, сохраняя также предшествующий rAF;
  не считать все кадры до DOMContentLoaded невидимыми. Требовать ≥2 видимых образца
  до запуска задержанного приложения и наблюдать ≥1500 мс после его инициализации.
  Для неизменного viewport отклонение left/width от конечной выбранной раскладки ≤1 px.
  Отдельно требовать доступный текст без нового loader, а не успешное скрытие скачка.

  Минимальные именованные сценарии и assertions:

  | Проверка | Действия и ожидаемый результат |
  | --- | --- |
  | `firstPaint` | Fresh и cache-disabled reload, mode отсутствует/1/3/4/5, 2560×1280; для 4/5 page=7500, content=6500. Раскладка с первого показа совпадает с итоговой; режим и валидные значения сохранены. |
  | `delayedApp` | Удержать основной app module 2500 мс, определив URL по script type=module в matching HTML. Прочие ресурсы не задерживать. До release видим правильный текст и раскладку; после release и debounce координаты не меняются. Выполнить для default и mode=5. |
  | `invalidStorage` | mode=999 и нечисловой mode дают FullWidth до/после mounted; проценты ниже6000, выше10000, нечисловые и6551 совпадают с clamp/ceil плагина, включая отложенное обновление. |
  | `blockedStorage` | На document-start чтение/запись ключей Nolebase бросают SecurityError; plain-страница и Mermaid с якорем доступны без необработанных исключений. Отдельно выполнить built bootstrap с бросающим getter localStorage и проверить FullWidth fallback. После mount отозвать чтение и проверить реальный SPA к Mermaid. Это уточнение по Ruling журнала: полный отказ getter также ломает существующий VitePress вне этой интеграции. Ожидаемые сообщения VueUse отделены от настоящих ошибок. |
  | `controlsAndNavigation` | Реально переключить режим через меню, сохранить, перейти SPA, Back и reload; выбор сохранён и ранний скрипт не возвращает прежний режим. Использовать существующие helpers/селекторы controls. |
  | `responsive` | 390×844 и desktop 1439/1440, resize 2560→390→2560 после готовности. Ни overflow, ни потери выбора; после resize установлены правильные проценты. После стабилизации новый reload снова без скачка. |

  Default и mode=5 проверить в обеих темах; остальные случаи достаточно один раз.
  Сохранить существующий observer ошибок и его negative self-check. Проверку без JS
  выполнить существующим подходом: текст доступен, новый механизм его не скрывает.

- [x] **3. Доказать RED на исходной реализации.** Собрать
  `CHROMIUM_PATH=/opt/google/chrome/chrome DIAGRAMS_NATIVE=1 bun run build`, затем
  `CHROMIUM_PATH=/opt/google/chrome/chrome bun scripts/check-readability.ts width`.
  Ожидается ошибка изменения видимых координат, воспроизводящая исходный дефект;
  не принимать таймаут fixture или отсутствующий селектор за RED.

- [x] **4. Реализовать минимальный bootstrap.** `readingLayoutHeadScript(): string`
  сериализует независимую функцию. Если body ещё нет, одноразовый MutationObserver
  применяет состояние сразу при его появлении и отключается; DOMContentLoaded/mounted
  для этого слишком поздние. При готовом body применить сразу. Менять только
  классы плагина и его CSS-переменные на body, не создавать постоянный слой CSS
  или обработчик, конкурирующий с controls. Существующий head сохранить.

  Режимы: 1 FullWidth, 3 Original, 4 SidebarWidthAdjustableOnly, 5 BothWidthAdjustable;
  отсутствующий/неподдерживаемый режим — 1. Разбор числового режима согласовать с
  VueUse установленного пакета; некорректный сохранённый режим нормализовать в storage
  с обработкой отказа записи, чтобы plugin mount не вернул другой класс.
  Проценты: отсутствующий page=10000/content=8000; parseInt, NaN→10000,
  clamp6000..10000, ceil(value/100)%; ниже1440px обе переменные100%.
  Валидные настройки не перезаписывать. Ошибка чтения — defaults без падения.

- [x] **5. Согласовать проверку готовности статьи.** В `widthsReady` обеспечить
  безопасное чтение и те же defaults/проценты при доступном storage. При отзыве доступа принять уже применённую раскладку, оставив критерий стабильной геометрии. Не менять deadline,
  владельца прокрутки, готовность SVG или смысл существующего загрузчика.
  Если повторение преобразования требует общего helper, он должен оставаться
  сериализуемым; не создавать вторую независимую конфигурацию раскладки.

- [x] **6. Получить GREEN.** Повторить секцию `width` на собранном исправлении.
  Выполнить `loading scroll plugins` для Mermaid, якорей и controls, включая
  `modules/2/tracks/offline/caching-strategies#stalewhilerevalidate`.
  Отдельные сценарии измерения ширины не требуют полной декартовой матрицы всех fixtures.
  Убедиться, что отказ storage не превращает подготовку Mermaid в необработанный exception.

- [x] **7. Проверить nested base и обязательные команды.** Выполнить
  `bun run typecheck`, `bun run test`, `bun run modules:check`, затем успешную root build.
  Для вложенного пути собрать с `SITE_BASE=/branches/fix-reading-width-first-paint/`
  и теми же CHROMIUM_PATH/DIAGRAMS_NATIVE; matching runner запустить с тем же SITE_BASE,
  секции `width loading scroll plugins`. Между сборками не использовать старый dist.
  Root и nested собирать последовательно; браузерные проверки должны читать свой build.

- [x] **8. Документировать и закоммитить.** Кратко обновить README, зафиксировать RED/GREEN,
  команды и артефакты в журнале execution skill. `git diff --check`; убедиться, что нет
  нового loader, lockfile/форка и посторонних изменений. Коммит на русском:
  `fix(docs): применять ширину чтения до первого отображения`. Спеку и план включить в ветку.

## Завершение

- [ ] Пройти независимое ревью по выбранному execution skill; при SDD обязательны ревью
  задачи и итоговое ревью. Исправления проверяются затронутыми сценариями.
- [ ] Открыть PR в main с разделами «Что / Решения / Проверка» и ссылкой на branch preview;
  не вливать без поручения. Проверить актуальный head, CI и фактическую публикацию preview.
- [ ] На preview проверить default hard reload и сохранённый mode5 с document-start trace;
  результат локального build не объявлять проверкой публикации. Передать PR, результаты
  и ограничения: браузерная автоматизация Chromium не доказывает работу Safari/Firefox.

## Самопроверка плана

Одна задача охватывает раннюю установку, config, потребителя widthsReady и браузерную
регрессию. Все пять Review Focus закреплены отдельными scenarios. Сигнатуры совпадают,
настройки и численные границы сверены с установленным пакетом. Проверка первого показа
не заменена конечным состоянием или loader. Способ выполнения: superpowers:executing-plans, выбран владельцем.
