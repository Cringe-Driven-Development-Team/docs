# Удаление Inline Link Preview — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development; user explicitly selected SDD for this plan. Steps use checkbox syntax.

**Goal:** Полностью удалить hover-preview ссылок и сохранить штатную навигацию документации.
**Architecture:** Одна атомарная задача удаляет интеграцию и переводит её проверки на обычные ссылки. Существующие VitePress, Enhanced Readabilities, Tabs, Group Icons, Mermaid и Eraser используются без замены.
**Tech Stack:** VitePress 2, Vue, Bun, существующий Puppeteer CLI.
**Spec:** `docs/superpowers/specs/2026-11-01-remove-inline-link-preview-design.md` — утверждена пользователем.

## Global Constraints

- Enhanced Readabilities с FullWidth и сохранёнными настройками, Tabs, Group Icons, Mermaid и Eraser остаются. Их зависимости/стили не удаляются вместе с preview.
- Текст страниц, ID заголовков, маршруты, sidebar и схемы не меняются. Существующий Mermaid-scroll hook не переписывается без воспроизводимой отдельной причины.
- Удалить только устаревшие unit-кейсы фильтра preview. Остальные проверки publishing/front-libs из `scripts/readability-links.test.ts` сохранить.
- Архивные спеки/планы не переписывать; превью веток Pages остаётся отдельным механизмом.
- Не заявлять исчезновение всех скачков, если повтор видео показывает отдельную проблему после удаления preview. Новый merge отдельно не поручен.

## Review Focus

1. Наведение на ссылки из видео не создаёт popup/preview iframe и не меняет позицию/размеры уже готовой страницы на 2560×1440.
2. Обычный клик остаётся SPA-переходом внутри текущей базы; `#networkonly` доступен после Mermaid, reload/Back работают.
3. Другие проверки из смешанного readability-links.test.ts и настоящие iframe схем не удалены вместе с preview.
4. FullWidth, сохранённая узкая ширина, Tabs/клавиатура, Group Icons, sidebar и статический OpenWiki продолжают работать на desktop/mobile.
5. Активный docs-site описывает обычные ссылки; Claude/Codex копии обновляются отдельно, без потери параллельных правок.

### Task 1: Удалить плагин, обновить проверки и справку

**Files:**
- Modify: `package.json`, `bun.lock` — удалить только `@nolebase/vitepress-plugin-inline-link-preview` и ставшие ненужными транзитивные записи средствами Bun.
- Modify: `site/.vitepress/config.mts`, `site/.vitepress/theme/index.ts`, `site/.vitepress/theme/custom.css` — убрать transform, регистрацию/компонент/неиспользуемые импорты, client exclude и CSS только preview.
- Delete: `site/.vitepress/link-preview.ts`.
- Modify: `scripts/readability-links.test.ts`, `scripts/check-readability.ts` — сохранить несвязанные тесты, заменить preview-сценарии реальной проверкой обычных ссылок.
- Modify: `.agents/skills/docs-site/SKILL.md`; regenerate `.claude/skills/docs-site/SKILL.md` через `bun run skills:sync`.
- Include: утверждённую спеку и этот план в коммитах задачи. Домашний `/home/oleg/.codex/skills/docs-site/SKILL.md` устанавливается после принятого ревью с проверкой исходного хеша.

**Interfaces:**
- Consumes: свежий `origin/main`, существующий browser CLI и видео-сценарий offline/theory → caching-strategies#networkonly.
- Produces: штатные ссылки без preview; сохраняет секции CLI `hierarchy`, `scroll`, `pages`, `plugins`, `title` и `READABILITY_ARTIFACTS_DIR`. Новая preview-обёртка, router или переключатель не создаются.

