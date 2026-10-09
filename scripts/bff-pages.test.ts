import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

// Документы трека «BFF» модуля октября: страница трека и две подстраницы.
export const TRACK = "site/modules/2026-10/tracks/bff.md";
export const CONTRACT = "site/modules/2026-10/tracks/bff/contract.md";
export const AUTH = "site/modules/2026-10/tracks/bff/auth.md";
export const BFF_PAGES = [TRACK, CONTRACT, AUTH];
export const CSRF_PAGES = ["site/security/csrf/index.md", "site/security/csrf/scenarios.md", "site/security/csrf/checks.md"];
export const TRPC_WARNING = "Решение по tRPC меняет участок клиент → BFF";
export const OLD_WARNING = "Проект трека миграции на BFF, ещё не внедрено";
export const TIP =
  "Это текущая реализация; при переезде на BFF её заменяет [Авторизация и CSRF в BFF](/modules/2026-10/tracks/bff/auth).";

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
  expect(md).toContain("pages: [contract, auth]");
  expect(md).not.toContain('- "tRPC (client)"');
  expect(md).toContain("](./trpc-client)");
  expect(md).toContain('- "tRPC (server)"');
  expect(md.split("\n").some((line) => line.startsWith("# "))).toBe(false);
  const trpc = section(md, "tRPC");
  expect(trpc).toContain("./bff/contract");
  expect(trpc).not.toContain("/api/v1");
});

/** Подраздел `### <title>` до следующего заголовка `##` или `###`. */
function subsection(md: string, title: string): string {
  const start = md.indexOf(`\n### ${title}\n`);
  if (start === -1) return "";
  const rest = md.slice(start + 1).split("\n").slice(1).join("\n");
  const next = rest.search(/^##+ /m);
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

test("в «Авторизация и CSRF» десять сценариев со схемой и пометкой", () => {
  expect(existsSync(AUTH)).toBe(true);
  const list = scenarios(readFileSync(AUTH, "utf8"));
  expect(list.length).toBe(10);
  for (const { title, body } of list) {
    expect(body.match(/```mermaid/g)?.length, title).toBe(1);
    expect(body, title).toContain("sequenceDiagram");
    expect(body, title).toContain("*Проект: проверить после внедрения.*");
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
  const claude = readFileSync("CLAUDE.md", "utf8");
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
  for (const title of ["Атака с чужого сайта", "Запрос с поддомена"]) {
    expect(subsection(auth, title), title).toContain("415");
  }
  expect(section(auth, "CSRF")).toContain("первыми из проверок BFF");
  expect(section(readFileSync(CONTRACT, "utf8"), "Какие вызовы BFF принимает")).toContain("Content-Type: application/json");
});

test("ошибка createContext на батч — один конверт", () => {
  const client = section(readFileSync(CONTRACT, "utf8"), "Клиент");
  expect(client).toContain("один конверт");
  expect(client).toContain("toEqual");
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

test("клиент tRPC — пакет @cdd-team/trpc-client из frontend-packages", () => {
  const repo = "https://github.com/Cringe-Driven-Development-Team/frontend-packages";
  for (const file of [TRACK, CONTRACT]) {
    const md = readFileSync(file, "utf8");
    expect(md, file).toContain("@cdd-team/trpc-client");
    expect(md, file).toContain(repo);
    expect(md, file).not.toContain("@cdd/trpc-client");
    expect(md, file).not.toContain("tRPC (`packages/trpc-client`");
    expect(md, file).not.toContain("пакет `packages/trpc-client`");
  }
});
