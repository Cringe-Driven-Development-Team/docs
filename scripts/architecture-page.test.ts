import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { diagramNames, indexNames } from "./build-index.ts";

const PAGE = "site/architecture/index.md";
const ORDER = ["deployment", "ci", "cd", "frontend", "contract", "infra"];

test("every root diagram is on /architecture/ with a heading and a Diagram", () => {
  const page = readFileSync(PAGE, "utf8");
  for (const name of indexNames(diagramNames())) {
    const section = page.split(`{#${name}}`)[1]?.split("\n## ")[0] ?? "";
    expect(section, name).toContain(`<Diagram name="${name}"`);
  }
  const headings = [...page.matchAll(/^## .+ \{#([^}]+)\}$/gm)].map((match) => match[1]);
  expect(headings).toEqual(ORDER);
});

test("config: three entrances keep architecture in documentation, no branch previews in the nav", () => {
  const config = readFileSync("site/.vitepress/config.mts", "utf8");
  expect(config).toContain("link: '/architecture/'");
  const nav = config.split("nav: [")[1]?.split("],")[0] ?? "";
  expect([...nav.matchAll(/text: '([^']+)'/g)].map(match => match[1])).toEqual([
    "OpenWiki", "Документация", "Модули",
  ]);
  expect(nav).toContain("link: '/documentation/'");
  expect(config).not.toContain("link: '/diagrams/'");
  // Список превью веток — по ссылке из README, в меню сайта его нет
  expect(config).not.toContain("link: '/branches/'");
  expect(config).not.toContain("Превью веток");
  const home = readFileSync("site/index.md", "utf8");
  expect(home).not.toContain("/diagrams/");
  expect(home).toContain("/documentation/");
  const documentation = readFileSync("site/documentation/index.md", "utf8");
  for (const link of ["/documentation/bff", "/architecture/", "/security/csrf/", "/project-context", "/modules/"]) {
    expect(documentation).toContain(`](${link})`);
  }
  expect(documentation).toContain('href="../openwiki/" target="_self"');
  const observed = documentation.split("## Что подтверждено на проде")[1]?.split("## Архитектура")[0] ?? "";
  const observations = observed.match(/^- .+$/gm) ?? [];
  expect(observations).toHaveLength(5);
  expect(observations[1]).toContain("не содержит пользователя и не устанавливает cookie");
  expect(observations[2]).toContain("GET tRPC без CSRF-заголовка");
  expect(observations[3]).toContain("GET tRPC с CSRF-заголовком");
  expect(observed).toContain("POST-защита от чужого Origin");
  expect(documentation).toContain("31.10.2026");
  expect(documentation).toContain("не подтверждены");
});

test("docs tell where module plan diagrams live", () => {
  for (const file of ["README.md", "AGENTS.md", ".agents/skills/eraser-diagrams/SKILL.md"]) {
    expect(readFileSync(file, "utf8"), file).toContain("diagrams/modules/");
  }
});

test("docs tell to add a new root diagram to ROOT_NAMES and to the page", () => {
  for (const file of ["README.md", "AGENTS.md"]) {
    const text = readFileSync(file, "utf8");
    expect(text, file).toContain("site/.vitepress/diagram-names.ts");
    expect(text, file).toContain("ROOT_NAMES");
    expect(text, file).toContain("site/architecture/index.md");
  }
});

test("page has no links to the removed bff diagrams, keeps frozen k3s", () => {
  const page = readFileSync(PAGE, "utf8");
  expect(page).not.toContain("../bff/");
  expect(page).toContain("../frozen-k3s/deployment.html");
});

test("current behavior points to documentation and the CSRF sidebar names history", () => {
  const modules = readFileSync("site/modules/index.md", "utf8");
  expect(modules).toContain("](/documentation/)");
  expect(modules).not.toContain("](/security/csrf/)");
  const context = readFileSync("site/project-context.md", "utf8");
  expect(context).toContain("](/documentation/)");
  const config = readFileSync("site/.vitepress/config.mts", "utf8");
  const sidebar = config.split("'/security/csrf/': [")[1]?.split("],")[0] ?? "";
  expect(sidebar).toContain("text: 'CSRF: история 07.10.2026'");
  expect(sidebar).toContain("link: '/documentation/bff'");
});