- [ ] **Step 1: Обновить базу и зафиксировать RED.** В изолированной feature-ветке от свежего `origin/main` найти все активные consumers плагина, сохранить home-хеш скилла и базовый diff защищённых страниц/схем. Собрать baseline существующей native-командой `CHROMIUM_PATH=/opt/google/chrome/chrome DIAGRAMS_NATIVE=1 bun run build`. В существующем CLI добавить сценарий обычных ссылок, заменив только проверяемые ожидания preview: дождаться `document.fonts.ready` и готовности Mermaid, на 2560×1440 навести курсор на ссылки стратегий, assert отсутствие preview popup/iframe и стабильные scrollY/размеры. Выполнить RED до удаления плагина: реально появившийся popup обязан нарушить assert. Без assertion по одному наличию строк импорта.
- [ ] **Step 2: Удалить интеграцию.** `bun remove @nolebase/vitepress-plugin-inline-link-preview`; удалить transform/client exclude, wrapper/регистрацию/импорты/CSS и helper. Оставить `@nolebase` SSR/fastdom настройки, нужные Enhanced Readabilities. Убрать только obsolete preview unit-кейсы и дублирующие browser-ожидания, сохранив проверки publishing/front-libs. Новое hover/click покрытие держать в существующей секции plugins; hierarchy сохраняет навигацию/поиск/OpenWiki без обязательного iframe-preview.
- [ ] **Step 3: Обновить docs-site.** Заменить активную инструкцию Inline Link Preview кратким описанием обычных ссылок без hover-preview и актуализировать перечисление browser-проверок; сведения о ширине, sidebar и branch preview сохраняются. До/после сверить применение справки к сценарию «что делает hover, как открыть ссылку/якорь и какими секциями проверить это, не сбрасывая ширину»; не добавлять строковые тесты на формулировки. `bun run skills:sync`, validator скилла и тесты синхронизации должны пройти; домашнюю копию до ревью не перезаписывать.
- [ ] **Step 4: Проверить GREEN и регрессии на root.** Выполнить `bun run typecheck`, `bun run test`, `bun run modules:check`, native build, затем `CHROMIUM_PATH=/opt/google/chrome/chrome READABILITY_ARTIFACTS_DIR=".superpowers/sdd/2026-11-01-remove-inline-link-preview/readability" bun scripts/check-readability.ts hierarchy scroll plugins`. Проверить отсутствие popup при повторных наведениях, обычный клик в caching-strategies#networkonly, видимость целевого heading после готовности схем, reload/Back и SPA-маркер; сохранить состояния/скриншоты, в том числе mobile390 и обе темы. Оставшиеся смещения после удаления описать точно, не объявляя все скачки исправленными и не переписывая scroll hook наугад.
- [ ] **Step 5: Проверить вложенную базу.** Заново собрать с `SITE_BASE=/branches/docs-remove-inline-link-preview/` и повторить затронутые browser-секции с тем же `SITE_BASE`. Native-команды и Chrome path — как выше. Ссылки/история/хеши/OpenWiki не выходят из базы; настоящие iframe схем продолжают загружаться. Сохранить проверки FullWidth/узкой ширины, Tabs, иконок и меню, не запускать заново несвязанные матрицы title/всех страниц без причины.
- [ ] **Step 6: Самопроверка и коммит.** `git diff --check`, классификация оставшихся упоминаний preview (история/отрицательные assertions/branch preview допустимы), отсутствие импорта удалённого helper/пакета, неизменность страниц/ID/схем и работа остальных плагинов. Коммит `refactor(документация): удалить Inline Link Preview`. Отчёт содержит точные команды, результаты RED/GREEN, ограничения и SHA; CI не подменяется native-сборкой.

## Завершение после выбранных ревью

После ревью задачи и итогового ревью ветки установить точный принятый docs-site в Codex с backup/hash guard, сверить три копии. Отправить feature-ветку и открыть draft PR в main с разделами «Что», «Решения», «Проверка» и ссылкой на превью. Проверить CI на точном head, настоящий Pages build/deploy и в опубликованной ветке повторить hover/click из видео. Сохранить доказательства; новый PR без отдельного поручения не вливать.
