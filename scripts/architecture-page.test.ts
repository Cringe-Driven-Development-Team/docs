import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { diagramNames, indexNames } from "./build-index.ts";
import config from "../site/.vitepress/config.mts";

const PAGE = "site/documentation/architecture/index.md";
const ORDER = ["deployment", "ci", "cd", "frontend", "contract", "infra"];

test("documentation sidebar is a linked collapsed tree", () => {
  const sidebar = config.themeConfig!.sidebar as Record<string, unknown>;
  expect(Object.keys(sidebar)).toEqual(['/documentation/', '/modules/']);
  expect(sidebar['/documentation/']).toEqual([{text: 'Документация', items: [
    {text: 'Что работает сейчас', link: '/documentation/'},
    {text: 'BFF: проверенная часть', link: '/documentation/bff'},
    {text: 'Архитектура', link: '/documentation/architecture/'},
    {text: 'CSRF: историческая проверка', link: '/documentation/csrf/', collapsed: true, items: [
      {text: 'Сценарии', link: '/documentation/csrf/scenarios'},
      {text: 'Проверка и ограничения', link: '/documentation/csrf/checks'},
    ]},
    {text: 'Владельцы сведений', link: '/documentation/project-context'},
  ]}]);
  expect(config.themeConfig!.nav).toContainEqual({text: 'Документация', link: '/documentation/', activeMatch: '^/documentation/'});
});

test('production evidence distinguishes configuration from scenarios', () => {
  const intro = readFileSync(PAGE, 'utf8').split('\n## deployment')[0]!;
  for (const value of ['Архитектура работающего сервиса', '{#архитектура-mvp}', '01.11.2026',
    '6e1a0d81bc284e87aa4a9561d7b65eee835a26c3', 'baf512e9a7bd7e5452554cdc89baa20e24aa7a32',
    '26205cff0bdfd9c1d74e9f23557d8c931c724b9573ee49ce1b6eec3748c233f3',
    '41302004065', 'RUNTIME_ENABLED=true', 'gateway', 'VPS2', 'auxiliary']) {
    expect(intro, value).toContain(value);
  }
  expect(intro).toMatch(/runtime[\s\S]*не проверен/);
  expect(intro).toMatch(/Авторизованн[\s\S]*не проверен/);
});

test("every root diagram is on /documentation/architecture/ with a heading and a Diagram", () => {
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
  expect(config).toContain("link: '/documentation/architecture/'");
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
  for (const link of ["/documentation/bff", "/documentation/architecture/", "/documentation/csrf/", "/documentation/project-context", "/modules/"]) {
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
    expect(text, file).toContain("site/documentation/architecture/index.md");
  }
});

test("page has no links to removed diagram folders", () => {
  const page = readFileSync(PAGE, "utf8");
  expect(page).not.toContain("../bff/");
  expect(page).not.toContain("../frozen-k3s/");
});

test("current behavior points to documentation and the CSRF sidebar names history", () => {
  const modules = readFileSync("site/modules/index.md", "utf8");
  expect(modules).toContain("](/documentation/)");
  expect(modules).not.toContain("](/documentation/csrf/)");
  const context = readFileSync("site/documentation/project-context.md", "utf8");
  expect(context).toContain("](/documentation/)");
  expect(context).toContain('](/documentation/architecture/#contract)');
  expect(readFileSync(PAGE, 'utf8')).toContain('{#contract}');
});
