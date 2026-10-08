import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { diagramNames, indexNames } from "./build-index.ts";

const PAGE = "site/architecture/index.md";
const ORDER = ["deployment", "ci", "cd", "frontend", "contract", "infra"];

test("every root diagram is on /architecture/ with a heading and a Diagram", () => {
  const page = readFileSync(PAGE, "utf8");
  for (const name of indexNames(diagramNames())) {
    expect(page, name).toContain(`\n## ${name}\n`);
    expect(page, name).toContain(`<Diagram name="${name}"`);
  }
  const headings = [...page.matchAll(/^## (\S+)$/gm)].map((match) => match[1]);
  expect(headings).toEqual(ORDER);
});

test("config: Architecture goes to /architecture/ without target, branch previews only on main", () => {
  const config = readFileSync("site/.vitepress/config.mts", "utf8");
  expect(config).toContain("link: '/architecture/'");
  expect(config).toContain("activeMatch: '^/architecture/'");
  expect(config).not.toContain("link: '/diagrams/'");
  expect(config).toMatch(/SITE_BASE === '\/docs\/'[\s\S]{0,200}link: '\/branches\/'/);
  const home = readFileSync("site/index.md", "utf8");
  expect(home).not.toContain("/diagrams/");
  expect(home).toContain("/architecture/");
});

test("docs tell to add a new root diagram to ROOT_NAMES and to the page", () => {
  for (const file of ["README.md", "CLAUDE.md"]) {
    const text = readFileSync(file, "utf8");
    expect(text, file).toContain("site/.vitepress/diagram-names.ts");
    expect(text, file).toContain("ROOT_NAMES");
    expect(text, file).toContain("site/architecture/index.md");
  }
});
