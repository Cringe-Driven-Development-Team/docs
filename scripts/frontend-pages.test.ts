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


test("frontend: запросы, сессия и серверная обработка имеют полные страницы", () => {
  for (const value of ['httpBatchLink', 'httpLink', 'FormData', 'X-CSRF', 'cells.update', 'appCode', 'zodError', 'maxURLLength: 2000', "credentials: 'same-origin'", 'RouterInputs', 'RouterOutputs', 'If-Match', 'неизвестен']) expect(read('requests'), value).toContain(value);
  for (const value of ['switchSession', 'SESSION_CHANGED', 'HttpOnly', 'UNAUTHORIZED', '30 с', '10 с', 'logoutAll', 'serverRevocation', '#142']) expect(read('session'), value).toContain(value);
  for (const value of ['createContext', 'authedProcedure', 'loadNotebook', 'NotebookPage', 'strictObject', 'unwrap', 'Orval', 'spec/openapi.json', 'isJSON', '503']) expect(read('bff'), value).toContain(value);
  for (const id of ['bff-проверенная-часть', 'что-наблюдается-на-проде', 'релизы-и-граница-доказательства', 'где-искать-реализацию', 'что-еще-нужно-проверить']) expect(read('bff').split(`{#${id}}`), id).toHaveLength(2);
  for (const page of ['requests', 'session', 'bff']) {
    expect(read(page), page).toContain('ea123518d624521f999e884ff32ddec0a5bf6bfa');
    expect(read(page), page).toContain('08.11.2026');
    expect(read(page), page).toMatch(/не новый прогон|не свидетельство нового прогона/);
  }
});

