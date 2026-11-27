import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (page: string) => readFileSync(`site/documentation/frontend/${page}.md`, "utf8");
const section = (md: string, title: string) => md.replace(/ \{#[^}]+\}/g, "").split(`\n## ${title}\n`)[1]?.split(/\n## /)[0] ?? "";
const FRONTEND_SHA = "ea123518d624521f999e884ff32ddec0a5bf6bfa";

test("frontend: обзор ведёт к устройству клиента и задачам разработчика", () => {
  const overview = read("index");
  for (const page of ["architecture", "routing", "build", "styles", "startup", "rendering", "state", "requests", "session", "bff", "packages", "checks"]) {
    expect(overview, page).toMatch(new RegExp("\\]\\(\\./" + page + "(?:#[^)]+)?\\)"));
  }
  expect(overview.split("{#notebook-flow}")).toHaveLength(2);
  expect(overview.split("{#notebook-flow}")[1]).toContain("](/documentation/notebooks/editing)");
  for (const file of ["index", "current-state", "project-context"]) {
    expect(readFileSync(`site/documentation/${file}.md`, "utf8"), file).toContain("](/documentation/frontend/)");
  }
});

test("frontend: прямой вход читает bootstrap до рендера; сломанные данные останавливают запуск", () => {
  const startup = read("startup");
  for (const value of ['script#bootstrap', 'application/json', 'user', 'notebookPage', 'BootstrapError', 'Не удалось запустить приложение. Обновите страницу.', 'RouterProvider']) {
    expect(startup, value).toContain(value);
  }
  expect(startup).toMatch(/readBootstrap\(\)[\s\S]*initSession\(user\)[\s\S]*setPreloadedNotebook\(notebookPage\)[\s\S]*createRoot/);
  expect(startup).toMatch(/BootstrapError[\s\S]*users\.me/);
  for (const value of ['peekPreloadedNotebook(id)', 'takePreloadedNotebook(id)', 'один раз', 'notebooks.get', 'alive']) expect(startup, value).toContain(value);
});

test("frontend: доступ к защищённому URL проверяется при прямом входе и внутри SPA", () => {
  const routing = read("routing");
  for (const value of ["PAGES", "GUEST_PAGES", "routeTree.ts", "_guest", "_auth", "beforeLoad", "302", "/login", "Outlet", "popstate"]) expect(routing, value).toContain(value);
  expect(routing).toMatch(/гост[ьяю][^\n]*\x60_auth\x60[^\n]*\x60\/login\x60/i);
  expect(read("checks")).toContain("](./build#dev-prod)");
  expect(read("build")).toContain("](./checks#tools)");
});

test("frontend: локальный ввод, подтверждение и поздний ответ описаны на границе стора", () => {
  const state = read("state");
  for (const value of ["confirmed", "drafts", "generation", "Map", "hash", "500 мс", "65 536", "IME", "409 notebook_conflict", "{#saving}"]) expect(state, value).toContain(value);
  expect(state).toMatch(/черновик[^\n]*совпадает с отправленным/i);
  expect(state).toMatch(/ответ[^\n]*другого блокнота/i);
  const editing = readFileSync("site/documentation/notebooks/editing.md", "utf8");
  for (const fragment of ["save-queue", "revision", "orphans"]) {
    expect(state).toContain(`](/documentation/notebooks/editing#${fragment})`);
    expect(editing).toContain(`{#${fragment}}`);
  }
  const rendering = read("rendering");
  for (const value of ["CodeOrText", "key={row.cell.id}", "useLayoutEffect", "Object.is", "forceRender", "ResizeObserver", "disconnect", "pointer: coarse"]) expect(rendering, value).toContain(value);
});

test("frontend: команды и требования запуска соответствуют main", () => {
  const build = read("build");
  for (const value of ["Bun", "Turborepo", "Vite", "tsc --noEmit", "jsxImportSource", "SVGR", "Babel", "IDENTITY_API_URL", "WORKSPACE_API_URL", "SESSION_KEY", "APP_ORIGIN", "BFF_KEY", "GO_API_TLS_CA_FILE", "GO_API_TLS_CERT_FILE", "GO_API_TLS_KEY_FILE", "DEV_TUNNEL_SSH_HOST", "DEV_TUNNEL_BACKEND_HOST", "bun run dev:tunnel", "bun run preview"]) expect(build, value).toContain(value);
  const checks = read("checks");
  for (const value of ["bun run check", "bun test scripts/release/test apps/bff/test", "bun run build", "contract:verify", "lefthook", "oxfmt", "oxlint", "Go"]) expect(checks, value).toContain(value);
  for (const value of ["CSS Modules", ".module.css", "clsx", "tokens.css", "global.css"]) expect(read("styles"), value).toContain(value);
});

test("frontend: проверка записи различает запрос браузера и вызов Go", () => {
  const scenario = section(read("checks"), "Проверить изменение формы");
  const saveStep = scenario.split("\n3. ")[1] ?? "";
  expect(saveStep).toMatch(/Network[^.]*POST \/api\/cells\/update[^.]*JSON[^.]*`hash`[^.]*`source`/);
  expect(saveStep).toMatch(/Ответ `200`[^.]*новый `hash`/);
  expect(saveStep).toMatch(/`If-Match` BFF добавляет при вызове Go/);
  expect(saveStep).toMatch(/Откройте[^.]*новой вкладке[^.]*сверьте[^.]*текст/);
});

test("frontend: источники для браузера и разработки закреплены на SHA со строками", () => {
  for (const page of ["index", "architecture", "routing", "build", "styles", "startup", "rendering", "state", "checks"]) {
    const links = [...read(page).matchAll(/https:\/\/github\.com\/[^/]+\/[^/]+\/blob\/([^\s)]+)/g)];
    const sha = ["build", "checks"].includes(page) ? "bfab8a485c78412a814b3765d10ef83a6267deed" : "b1baf996fb6753d1a62eab6f874d03dca30faadc";
    expect(links.filter(([, ref]) => ref!.startsWith(sha)).length, page).toBeGreaterThan(1);
    for (const [, ref] of links) expect(ref, page).toMatch(/^[a-f0-9]{40}\/[^#]+#L\d+(?:-L\d+)?$/);
  }
});

test("frontend: страницы не содержат чувствительных значений и неэкранированных шаблонов", () => {
  for (const page of ["architecture", "index", "routing", "build", "styles", "startup", "rendering", "state", "requests", "session", "bff", "packages", "checks"]) {
    const md = read(page);
    expect(md, page).not.toMatch(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);
    expect(md, page).not.toMatch(/gh[pousr]_[A-Za-z0-9]+|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|(?:token|secret|password)\s*[:=]\s*["'][^"']+/i);
    expect(md.replace(/^```[\s\S]*?^```/gm, "").replace(/<code v-pre>[\s\S]*?<\/code>/g, ""), page).not.toContain("{{");
  }
});

test("frontend: закреплены действующие HTTP-контракты", () => {
  for (const value of ['BffPaths', 'browserTransport', 'POST /api/users/avatar', 'multipart/form-data']) expect(read('requests'), value).toContain(value);
  for (const value of ['BffPaths', 'contract:fetch', 'contract:verify']) expect(read('bff'), value).toContain(value);
  expect(read('packages')).toContain('](https://github.com/Cringe-Driven-Development-Team/frontend-packages)');
});

test("frontend: запросы, сессия и серверная обработка имеют полные страницы", () => {
  for (const value of ['FormData', 'X-CSRF', 'If-Match', 'appCode', 'validationErrors', 'execute-all', '/api/runtime/updates', "credentials: 'same-origin'"]) expect(read('requests'), value).toContain(value);
  for (const value of ['switchSession', 'SESSION_CHANGED', 'HttpOnly', 'UNAUTHORIZED', '30 с', '10 с', 'logoutAll', 'serverRevocation', '#142']) expect(read('session'), value).toContain(value);
  for (const value of ['Bun.serve', 'loadNotebook', 'unwrap', 'spec/openapi.json', '503']) expect(read('bff'), value).toContain(value);
  for (const id of ['bff-проверенная-часть', 'что-наблюдается-на-проде', 'релизы-и-граница-доказательства', 'где-искать-реализацию', 'что-еще-нужно-проверить']) expect(read('bff').split(`{#${id}}`), id).toHaveLength(2);
});

for (const [page, title, relationships] of [
  ['requests', 'Один клиент и транспорт', [/C->>T:.*RequestInit/, /T->>B:.*X-CSRF/, /T-->>C: Promise<Response>/, /status, headers и data/, /C-->>UI: DTO или BffError/]],
  ['session', 'Смена сессии и поздние ответы', [/switchSession/, /Пауза новых защищённых запросов/, /B-->>C: Ответ, возможный Set-Cookie/, /C->>B: Запрос смены после завершения ожидания/]],
  ['bff', 'Проверка входа и типы BFF', [/R.*--> C/, /C.*CSRF/, /C --> I/, /I --> D/, /Адаптер Go и unwrap/, /A --> H2/, /D --> R2/]],
] as const) test(`frontend: транспорт и серверная граница — ${page}`, () => {
  const pair = section(read(page), title).match(/<DiagramSection>([\s\S]*?)<template #diagram>\s*```mermaid\n([\s\S]*?)```\s*<\/template>\s*<\/DiagramSection>/);
  expect(pair, page).not.toBeNull();
  expect(pair![1]!.replace(/\s/g, '').length).toBeGreaterThan(80);
  expect(pair![1], page).toContain('https://github.com/');
  for (const relation of relationships) expect(pair![2], page).toMatch(relation);
  if (page === 'bff') expect(pair![2]).not.toMatch(/H[^\n]*--> C/);
  expect(read(page).match(/^```mermaid$/gm)).toHaveLength(1);
});

test("frontend: новые запросы и сессия ссылаются на существующих владельцев", () => {
  for (const [from, link, target, heading] of [
    ['requests', './bff#bff-проверенная-часть', 'bff', '## BFF: проверенная часть {#bff-проверенная-часть}'],
    ['session', './bff#bff-проверенная-часть', 'bff', '## BFF: проверенная часть {#bff-проверенная-часть}'],
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
    'site/modules/2/tracks/bff.md',
    'site/modules/2/tracks/bff/migration.md',
  ]) {
    expect(readFileSync(from, 'utf8'), from).toContain('](/documentation/frontend/bff#bff-проверенная-часть)');
    expect(read('bff'), from).toContain('## BFF: проверенная часть {#bff-проверенная-часть}');
  }
  for (const file of ['architecture/index', 'current-state']) {
    expect(readFileSync(`site/documentation/${file}.md`, 'utf8')).toContain('](/documentation/frontend/bff)');
  }
});


test("frontend: исходники и наблюдение о BFF привязаны к ревизиям", () => {
  for (const page of ['requests', 'session', 'bff']) {
    const md = read(page);
    const current = md.split('## BFF: проверенная часть')[0]!;
    const sources = [...current.matchAll(/https:\/\/github\.com\/Cringe-Driven-Development-Team\/frontend\/blob\/([^\s)]+)/g)];
    expect(sources.length, page).toBeGreaterThan(1);
    for (const [, path] of sources) expect(path, page).toMatch(/^(?:b1baf996fb6753d1a62eab6f874d03dca30faadc|bfab8a485c78412a814b3765d10ef83a6267deed)\/[^#]+#L\d+(?:-L\d+)?$/);
    expect(md, page).not.toMatch(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);
    expect(md, page).not.toMatch(/gh[pousr]_[A-Za-z0-9]+|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY/);
    expect(md.replace(/^```[\s\S]*?^```/gm, ''), page).not.toContain('{{');
    expect(md, page).not.toMatch(/LINK_[A-Z_]+|\)_[A-Z]+/);
  }
  const historical = read('bff').split('## BFF: проверенная часть')[1]!;
  for (const value of ['27.11.2026', '23:58:42 MSK', '8118066244', 'b1baf996fb6753d1a62eab6f874d03dca30faadc', 'id="bootstrap"', 'в этом наблюдении не запускались']) expect(historical, value).toContain(value);
  expect(historical).not.toContain('ea123518d624521f999e884ff32ddec0a5bf6bfa');
});


test("frontend: пакеты привязаны к версиям приложения", () => {
  const page = read('packages');
  for (const [name, version] of [['react', '1.7.1'], ['router', '0.1.0'], ['zustand', '1.0.1'], ['clsx', '0.1.0'], ['vite-plugin-bff-html', '0.2.1'], ['http-client', '0.1.1'], ['serialize-javascript', '0.1.1']]) expect(page).toContain(`| \`@cdd-team/${name}\` | \`${version}\` |`);
  for (const token of ['workspace:', 'peerDependencies', 'release-please', 'bun.lock']) expect(page).toContain(token);
  for (const [name, sha] of [
    ['react', 'f4d2bd02fcc127e5603bbe09874242b071def7ba'],
    ['router', 'bda991c58d01a88b119d910787a87966e31bfe0a'],
    ['zustand', '4652b210db7bf9fcdbbdf96539b412201a1bec85'],
    ['clsx', 'bda991c58d01a88b119d910787a87966e31bfe0a'],
    ['vite-plugin-bff-html', '5be3456bc9df61efebef6902ac5ebe157a307c60'],
  ]) expect(page).toContain(`/blob/${sha}/packages/${name}/package.json#L`);
  for (const token of ['@cdd-team/oxlint-plugin-jsdoc', '0.1.2', '@cdd/schemas', '@cdd/bff', 'optional', '^1.7.0', '^1.2.1', '^8.3.3', 'exports', 'jsx-runtime', '/vanilla', 'paths_released', 'npm view', 'release-report.json']) expect(page).toContain(token);
  for (const sha of ['b1baf996fb6753d1a62eab6f874d03dca30faadc', '2e27346f12034a086b41abcf3a140d4ce94274e1', '872ffb6e01c13473867adfa6247e4e2d192f1c1b', 'c164cae793455704719825ab56e2ca365f708c23']) expect(page).toContain(sha);
  for (const [, path] of page.matchAll(/https:\/\/github\.com\/[^/]+\/[^/]+\/blob\/([^\s)]+)/g)) expect(path).toMatch(/^[a-f0-9]{40}\/[^#]+#L\d+(?:-L\d+)?$/);
  expect(page).not.toMatch(/frontend-packages\/blob\/main/);
});

test("frontend: выпуск отделён от подтверждения npm и обновления приложения", () => {
  const pair = section(read('packages'), 'Выпуск и обновление приложения').match(/<DiagramSection>([\s\S]*?)<template #diagram>\s*```mermaid\n([\s\S]*?)```\s*<\/template>\s*<\/DiagramSection>/);
  expect(pair).not.toBeNull();
  expect(pair![1]).toContain('https://github.com/');
  for (const relation of [/W.*--> R/, /R --> C/, /C --> P/, /P --> V/, /V -->\|Да\| F/, /V -->\|Нет\| E/, /bun.lock/, /paths_released/]) expect(pair![2], String(relation)).toMatch(relation);
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


test("frontend: старый BFF используется только как browser redirect", () => {
  const files = ['site/documentation/index.md', 'site/documentation/current-state.md', 'site/documentation/project-context.md', ...['architecture', 'index', 'routing', 'build', 'styles', 'startup', 'rendering', 'state', 'requests', 'session', 'bff', 'packages', 'checks'].map(page => `site/documentation/frontend/${page}.md`)];
  for (const file of files) expect(readFileSync(file, 'utf8'), file).not.toMatch(/\]\((?:\/documentation\/bff|\.\.\/bff)(?:#|\))/);
  const browser = readFileSync('scripts/check-readability.ts', 'utf8').split('async function checkHierarchy')[1]!.split('async function checkTitle')[0]!;
  for (const id of ['bff-проверенная-часть', 'что-наблюдается-на-проде', 'релизы-и-граница-доказательства', 'где-искать-реализацию', 'что-еще-нужно-проверить']) expect(browser, id).toContain(id);
  expect(browser).toContain("documentation/bff");
  expect(browser).toContain("unique BFF heading");
  for (const query of ['switchSession', 'jsxImportSource', 'release-please']) expect(browser, query).toContain(query);
});


test('frontend: входные страницы не отрицают реализацию поиска выбранного среза', () => {
  for (const path of ['site/documentation/index.md', 'site/documentation/notebooks/index.md']) {
    const md = readFileSync(path, 'utf8');
    expect(md).not.toMatch(/UI поиска[^.]*отсутствует|UI[^.]*пока отсутствует|UI поиска не реализован/);
    expect(md).toContain(path.includes('/notebooks/') ? 'не новый прогон' : 'код поиска');
  }
  const notebooks = readFileSync('site/documentation/notebooks/index.md', 'utf8');
  expect(notebooks).toContain(`frontend/blob/${FRONTEND_SHA}/apps/client/src/pages/NotebookPage/NotebookPage.tsx#L322-L346`);
  expect(notebooks).toContain('задачей #96');
});



test("frontend: ссылки к действиям и владельцам деталей сохраняют цели", () => {
  for (const [from, to, id] of [
    ["index", "routing", "pages-и-дерево-маршрутов"],
    ["index", "routing", "navigation"],
    ["index", "checks", "сценарии-редактора-и-сессии"],
    ["index", "checks", "tools"],
    ["index", "build", "transforms"],
    ["index", "styles", "modules"],
    ["index", "rendering", "cell"],
    ["build", "styles", "pipeline"],
    ["build", "checks", "tools"],
    ["styles", "build", "transforms"],
    ["checks", "build", "dev-prod"],
    ["checks", "build", "алиасы-env-и-ресурсы"],
    ["checks", "state", "saving"],
    ["checks", "session", "switching"],
    ["routing", "session", "switching"],
    ["rendering", "styles", "modules"],
    ["startup", "requests", "transport"],
    ["state", "rendering", "subscriptions"],
    ["state", "requests", "errors"],
  ] as const) {
    expect(read(from), from).toContain(`](./${to}#${id})`);
    const target = read(to);
    const anchor = id === "алиасы-env-и-ресурсы" ? "## Алиасы, env и ресурсы" : `{#${id}}`;
    expect(target.split(anchor), id).toHaveLength(2);
  }
});

for (const [page, title, relations] of [
  ["index", "Редактирование блокнота", [/open.*--> boot/, /spa.*--> get/, /draft --> saved/]],
  ["architecture", "Состояние и обновление UI", [/login --> bff/, /bff --> result/, /result --> store/, /store --> ui/]],
  ["startup", "Сторы до первого рендера", [/valid -->\|Да\| session/, /session --> notebook/, /notebook --> router/, /valid -->\|Нет\| failure/, /failure --> stopped/]],
  ["routing", "Переход и история", [/url.*--> bff/, /link.*--> history/, /history --> tree/, /tree --> guard/, /guard.*outlet/]],
  ["rendering", "Внешний стор и обновление DOM", [/input.*--> store/, /store --> compare/, /local.*--> render/, /reconcile --> dom/]],
  ["state", "Новый ввод во время запроса", [/S->>B: Запись v1/, /UI->>S: Черновик v2/, /B-->>S: Подтверждение v1/, /confirmed = v1, drafts = v2/]],
  ["state", "Сохранение и конфликты", [/Исход неизвестен.*read/, /read --> reconcile/, /409 notebook_conflict.*pause/, /pause --> fresh/, /fresh --> choice/]],
  ["build", "Преобразования и проверка типов", [/source.*--> types/, /source --> oxc/, /svgr --> oxc/, /oxc --> dev/, /oxc --> prod/]],
  ["styles", "CSS Modules и область классов", [/css.*--> names/, /names --> button/, /button --> dom/, /tokens.*--> rules/, /rules --> dom/]],
  ["checks", "Что проверяют инструменты", [/change.*--> check/, /change --> build/, /browser --> bff/, /bff --> go/]],
] as const) test(`frontend: парная схема — ${page}, ${title}`, () => {
  const pair = section(read(page), title).match(/<DiagramSection>([\s\S]*?)<template #diagram>\s*```mermaid\n([\s\S]*?)```\s*<\/template>\s*<\/DiagramSection>/);
  expect(pair, title).not.toBeNull();
  expect(pair![1]).toContain("https://github.com/");
  for (const relation of relations) expect(pair![2], String(relation)).toMatch(relation);
});
