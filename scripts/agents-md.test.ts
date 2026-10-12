import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const agents = readFileSync("AGENTS.md", "utf8");
const claude = readFileSync("CLAUDE.md", "utf8");

test("CLAUDE.md подключает AGENTS.md и держит только строки для Claude Code", () => {
  expect(claude).toContain("@AGENTS.md");
  expect(claude).toContain("## Только для Claude Code");
});

test("AGENTS.md содержит все разделы правил", () => {
  for (const heading of [
    "## Проект",
    "## Что где лежит",
    "## Схемы",
    "## Сборка",
    "## Процесс",
    "## Публичный репозиторий",
    "## Окружение: Windows",
    "## Скиллы",
  ]) {
    expect(agents, heading).toContain(heading);
  }
});

test("AGENTS.md называет скиллы, пути и проверки", () => {
  for (const word of [
    "eraser-diagrams",
    "docs-modules",
    "docs-site",
    ".agents/skills/",
    "bun run skills:sync",
    "modules:check",
    "lefthook",
  ]) {
    expect(agents, word).toContain(word);
  }
});

test("README и AGENTS.md не отправляют править скилл в .claude/skills", () => {
  for (const file of ["README.md", "AGENTS.md"]) {
    expect(readFileSync(file, "utf8"), file).not.toContain(".claude/skills/eraser-diagrams");
  }
});

test("AGENTS.md меньше 32 КиБ", () => {
  expect(Buffer.byteLength(agents)).toBeLessThan(32 * 1024);
});
