import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

// Документы трека «BFF» модуля октября: страница трека и четыре подстраницы.
export const TRACK = "site/modules/2/tracks/bff.md";
export const CONTRACT = "site/modules/2/tracks/bff/contract.md";
export const AUTH = "site/modules/2/tracks/bff/auth.md";
export const SERVICE = "site/modules/2/tracks/bff/service.md";
// SERVICE сюда не входит: проверка «нет IPv4» ниже ловит 127.0.0.1 из healthcheck; свои проверки — в тестах «Сервис BFF».
export const BOOTSTRAP = "site/modules/2/tracks/bff/bootstrap.md";
export const BFF_PAGES = [TRACK, CONTRACT, AUTH, BOOTSTRAP];
export const CSRF_PAGES = ["site/security/csrf/index.md", "site/security/csrf/scenarios.md", "site/security/csrf/checks.md"];
export const TRPC_WARNING = "Решение по tRPC меняет участок клиент → BFF";
export const OLD_WARNING = "Проект трека миграции на BFF, ещё не внедрено";
export const TIP =
  "Это текущая реализация; при переезде на BFF её заменяет [Авторизация и CSRF в BFF](/modules/2/tracks/bff/auth).";

/** Первый блок `:::` страницы: после frontmatter и строки `# `, если она есть. */
export function firstBlock(md: string): string {
  const body = md.replace(/^---\n[\s\S]*?\n---\n/, "");
  const lines = body.split("\n");
  const title = lines.findIndex((line) => line.startsWith("# "));
  const rest = lines.slice(title + 1).join("\n");
  const start = rest.indexOf(":::");
  if (start === -1) return "";
  const end = rest.indexOf("\n:::", start + 3);
  return end === -1 ? rest.slice(start) : rest.slice(start, end + 4);
}

test("плашек про отвергнутый вариант нет", () => {
  for (const file of BFF_PAGES) {
    const md = readFileSync(file, "utf8");
    expect(md, file).not.toContain("отвергнутый вариант");
    expect(md, file).not.toContain(TRPC_WARNING);
    expect(md, file).not.toContain(OLD_WARNING);
  }
});

test("в треке есть раздел tRPC и подстраницы", () => {
  const md = readFileSync(TRACK, "utf8");
  expect(md).toContain("## tRPC");
  expect(md).toContain("pages: [contract, auth, service, bootstrap]");
  expect(md).not.toContain('- "tRPC (client)"');
  expect(md).toContain("](./trpc-client)");
  expect(md).toContain('- "tRPC (server)"');
  expect(md.split("\n").some((line) => line.startsWith("# "))).toBe(false);
  const trpc = section(md, "tRPC");
  expect(trpc).toContain("./bff/contract");
  expect(trpc).not.toContain("/api/v1");
});

/** Подраздел до следующего заголовка того же или более высокого уровня. */
function subsection(md: string, title: string, level: 3 | 4 = 3): string {
  const start = md.indexOf(`\n${"#".repeat(level)} ${title}\n`);
  if (start === -1) return "";
  const rest = md.slice(start + 1).split("\n").slice(1).join("\n");
  const next = rest.search(new RegExp(`^#{1,${level}} `, "m"));
  return next === -1 ? rest : rest.slice(0, next);
}

test("обзор: клиент вызывает tRPC", () => {
  const md = readFileSync(TRACK, "utf8");
  const before = section(md, "Было и стало");
  expect(before).toContain("/api/trpc/* на bff:3000");
  expect(before).not.toContain("/api/v1/* на bff:3000");
  expect(subsection(md, "Infra")).toContain("/api/trpc/*");
  const front = subsection(md, "Фронт");
  expect(front).toContain("AppRouter");
  expect(front).not.toContain("публичного контракта");
});

test("в меню нет раздела BFF", () => {
  const config = readFileSync("site/.vitepress/config.mts", "utf8");
  expect(config).not.toContain("text: 'BFF'");
  expect(config).not.toContain("'/bff/'");
  expect(config).toContain("moduleSidebar(");
});

test("старого раздела нет", () => {
  expect(existsSync("site/bff")).toBe(false);
});

