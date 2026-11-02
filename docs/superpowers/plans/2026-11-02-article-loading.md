# Короткий лоадер статьи — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** При открытии статьи с Mermaid показывать короткий лоадер, затем готовую видимую часть и правильно установленный якорь без последующего скачка.

**Architecture:** Маленький независимый от Vue bootstrap в head включает начальное состояние и собственный предел ожидания. Один контроллер темы согласует ширину, видимые схемы и якорь; общий SSR-компонент рисует состояние загрузки. Существующая коррекция якоря переезжает в этот контроллер, чтобы два таймера не двигали страницу независимо.

**Tech Stack:** существующие VitePress2, Vue3, TypeScript, CSS, Bun и Puppeteer; новые зависимости не нужны.

**Spec:** `docs/superpowers/specs/2026-11-02-article-loading-design.md`, утверждена владельцем 2026-11-02.

## Global Constraints

- Работать в существующем worktree `.claude/worktrees/article-loading`, ветка `docs/article-loading`, от `main` после PR134 (`d93749c`). Спека уже закоммичена; продуктовый код ещё не менялся.
- Копия предыдущей трассировки — `.superpowers/mermaid-loading-recon/`; сравнивать исходный сценарий fresh/reload, а не заново исследовать весь просмотрщик.
- Текст индикатора: «Загрузка статьи…». Предел ожидания: **5000ms**, без искусственного минимального времени показа.
- Лоадер только при initial/reload/переходе на другую статью с Mermaid. Смена темы, zoom и hash внутри открытой статьи его не включают. Статьи без Mermaid доступны сразу.
- Шапка и боковая навигация доступны. Статья и оглавление остаются в DOM и сохраняют размеры; не использовать display:none для измеряемого содержимого, body overflow lock или перехват фокуса.
- Не ждать все lazy-схемы. Учитывать текущий экран и preload-область renderer **200px сверху и снизу**; начатая отрисовка не должна сдвинуть раскрытую статью.
- Ошибка/таймаут/действие читателя/уход со страницы завершают или отменяют подготовку. Без JS и при незагрузившемся основном приложении текст не остаётся скрытым навсегда.
- Существующие цвета и типографика темы, обе темы, role=status, aria-busy и prefers-reduced-motion. Никакого процента загрузки или новой анимации перемещения статьи.
- Не менять форк renderer, зависимости, исходники50 схем, DiagramFrame/Panzoom и данные модулей; не генерировать OpenWiki и не менять AGENTS/CLAUDE.
- Сборка и browser CLI используют matching SITE_BASE/dist. Артефакты исполнения — только в workspace этого плана; завершённый план mermaid-layout не переисполнять.

## Review Focus

1. Основное приложение не загрузилось или JS отключён: доступность текста и выход по5000ms не зависят от Vue.
2. Якорь ниже lazy-схем, сохранённая ширина и поздние шрифты: статья раскрывается после позиционирования, без повторного видимого автоскролла.
3. Быстрый SPA/Back: старые promise/rAF/watchdog не меняют загрузку и scroll следующей статьи.
4. Wheel/touch/клавиатура во время подготовки: читатель получает управление; скрытое содержимое не удерживает фокус и не появляется при каждом hash/theme/zoom.
5. Схема с ошибкой или медленная схема за экраном: лоадер не зависает и не превращает lazy-страницу в ожидание всех SVG.

---

## Файлы и интерфейсы

- Create `site/.vitepress/theme/article-loading.ts`: bootstrap, ограниченная временем подготовка, готовность геометрии и единственный владелец коррекции якоря. Без импорта Vue и побочных обращений к DOM на уровне модуля: файл импортируется конфигом при SSR.
- Create `site/.vitepress/theme/ArticleLoading.vue`: только SSR-разметка индикатора; нет собственных таймеров и состояния готовности.
- Modify `site/.vitepress/config.mts`: добавить собственный head script, сохранив favicon и остальной head.
- Modify `site/.vitepress/theme/index.ts`: подключить компонент в `doc-top` и контроллер к initial/route/hash; сохранить `doc-before: trackHeader`, Mermaid factory/theme watcher, меню чтения, tabs, graph и legacy redirect.
- Modify `site/.vitepress/theme/custom.css`: первоначальная маска статьи/оглавления и индикатор в существующей теме.
- Modify `scripts/check-readability.ts`: секция `loading`, использующая существующий сервер, ошибки с document-start и Puppeteer; нового browser runner в репозитории не создавать.
- Modify `README.md`: коротко описать лоадер, предел ожидания и команду проверки.

