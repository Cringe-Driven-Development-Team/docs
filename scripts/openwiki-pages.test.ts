import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const quickstart = "https://github.com/Cringe-Driven-Development-Team/docs/blob/main/openwiki/quickstart.md";
const context = readFileSync("site/project-context.md", "utf8");
const readme = readFileSync("README.md", "utf8");
const agents = readFileSync("AGENTS.md", "utf8");
const claude = readFileSync("CLAUDE.md", "utf8");

test("project-context and README link to the derived wiki and identify docs as canonical", () => {
  for (const text of [context, readme]) {
    expect(text).toContain(`](${quickstart})`);
    expect(text).toMatch(/Wiki — производн/);
    expect(text).toMatch(/Канонический текст остаётся в `docs`/);
  }
});

test("agent instructions retain the import and restrict updates to the owner's local command", () => {
  expect(claude).toContain("@AGENTS.md");
  for (const text of [agents, claude]) {
    expect(text.split("<!-- OPENWIKI:START -->")).toHaveLength(2);
    expect(text.split("<!-- OPENWIKI:END -->")).toHaveLength(2);
  }
  expect(agents).toContain("Обновление wiki запускается только по явной локальной команде владельца");
  expect(agents).toContain("Предложение о scheduled workflow в управляемом блоке ниже здесь не применяется");
  expect(agents).toContain("CI только проверяет wiki PR");
  expect(agents).toContain("bun run wiki:check --against");
  expect(agents).toContain("актуальном SHA");
});
