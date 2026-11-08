import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (page: string) => readFileSync(`site/documentation/frontend/${page}.md`, "utf8");
const section = (md: string, title: string) => md.replace(/ \{#[^}]+\}/g, "").split(`\n## ${title}\n`)[1]?.split(/\n## /)[0] ?? "";
const FRONTEND_SHA = "0606aa6cb83b78a76f1e69816b2a6abd82dc20ee";

test("frontend: обзор объясняет действующее редактирование", () => {
  const overview = read("index");
  expect(overview).toContain("{#notebook-flow}");
  for (const token of ["apps/client", "apps/bff", "packages/schemas", "notebookPage", "editSource", "commitSource", "cells.update", "If-Match"]) expect(overview).toContain(token);
  expect(read("startup")).toContain("BootstrapError");
  expect(read("startup")).toContain("RouterProvider");
});

test("frontend: страницы идут от устройства приложения к самопроверке", () => {
  for (const [page, headings] of [
    ["index", ["Статус сведений", "Монорепа", "Карта файлов", "Сквозной сценарий", "Что проверить в понимании"]],
    ["startup", ["Первый HTML от BFF", "Проверка bootstrap в браузере", "Сторы до первого рендера", "Прямой URL и SPA-переход", "Повреждённые данные останавливают запуск", "Что проверить в понимании"]],
    ["routing", ["PAGES и дерево маршрутов", "Переход и история", "Параметры и 404", "beforeLoad и защита запросов", "Что проверить в понимании"]],
    ["rendering", ["Cell: JSX, props и события", "Локальный режим и key", "Внешний стор и обновление DOM", "Эффекты и cleanup", "Клавиатура и touch", "Что проверить в понимании"]],
    ["state", ["Кто владеет состоянием", "Подтверждённый снимок и черновики", "Ввод и IME", "Новый ввод во время запроса", "Смена блокнота и поздний ответ", "Сохранение и конфликты", "Граница runtime", "Что проверить в понимании"]],
  ] as const) {
    expect(read(page).match(/^## .+$/gm)?.map((line) => line.slice(3).replace(/ \{#[^}]+\}/g, ""))).toEqual([...headings]);
  }
  expect(read("index")).toContain("](./startup)");
  expect(read("startup")).toContain("](./)");
});

test("frontend: сценарий доходит до подтверждения и сохраняет условия редактора", () => {
  const flow = section(read("index"), "Сквозной сценарий");
  for (const token of ["(pointer: coarse)", "readOnly={touch}", "500 мс", "IME", "65 536 байт UTF-8", "confirmed", "новый ввод во время запроса", "notebook_conflict", "сверяет"]) expect(flow, token).toContain(token);
  expect(flow).toMatch(/черновик[\s\S]*не отправляется, пока его не сократят/i);
  expect(flow).toMatch(/Черновик снимается\s+только при совпадении с отправленным текстом/);
  expect(flow).toMatch(/Ответ прежнего открытого блокнота не применяется/);
});

test("frontend: запуск проверяет вход и однократно использует подходящий preloaded", () => {
  const startup = read("startup");
  const beforeRender = section(startup, "Сторы до первого рендера");
  expect(beforeRender).toContain("readBootstrap()");
  expect(beforeRender).toContain("setPreloadedNotebook(notebookPage)");
  expect(beforeRender.indexOf("readBootstrap()")).toBeLessThan(beforeRender.indexOf("initSession(user)"));
  expect(beforeRender.indexOf("setPreloadedNotebook(notebookPage)")).toBeLessThan(beforeRender.indexOf("createRoot(container)"));
  const preload = section(startup, "Прямой URL и SPA-переход");
  for (const token of ["peekPreloadedNotebook(id)", "takePreloadedNotebook(id)", "один раз", "совпадающий ID", "notebooks.get", "alive"]) expect(preload, token).toContain(token);
  const failure = section(startup, "Повреждённые данные останавливают запуск");
  for (const token of ["BootstrapError", "started", "RouterProvider", "не рендерится", "users.me"]) expect(failure, token).toContain(token);
});

test("frontend: состояние объясняет сохранность черновика", () => {
  const state = read("state");
  for (const token of ["confirmed", "drafts", "500", "65 536", "IME", "hash", "{#saving}"]) expect(state).toContain(token);
  expect(section(state, "Сохранение и конфликты")).toContain("409");
  expect(read("routing")).toContain("beforeLoad");
  expect(read("rendering")).toContain("useLayoutEffect");
  expect(read("rendering")).toContain("pointer: coarse");
});

test("frontend: объяснения разделяют ввод, подтверждение и восстановление", () => {
  const state = read("state");
  const input = section(state, "Ввод и IME");
  for (const token of ["500 мс", "isComposing", "compositionend", "commitSource", "UTF-8", "tooLarge"]) expect(input, token).toContain(token);
  const ack = section(state, "Новый ввод во время запроса");
  for (const token of ["отправленному", "drafts", "confirmed", "исходному", "следующ"]) expect(ack, token).toContain(token);
  const late = section(state, "Смена блокнота и поздний ответ");
  for (const token of ["generation", "не применяется", "Map", "hash", "закрытие вкладки"]) expect(late, token).toContain(token);
  const saving = section(state, "Сохранение и конфликты");
  for (const token of ["неизвестен", "свер", "Один автоматический повтор", "Серверный", "Мой", "orphans", "повторный конфликт", "#165"]) expect(saving, token).toContain(token);
  expect(saving).toMatch(/закрытие диалога[\s\S]*пауз/i);
});

test("frontend: роутинг и рендеринг объясняют используемые механизмы", () => {
  const routing = read("routing");
  for (const token of ["PAGES", "Outlet", "_guest", "_auth", "beforeLoad", "authedProcedure"]) expect(routing, token).toContain(token);
  for (const token of ["Link", "pushState", "replaceState", "Back/Forward", "popstate"]) expect(section(routing, "Переход и история"), token).toContain(token);
  expect(section(routing, "beforeLoad и защита запросов")).toMatch(/не заменяет\s+серверную проверку/);
  const rendering = read("rendering");
  for (const token of ["key={row.cell.id}", "индекс", "hooks"]) expect(section(rendering, "Локальный режим и key"), token).toContain(token);
  for (const token of ["1.0.1", "Object.is", "forceRender", "useLayoutEffect"]) expect(section(rendering, "Внешний стор и обновление DOM"), token).toContain(token);
  for (const token of ["ResizeObserver", "disconnect", "cleanup", "alive"]) expect(section(rendering, "Эффекты и cleanup"), token).toContain(token);
});

test("frontend: новые fragment-ссылки имеют существующие цели", () => {
  for (const [from, link, target, heading] of [
    ["index", "./routing#navigation", "routing", "## Переход и история {#navigation}"],
    ["index", "./rendering#cell", "rendering", "## Cell: JSX, props и события {#cell}"],
    ["index", "./state#saving", "state", "## Сохранение и конфликты {#saving}"],
    ["rendering", "./state#saving", "state", "## Сохранение и конфликты {#saving}"],
    ["state", "./rendering#subscriptions", "rendering", "## Внешний стор и обновление DOM {#subscriptions}"],
  ]) {
    expect(read(from!), from).toContain(`](${link})`);
    expect(read(target!), target).toContain(heading!);
  }
  const editing = readFileSync("site/documentation/notebooks/editing.md", "utf8");
  for (const fragment of ["save-queue", "revision", "orphans"]) {
    expect(read("state")).toContain(`](/documentation/notebooks/editing#${fragment})`);
    expect(editing).toContain(`{#${fragment}}`);
  }
});

test("frontend: источники закреплены на проверенном SHA со строками", () => {
  for (const page of ["index", "startup", "routing", "rendering", "state"]) {
    const md = read(page);
    expect(md, page).toContain("08.11.2026");
    expect(md, page).toContain(FRONTEND_SHA);
    const links = [...md.matchAll(/https:\/\/github\.com\/Cringe-Driven-Development-Team\/frontend\/([^\s)]+)/g)].map((match) => match[1]!);
    expect(links.length, page).toBeGreaterThan(1);
    for (const link of links) {
      expect(link, page).toMatch(new RegExp(`^(?:tree/${FRONTEND_SHA}$|blob/${FRONTEND_SHA}/[^#]+#L\\d+(?:-L\\d+)?$)`));
    }
    expect(md, page).toMatch(/не новый прогон|не свидетельство нового прогона/);
  }
  const packageShas = {
    react: "f4d2bd02fcc127e5603bbe09874242b071def7ba",
    router: "bda991c58d01a88b119d910787a87966e31bfe0a",
    zustand: "4652b210db7bf9fcdbbdf96539b412201a1bec85",
  };
  for (const page of ["routing", "rendering", "state"]) {
    const links = [...read(page).matchAll(/https:\/\/github\.com\/Cringe-Driven-Development-Team\/frontend-packages\/blob\/([^/]+)\/packages\/([^/]+)\/([^\s)]+)/g)];
    expect(links.length, page).toBeGreaterThan(0);
    for (const [, sha, pkg, path] of links) {
      expect(sha, page).toBe(packageShas[pkg as keyof typeof packageShas]);
      expect(path, page).toMatch(/#L\d+(?:-L\d+)?$/);
    }
  }
});

test("frontend: страницы не содержат чувствительных значений и неэкранированных шаблонов", () => {
  for (const page of ["index", "startup", "routing", "rendering", "state"]) {
    const md = read(page);
    expect(md, page).not.toMatch(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);
    expect(md, page).not.toMatch(/gh[pousr]_[A-Za-z0-9]+|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|(?:token|secret|password)\s*[:=]\s*["'][^"']+/i);
    expect(md.replace(/^```[\s\S]*?^```/gm, "").replace(/<code v-pre>[\s\S]*?<\/code>/g, ""), page).not.toContain("{{");
  }
});

test("frontend: шесть схем объясняют связи рядом с текстом", () => {
  for (const [page, title, relationships] of [
    ["index", "Сквозной сценарий", [/Клиент/, /BFF/, /Go/, /notebookPage/, /notebooks\.get/, /editSource/, /client->>bff: cells\.update/, /bff->>go:.*If-Match/, /confirmed/]],
    ["startup", "Сторы до первого рендера", [/readBootstrap.*-->/, /initSession/, /setPreloadedNotebook/, /RouterProvider/, /valid -->\|Нет\| failure/, /failure --> stopped/, /BootstrapError/, /не запускается/]],
    ["routing", "Переход и история", [/Прямой URL/, /BFF/, /pushState.*replaceState/, /popstate/, /дерев/, /tree --> guard/, /guard -->\|Маршрут разрешён\| outlet/, /beforeLoad/, /Outlet/]],
    ["rendering", "Внешний стор и обновление DOM", [/onInput.*-->/, /editSource/, /подписчик/, /Object\.is/, /forceRender/, /useState --> render/, /forceRender --> render/, /reconcile --> commit/, /commit.*DOM/]],
    ["state", "Новый ввод во время запроса", [/store->>bff:.*v1/, /bff-->>store:.*v1/, /v2/, /confirmed/, /drafts/, /hash/, /сохраняется/]],
    ["state", "Сохранение и конфликты", [/неизвестен/, /notebooks\.get/, /сверка/i, /409 notebook_conflict/, /пауз/, /выбор/i, /read --> reconcile/, /pause --> fresh/, /fresh --> choice/, /условные записи/]],
  ] as const) {
    const body = section(read(page), title);
    const pair = body.match(/<DiagramSection>([\s\S]*?)<template #diagram>\s*```mermaid\n([\s\S]*?)```\s*<\/template>\s*<\/DiagramSection>/);
    expect(pair, `${page}: ${title} — явная пара текста и схемы`).not.toBeNull();
    expect(pair![1]!.replace(/\s/g, "").length).toBeGreaterThan(80);
    expect(pair![1], `${page}: источники рядом со схемой`).toContain("https://github.com/");
    for (const relation of relationships) expect(pair![2], `${page}: ${relation}`).toMatch(relation);
  }
  for (const [page, count] of [["index", 1], ["startup", 1], ["routing", 1], ["rendering", 1], ["state", 2]] as const) {
    expect(read(page).match(/^```mermaid$/gm)?.length ?? 0, page).toBe(count);
  }
});