**Runtime interfaces:**
- `articleLoadingHeadScript(): string` из `article-loading.ts` возвращает самодостаточный JS для head: без import, Vue или ссылок на замыкание модуля.
- `prepareArticle(options: { initial: boolean; showLoader: boolean }): () => void` запускает подготовку текущего документа и возвращает идемпотентную отмену. initial принимает оставшийся deadline bootstrap; поздняя гидратация не продлевает начальные5000ms и не скрывает уже раскрытый текст.
- `html[data-article-loading="pending"]` — общий DOM-признак маски. При finish/cancel он снимается только владельцем текущей подготовки. Внутренний bootstrap-state может хранить deadline/finish/interrupted; не создавать публичную шину событий или общий registry.
- `.article-loading[role="status"]` — индикатор; aria-busy обновляется на текущем `.VPDoc`. Для страницы без Mermaid CSS-маска не применяется даже до гидратации.
- `ArticleLoading.vue` подключается через `doc-top`: установленный `VPDoc.vue` размещает этот слот перед `.container`, которая содержит статью и aside. Поэтому маска не затрагивает сам индикатор, header или sidebar.
- `checkArticleLoading(browser: Browser, url: (path: string) => string): Promise<void>` — приватный вход новой секции browser CLI. Наблюдение использует `.VPDoc > .container`, `.article-loading` и существующие `figure[data-diagram-kind="mermaid"]/.diagram__canvas`.

### Task 1: Лоадер до готового первого кадра, интеграция и проверка

**Files:** все перечисленные выше. Это одна функциональная задача: bootstrap, DOM-индикатор и готовность образуют единый жизненный цикл.

**Interfaces:** consumes существующие Mermaid render-complete/размеры/transform и настройки Nolebase; produces три runtime-интерфейса выше и секцию CLI `loading`.

- [x] **1. Проверить baseline в выбранном worktree.** Установить текущий lock через `bun install --frozen-lockfile`, затем `bun run typecheck`, `bun run test`, `bun run modules:check`. Сохранить короткие логи в workspace плана. Ожидается чистая исходная ветка и474 теста без ошибок; зависимость renderer остаётся A9 из текущего lock.

- [x] **2. Добавить browser RED для загрузки.** Зарегистрировать `loading` в разрешённых аргументах CLI и вызвать `checkArticleLoading` в общем try/finally. Через evaluateOnNewDocument собирать с первого кадра `{time, articleVisible, loaderVisible, scrollY, headingTop, documentHeight, frameHeight, readyFrames}`; сохранить JSON и screenshots. Целевой маршрут: `modules/2/tracks/offline/caching-strategies#stalewhilerevalidate`, plain-страница без Mermaid: `documentation/project-context`.

  В тестах должны быть следующие именованные проверки с конкретными результатами:
  - `initialFrameMasked`: после появления статьи и до готовности контент/оглавление скрыты, status виден, header/sidebar доступны; при готовности маска исчезает.
  - `stableReveal`: после раскрытия в течение1000ms и после старого срока коррекции якоря положение heading меняется не более1px, scrollY не корректируется автоматически; целевой heading ниже закреплённой шапки. Наблюдать до lazy traversal.
  - `visibleOnly`: после готовности первый экран имеет SVG/начальный transform, но далёкие исходники ещё lazy. Отдельно проверить прямое открытие без hash.
  - `failOpen`: при удержании основного app module текст становится доступен к5000ms с разумным допуском планировщика250ms; при release после deadline не скрывается снова. С отключённым JavaScript статья доступна сразу.
  - `cancelAndSupersede`: wheel, touch и keydown завершают подготовку без preventDefault; поздний callback старого документа после реального SPA/Back не меняет новый loading/scroll.
  - `ordinaryActions`: страницы без Mermaid, повторный hash, тема и zoom не включают новый лоадер; готовые controls/Panzoom работают.
  - `errorAndTimeout`: удержанный результат видимой схемы и её реальная ошибка не оставляют статью навсегда скрытой; локальная ошибка видна после раскрытия. Ожидаемые fixture errors хранить отдельно от ошибок правильных страниц, как в существующем error/recovery тесте.

  Модуль приложения для задержки определить из `<script type="module" src>` собранного HTML, не по случайному hash имени. Для задержки готовности схемы можно перехватить scoped render-complete в test-only document-start fixture и позднее доставить его исходному wrapper; не добавлять test flags в продукт.

- [x] **3. Запустить RED на исходном matching build.** `CHROMIUM_PATH=/opt/google/chrome/chrome DIAGRAMS_NATIVE=1 bun run build`, затем `CHROMIUM_PATH=/opt/google/chrome/chrome bun scripts/check-readability.ts loading`. Ожидается падение на отсутствии начальной маски/индикатора, а не таймаут самой fixture. Сохранить координаты и полный failure.

- [x] **4. Реализовать ограниченный bootstrap в `article-loading.ts`.** `articleLoadingHeadScript()` сериализует только самодостаточную функцию со значением5000ms. Она работает до загрузки приложения, включает pending, отслеживает завершение/раннее действие читателя и гарантирует раскрытие по deadline. Старое завершение не влияет на новую подготовку. При отключённом JS pending не появляется. Не импортировать browser-only runtime из конфига и не использовать глобальные стили, скрывающие все статьи без проверки наличия Mermaid.

