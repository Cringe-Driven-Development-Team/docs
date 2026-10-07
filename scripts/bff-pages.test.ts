import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

// Страницы раздела «Миграция на BFF»; страницы 2 и 3 появляются в следующих задачах.
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
});
