import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { diagramNames, indexNames } from "./build-index.ts";
import config from "../site/.vitepress/config.mts";

const PAGE = "site/documentation/architecture/index.md";
const ORDER = ["server-access", "deployment", "ci", "cd", "frontend", "contract", "infra", "notebooks-components", "notebooks-infrastructure"];

test("server access identifies roles without publishing addresses", () => {
  const page = readFileSync(PAGE, "utf8");
  const section = page.split("{#server-access}")[1]?.split("\n## ")[0] ?? "";
  for (const value of ["VPS1", "gateway", "cellestial.ru", "VPS2", "backend",
    "VPS3", "auxiliary", "hooks.cellestial.ru", "deploy", "личный", "приватном",
    "https://github.com/Cringe-Driven-Development-Team/agent-plugins-private/blob/main/plugins/cellestial-ops/skills/cellestial-ops/SKILL.md"]) {
    expect(section, value).toContain(value);
  }
  expect(section).toMatch(/VPS2[^\n]+через VPS1/);
  expect(section).not.toMatch(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
  expect(section).not.toContain("ssh -");
});

test("documentation sidebar is a linked collapsed tree", () => {
  const sidebar = config.themeConfig!.sidebar as Record<string, unknown>;
  expect(Object.keys(sidebar)).toEqual(['/documentation/', '/modules/']);
  expect(sidebar['/documentation/']).toEqual([{text: 'Документация', items: [
    {text: 'Обзор продукта', link: '/documentation/'},
    {text: 'Что работает сейчас', link: '/documentation/current-state'},
    {text: 'Frontend', link: '/documentation/frontend/', collapsed: true, items: [
      {text: 'Роутинг', link: '/documentation/frontend/routing'},
      {text: 'Сборка и разработка', link: '/documentation/frontend/build'},
      {text: 'Стили', link: '/documentation/frontend/styles'},
      {text: 'Запуск приложения', link: '/documentation/frontend/startup'},
      {text: 'Компоненты и рендеринг', link: '/documentation/frontend/rendering'},
      {text: 'Управление состоянием', link: '/documentation/frontend/state'},
      {text: 'Запросы и ошибки', link: '/documentation/frontend/requests'},
      {text: 'Сессия и авторизация', link: '/documentation/frontend/session'},
      {text: 'BFF', link: '/documentation/frontend/bff'},
      {text: 'Командные пакеты', link: '/documentation/frontend/packages'},
      {text: 'Проверка изменений', link: '/documentation/frontend/checks'},
    ]},
    {text: 'Офлайн-режим', link: '/documentation/offline/', collapsed: true, items: [
      {text: 'Сборка и регистрация SW', link: '/documentation/offline/build-and-registration'},
      {text: 'Инфраструктура PWA', link: '/documentation/offline/infrastructure'},
    ]},
    {text: 'Блокноты: реализация', link: '/documentation/notebooks/', collapsed: true, items: [
      {text: 'Редактирование и сохранение', link: '/documentation/notebooks/editing'},
      {text: 'Окружение и исполнение', link: '/documentation/notebooks/execution'},
      {text: 'Результаты', link: '/documentation/notebooks/results'},
      {text: 'Хранение и инфраструктура', link: '/documentation/notebooks/storage-and-infrastructure'},
    ]},
    {text: 'Архитектура', link: '/documentation/architecture/'},
    {text: 'Безопасность', link: '/documentation/security/', collapsed: true, items: [
      {text: 'CSRF', link: '/documentation/security/csrf'},
      {text: 'XSS', link: '/documentation/security/xss'},
      {text: 'CSP', link: '/documentation/security/csp'},
    ]},
    {text: 'Владельцы сведений', link: '/documentation/project-context'},
  ]}]);
  expect(config.themeConfig!.nav).toContainEqual({text: 'Документация', link: '/documentation/', activeMatch: '^/documentation/'});
});

test('production evidence distinguishes configuration from scenarios', () => {
  const page = readFileSync(PAGE, 'utf8');
  const intro = page.split('\n## ')[0]!;
  for (const value of ['Архитектура работающего сервиса', '{#архитектура-mvp}', '09.11.2026', '03:37 МСК',
    '319e691b79f81e09dcffabc04941831a5f4b5930', '06841d4765c28ad7e52bf5e36df3b72cb22c094e',
    '42538007203', '42536140424', '42532217133', 'Прямой SSH', 'HTTP-проверки']) {
    expect(intro, value).toContain(value);
  }
  expect(intro).toMatch(/runtime[\s\S]*не проверен/);
  expect(intro).toMatch(/Авторизованн[\s\S]*не проверен/);
  expect(page).not.toMatch(/01\.11\.2026|baf512e9|6e1a0d81|Историческ|исторический срез/);
  expect(page).not.toMatch(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
  expect(page).not.toContain('{{');
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
  const documentation = readFileSync("site/documentation/current-state.md", "utf8");
  for (const link of ["/documentation/frontend/bff#bff-проверенная-часть", "/documentation/architecture/", "/documentation/security/", "/documentation/project-context", "/modules/"]) {
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

test("current behavior points to documentation", () => {
  const modules = readFileSync("site/modules/index.md", "utf8");
  expect(modules).toContain("](/documentation/current-state)");
  expect(modules).not.toContain("](/documentation/csrf/)");
  const context = readFileSync("site/documentation/project-context.md", "utf8");
  expect(context).toContain("](/documentation/current-state)");
  expect(context).toContain('](/documentation/architecture/#contract)');
  expect(readFileSync(PAGE, 'utf8')).toContain('{#contract}');
});