- [x] **5. Реализовать `prepareArticle` и перенести коррекцию якоря.** Переиспользовать текущие расчёты сохранённых ширин Nolebase, navBottom и отступа24px; удалить прежний независимый таймер из index.ts. Во время скрытой подготовки сначала установить нужный hash, затем дождаться шрифтов и viewer-ready схем в диапазоне `[-200, innerHeight+200]`. Учитывать уже начатую отрисовку, которая способна изменить геометрию; не ждать необследованные raw fences за экраном. SVG должен иметь размер/начальный transform; чистое наличие `<svg>` недостаточно. Готовые размеры/позиции должны совпасть с допуском1px на двух последовательных кадрах после выполнения условий. При reveal завершить все отложенные автокоррекции этой подготовки. При cancel/unmount очистить rAF/timers/listeners; async font/result callback проверяет владельца и актуальный документ.

- [x] **6. Подключить head, SSR-компонент, CSS и router.** Сохранить существующий head и слоты. Маска скрывает `.VPDoc > .container` с сохранением измеряемого layout; индикатор располагается в видимой области статьи и доступен без client mount. Добавить role=status/aria-busy, reduced-motion. first paint скрывается только на Mermaid-статьях; не менять min-height/натуральный размер карточек ради маски. initial использует bootstrap deadline, смена пути создаёт новую подготовку с5000ms, hash того же пути — коррекцию без лоадера. Пользовательский ввод имеет приоритет; ни body lock, ни диалог, ни восстановление старого фокуса не нужны.

- [x] **7. Получить GREEN и завершить приёмку.** Новая секция проходит fresh/reload/реальный SPA в обеих темах,2560×1440 и390×844, default и сохранённом узком режиме3; отдельный случай режима с регулируемой шириной проверяет существующий debounce. Проверить контролируемую позднюю готовность шрифта, reduced-motion и быстрые повторные переходы. Deadline/error fixtures достаточно выполнить по одному на нужный механизм, не размножать ожидание5s на всю матрицу.

  Команды: `bun run typecheck`, `bun run test`, `bun run modules:check`, root native build как выше, затем CLI `loading mermaid pages scroll plugins`. Ожидается отсутствие product errors/overflow, корректное раскрытие/отмена,474 unit tests либо больше при обоснованном добавлении pure-тестов. Существующие document-start observer и его negative self-check сохранить без ослабления. Полную матрицу выполнить один раз после интеграции; дальнейшие повторы только при новой правке/сбое.

  Nested: `SITE_BASE=/branches/docs-article-loading/ CHROMIUM_PATH=/opt/google/chrome/chrome DIAGRAMS_NATIVE=1 bun run build`, затем с теми же SITE_BASE/CHROMIUM_PATH CLI `loading scroll`. Ожидается matching dist и те же гарантии для начального HTML, SPA и hash. Широкие независимые проверки можно запускать параллельно только с неизменяемым соответствующим dist; не плодить второй browser runner или новые worktrees ради тестов.

- [x] **8. Документировать и закоммитить.** В README кратко указать готовность видимой части, предел5000ms и секцию CLI `loading`. Выполнить `git diff --check`; подтвердить отсутствие изменений схем, dependency lock и форка. Коммит: `fix(docs): показывать статью после подготовки видимых схем`. Whole-task gate: `bun run test`; журнал выбранного execution skill содержит RED/GREEN, matching build и принятые rulings.

## Завершение

- [ ] Выполнить ревью и исправления по выбранному execution skill; не заменять его собственной проверкой автора.
- [ ] Открыть новый docs PR в main, «Что / Решения / Проверка», ссылка на `/branches/docs-article-loading/modules/2/tracks/offline/caching-strategies#stalewhilerevalidate`. PR134 уже влит; не дописывать в его удалённую ветку и не сливать новый PR автоматически.
- [ ] Проверить CI актуального head и настоящий Pages deploy; подтвердить SHA в `/branches/`. На опубликованной версии записать first paint, готовый heading и отсутствие скачка после reveal в обеих темах. Dispatch сам по себе не подтверждает preview.
- [ ] Передать PR/preview, результаты и ограничения: при timeout доступность текста важнее последующей стабильности; реальные Safari/iPhone/Firefox не объявлять проверенными по Chromium.

## Самопроверка

Все требования утверждённой спеки находятся в одной задаче и включены в её проверки.
Пять Review Focus покрыты именованными loading fixtures. Интерфейсы head/controller,
pending DOM, doc-top и browser section совпадают между шагами. Решение по первому
кадру не зависит от основного приложения; deadline не обновляется при позднем mount.
Отдельной генерации размеров, нового renderer API и второго владельца hash-scroll нет.
Владелец выбрал superpowers:executing-plans; способ выполнения повторно не уточнять.