test("frontend: транспорт, смена сессии и BFF показаны рядом с доказательством", () => {
  for (const [page, title, relationships] of [
    ['requests', 'Один клиент и два транспорта', [/splitLink/, /FormData/, /httpLink/, /httpBatchLink/, /batch --> bff/, /multipart --> bff/, /X-CSRF/]],
    ['session', 'Смена сессии и поздние ответы', [/switchSession/, /closing/, /inflight/, /Set-Cookie/, /generation/, /SESSION_CHANGED/]],
    ['bff', 'RPC: контекст и валидация', [/createContext/, /CSRF/, /authedProcedure/, /strictObject/, /createGo/, /unwrap/, /Go/]],
  ] as const) {
    const pair = section(read(page), title).match(/<DiagramSection>([\s\S]*?)<template #diagram>\s*```mermaid\n([\s\S]*?)```\s*<\/template>\s*<\/DiagramSection>/);
    expect(pair, page).not.toBeNull();
    expect(pair![1]!.replace(/\s/g, '').length).toBeGreaterThan(80);
    expect(pair![1], page).toContain('https://github.com/');
    for (const relation of relationships) expect(pair![2], page).toMatch(relation);
    expect(read(page).match(/^```mermaid$/gm)).toHaveLength(1);
  }
});

test("frontend: новые запросы и сессия ссылаются на существующих владельцев", () => {
  for (const [from, link, target, heading] of [
    ['requests', './bff#bff-проверенная-часть', 'bff', '## BFF: проверенная часть {#bff-проверенная-часть}'],
    ['session', './bff#bff-проверенная-часть', 'bff', '## BFF: проверенная часть {#bff-проверенная-часть}'],
    ['bff', '#bff-проверенная-часть', 'bff', '## BFF: проверенная часть {#bff-проверенная-часть}'],
    ['index', '/documentation/frontend/bff#bff-проверенная-часть', 'bff', '## BFF: проверенная часть {#bff-проверенная-часть}'],
    ['requests', './state#saving', 'state', '## Сохранение и конфликты {#saving}'],
    ['requests', './session#switching', 'session', '## Смена сессии и поздние ответы {#switching}'],
    ['session', './startup#сторы-до-первого-рендера', 'startup', '## Сторы до первого рендера'],
    ['bff', './startup#первыи-html-от-bff', 'startup', '## Первый HTML от BFF'],
    ['bff', './requests#errors', 'requests', '## Ошибки и реакция интерфейса {#errors}'],
  ]) {
    expect(read(from!), link).toContain(`](${link})`);
    expect(read(target!), heading).toContain(heading!);
  }
  for (const from of [
    'site/documentation/current-state.md',
    'site/documentation/architecture/index.md',
    'site/modules/2/tracks/bff.md',
    'site/modules/2/tracks/bff/migration.md',
  ]) {
    expect(readFileSync(from, 'utf8'), from).toContain('](/documentation/frontend/bff#bff-проверенная-часть)');
    expect(read('bff'), from).toContain('## BFF: проверенная часть {#bff-проверенная-часть}');
  }
});


test("frontend: текущие источники отделены от исторического BFF и безопасны", () => {
  for (const page of ['requests', 'session', 'bff']) {
    const md = read(page);
    const current = md.split('## BFF: проверенная часть')[0]!;
    const sources = [...current.matchAll(/https:\/\/github\.com\/Cringe-Driven-Development-Team\/frontend\/blob\/([^\s)]+)/g)];
    expect(sources.length, page).toBeGreaterThan(1);
    for (const [, path] of sources) expect(path, page).toMatch(/^ea123518d624521f999e884ff32ddec0a5bf6bfa\/[^#]+#L\d+(?:-L\d+)?$/);
    expect(md, page).not.toMatch(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);
    expect(md, page).not.toMatch(/gh[pousr]_[A-Za-z0-9]+|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY/);
    expect(md.replace(/^```[\s\S]*?^```/gm, ''), page).not.toContain('{{');
    expect(md, page).not.toMatch(/LINK_[A-Z_]+|\)_[A-Z]+/);
  }
  const historical = read('bff').split('## BFF: проверенная часть')[1]!;
  for (const value of ['31.10.2026 в 13:11 UTC', 'dd3d11fbeebe5bf1e2b51fdd663a36d1829a4e64', '23d3dd9e955424a7634fb0dc49a38af6eb08792c', '14653763279dab055e3cea47a84a0c531bccf03f', 'csrf_invalid', 'не проверен авторизованным сценарием на проде', 'не утверждение об отсутствии реализации']) expect(historical, value).toContain(value);
  expect(historical).not.toContain('ea123518d624521f999e884ff32ddec0a5bf6bfa');
});


test("frontend: сборка отделена от проверки типов и mock от прода", () => {
  for (const token of ['Bun', 'Turborepo', 'Vite', 'tsc --noEmit', 'jsxImportSource', 'SVGR', 'Babel']) expect(read('build'), token).toContain(token);
  for (const token of ['CSS Modules', '.module.css', 'clsx', 'tokens.css', 'global.css']) expect(read('styles'), token).toContain(token);
  for (const token of ['bun run check', 'bun run build', 'notebookConflict.test.ts', 'session.test.ts', 'dev:prism']) expect(read('checks'), token).toContain(token);
  for (const token of ['Oxc', 'Rolldown', 'не проверяет типы', 'sourcemap', 'false', 'ES-модули']) expect(section(read('build'), 'Преобразования и проверка типов'), token).toContain(token);
  expect(section(read('build'), 'Преобразования и проверка типов')).toContain('не означает');
  for (const token of ['PostCSS', 'Lightning CSS', 'препроцессор', 'Sass', 'вложенность']) expect(section(read('styles'), 'Обработка CSS сборщиком'), token).toContain(token);
  for (const token of ['Prism', 'Cloud Mock', 'не доказывает сохранение', 'Go', 'VITE_MOCK_PREFER', 'If-Match']) expect(section(read('checks'), 'Моки и настоящая запись в Go'), token).toContain(token);
});

test("frontend: порядок разделов сборки, стилей и проверок", () => {
  for (const [page, headings] of [
    ['build', ['Bun и Turborepo', 'Преобразования и проверка типов', 'Разработка и production', 'Алиасы, env и ресурсы', 'Что проверить в понимании']],
    ['styles', ['CSS Modules и область классов', 'Кнопка: классы и состояния', 'Токены и глобальные стили', 'Обработка CSS сборщиком', 'Что проверить в понимании']],
    ['checks', ['Что проверяют инструменты', 'Сценарии редактора и сессии', 'Индекс, хуки и CI', 'Моки и настоящая запись в Go', 'Что проверить в понимании']],
  ] as const) expect(read(page).match(/^## .+$/gm)?.map(line => line.slice(3).replace(/ \{#[^}]+\}/g, ''))).toEqual([...headings]);
});

test("frontend: схемы сборки, стилей и проверок показывают разные границы", () => {
  for (const [page, title, relations] of [
    ['build', 'Преобразования и проверка типов', [/source.*--> typecheck/, /source.*--> oxc/, /svg.*--> svgr/, /svgr --> oxc/, /oxc --> bundle/, /Rolldown/, /Babel/, /noEmit/]],
    ['styles', 'CSS Modules и область классов', [/module.*--> mapping/, /module.*--> selectors/, /mapping --> button/, /selectors --> dom/, /button --> dom/, /CSS Modules/]],
    ['checks', 'Моки и настоящая запись в Go', [/client.*--> bff/, /bff -->\|"Мок"\| mock/, /mock --> ui/, /bff -->\|"Настоящий сервер"\| go/, /go --> persistence/, /Prism/, /сохранение/]],
  ] as const) {
    const pair = section(read(page), title).match(/<DiagramSection>([\s\S]*?)<template #diagram>\s*```mermaid\n([\s\S]*?)```\s*<\/template>\s*<\/DiagramSection>/);
    expect(pair, page).not.toBeNull();
    expect(pair![1]!.replace(/\s/g, '').length, page).toBeGreaterThan(80);
    expect(pair![1], page).toContain('https://github.com/');
    for (const relation of relations) expect(pair![2], page).toMatch(relation);
    expect(read(page).match(/^```mermaid$/gm), page).toHaveLength(1);
  }
});