test("ссылок на /bff/ не осталось", () => {
  for (const file of new Bun.Glob("site/**/*.md").scanSync()) {
    expect(readFileSync(file, "utf8"), file).not.toContain("](/bff/");
  }
});

test("страницы CSRF ссылаются на трек", () => {
  for (const file of CSRF_PAGES) {
    const block = firstBlock(readFileSync(file, "utf8"));
    expect(block.startsWith("::: tip"), file).toBe(true);
    expect(block, file).toContain(TIP);
  }
});

/** Подраздел `### <title>` внутри `## Сценарии`: список всех и поиск по имени. */
function scenarios(md: string): { title: string; body: string }[] {
  const start = md.indexOf("\n## Сценарии");
  if (start === -1) return [];
  const rest = md.slice(start + 1).split("\n").slice(1).join("\n");
  const next = rest.search(/^## /m);
  const section = next === -1 ? rest : rest.slice(0, next);
  return section
    .split(/^### /m)
    .slice(1)
    .map((chunk) => {
      const [title = "", ...body] = chunk.split("\n");
      return { title: title.trim(), body: body.join("\n") };
    });
}

test("в «Авторизация и CSRF» семь сценариев сессии со схемой и пометкой", () => {
  expect(existsSync(AUTH)).toBe(true);
  const list = scenarios(readFileSync(AUTH, "utf8"));
  expect(list.map((s) => s.title)).toEqual([
    "Вход", "Запрос данных", "Access истёк", "Две вкладки", "Выход",
    "Сессия кончилась", "Первый вход после переезда",
  ]);
  for (const { title, body } of list) {
    expect(body.match(/```mermaid/g)?.length, title).toBe(1);
    expect(body.match(/sequenceDiagram/g)?.length, title).toBe(1);
    expect(body.split("*Проект: проверить после внедрения.*").length - 1, title).toBe(1);
  }
});

test("CSRF: три подраздела со своими схемами и прежними заголовками-якорями", () => {
  const auth = readFileSync(AUTH, "utf8");
  const csrf = section(auth, "CSRF");
  const diagrams = [
    ["Запрос нашего клиента", "client"],
    ["Атака с чужого сайта", "foreign"],
    ["Переход по внешней ссылке", "navigation"],
  ];
  expect(csrf.split("\n").filter((line) => line.startsWith("### "))).toEqual(
    diagrams.map(([title]) => `### ${title}`),
  );
  for (const [title, name] of diagrams) {
    const component = `<Diagram name="modules/2/bff-csrf-${name}" />`;
    const part = subsection(csrf, title!);
    expect(part, title).toContain(component);
    expect(part.slice(0, part.indexOf(component)).trim().length, title).toBeGreaterThan(20);
    expect(auth.split(component).length - 1, name).toBe(1);
  }
  expect(csrf.match(/<Diagram /g)?.length).toBe(3);
  expect(csrf).not.toContain("```mermaid");
  expect(subsection(csrf, "Атака с чужого сайта")).toContain("#### Запрос с поддомена");
  for (const heading of [
    "### Атака с чужого сайта", "#### Запрос с поддомена", "### Переход по внешней ссылке",
  ]) expect(auth.split("\n").filter((line) => line === heading).length, heading).toBe(1);
  expect(auth).not.toContain("WebSocket");
  expect(auth).toContain("три схемы CSRF и семь сценариев сессии");
  expect(subsection(csrf, "Переход по внешней ссылке")).toContain("](./bootstrap)");

  const readme = readFileSync("README.md", "utf8");
  for (const [, name] of diagrams) {
    const link = `[bff-csrf-${name}](https://docs.cellestial.ru/modules/2/bff-csrf-${name}.html)`;
    expect(readme.split("\n").filter((line) => line.startsWith("| ") && line.includes(link)).length, name).toBe(1);
  }
});

test("сценарий двух вкладок — один refresh в Go", () => {
  expect(existsSync(AUTH)).toBe(true);
  const tabs = scenarios(readFileSync(AUTH, "utf8")).find((s) => s.title === "Две вкладки");
  expect(tabs).toBeDefined();
  const toGo = tabs!.body.split("\n").filter((line) => /^\s*\w+-+>>[+-]?A:/.test(line));
  expect(toGo.filter((line) => line.includes("/auth/refresh")).length).toBe(1);
});

export const PROCEDURES = [
  "auth.register",
  "auth.login",
  "auth.logout",
  "users.me",
  "notebooks.list",
  "notebooks.get",
  "notebooks.create",
  "cells.create",
  "cells.delete",
];

/** Раздел `## <title>` страницы до следующего `## `. */
export function section(md: string, title: string): string {
  const start = md.indexOf(`\n## ${title}\n`);
  if (start === -1) return "";
  const rest = md.slice(start + 1).split("\n").slice(1).join("\n");
  const next = rest.search(/^## /m);
  return next === -1 ? rest : rest.slice(0, next);
}

test("«Контракт» описывает tRPC", () => {
  const md = readFileSync(CONTRACT, "utf8");
  const headings = md.split("\n").filter((line) => line.startsWith("## ")).map((line) => line.slice(3));
  expect(headings).toEqual([
    "Источники правды",
    "Что меняется в контракте Go",
    "Команды",
    "Генерация Orval",
    "Роутер",
    "Как добавить процедуру",
    "Процедуры экранов",
    "Ошибки",
    "Клиент",
    "Какие вызовы BFF принимает",
  ]);
  for (const needle of ["AppRouter", "views.notebook", "appCode", "inferRouterOutputs", "/api/trpc", "createContext", "authedProcedure", "goZod", "client: 'zod'"]) {
    expect(md, needle).toContain(needle);
  }
  for (const needle of ["bff.overlay.yaml", "openapi.public.json", "client: 'hono'", "Собственные ручки"]) {
    expect(md, needle).not.toContain(needle);
  }
});

test("в таблице роутера все 9 процедур", () => {
  const rows = section(readFileSync(CONTRACT, "utf8"), "Роутер")
    .split("\n")
    .filter((line) => line.startsWith("|"));
  for (const p of PROCEDURES) expect(rows.some((row) => row.includes(`\`${p}\``)), p).toBe(true);
  expect(rows.some((row) => row.includes("auth.refresh"))).toBe(false);
});

test("openapi-cdd встречается только в одной фразе «Контракта»", () => {
  const count = (f: string) => (readFileSync(f, "utf8").match(/openapi-cdd/g) ?? []).length;
  expect(count(CONTRACT)).toBeLessThanOrEqual(1);
  expect(count(TRACK)).toBe(0);
  expect(count(AUTH)).toBe(0);
});

test("в «Обзоре» есть раздел «Две VPS»", () => {
  const md = readFileSync(TRACK, "utf8");
  for (const needle of ["## Две VPS", "X-BFF-Key", "BFF_API_KEY", "mTLS"]) {
    expect(md, needle).toContain(needle);
  }
  for (const file of BFF_PAGES) {
    // Номера разделов RFC («§6.1.3.3.2», «section-6.1.3.3.2») похожи на IPv4, их не считаем.
    const text = readFileSync(file, "utf8").replace(/(§|section-)\d+(\.\d+)*/g, "");
    expect(text, file).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/);
  }
});

test("правило модулей записано", () => {
  const claude = readFileSync("AGENTS.md", "utf8");
  expect(claude).toContain("## Что где лежит");
  expect(claude).toContain("Схемы корня описывают прод");
  expect(claude).toContain("tracks/<id>/<page>.md");
  expect(claude).not.toContain("Схемы описывают целевое состояние");
  expect(readFileSync("README.md", "utf8")).toContain("pages: [");
  expect(readFileSync("site/modules/index.md", "utf8")).toContain("Здесь план");
});

/** Строки-стрелки всех mermaid-блоков раздела «Сценарии». */
function scenarioArrows(md: string): string[] {
  const blocks = section(md, "Сценарии").match(/```mermaid\n[\s\S]*?```/g) ?? [];
  return blocks.flatMap((block) => block.split("\n")).filter((line) => /^\s*\w+-+>>[+-]?\w+:/.test(line));
}

test("в сценариях браузер вызывает tRPC", () => {
  const arrows = scenarioArrows(readFileSync(AUTH, "utf8"));
  const fromClient = arrows.filter((line) => /^\s*[FB]-+>>[+-]?[BP]:/.test(line));
  expect(fromClient.length).toBeGreaterThan(0);
  for (const line of fromClient) expect(line).not.toContain("/api/v1");
  expect(fromClient.some((line) => line.includes("/api/trpc/auth.login"))).toBe(true);
  const toGo = arrows.filter((line) => /^\s*P-+>>[+-]?A:/.test(line));
  expect(toGo.some((line) => line.includes("/api/v1"))).toBe(true);
});

test("«Авторизация» описывает обработку вызова", () => {
  const md = readFileSync(AUTH, "utf8");
  expect(md).toContain("\n## Как BFF обрабатывает вызов\n");
  expect(md).not.toContain("## Как BFF проксирует запрос");
  for (const needle of ["createContext", "authedProcedure", "/api/trpc"]) expect(md, needle).toContain(needle);
  expect(md).not.toContain("списке разрешённых");
});

test("ссылки на старые разделы", () => {
  for (const file of BFF_PAGES) {
    const md = readFileSync(file, "utf8");
    for (const anchor of ["#какие-запросы-bff-пропускает", "#собственные-ручки-bff", "#overlay", "#как-bff-проксирует-запрос"]) {
      expect(md, `${file} ${anchor}`).not.toContain(anchor);
    }
  }
});

test("не-JSON до createContext — 415, а не 403", () => {
  const auth = readFileSync(AUTH, "utf8");
  for (const [title, level] of [["Атака с чужого сайта", 3], ["Запрос с поддомена", 4]] as const) {
    expect(subsection(auth, title, level), title).toContain("415");
  }
  expect(section(auth, "CSRF")).toContain("первыми из проверок BFF");
  expect(section(readFileSync(CONTRACT, "utf8"), "Какие вызовы BFF принимает")).toContain("Content-Type: application/json");
});

test("ошибка createContext на батч — один конверт", () => {
  const client = section(readFileSync(CONTRACT, "utf8"), "Клиент");
  expect(client).toContain("один конверт");
  expect(client).toContain("httpBatchLink");
});

test("конверт успеха — result.data", () => {
  const auth = readFileSync(AUTH, "utf8");
  expect(auth).not.toContain("{ result: User }");
  expect(auth).not.toContain("{ result: null }");
  expect(auth).toContain("{ result: { data: User } }");
});

test("поле ячейки — kind, как в контракте Go", () => {
  const contract = readFileSync(CONTRACT, "utf8");
  expect(contract).not.toContain("type: 'code'");
  expect(contract).toContain("kind: 'code'");
});

test("выход отзывает refresh и при истёкшем access", () => {
  const contract = readFileSync(CONTRACT, "utf8");
  const auth = readFileSync(AUTH, "utf8");
  expect(contract).toContain("optionalSessionProcedure");
  expect(auth).toContain("optionalSessionProcedure");
  expect(auth).toContain("`auth.logout` никогда не отвечает `UNAUTHORIZED`");
});

test("MVP uses official tRPC", () => {
  const client = section(readFileSync(CONTRACT, "utf8"), "Клиент");
  for (const needle of ["@trpc/client", "createTRPCClient<AppRouter>", "httpBatchLink", "maxURLLength: 2000", "TRPCClientError", "X-CSRF", "same-origin", "data.code", "data.appCode", "data.zodError"]) {
    expect(client, needle).toContain(needle);
  }
  expect(client).toMatch(/["']X-CSRF["']:\s*["']1["']/);
  for (const needle of ["@cdd-team/trpc-client", "createClient", "TrpcError", "test(", "подставном `fetch`", "сторонних runtime-библиотек на клиенте нет"]) {
    expect(client, needle).not.toContain(needle);
  }
  for (const needle of ["query", "mutation", "ошибка полей", "UNAUTHORIZED", "refresh", "ручн"]) expect(client, needle).toContain(needle);
  for (const file of [TRACK, "site/modules/2/tracks/trpc-client.md"]) {
    const md = readFileSync(file, "utf8");
    expect(md, file).toContain("@trpc/client");
    expect(md, file).toContain("@trpc/server");
    expect(md, file).toContain("/modules/3/tracks/trpc");
    expect(md, file).not.toContain("@cdd-team/trpc-client");
  }
});

test("подтрек tRPC-клиента сохраняет опубликованный якорь «Связи»", () => {
  const md = readFileSync("site/modules/2/tracks/trpc-client.md", "utf8");
  expect(md.split("\n").filter((line) => line === "## Связи")).toHaveLength(1);
});

test("procedure flow uses AppRouter without SDK generation", () => {
  const md = readFileSync(CONTRACT, "utf8");
  const flow = section(md, "Как добавить процедуру");
  const at = (title: string) => md.indexOf(`\n## ${title}\n`);
  expect(at("Роутер")).toBeLessThan(at("Как добавить процедуру"));
  expect(at("Как добавить процедуру")).toBeLessThan(at("Процедуры экранов"));
  expect(flow.match(/^\d\. /gm)).toHaveLength(6);
  for (const needle of ["имя", "query/mutation", "вход", "результат", "ошибки", "авторизац", "Apidog", "bun run sync", "Orval", "Zod", "Hono", "адаптер", "AppRouter", "TypeScript", "Кодогенерации клиента", "typecheck"]) expect(flow, needle).toContain(needle);
  for (const needle of ["get: authedProcedure", "ctx.go.getNotebook(input.id)", "api.notebooks.get.query({ id: 1 })", "inferRouterInputs", "inferRouterOutputs"]) expect(flow, needle).toContain(needle);
  expect(section(md, "Процедуры экранов")).toContain("будущая ручка");
});

test("карта задач BFF сохраняет последовательность и границы", () => {
  const md = readFileSync(TRACK, "utf8");
  const refs = [44, 45, 2, 46, 5, 4].map((id) => md.indexOf(`[#${id} `));
  expect(refs.every((at) => at >= 0)).toBe(true);
  expect([...refs].sort((a, b) => a - b)).toEqual(refs);
  for (const needle of ["CI/CD", "параллельно", "артефактов", "приёмка", "согласованного Go"]) expect(md, needle).toContain(needle);
});

test("новые ссылки контракта ведут на существующие заголовки", () => {
  for (const [source, link, target, heading] of [
    ["site/modules/2/tracks/trpc-client.md", "./bff/contract#клиент", CONTRACT, "## Клиент"],
    ["site/modules/2/tracks/trpc-client.md", "./bff/contract#как-добавить-процедуру", CONTRACT, "## Как добавить процедуру"],
    [CONTRACT, "./service#каркас", SERVICE, "## Каркас"],
  ]) {
    expect(readFileSync(source!, "utf8"), link).toContain(link!);
    expect(readFileSync(target!, "utf8"), heading).toContain(heading!);
  }
});

test("в треке есть схема контракта: генерация, BFF и клиент", () => {
  const md = readFileSync(TRACK, "utf8");
  const part = section(md, "Как устроен контракт");
  expect(part).toContain('<Diagram name="modules/2/bff-contract" />');
  expect(part).not.toContain("```mermaid");
  // имена целей конфига Orval — только на подстранице «Контракт», рядом с самим конфигом
  expect(md).not.toMatch(/goZod|goApi/);
  expect(part).toContain("/modules/3/");
  expect(part).toContain("./bff/contract");
  expect(part).toContain("@cdd/schemas");
});

test("«Контракт»: схемы Orval — пакет @cdd/schemas для BFF, свой zod — модуль №3", () => {
  const md = readFileSync(CONTRACT, "utf8");
  expect(section(md, "Источники правды")).toContain("@cdd/schemas");
  expect(section(md, "Генерация Orval")).toContain("target: 'packages/schemas/src/zod.ts'");
  expect(md).not.toContain("apps/bff/src/go/zod.ts");
  expect(section(md, "Роутер")).toContain("from '@cdd/schemas'");
  const client = section(md, "Клиент");
  for (const needle of ["src/utils/credentials.ts", "zodError", "/modules/3/tracks/zod", "/modules/3/tracks/react-hook-form"]) expect(client, needle).toContain(needle);
  expect(md).not.toContain("resolve: { alias");
});

test("в треке есть схема монорепы фронта", () => {
  const md = readFileSync(TRACK, "utf8");
  const part = section(md, "Монорепа фронта");
  expect(part).toContain('<Diagram name="modules/2/frontend-monorepo" />');
  expect(part).toContain("#как-устроен-контракт");
  expect(part).toContain("frontend/issues/44");
  // порядок разделов: контракт → монорепа → было и стало
  const at = (title: string) => md.indexOf(`\n## ${title}\n`);
  expect(at("Как устроен контракт")).toBeGreaterThan(-1);
  expect(at("Как устроен контракт")).toBeLessThan(at("Монорепа фронта"));
  expect(at("Монорепа фронта")).toBeLessThan(at("Было и стало"));
});

test("tRPC (server) делает Денис, Валентин — сторона Go", () => {
  const md = readFileSync(TRACK, "utf8");
  expect(md).toContain("включая «tRPC (server)» — роутер tRPC в BFF, делает Денис");
  expect(md).toContain("Валентин — изменения на стороне Go");
  expect(md).not.toContain("делает Валентин");
});

test("подстраница «Сервис BFF»: разделы по порядку и ключевые решения", () => {
  const md = readFileSync(SERVICE, "utf8");
  expect(md).toContain("title: Сервис BFF");
  const order = ["## Каркас", "## Переменные окружения", "## Health check", "## Ошибки и логи", "## Сборка и образ", "## На проде"].map((h) => md.indexOf(h));
  expect(order.every((i) => i > 0)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  for (const s of ["fetchRequestHandler", "@trpc/server/adapters/fetch", "resHeaders", "/health", "SESSION_KEY", "APP_ORIGIN", "GO_API_URL", "oven/bun:", "-alpine", "bun build", "--target bun", "bff:3000", "service_healthy", "BFF_IMAGE_TAG", "frontend/issues/4"]) expect(md, s).toContain(s);
  expect(md).not.toContain("@hono/trpc-server");
  // значения ключа нет; строка compose `SESSION_KEY: ${SESSION_KEY:?…}` — подстановка, не значение
  expect(md).not.toMatch(/(?<!\$\{)SESSION_KEY\s*[:=]\s*(?!\$\{SESSION_KEY:)\S{8,}/);
  // реальных адресов нет; 127.0.0.1 — адрес healthcheck внутри контейнера
  expect(md.replaceAll("127.0.0.1", "")).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/);
});

test("подстраница «Сервис BFF»: ссылки на соседей ведут на существующие заголовки", () => {
  const md = readFileSync(SERVICE, "utf8");
  for (const [link, file, heading] of [
    ["./contract#роутер", CONTRACT, "## Роутер"],
    ["./auth#как-bff-обрабатывает-вызов", AUTH, "## Как BFF обрабатывает вызов"],
    ["../bff#переключение", TRACK, "## Переключение"],
    ["../bff#монорепа-фронта", TRACK, "## Монорепа фронта"],
    ["./contract#ошибки", CONTRACT, "## Ошибки"],
    ["(#переменные-окружения)", SERVICE, "## Переменные окружения"],
    ["(#на-проде)", SERVICE, "## На проде"],
  ] as const) {
    expect(md, link).toContain(link);
    expect(readFileSync(file, "utf8"), heading).toContain(heading);
  }
});

test("подстраница «Сервис BFF»: шаблоны Ansible в строковом коде не съедает Vue", () => {
  // В блоках ``` VitePress ставит v-pre, а `{{ … }}` в строке Vue подставляет как выражение — имя пропадает.
  const prose = readFileSync(SERVICE, "utf8").replace(/^```[\s\S]*?^```/gm, "");
  const inline = prose.match(/`[^`\n]+`/g) ?? [];
  expect(inline.filter((code) => code.includes("{{"))).toEqual([]);
  expect(prose).toContain("APP_ORIGIN=https://{{ app_domain }}");
  // выкатка: роль app тянет образ bff вместе с api и проверяет его тег и ключ
  const prod = section(readFileSync(SERVICE, "utf8"), "На проде");
  for (const needle of ["pull-api.yml", "pull: never", "bff_image_tag", "BFF_IMAGE_TAG={{ bff_image_tag }}", "validate.yml", "session_key"]) expect(prod, needle).toContain(needle);
  expect(prod).not.toContain("три места");
  // в HTML-теге markdown-it-emoji превращает «:$» в 😒 — двоеточие пишется сущностью
  expect(prose.match(/<code v-pre>[^<]*<\/code>/g)?.filter((code) => code.includes(":$")) ?? []).toEqual([]);
});


test("bootstrap: контракт, преобразование и старт клиента", () => {
  const md = readFileSync(BOOTSTRAP, "utf8");
  expect(md).toContain("title: Серверный bootstrap");
  expect(md.split("\n").filter((line) => line.startsWith("## ")).map((line) => line.slice(3))).toEqual([
    "Контракт", "HTML-запрос", "Вставка данных", "Старт клиента", "Ошибки", "Кеширование", "Разработка", "Выпуск и откат", "Проверка",
  ]);
  expect(section(md, "Контракт")).toContain('<script id="bootstrap" type="application/json"></script>');
  for (const value of ["HTMLRewriter", "serialize-javascript", "isJSON: true", "html: true"]) {
    expect(section(md, "Вставка данных"), value).toContain(value);
  }
  for (const value of ["textContent", "JSON.parse", "ошибка запуска"]) {
    expect(section(md, "Старт клиента"), value).toContain(value);
  }
  expect(section(readFileSync(CONTRACT, "utf8"), "Источники правды")).toContain("BootstrapData");
  expect(section(readFileSync(CONTRACT, "utf8"), "Роутер")).toContain("users.me");
  expect(section(readFileSync(AUTH, "utf8"), "Cookie сессии")).toContain("| `SameSite` | `Lax` |");
});

test("bootstrap: сессия, ошибки, кеширование и выпуск", () => {
  const md = readFileSync(BOOTSTRAP, "utf8");
  const errors = section(md, "Ошибки");
  for (const value of ["user: null", "503", "refresh", "новая cookie", "BAD_GATEWAY"]) expect(errors, value).toContain(value);
  expect(section(md, "Вставка данных")).toContain("отказ старта");
  const cache = section(md, "Кеширование");
  for (const value of ["гостевые", "private, no-store", "PWA"]) expect(cache, value).toContain(value);
  const release = section(md, "Выпуск и откат");
  expect(release.indexOf("Загрузить ассеты")).toBeGreaterThan(-1);
  expect(release.indexOf("Загрузить ассеты")).toBeLessThan(release.indexOf("Выкатить образ"));
  expect(release).toContain("Ошибка загрузки запрещает выкладку");
  expect(section(md, "Проверка")).toContain("Проект: проверить после внедрения");
  const allowed = section(readFileSync(CONTRACT, "utf8"), "Какие вызовы BFF принимает");
  expect(allowed).toContain("HTML-хендлер");
  expect(allowed).toContain("GET /users/me");
});

test("bootstrap: новые ссылки с якорями ведут на существующие заголовки", () => {
  for (const [source, link, target, heading] of [
    [TRACK, "./bff/bootstrap#выпуск-и-откат", BOOTSTRAP, "## Выпуск и откат"],
    [CONTRACT, "./bootstrap#контракт", BOOTSTRAP, "## Контракт"],
    [AUTH, "./bootstrap#html-запрос", BOOTSTRAP, "## HTML-запрос"],
    [SERVICE, "./bootstrap#вставка-данных", BOOTSTRAP, "## Вставка данных"],
    [SERVICE, "./bootstrap#выпуск-и-откат", BOOTSTRAP, "## Выпуск и откат"],
  ]) {
    expect(readFileSync(source!, "utf8"), link).toContain(link!);
    expect(readFileSync(target!, "utf8"), heading).toContain(heading!);
  }
});

test("bootstrap: схема встроена в начале HTML-потока до нумерованных шагов", () => {
  const part = section(readFileSync(BOOTSTRAP, "utf8"), "HTML-запрос");
  expect(part).toContain('<Diagram name="modules/2/bff-bootstrap" />');
  expect(part).toContain("Поток:");
  expect(part).toContain("1. BFF");
  expect(part.indexOf("<Diagram")).toBeGreaterThan(part.indexOf("Поток:"));
  expect(part.indexOf("<Diagram")).toBeLessThan(part.indexOf("1. BFF"));
});

test("SameSite explains direct and external navigation", () => {
  const cookie = section(readFileSync(AUTH, "utf8"), "Cookie сессии");
  expect(cookie).toMatch(/\| Прямой ввод адреса или закладка \| cookie отправляется \| cookie отправляется \|/);
  expect(cookie).toMatch(/\| Ссылка с другого сайта.*GitHub.*\| cookie не отправляется в первоначальном запросе \| cookie отправляется \|/);
  for (const needle of ["HTTPS", "редирект", "инициатор", "cookie не удалена", "same-site", "стартового `users.me`"]) expect(cookie, needle).toContain(needle);
  const html = section(readFileSync(BOOTSTRAP, "utf8"), "HTML-запрос");
  for (const needle of ["Strict", "закладк", "GitHub", "гостев", "./auth#cookie-сессии"]) expect(html, needle).toContain(needle);
  // Политика GET и три CSRF-подраздела уже покрыты отдельными тестами выше.
});

test("S2S is readable and mTLS is future", () => {
  const vps = section(readFileSync(TRACK, "utf8"), "Две VPS");
  for (const title of ["S2S-ключ", "mTLS — следующий этап", "Перенос Go и Postgres"]) expect(vps, title).toContain(`### ${title}`);
  const key = subsection(vps, "S2S-ключ");
  for (const needle of ["Назначение", "Проверка", "раньше Bearer", "ConstantTimeCompare", "403", "s2s_forbidden", "BAD_GATEWAY", "502", "503", "refresh не делает", "сессию не трогает", "Хранение", "Ротация", "старый", "новый"]) expect(key, needle).toContain(needle);
  const mtls = subsection(vps, "mTLS — следующий этап");
  for (const needle of ["сертификат", "обеих сторон", "шифрует", "не шифрует", "доверия", "ротации", "не входит в MVP", "принятый риск"]) expect(mtls, needle).toContain(needle);
  const move = subsection(vps, "Перенос Go и Postgres");
  for (const needle of ["ProxyJump", "inventory", "AllowTcpForwarding", "файрвол", "infra/issues/58", "infra/issues/59", "backend/issues/41"]) expect(move.toLowerCase(), needle).toContain(needle.toLowerCase());
  expect(move).not.toContain("задачи ещё нужно оформить");
});

test("MVP release differs from future canary", () => {
  const track = readFileSync(TRACK, "utf8");
  const release = section(track, "Переключение");
  for (const needle of ["один экземпляр", "короткое окно", "playbook", "Откат", "SESSION_KEY", "прежним", "promote"]) expect(release, needle).toContain(needle);
  expect(release.indexOf("Загрузить ассеты")).toBeLessThan(release.indexOf("образ BFF"));
  const service = readFileSync(SERVICE, "utf8");
  const health = section(service, "Health check");
  for (const needle of ["liveness", "готовность", "конфигурации", "шаблона", "graceful shutdown", "конечный срок", "один экземпляр"]) expect(health.toLowerCase(), needle).toContain(needle.toLowerCase());
  const bootstrap = section(readFileSync(BOOTSTRAP, "utf8"), "Выпуск и откат");
  for (const needle of ["один экземпляр", "короткое окно", "SESSION_KEY", "frontend/issues/4", "неизменяемый", "предыдущего", "Откат"]) expect(bootstrap, needle).toContain(needle);
  const canary = subsection(release, "Канарейка — следующий этап");
  for (const needle of ["стабильный сегмент", "HTML", "RPC", "ошибок", "задержек", "возврат трафика", "cookie", "refresh", "открытыми вкладками", "Go/БД", "10 секунд", "между процессами"]) expect(canary.toLowerCase(), needle).toContain(needle.toLowerCase());
  expect(section(readFileSync(CONTRACT, "utf8"), "Клиент")).toContain("UNAUTHORIZED");
});

test("migration arrow label is short", () => {
  const before = section(readFileSync(TRACK, "utf8"), "Было и стало");
  const label = before.match(/P -->\|"([^"]+)"\| A/ )?.[1];
  expect(label).toBeDefined();
  expect(label).not.toContain("http://");
  expect(label!.length).toBeLessThan(55);
  for (const needle of ["GO_API_URL", "http://api:8080/api/v1", "Authorization: Bearer"]) expect(before, needle).toContain(needle);
});

test("SameSite bootstrap link keeps target heading", () => {
  expect(readFileSync(BOOTSTRAP, "utf8")).toContain("./auth#cookie-сессии");
  expect(readFileSync(AUTH, "utf8")).toContain("## Cookie сессии");
});
