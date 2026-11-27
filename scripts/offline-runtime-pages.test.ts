import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const md = readFileSync("site/documentation/offline/index.md", "utf8");

test("offline runtime: Cache Storage содержит только HTML, CSS и шрифт fallback", () => {
  for (const pattern of [
    /\| Персональный HTML BFF \| Нет \|/,
    /\| RPC \/ API \| Нет \|/,
    /\| `\/offline\.html` \| Да \|/,
    /\| `\/offline\.css` \| Да \|/,
    /\| `\/onest-variable\.woff2` \| Да \|/,
    /\| Манифест и иконки \| Нет \|/,
    /\| JS\/CSS и остальные ассеты SPA \| Нет \|/,
  ]) expect(md).toMatch(pattern);
  for (const term of ["503", "сетевой отказ", "Response.error()", "Cache Storage", "Disable cache"]) expect(md).toContain(term);
  expect(md).toMatch(/\/frontend\/blob\/[0-9a-f]{40}\/apps\/client\/sw\/sw\.ts#L\d+/);
});

test("offline runtime: наблюдение различает первый визит, открытую вкладку и повторную навигацию", () => {
  const evidence = md.split("\n## Проверка на проде\n")[1]?.split("\n## ")[0] ?? "";
  expect(evidence).toMatch(/\b[0-9a-f]{40}\b/);
  expect(evidence).toMatch(/\d{2}\.\d{2}\.2026/);
  for (const term of ["UTC+3", "Chrome", "ERR_INTERNET_DISCONNECTED", "/login", "Повторить", "открытая вкладка"]) {
    expect(evidence).toContain(term);
  }
  expect(md.split("\n## Границы проверки\n")[1]).toContain("Авторизованное сохранение");
});
