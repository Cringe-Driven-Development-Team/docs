# Публикация OpenWiki на Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Публиковать родной визуализатор OpenWiki по `https://docs.cellestial.ru/openwiki/` с датой и исходным SHA wiki и ссылкой в шапке документации.

**Architecture:** При каждой сборке Pages OpenWiki 0.7.2 статически экспортирует уже закоммиченную wiki в `dist/openwiki/`; небольшой скрипт дополняет экспорт метаданными checkpoint. VitePress даёт ссылку на этот каталог, а существующий Pages workflow публикует `dist/` и превью веток. Генерация wiki моделью остаётся отдельной ручной операцией.

**Tech Stack:** Bun, TypeScript, VitePress, OpenWiki 0.7.2, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-24-openwiki-visualizer-pages-design.md`

## Global Constraints

- Публичный путь — `/openwiki/`, путь превью — `/branches/<slug>/openwiki/`; браузерные файлы OpenWiki должны ссылаться друг на друга относительно своего каталога.
- Закрепить точную версию OpenWiki `0.7.2`; его Node engine требует `>=22.22.0`.
- Показывать `updatedAt` и **полный** `gitHead` из `openwiki/.last-update.json`, а не время сборки или HEAD сайта; SHA ведёт на коммит `Cringe-Driven-Development-Team/docs`.
- Вывод визуализатора остаётся только в `dist/`, без коммита generated assets и без переноса Markdown в `site/`.
- Ни сборка, ни CI не запускают модель, не требуют API-ключ и не добавляют расписание обновления wiki. Существующее расписание пересборки Pages не меняется.
- Сохранять визуализатор OpenWiki с графом и Markdown reader; в статическом варианте допустим индикатор `Static` и нет live reload.

## Review Focus

1. Отсутствующий checkpoint: сборка должна упасть до экспорта и не показать выдуманные метаданные — тест в Task 1.
2. `status`, дата или SHA в checkpoint неверны: сборка должна упасть с понятной ошибкой — табличный тест в Task 1.
3. HTML OpenWiki изменил ожидаемую точку вставки: сборка должна упасть, а не молча потерять строку метаданных — тест в Task 1.
4. Wiki отстала от нового HEAD сайта: строка показывает прежний `gitHead` checkpoint — тест в Task 1.
5. Превью ветки имеет ненулевой `SITE_BASE`: ссылка в меню и относительные ресурсы wiki должны вести внутрь превью — проверка собранного HTML и HTTP в Task 2.

---

### Task 1: Статический экспорт OpenWiki и происхождение данных

**Files:**
- Create: `scripts/export-openwiki.ts` — проверка checkpoint, вызов штатного экспортера, вставка строки метаданных в HTML/CSS.
- Create: `scripts/export-openwiki.test.ts` — поведение экспорта на фикстуре и валидация входа.
- Modify: `package.json`, `bun.lock` — `openwiki@0.7.2` как точная devDependency, Node engine `>=22.22.0`, команда `wiki:export`.

**Interfaces:**
- Consumes: `openwiki/.last-update.json`, `openwiki/**/*.md`, локальный бинарник `openwiki` из `node_modules/.bin`.
- Produces: `export type WikiProvenance = { updatedAt: string; gitHead: string }`; `readWikiProvenance(raw: unknown): WikiProvenance`; `decorateVisualizer(html: string, css: string, info: WikiProvenance): { html: string; css: string }`; `exportWikiVisualizer(root: string, runVisualizer?: (source: string, output: string) => Promise<void>): Promise<void>`; файлы в `dist/openwiki/`.

- [ ] **Step 1: Написать падающие тесты `scripts/export-openwiki.test.ts`.** Проверить: `readWikiProvenance` принимает `status: complete`, ISO `updatedAt` и 40-символьный hex SHA; отвергает отсутствие полей, другой status, недействительную дату и SHA. `decorateVisualizer` вставляет `<time datetime="2026-10-24T17:03:09.475Z">`, полный SHA и `https://github.com/Cringe-Driven-Development-Team/docs/commit/<SHA>` перед `<div class="main" id="main">`; SHA не заменяется HEAD тестового репозитория. Неизвестный HTML без этой точки вставки отвергается. Для `exportWikiVisualizer` фиктивный runner пишет пять соседних файлов, после чего тест проверяет их наличие, изменённый HTML/CSS и отсутствие старого файла из предыдущего `dist/openwiki/`; при отсутствующем checkpoint runner не вызывается.
- [ ] **Step 2: Запустить адресные тесты и подтвердить RED.** `bun test scripts/export-openwiki.test.ts`; ожидаются ошибки отсутствующих экспортов или провалы указанных утверждений.
- [ ] **Step 3: Добавить зависимость и команду.** `bun add -d openwiki@0.7.2 --exact`; в `package.json` установить `engines.node: ">=22.22.0"` и `wiki:export: "bun scripts/export-openwiki.ts"`; сохранить обновлённый `bun.lock`.
- [ ] **Step 4: Реализовать `readWikiProvenance(raw)` в `scripts/export-openwiki.ts`.** Принимать только `status: complete`, действительный ISO `updatedAt` и полный 40-символьный hex `gitHead`; ошибка на другом значении называет поле.
- [ ] **Step 5: Реализовать `decorateVisualizer(html, css, info)`.** Вставить адаптивную строку происхождения между верхней панелью и `.main`, дописать стили в `styles.css`; требовать ровно одну точку вставки. Отображать дату как `YYYY-MM-DD HH:mm UTC`, полный SHA как ссылку на коммит.
- [ ] **Step 6: Реализовать `exportWikiVisualizer(root, runVisualizer?)` и прямой запуск скрипта.** Проверить checkpoint до экспорта; очищать только `dist/openwiki/`; вызвать `openwiki visualize openwiki --export dist/openwiki` без модели и сетевого сервера; требовать `index.html`, `client.js`, `client-lib.js`, `styles.css`, `graph.json`. При прямом запуске вызвать `exportWikiVisualizer(process.cwd())` и завершать процесс ненулевым кодом при ошибке.
- [ ] **Step 7: Подтвердить GREEN.** `bun test scripts/export-openwiki.test.ts && bun run typecheck`; ожидаются 0 ошибок.
- [ ] **Step 8: Проверить реальный экспорт на закоммиченной wiki.** `bun run wiki:export`; убедиться, что `dist/openwiki/graph.json` содержит страницу `quickstart`, в `index.html` есть `data-static-export="true"`, относительные ссылки `./client.js`, `./styles.css`, полный SHA и дата из checkpoint. Подать `dist/` обычным статическим HTTP-сервером и проверить браузером граф и reader без процесса `openwiki visualize`.
- [ ] **Step 9: Выполнить проверки перед коммитом.** `bun run typecheck && bun run test && bun run modules:check && CHROMIUM_PATH=/usr/bin/google-chrome DIAGRAMS_NATIVE=1 bun run build && git diff --check`; ожидаются 0 ошибок.
- [ ] **Step 10: Сделать отдельный коммит.** Коммит на русском только с файлами Task 1.