test("frontend: новые fragment-ссылки сборки, стилей и проверок имеют цели", () => {
  for (const [from, link, target, heading] of [
    ['index', './build#transforms', 'build', '## Преобразования и проверка типов {#transforms}'],
    ['index', './styles#modules', 'styles', '## CSS Modules и область классов {#modules}'],
    ['index', './checks#tools', 'checks', '## Что проверяют инструменты {#tools}'],
    ['build', './styles#pipeline', 'styles', '## Обработка CSS сборщиком {#pipeline}'],
    ['build', './checks#tools', 'checks', '## Что проверяют инструменты {#tools}'],
    ['styles', './build#transforms', 'build', '## Преобразования и проверка типов {#transforms}'],
    ['checks', './state#saving', 'state', '## Сохранение и конфликты {#saving}'],
    ['checks', './session#switching', 'session', '## Смена сессии и поздние ответы {#switching}'],
    ['checks', './build#dev-prod', 'build', '## Разработка и production {#dev-prod}'],
  ]) {
    expect(read(from!), link).toContain(`](${link})`);
    expect(read(target!), heading).toContain(heading!);
  }
});

test("frontend: сборочные источники закреплены и страницы сохраняют границу проверки", () => {
  for (const page of ['build', 'styles', 'checks', 'packages']) {
    const md = read(page);
    expect(md, page).toContain('08.11.2026');
    expect(md, page).toMatch(/не новый прогон|не свидетельство нового прогона/);
    const links = [...md.matchAll(/https:\/\/github\.com\/Cringe-Driven-Development-Team\/frontend\/blob\/([^\s)]+)/g)];
    expect(links.length, page).toBeGreaterThan(1);
    for (const [, path] of links) expect(path, page).toMatch(/^ea123518d624521f999e884ff32ddec0a5bf6bfa\/[^#]+#L\d+(?:-L\d+)?$/);
    for (const [, path] of md.matchAll(/https:\/\/github\.com\/[^/]+\/[^/]+\/blob\/([^\s)]+)/g)) expect(path, page).toMatch(/^[a-f0-9]{40}\/[^#]+#L\d+(?:-L\d+)?$/);
    expect(md, page).not.toMatch(/gh[pousr]_[A-Za-z0-9]+|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY/);
    expect(md.replace(/^```[\s\S]*?^```/gm, ''), page).not.toContain('{{');
  }
});


test("frontend: пакеты привязаны к версиям приложения", () => {
  const page = read('packages');
  for (const [name, version] of [['react', '1.7.1'], ['router', '0.1.0'], ['zustand', '1.0.1'], ['clsx', '0.1.0'], ['vite-plugin-bff-html', '0.2.1']]) expect(page).toContain(`| \`@cdd-team/${name}\` | \`${version}\` |`);
  for (const token of ['workspace:', 'peerDependencies', 'release-please', 'bun.lock']) expect(page).toContain(token);
  for (const [name, sha] of [
    ['react', 'f4d2bd02fcc127e5603bbe09874242b071def7ba'],
    ['router', 'bda991c58d01a88b119d910787a87966e31bfe0a'],
    ['zustand', '4652b210db7bf9fcdbbdf96539b412201a1bec85'],
    ['clsx', 'bda991c58d01a88b119d910787a87966e31bfe0a'],
    ['vite-plugin-bff-html', '5be3456bc9df61efebef6902ac5ebe157a307c60'],
  ]) expect(page).toContain(`/blob/${sha}/packages/${name}/package.json#L`);
  for (const token of ['@cdd-team/oxlint-plugin-jsdoc', '0.1.2', '@cdd/schemas', '@cdd/bff', 'optional', '^1.7.0', '^1.2.1', '^8.3.3', 'exports', 'jsx-runtime', '/vanilla', 'paths_released', 'npm view', 'release-report.json']) expect(page).toContain(token);
  expect(page).toMatch(/Тег[^.]*не подтверждает[^.]*npm/);
  expect(page).toContain('ea123518d624521f999e884ff32ddec0a5bf6bfa');
  expect(page).toContain('08.11.2026');
  expect(page).toContain('не новый прогон');
  expect(page).not.toMatch(/frontend-packages\/blob\/main/);
});

test("frontend: выпуск отделён от подтверждения npm и обновления приложения", () => {
  const pair = section(read('packages'), 'Выпуск и обновление приложения').match(/<DiagramSection>([\s\S]*?)<template #diagram>\s*```mermaid\n([\s\S]*?)```\s*<\/template>\s*<\/DiagramSection>/);
  expect(pair).not.toBeNull();
  expect(pair![1]).toContain('https://github.com/');
  for (const relation of [/change --> releasePr/, /releasePr --> tags/, /tags --> verify/, /verify --> publish/, /publish --> visible/, /visible -->\|Да\| update/, /visible -->\|Нет\| investigate/, /update --> checks/, /bun.lock/, /paths_released/]) expect(pair![2], String(relation)).toMatch(relation);
  expect(read('packages').match(/^```mermaid$/gm)).toHaveLength(1);
  expect(read('index')).toContain('](./packages)');
  expect(readFileSync('site/documentation/project-context.md', 'utf8')).toContain('](/documentation/frontend/packages)');
  for (const [link, target, heading] of [
    ['./build#transforms', 'build', '## Преобразования и проверка типов {#transforms}'],
    ['./styles#modules', 'styles', '## CSS Modules и область классов {#modules}'],
    ['./checks#tools', 'checks', '## Что проверяют инструменты {#tools}'],
  ]) {
    expect(read('packages'), link).toContain(`](${link})`);
    expect(read(target!), heading).toContain(heading!);
  }
});
