# Подстраница «Сервис BFF» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** у трека BFF есть подстраница «Сервис BFF» с целевым устройством сервиса: каркас Hono + tRPC, env, health, логи, образ, прод.

**Architecture:** новый файл `site/modules/2/tracks/bff/service.md`, `service` в `pages` трека; тесты страниц —
`scripts/bff-pages.test.ts`, порядок подстраниц — `scripts/modules-data.test.ts`.

**Tech Stack:** VitePress markdown, bun test.

**Spec:** `docs/superpowers/specs/2026-10-12-bff-service-page-design.md`

## Global Constraints

- Worktree `cdd-docs/.claude/worktrees/bff-service`, ветка `docs/bff-service` от `main` `c65e17e`.
- Содержание страницы — строго спека §3: шесть разделов `##` в порядке «Каркас», «Переменные окружения», «Health check», «Ошибки и логи», «Сборка и образ», «На проде».
- Адаптер — `fetchRequestHandler` из `@trpc/server/adapters/fetch`; `@hono/trpc-server` на странице не упоминается.
- Образ — `oven/bun:<точная версия>-alpine`; версию не выдумывать: на странице плейсхолдер «точная версия — в Dockerfile, закрепляется в frontend#4» или актуальный тег, проверенный в Docker Hub на дату PR.
- Переменные: `SESSION_KEY`, `APP_ORIGIN`, `GO_API_URL`, `PORT` (по умолчанию `3000`); значения секретов на странице не приводятся.
- Ссылки на соседние страницы — относительные: `./contract#роутер`, `./auth#как-bff-обрабатывает-вызов`, на трек — `../bff#переключение`.
- Публичный репозиторий: без IP, токенов, внутренних адресов (кроме имён сервисов compose `api`, `bff`).
- Перед коммитом: `bun run typecheck && bun run test && DIAGRAMS_NATIVE=1 bun run build`. Коммиты по-русски.

## Review Focus

1. Якоря ссылок на «Контракт», «Авторизацию» и «Переключение» существуют — битая ссылка в сборке не ловится. Тест в задаче 1.
2. Страница не противоречит «Авторизации и CSRF»: CSRF и сессия — в `createContext`, `Set-Cookie` — через `resHeaders`. Проверка ревьюером по тексту.
3. Пример кода каркаса компилируется в голове читателя: `fetchRequestHandler({ endpoint, req, router, createContext, onError })`, `export default { port, fetch }`. Проверка ревьюером.
4. На странице нет значений секретов и реальных адресов. Тест в задаче 1 (`SESSION_KEY=` без значения).
5. Подстраница видна в меню трека и в шапке трека — `pages` и `modules-data` тест. Задача 1.

---

### Задача 1: подстраница `service.md`

**Files:**
- Create: `site/modules/2/tracks/bff/service.md`
- Modify: `site/modules/2/tracks/bff.md:12` (`pages: [contract, auth, service]`), абзац обзора сверху — упомянуть третью подстраницу рядом с «Контрактом» и «Авторизацией»
- Test: `scripts/bff-pages.test.ts` (константа `SERVICE`, `BFF_PAGES` с ней; `:39` — новый `pages`), `scripts/modules-data.test.ts:14`

- [ ] **Шаг 1: падающие тесты.** `modules-data.test.ts:14` ожидает `["Контракт", "Авторизация и CSRF", "Сервис BFF"]`. В `bff-pages.test.ts`:

```ts
export const SERVICE = "site/modules/2/tracks/bff/service.md";

test("подстраница «Сервис BFF»: разделы по порядку и ключевые решения", () => {
  const md = readFileSync(SERVICE, "utf8");
  expect(md).toContain("title: Сервис BFF");
  const order = ["## Каркас", "## Переменные окружения", "## Health check", "## Ошибки и логи", "## Сборка и образ", "## На проде"].map((h) => md.indexOf(h));
  expect(order.every((i) => i > 0)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  for (const s of ["fetchRequestHandler", "@trpc/server/adapters/fetch", "resHeaders", "/health", "SESSION_KEY", "APP_ORIGIN", "GO_API_URL", "oven/bun:", "-alpine", "bun build", "--target bun", "bff:3000", "service_healthy", "BFF_IMAGE_TAG", "frontend/issues/4"]) expect(md, s).toContain(s);
  expect(md).not.toContain("@hono/trpc-server");
  expect(md).not.toMatch(/SESSION_KEY\s*[:=]\s*\S{8,}/);
});

test("подстраница «Сервис BFF»: ссылки на соседей ведут на существующие заголовки", () => {
  const md = readFileSync(SERVICE, "utf8");
  for (const [link, file, heading] of [
    ["./contract#роутер", CONTRACT, "## Роутер"],
    ["./auth#как-bff-обрабатывает-вызов", AUTH, "## Как BFF обрабатывает вызов"],
    ["../bff#переключение", TRACK, "## Переключение"],
  ] as const) {
    expect(md, link).toContain(link);
    expect(readFileSync(file, "utf8"), heading).toContain(heading);
  }
});
```

`:39` — `pages: [contract, auth, service]`. Если тесты перебирают `BFF_PAGES` с проверками, которые новой странице не подходят (плашки tRPC и т. п.), — новую страницу в `BFF_PAGES` не добавлять, а в отчёте назвать, какие проверки её не касаются.

- [ ] **Шаг 2:** `bun test scripts/bff-pages.test.ts scripts/modules-data.test.ts` — Expected: FAIL (нет файла, старый `pages`).
- [ ] **Шаг 3: страница.** По спеке §3, раздел за разделом. Каркас — блок `ts` с пометкой «*Пример*», как на «Контракте». Таблица переменных — из спеки. «На проде» — по образцу `api` из `infra` `ansible/roles/app/templates/compose.yml.j2` на `2f97437` (ссылки на файлы с SHA) и `Caddyfile.j2`. В конце — абзац: CI собирает и публикует образ (frontend#4 со ссылкой), compose и Caddy правятся в `infra`.
- [ ] **Шаг 4: трек.** `pages: [contract, auth, service]`; в абзаце обзора трека, где перечислены подстраницы, — третья: «[Сервис BFF](./bff/service) (каркас, переменные, health check, образ и запуск)». В «Что меняется → BFF» после «Новый сервис на Hono …» — ссылка на подстраницу.
- [ ] **Шаг 5:** тесты шага 2 — PASS; `bun run typecheck && bun run test && DIAGRAMS_NATIVE=1 bun run build` — зелёное.
- [ ] **Шаг 6:** коммит `docs(modules): подстраница «Сервис BFF» — каркас, env, health, образ, прод`.

### Задача 2: PR и проверка

- [ ] **Шаг 1:** push ветки, PR в `main` («Что / Решения / Проверка», ссылка на превью).
- [ ] **Шаг 2:** после сборки Pages (превью ветки или прод после мержа): подстраница есть в меню трека BFF и в шапке трека, три ссылки на соседей открывают нужные разделы.
