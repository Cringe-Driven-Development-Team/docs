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

test("каждая страница трека начинается с плашки про tRPC", () => {
  for (const file of BFF_PAGES) {
    const md = readFileSync(file, "utf8");
    const block = firstBlock(md);
    expect(block.startsWith("::: warning"), file).toBe(true);
    expect(block, file).toContain(TRPC_WARNING);
    expect(block, file).toContain(file === TRACK ? "(#trpc)" : "(../bff#trpc)");
    expect(md, file).not.toContain(OLD_WARNING);
  }
});

test("в треке есть раздел tRPC и подстраницы", () => {
  const md = readFileSync(TRACK, "utf8");
  expect(md).toContain("## tRPC");
  expect(md).toContain("pages: [contract, auth]");
  expect(md).toContain('- "tRPC"');
  expect(md.split("\n").some((line) => line.startsWith("# "))).toBe(false);
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

test("страница «Контракт» описывает overlay", () => {
  expect(existsSync(CONTRACT)).toBe(true);
  const md = readFileSync(CONTRACT, "utf8");
  for (const needle of [
    "spec/bff.overlay.yaml",
    "spec/openapi.public.json",
    "openapi-format",
    "--overlayFile",
    "sessionCookie",
    "csrfHeader",
    "TokenPair",
    "orval",
    "client: 'hono'",
    "Собственные ручки BFF",
    "`bff`",
  ]) {
    expect(md, needle).toContain(needle);
  }
  const yamlBlocks = md.match(/```yaml\n[\s\S]*?```/g) ?? [];
  expect(yamlBlocks.length).toBe(1);
  expect(yamlBlocks[0]).toContain("overlay: 1.0.0");
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
