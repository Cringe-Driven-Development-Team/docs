import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

const FILE = "site/documentation/offline/build-and-registration.md";
const read = () => existsSync(FILE) ? readFileSync(FILE, "utf8") : "";
const blocks = () => [...read().matchAll(/^```mermaid\n([\s\S]*?)^```/gm)].map(match => match[1]!);

test("offline build: от пакетов к конфигурации и выполнению", () => {
  expect(read()).toMatch(/^---\ntitle: Сборка и регистрация SW\n---/);
  expect(read().match(/^## .+$/gm)?.map(line => line.slice(3))).toEqual([
    "Семейство Workbox", "Прямые и транзитивные зависимости", "Что делает vite-plugin-pwa",
    "Виртуальный модуль регистрации", "Как связаны сборка и регистрация",
    "Где настроен SW в Cellestial", "Что выполняется в браузере",
  ]);
});

test("offline build: назначение пакетов отделено от способа их установки", () => {
  const md = read();
  for (const name of ["build", "window", "core", "routing", "strategies", "precaching"]) expect(md).toContain(`| \`workbox-${name}\` |`);
  for (const name of ["При сборке", "На странице", "В SW", "dependencies", "devDependencies", "bun.lock"]) expect(md).toContain(name);
  const graph = blocks()[0] ?? "";
  for (const name of ["Клиент", "vite-plugin-pwa", "workbox-build", "workbox-window", "workbox-core", "Другие пакеты"]) expect(graph).toContain(name);
  expect(md).toContain("не означает");
  expect(md).toContain("бандл");
});

test("offline build: виртуальный модуль связан с генерируемым файлом, а не с сетевым импортом", () => {
  const md = read();
  expect(md).toContain("import { registerSW } from 'virtual:pwa-register'");
  for (const path of ["vite.config.prod.ts", "vite/shared.ts", "vite/plugins.ts", "src/serviceWorker.ts"]) expect(md).toContain(path);
  for (const term of ["inlineWorkboxRuntime", "injectRegister", "onNeedReload", "onRegisterError"]) expect(md).toContain(term);
  expect(blocks()).toHaveLength(3);
  const build = blocks()[1] ?? "";
  for (const term of ["workbox-build", "dist/sw.js", "virtual:pwa-register", "SPA"]) expect(build).toContain(term);
  const runtime = blocks()[2] ?? "";
  for (const term of ["sequenceDiagram", "workbox-window", "Браузер", "BFF", "Cache Storage", "/sw.js", "/offline.html"]) expect(runtime).toContain(term);
});

test("offline build: есть источники и переход к обзору, нет полного решения", () => {
  const md = read();
  expect(md).toContain("](/documentation/offline/)");
  expect(md).toMatch(/\/frontend\/blob\/[0-9a-f]{40}\/apps\/client\//);
  expect(md).not.toMatch(/VitePWA\(\s*\{|self\.addEventListener\(/);
  expect(md).not.toMatch(/\b\d{1,3}(?:\.\d{1,3}){3}\b|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY/);
});
