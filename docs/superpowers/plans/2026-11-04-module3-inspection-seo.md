# Инспекция переменных и SEO в модуле №3 — план реализации

> **Для исполнителя:** использовать выбранный пользователем `superpowers:executing-plans`
> или `superpowers:subagent-driven-development`. До выбора реализацию не начинать.
> Выполнение отмечать чекбоксами.

**Цель:** добавить два трека модуля №3 с согласованными исполнителями и Open graph внутри SEO.

**Архитектура:** две страницы Markdown с frontmatter существующего module-graph.
Меню и граф строятся автоматически; Open graph — подзадача SEO и раздел его страницы.

**Технологии:** VitePress, `@tp-prepare/vitepress-module-graph`, Bun.

**Спецификация:** [согласованный дизайн](../specs/2026-11-04-module3-inspection-seo-design.md).

## Общие ограничения

- Ветка `docs/module3-inspection-seo`, worktree `.claude/worktrees/module3-inspection-seo`.
- Инспекция — `ManInTheCoat: front`, SEO — `iRedTea: front`; оба `area: front`, `mentors: [YarikMix]`.
- Названия: «Инспекция переменных ячейки блокнота», «SEO», «Open graph».
- Это план модуля; техническую реализацию функций и задачи GitHub не добавлять.
- Новые зависимости и правки конфигурации меню не нужны.

## Фокус проверки

- Точные названия и назначения должны сохраниться после разбора frontmatter — существующий тест данных.
- Open graph должен оказаться внутри SEO — проверка разобранных `subtasks` и HTML страницы.
- Новые страницы доступны из меню, заголовки читаемы — собранный HTML и браузерная проверка `hierarchy`.
- Нагрузка учитывает новые треки, существующие назначения сохранены — обновлённые ожидания теста данных.
- Описания остаются планом модуля — осмотр текста при ревью.

## Task 1: Добавить треки и проверить их отображение

**Файлы:** создать `site/modules/3/tracks/variable-inspection.md` и
`site/modules/3/tracks/seo.md`; изменить `scripts/modules-data.test.ts`.

**Интерфейсы:** существующий `loadModuleDir("site/modules")` читает страницы;
новые ID — `variable-inspection` и `seo`, вложенный пункт — `subtasks: [Open graph]`.

- [x] Запустить исходные `bun run modules:check` и `bun test scripts/modules-data.test.ts`.
- [x] Обновить ожидания существующего теста данных: список ID
  `["react-hook-form", "seo", "trpc", "variable-inspection", "zod"]`, число треков `5`;
  нагрузка `YarikMix: [0, 5]`, `ManInTheCoat: [2, 0]`, `iRedTea: [3, 0]`, остальные `[0, 0]`.
  Закрепить новые назначения и вложенность:

  ```ts
  expect(tracks.get("variable-inspection")?.title).toBe("Инспекция переменных ячейки блокнота");
  expect(tracks.get("variable-inspection")?.do).toEqual([{ login: "ManInTheCoat", side: "front" }]);
  expect(tracks.get("seo")?.title).toBe("SEO");
  expect(tracks.get("seo")?.do).toEqual([{ login: "iRedTea", side: "front" }]);
  expect(tracks.get("seo")?.subtasks.map((s) => s.title)).toEqual(["Open graph"]);
  for (const id of ["variable-inspection", "seo"]) expect(tracks.get(id)?.area).toBe("front");
  ```

- [x] Запустить `bun test scripts/modules-data.test.ts`: падение только из-за отсутствующих новых треков.
- [x] Создать две страницы с согласованным frontmatter и коротким описанием темы как плана;
  на странице SEO добавить `## Open graph` и предложение о превью ссылок.
- [x] Запустить `bun run modules:check` и `bun test scripts/modules-data.test.ts`: успешное завершение.
  Через `loadModuleDir` вывести два новых трека и проверить названия, исполнителей, менторов и подзадачу.
- [x] Выполнить `bun run typecheck && bun run test && bun run build`;
  при недоступном Docker использовать `DIAGRAMS_NATIVE=1 bun run build`.
- [x] Проверить в `dist/modules/3/tracks/` обе страницы, заголовок Open graph и ссылки меню;
  запустить `CHROMIUM_PATH='<установленный Chrome>' bun scripts/check-readability.ts hierarchy`.
- [x] Выполнить ревью по выбранному способу реализации, исправить замечания и проверить исправленное.
- [x] Закоммитить спецификацию, план, страницы и тест:
  `docs(modules): добавить инспекцию переменных и SEO в третий модуль`.

## Самопроверка плана

Согласованные названия, назначения, ментор, вложенность, краткие описания и проверки покрыты одной задачей.
Дополнительных функций нет. Пользователь выбрал `superpowers:executing-plans`.

## Результат выполнения

Исполнено через `superpowers:executing-plans`. Typecheck, 474 теста и Docker-сборка
успешны; `site:check` проверил 183 страницы. Браузерная проверка `hierarchy`
и обеих новых страниц на 1440/390 px успешна. Независимое итоговое ревью:
Critical — 0, Important — 0, Minor — 0.

Служебный заголовок `Task 1` нужен парсеру журнала; содержание задачи не менялось.
Ревью выполнено после коммита, поскольку инструмент собирает пакет по диапазону
коммитов. Замечаний и исправляющих коммитов не потребовалось.
