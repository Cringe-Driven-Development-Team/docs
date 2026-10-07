import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

// Страницы раздела «Миграция на BFF».
export const BFF_PAGES = ["site/bff/index.md", "site/bff/contract.md", "site/bff/auth.md"];
export const CSRF_PAGES = ["site/security/csrf/index.md", "site/security/csrf/scenarios.md", "site/security/csrf/checks.md"];
export const WARNING =
  "Проект трека миграции на BFF, ещё не внедрено. Как работает сейчас — раздел [CSRF](/security/csrf/).";
export const TIP =
  "Это текущая реализация; при переезде на BFF её заменяет [Авторизация и CSRF в BFF](/bff/auth).";

/** Текст первого блока `:::` после строки `# `. */
export function firstBlockAfterTitle(md: string): string {
  const lines = md.split("\n");
  const title = lines.findIndex((line) => line.startsWith("# "));
  const rest = lines.slice(title + 1).join("\n").trimStart();
  const end = rest.indexOf("\n:::");
  return end === -1 ? rest : rest.slice(0, end + 4);
}

test("каждая существующая страница BFF начинается с плашки «проект»", () => {
  expect(existsSync("site/bff/index.md")).toBe(true);
  for (const file of BFF_PAGES.filter((f) => existsSync(f))) {
    const block = firstBlockAfterTitle(readFileSync(file, "utf8"));
    expect(block.startsWith("::: warning"), file).toBe(true);
    expect(block, file).toContain(WARNING);
  }
});

test("в меню есть BFF", () => {
  const config = readFileSync("site/.vitepress/config.mts", "utf8");
  expect(config).toContain("text: 'BFF'");
  expect(config).toContain("activeMatch: '^/bff/'");
  expect(config).toContain("'/bff/'");
  expect(config).toContain("'/bff/contract'");
  expect(config).toContain("'/bff/auth'");
});

test("страницы CSRF ссылаются на раздел BFF", () => {
  for (const file of CSRF_PAGES) {
    const block = firstBlockAfterTitle(readFileSync(file, "utf8"));
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
  expect(existsSync("site/bff/auth.md")).toBe(true);
  const list = scenarios(readFileSync("site/bff/auth.md", "utf8"));
  expect(list.length).toBe(10);
  for (const { title, body } of list) {
    expect(body.match(/```mermaid/g)?.length, title).toBe(1);
    expect(body, title).toContain("sequenceDiagram");
    expect(body, title).toContain("*Проект: проверить после внедрения.*");
  }
});

test("сценарий двух вкладок — один refresh в Go", () => {
  expect(existsSync("site/bff/auth.md")).toBe(true);
  const tabs = scenarios(readFileSync("site/bff/auth.md", "utf8")).find((s) => s.title === "Две вкладки");
  expect(tabs).toBeDefined();
  const toGo = tabs!.body.split("\n").filter((line) => /^\s*\w+-+>>[+-]?A:/.test(line));
  expect(toGo.filter((line) => line.includes("/auth/refresh")).length).toBe(1);
});

test("страница «Контракт» описывает overlay", () => {
  expect(existsSync("site/bff/contract.md")).toBe(true);
  const md = readFileSync("site/bff/contract.md", "utf8");
  for (const needle of [
    "spec/bff.overlay.yaml",
    "spec/openapi.public.json",
    "openapi-format",
    "--overlayFile",
    "sessionCookie",
    "csrfHeader",
    "TokenPair",
  ]) {
    expect(md, needle).toContain(needle);
  }
  const yamlBlocks = md.match(/```yaml\n[\s\S]*?```/g) ?? [];
  expect(yamlBlocks.length).toBe(1);
  expect(yamlBlocks[0]).toContain("overlay: 1.0.0");
});
