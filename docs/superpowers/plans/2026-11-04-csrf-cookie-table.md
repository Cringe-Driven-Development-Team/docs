# Таблица cookie сессии — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Представить атрибуты cookie в документации CSRF таблицей из шести строк.

**Architecture:** Обычная Markdown-таблица внутри существующего раздела. Пояснения остаются абзацами перед и после таблицы; тему и компоненты менять не требуется.

**Tech Stack:** Markdown, VitePress, существующие проверки Bun и Docker-сборка.

**Spec:** `docs/superpowers/specs/2026-11-04-csrf-cookie-table-design.md` (утверждена).

## Global Constraints

- Править только раздел «Cookie сессии» в `site/documentation/security/csrf.md`.
- Перенести все шесть пар атрибут/значение из спеки без дополнительных строк.
- Сохранить сведения о токенах, сроках, AES-256-GCM, JavaScript, ограничениях cookie и транспорте клиента.
- Даты, источники, схемы, зависимости и generated OpenWiki не менять.
- Не добавлять тесты, фиксирующие точную редактуру обычного текста: проверить существующие тесты и собранную страницу.

## Review Focus

- Редакторская проверка: после переноса не потеряны ограничения `SameSite=Lax` и различие site/origin (шаги 1, 3).
- На узком экране имя cookie и значения читаются целиком, таблица не расширяет страницу (шаг 3).
- Перенос атрибутов не меняет смысл сведений о шифровании и доступе JavaScript (шаги 1, 3).

## Task 1: Перенести атрибуты в таблицу и проверить страницу

**Files:** Modify: `site/documentation/security/csrf.md`. Existing tests: `scripts/security-pages.test.ts`.

**Interfaces:** Consumes: текущий раздел и таблица из спеки. Produces: тот же маршрут `/documentation/security/csrf`, тот же якорь `#cookie-сессии`.

- [x] **Шаг 1. Изменить Markdown.** Перед таблицей оставить короткий абзац о содержимом cookie, шифровании и недоступности открытых токенов для JavaScript. Вставить таблицу из спеки. Следующий абзац с объяснениями атрибутов и транспорта сохранить. Проверить diff: изменён только этот раздел.
- [x] **Шаг 2. Выполнить штатные проверки.** Команды: `bun run typecheck`, `bun run test`, `bun run build`, `git diff --check`. Expected: все команды завершаются с кодом 0. Для Docker допустим уже проверенный запуск того же образа с `PUPPETEER_SKIP_DOWNLOAD=true` и установленным Chromium; команды сборки не менять.
- [x] **Шаг 3. Осмотреть собранную страницу.** Запустить `bunx vite preview --host 127.0.0.1 --port 4173 --strictPort --outDir dist`, открыть `/documentation/security/csrf` в Chrome при ширине 1440 и 390 px. Expected: две колонки, шесть строк данных из спеки, читаемые значения, нет горизонтального переполнения страницы; пояснения до и после таблицы сохранены. Сохранить и просмотреть снимки раздела; после проверки остановить свой сервер. Полный browser suite не требуется для этой редакторской правки.
- [x] **Шаг 4. Закоммитить изменение.** `git add site/documentation/security/csrf.md docs/superpowers/plans/2026-11-04-csrf-cookie-table.md` и `git commit -m 'docs(security): представить атрибуты cookie таблицей'`. Expected: коммит содержит страницу и план; завершённые шаги отмечены, рабочее дерево чистое.