### Task 2: Сборка Pages и вход с сайта

**Files:**
- Modify: `package.json` — запуск `wiki:export` в `build:native` после `site:vitepress` и до `site:check`.
- Modify: `site/.vitepress/config.mts` — пункт `OpenWiki` первым в `themeConfig.nav`, ссылка `/openwiki/`.
- Modify: `site/project-context.md` — ссылка на публичный визуализатор.
- Modify: `scripts/openwiki-pages.test.ts` — отдельно проверить ссылку на сайте и сохранённую ссылку на исходный Markdown в README.
- Modify: `README.md` — коротко описать публичный адрес и то, что Pages экспортирует уже обновлённую wiki.

**Interfaces:**
- Consumes: команду `bun run wiki:export` и каталог `dist/openwiki/` из Task 1, `SITE_BASE` существующей сборки VitePress.
- Produces: корневой и веточный сайт с работающим пунктом меню OpenWiki; существующий Pages workflow публикует тот же `dist/`.

- [ ] **Step 1: Обновить падающий тест `scripts/openwiki-pages.test.ts`.** Для `site/project-context.md` ожидать `](/openwiki/)`; для README сохранить прямую ссылку на `openwiki/quickstart.md` на GitHub и правила о каноническом `docs`. Запустить `bun test scripts/openwiki-pages.test.ts` и подтвердить RED на ссылке контекста.
- [ ] **Step 2: Добавить вход с сайта.** Применить скилл `docs-site`; в `site/.vitepress/config.mts` первым nav-пунктом поставить `{ text: 'OpenWiki', link: '/openwiki/', activeMatch: '^/openwiki/' }`; изменить ссылку в `site/project-context.md`.
- [ ] **Step 3: Обновить README.** Добавить публичный адрес и объяснение, что Pages экспортирует содержимое после ручного обновления wiki и слияния PR.
- [ ] **Step 4: Подключить экспорт к сборке.** В `build:native` вызвать `bun run wiki:export` после `bun run site:vitepress` и до `bun run site:check`. Workflow Pages уже использует `bun run build`, поэтому отдельный workflow не нужен.
- [ ] **Step 5: Подтвердить GREEN и корневую сборку.** `bun test scripts/openwiki-pages.test.ts`, затем `bun run typecheck && bun run test && bun run modules:check && CHROMIUM_PATH=/usr/bin/google-chrome DIAGRAMS_NATIVE=1 bun run build`; ожидаются 0 ошибок, `dist/openwiki/index.html` и рабочая ссылка `/openwiki/` в `dist/index.html`, `site:check` проходит.
- [ ] **Step 6: Проверить префикс ветки.** С `SITE_BASE=/branches/docs-openwiki-site/` пересобрать VitePress и запустить `site:check`; проверить, что nav ведёт на `/branches/docs-openwiki-site/openwiki/`, `dist/openwiki/index.html` ссылается на соседние `./client.js` и `./styles.css`, а `client.js` читает `./graph.json`. После push проверить HTTP 200 и загрузку графа по `/branches/docs-openwiki-site/openwiki/`.
- [ ] **Step 7: Проверить diff.** `git diff --check`; убедиться, что нет `dist/` и сгенерированных wiki файлов.
- [ ] **Step 8: Сделать отдельный коммит.** Коммит на русском только с файлами Task 2.

## Итоговая проверка и доставка

- [ ] Проверить весь diff относительно актуального `origin/main`: только спецификация, план, скрипт экспорта, зависимость, сборка, ссылки и тесты; никаких `dist/`, wiki Markdown, scheduled workflow или ключей.
- [ ] Открыть PR в `main` с разделами «Что», «Решения», «Проверка» и ссылкой на превью ветки; дождаться обязательного CI и проверить страницу превью браузером.
- [ ] После слияния проверить HTTP 200 по `https://docs.cellestial.ru/openwiki/`, доступность `graph.json` и ресурсов, граф/reader, дату и SHA checkpoint, а также ссылку в шапке главной страницы. Слияние и post-merge проверку выполнять в рамках выданного пользователем разрешения.
