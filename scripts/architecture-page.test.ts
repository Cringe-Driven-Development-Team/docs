import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { diagramNames, indexNames } from "./build-index.ts";
import config from "../site/.vitepress/config.mts";

const PAGE = "site/documentation/architecture/index.md";
const ORDER = ["server-access", "deployment", "ci", "cd", "frontend", "contract", "infra", "notebooks-components", "notebooks-infrastructure", "frontend-release-lifecycle", "frontend-release-delivery"];

test("server access identifies roles without publishing addresses", () => {
  const page = readFileSync(PAGE, "utf8");
  const section = page.split("{#server-access}")[1]?.split("\n## ")[0] ?? "";
  for (const value of ["VPS1", "gateway", "cellestial.ru", "VPS2", "backend",
    "VPS3", "auxiliary", "hooks.cellestial.ru", "deploy", "личный", "команда эксплуатации",
    "/ansible/README.md#L209-L211"]) {
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
      {text: 'Архитектура', link: '/documentation/frontend/architecture'},
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
      {text: 'Выкатки', link: '/documentation/frontend/releases/', collapsed: true, items: [
        {text: 'CI и публикация', link: '/documentation/frontend/releases/publication'},
        {text: 'Состав выпуска', link: '/documentation/frontend/releases/artifacts'},
        {text: 'Выкатка', link: '/documentation/frontend/releases/deployment'},
        {text: 'Откат', link: '/documentation/frontend/releases/rollback'},
        {text: 'Ошибки и уведомления', link: '/documentation/frontend/releases/troubleshooting'},
      ]},
      {text: 'Офлайн-режим', link: '/documentation/offline/', collapsed: true, items: [
        {text: 'Сборка и регистрация SW', link: '/documentation/offline/build-and-registration'},
        {text: 'Инфраструктура PWA', link: '/documentation/offline/infrastructure'},
      ]},
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

test('module sidebar collapses module 2 and expands module 3 by default', () => {
  const sidebar = config.themeConfig!.sidebar as Record<string, import('vitepress').DefaultTheme.SidebarItem[]>;
  const groups = sidebar['/modules/']!;
  expect(groups.find(group => group.items?.some(item => item.link === '/modules/2/'))?.collapsed).toBe(true);
  expect(groups.find(group => group.items?.some(item => item.link === '/modules/3/'))?.collapsed).toBe(false);
});

test('production evidence distinguishes configuration from scenarios', () => {
  const page = readFileSync(PAGE, 'utf8');
  const intro = page.split('\n## ')[0]!;
  for (const value of ['Архитектура работающего сервиса', '{#архитектура-mvp}', '28.11.2026', '02:18:48 МСК',
    'b1baf996fb6753d1a62eab6f874d03dca30faadc', '3532ca97dc2c9d0f84aa999eae85918e76907aa7',
    '8118066244', '7970701489', '8116451615', '46079576340', 'b8f6d2d81410f70ec5af642cb486d37b0b0f5412']) {
    expect(intro, value).toContain(value);
  }
  expect(intro).toMatch(/8116451615[^\n]*ошибкой внешней проверки[^\n]*Активная ревизия Go после этой попытки не установлена/);
  expect(intro).toMatch(/Авторизованные сценарии, запуск runtime[^\n]*не проверены/);
  expect(page).not.toMatch(/319e691|06841d4|a59f858|Orval|tRPC/);
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

test("config: documentation and modules keep architecture in documentation, no branch previews in the nav", () => {
  const config = readFileSync("site/.vitepress/config.mts", "utf8");
  expect(config).toContain("link: '/documentation/architecture/'");
  const nav = config.split("nav: [")[1]?.split("],")[0] ?? "";
  expect([...nav.matchAll(/text: '([^']+)'/g)].map(match => match[1])).toEqual([
    "Документация", "Модули",
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
  for (const link of ["/documentation/frontend/bff", "/documentation/architecture/", "/documentation/security/", "/documentation/project-context", "/modules/"]) {
    expect(documentation).toContain(`](${link})`);
  }
  const observed = documentation.split("## Что подтверждено на проде")[1]?.split("## Что реализовано")[0] ?? "";
  for (const value of ['28.11.2026, 02:18:48–02:18:49 МСК', 'UTC+03:00', 'b1baf996fb6753d1a62eab6f874d03dca30faadc',
    'Accept: text/html', 'user: null', 'не устанавливает cookie', 'csrf_invalid', 'UNAUTHORIZED', 'Content-Security-Policy']) expect(observed, value).toContain(value);
  expect(observed).not.toMatch(/запуск ячейки|сохранение блокнота|вход выполнен|POST /);
  expect(documentation).toContain('## Что реализовано в выложенном коде');
  expect(documentation).toContain('PostgreSQL');
  expect(documentation).toContain('Версия активного Go после этой попытки не установлена');
  const offline = documentation.split("## Офлайн-режим")[1]?.split("\n## ")[0] ?? "";
  for (const value of ['01:53:53–01:53:55 МСК', 'Chrome Headless', 'b1baf996', 'ERR_INTERNET_DISCONNECTED', 'Повторить']) expect(offline).toContain(value);

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

test("release diagrams link to published workflow and operating instructions", () => {
  const page = readFileSync(PAGE, "utf8");
  const ci = page.split("{#ci}")[1]?.split("\n## ")[0] ?? "";
  const cd = page.split("{#cd}")[1]?.split("\n## ")[0] ?? "";
  expect(ci).toContain("/.github/workflows/ci.yml#L234-L304");
  expect(cd).toContain("release_tag");
  expect(cd).toContain("/deployments/7970701489)");
  expect(cd).toContain("da8cdc6da73cd12abcc8b562f4aafed3efedd5da/ansible/deploy-backend.yml");
  for (const path of ["deployment", "rollback"]) {
    expect(cd).toContain(`](/documentation/frontend/releases/${path})`);
  }
});

test("contract section identifies the source by revision and links to its owners", () => {
  const contract = readFileSync(PAGE, 'utf8').split('{#contract}')[1]?.split('\n## ')[0] ?? '';
  expect(contract).toContain('BffPaths');
  for (const [sha, file] of [
    ['947a19ccf4319a621007b2900aa8e620ca27762b', 'spec/openapi.json'],
    ['29e5ef56133c6fc42cd2cce3b5ecb379b457c6b8', 'spec/identity/openapi.json'],
    ['29e5ef56133c6fc42cd2cce3b5ecb379b457c6b8', 'spec/workspace/openapi.json'],
  ]) expect(contract).toContain(`/backend/blob/${sha}/${file}#L`);
  expect(contract).toContain('](/documentation/frontend/bff#apidog-orval-и-схемы)');
  const owners = readFileSync('site/documentation/project-context.md', 'utf8');
  expect(owners).toContain('](https://github.com/Cringe-Driven-Development-Team/frontend-packages)');
});

test("product overview links to agreed scenarios and interface designs", () => {
  const overview = readFileSync('site/documentation/index.md', 'utf8');
  for (const link of ['/modules/2/tracks/file-exec', '/modules/2/tracks/file-exec/contract', '/modules/2/tracks/file-search', '/documentation/current-state']) expect(overview).toContain(`](${link})`);
  for (const node of ['398-52000', '398-52073', '398-52150', '398-52417', '398-52526', '496-14596', '398-52575', '398-52618', '398-52636', '398-52651', '496-16027']) expect(overview).toContain(`?node-id=${node}`);
  expect(overview).toContain('временная недоступность и несовместимость фронта и бэка');
  expect(overview).not.toMatch(/Apidog[^\n]*hash|вопрос не объявлен решённым/);
});
