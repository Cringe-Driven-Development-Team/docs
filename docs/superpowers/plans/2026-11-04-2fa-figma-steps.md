# Переключение экранов Figma: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Перенести согласованный четырёхшаговый просмотрщик на страницу 2FA: фронт.

**Architecture:** Расширить существующий FigmaEmbed до списка экранов с одним iframe.
Переиспользовать figmaUrls и текущую регистрацию компонента; обновить единственного потребителя.

**Tech Stack:** Vue, TypeScript, VitePress, Bun, существующий браузерный CLI.

**Spec:** `docs/superpowers/specs/2026-11-04-2fa-figma-steps-design.md`.

## Global Constraints

- Один живой iframe, без новых зависимостей и PNG в сайте.
- Порядок: Профиль → QR-код → Ввод кода → 2FA подключена; начальный QR-код.
- URL всех экранов проходят figmaUrls; подписи и title непустые.
- Сценарии 2FA, Mermaid, frontmatter и файл Figma не меняются.

## Review Focus

- Некорректный URL скрытого экрана обнаруживается до переключения.
- Клавиатура работает на границах списка и позволяет выйти из виджета.
- SSR и гидратация сохраняют QR-код и уникальные связи ARIA.
- Узкий режим чтения, мобильная ширина и длинная подпись не ломают страницу.
- Недоступная Figma не мешает переключению и обычной ссылке; реальная загрузка проверяется отдельно.

### Task 1: просмотрщик, страница и проверки

**Files:**
- Modify: `site/.vitepress/theme/FigmaEmbed.vue`.
- Modify: `site/modules/2/tracks/2fa-front.md`.
- Modify: `scripts/figma-embed-pages.test.ts`.
- Modify: `scripts/check-readability.ts` (существующие проверки Figma).
- Existing tests: `scripts/figma-embed.test.ts`.

**Interfaces:**
- Consumes: `figmaUrls(input: string): { embed: string; source: string }`.
- Produces: props `screens: { label: string; title: string; url: string }[]`,
  `initialIndex?: number` (по умолчанию 0). Страница передаёт `initialIndex=1`.
- Точные node-id: `398-52651`, `496-16027`, `513-23275`, `496-16218`;
  общий URL `https://www.figma.com/design/7iaVDGiwzQk2vZIB5ogVlq/Cellestial`.

- [ ] Обновить тест страницы: один FigmaEmbed между схемой подключения и входом;
  четыре node-id и подписи в согласованном порядке, initialIndex=1; Mermaid и таблица макетов сохранены.
- [ ] Запустить `bun test scripts/figma-embed-pages.test.ts`, убедиться в падении из-за отсутствия четырёх экранов.
- [ ] Обновить FigmaEmbed и вызов на странице по интерфейсам выше. Проверять весь список
  до рендера; iframe и ссылка используют выбранный элемент. Добавить доступные вкладки,
  клавиатуру и адаптивные стили на токенах темы, сохранить высоту iframe 600 px.
- [ ] Расширить браузерную проверку Figma: перехватывать все четыре embed URL;
  проверить начальный QR, click каждой вкладки, единственный iframe, src/title/link,
  ARIA и roving tabindex, ArrowLeft/Right с переходом через край, Home/End и выход Tab.
  Проверить 390/1440 px, обе темы и узкий режим чтения. Сохранить проверки якоря и расположения.
- [ ] Проверить SSR-ошибки на временной тестовой странице: пустой список, пустая подпись/title,
  неверный URL неактивного экрана, индекс вне списка. Удалить временную страницу после проверки.
- [ ] Запустить `bun run modules:check`, `bun run typecheck`, `bun run test`, `bun run build`.
  Проверить обновлённую браузерную секцию Figma и секции `scroll plugins` через
  `CHROMIUM_PATH=/opt/google/chrome/chrome bun scripts/check-readability.ts` с выбранными секциями.
- [ ] Повторить подходящую сборку и браузерную проверку с
  `SITE_BASE=/branches/docs-2fa-figma-steps/`; проверить живую Figma отдельно,
  сохранить скриншот и результат, не смешивая с проверкой заглушки.
- [ ] Пройти ревью выбранного способа исполнения и исправить замечания.
- [ ] Коммит `feat(docs): переключать экраны подключения 2FA в Figma`, PR в main
  с разделами «Что», «Решения», «Проверка» и ссылкой на превью.

## Самопроверка плана

Одна задача охватывает компонент, единственного потребителя и проверки; новые абстракции
и зависимости не требуются. Все пять пунктов Review Focus включены в проверки выше.
Способ исполнения выбирает пользователь перед изменением продуктового кода.
