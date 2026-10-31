import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const quickstart = "https://github.com/Cringe-Driven-Development-Team/docs/blob/main/openwiki/quickstart.md";
const context = readFileSync("site/project-context.md", "utf8");
const readme = readFileSync("README.md", "utf8");
const agents = readFileSync("AGENTS.md", "utf8");
const claude = readFileSync("CLAUDE.md", "utf8");

test("project-context links to the public visualizer", () => {
  expect(context).toContain('href="./openwiki/"');
});

test("README retains the source Markdown link", () => {
  expect(readme).toContain(`](${quickstart})`);
});

test("project-context and README identify docs as canonical", () => {
  for (const text of [context, readme]) {
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
  expect(agents).not.toContain("The scheduled OpenWiki GitHub Actions workflow");
  expect(agents).toContain("there is no scheduled generation");
  expect(agents).toContain("CI только проверяет wiki PR");
  expect(agents).toContain("bun run wiki:check --against");
  expect(agents).toContain("актуальном SHA");
});

test("code, production evidence and conditional workspace remain distinct", () => {
  for (const text of [agents, readme]) {
    expect(text).toContain("SHA выкаченного релиза, дата");
    expect(text).toContain("openwiki link");
    expect(text).toContain("openwiki workspace use");
    expect(text).toContain("git remote get-url origin");
    expect(text).toContain("openwiki/quickstart.md");
  }
  for (const name of ["react", "vite-plugin-bff-html", "router", "zustand", "clsx", "oxlint-plugin-jsdoc"]) {
    expect(context).toContain(`@cdd-team/${name}`);
    expect(context).toContain(`/packages/${name}/package.json#L1`);
  }
  expect(context).toContain("/.github/workflows/release.yml#L15-L82");
});
