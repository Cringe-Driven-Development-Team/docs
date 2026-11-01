import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadModuleDir } from "@tp-prepare/vitepress-module-graph/node";

const TRACK = "site/modules/2/tracks/offline.md";
const THEORY = "site/modules/2/tracks/offline/theory.md";
const ARCHITECTURE = "site/modules/2/tracks/offline/architecture.md";
const STRATEGIES = "site/modules/2/tracks/offline/caching-strategies.md";
const DEPLOYMENT = "site/modules/2/tracks/offline/deployment.md";
const CHECKS = "site/modules/2/tracks/offline/checks.md";
const PAGES = [THEORY, STRATEGIES, ARCHITECTURE, DEPLOYMENT, CHECKS];
const read = (file: string) => readFileSync(file, "utf8");
const section = (md: string, title: string) => md.replace(/ \{#[^}]+\}/g, "").split(`\n## ${title}\n`)[1]?.split(/\n## /)[0] ?? "";
const diagrams = (md: string) => [...md.matchAll(/^```mermaid\n([\s\S]*?)^```/gm)];

test("offline: подстраницы зарегистрированы в порядке чтения", () => {
  const track = loadModuleDir("site/modules").modules
    .find((module) => module.id === "2")?.tracks.find((track) => track.id === "offline");
  expect(track?.pages.map((page) => page.title)).toEqual([
    "Теория офлайн-режима", "Стратегии кеширования", "Архитектура офлайн-режима Cellestial",
    "Размещение и обновление", "Проверка офлайн-режима",
  ]);
});

test("offline: теория и архитектура идут от основ к самостоятельной проверке", () => {
  for (const [file, headings] of [
    [THEORY, ["Service Worker", "Жизненный цикл", "Где хранится кеш", "Когда наполняется кеш", "Стратегии кеширования", "Workbox", "vite-plugin-pwa", "Что проверить в понимании"]],
    [STRATEGIES, ["Перед выбором стратегии", "CacheOnly", "NetworkOnly", "CacheFirst", "NetworkFirst", "StaleWhileRevalidate", "Сравнение стратегий"]],
    [DEPLOYMENT, ["Адрес и scope", "Кто за что отвечает", "Обновление комплекта"]],
    [CHECKS, ["Вопросы для реализации", "Сценарии проверки"]],
    [ARCHITECTURE, ["Основа: SPA и BFF", "Подготовка офлайн-режима", "Открытие с сетью", "Открытие без сети", "Потеря сети в открытом приложении", "Что кешируем", "Размещение и обновление", "Границы режима", "Вопросы для реализации", "Сценарии проверки"]],
  ] as const) {
    expect(read(file).match(/^## .+$/gm)?.map((line) => line.slice(3).replace(/ \{#[^}]+\}/g, ""))).toEqual([...headings]);
  }
});

test("offline: 5 схем основ, 5 стратегий и 4 схемы архитектуры", () => {
  const theory = read(THEORY);
  const architecture = read(ARCHITECTURE);
  const strategies = read(STRATEGIES);
  expect(diagrams(theory)).toHaveLength(5);
  expect(diagrams(strategies)).toHaveLength(5);
  expect(PAGES.flatMap((file) => diagrams(read(file)))).toHaveLength(14);
  expect(diagrams(architecture)).toHaveLength(4);
  for (const strategy of ["CacheOnly", "NetworkOnly", "CacheFirst", "NetworkFirst", "StaleWhileRevalidate"]) {
    const part = section(strategies, strategy);
    expect(diagrams(part), strategy).toHaveLength(1);
  }
  for (const mode of ["generateSW", "injectManifest"]) expect(section(theory, "vite-plugin-pwa")).toContain(mode);
  for (const heading of ["Подготовка офлайн-режима", "Открытие с сетью", "Открытие без сети", "Потеря сети в открытом приложении"]) {
    expect(diagrams(section(architecture, heading)), heading).toHaveLength(1);
  }
});

test("offline: подготовка связывает страницу, браузер, BFF и Cache Storage", () => {
  const preparation = section(read(ARCHITECTURE), "Подготовка офлайн-режима");
  for (const needle of ["https://cellestial.ru/sw.js", "https://cellestial.ru/offline.html", "Cache Storage"]) expect(preparation, needle).toContain(needle);
  for (const pattern of [/страниц[аы] SPA[\s\S]*инициирует регистраци/i, /CDN[\s\S]*контексте страницы/, /BFF не регистрирует/, /во время установки/i, /заранее/, /публичн[\s\S]*BFF/i, /регистрация[\s\S]*не гарантирует/i, /активаци/i, /управлени/]) expect(preparation).toMatch(pattern);
  const diagram = diagrams(preparation)[0]?.[1] ?? "";
  for (const pattern of [/страница SPA/i, /Браузер \/ SW/, /Публичные файлы BFF/, /Cache Storage/, /регистраци/i, /sw\.js/, /offline\.html/, /установк/i, /сохран/i]) expect(diagram).toMatch(pattern);
});

test("offline: политика Cache Storage задаёт Да/Нет для каждого ресурса", () => {
  const resources = section(read(ARCHITECTURE), "Что кешируем");
  const table = resources.match(/^\| Ресурс \| Кешируем в Cache Storage \|[^\n]*\n\|[^\n]*\n((?:\|[^\n]*\n)+)/m);
  expect(table).not.toBeNull();
  const rows = (table?.[1] ?? "").trim().split("\n").map((row) => row.split("|").slice(1, -1).map((cell) => cell.trim()));
  expect(rows.map((row) => row.slice(0, 2))).toEqual([
    ["Навигационный HTML BFF", "Нет"],
    ["RPC / API", "Нет"],
    ["Офлайн-страница", "Да"],
    ["Обязательные ресурсы офлайн-страницы", "Да"],
    ["Остальные JS/CSS SPA и ассеты CDN", "Нет"],
  ]);
  expect(rows[2]?.[2]).toContain("BFF");
  expect(rows[3]?.[2]).toContain("BFF");
  expect(rows[4]?.[2]).toContain("CDN");
});

test("offline: пакеты Workbox и сборочная зависимость плагина объяснены явно", () => {
  const workbox = section(read(THEORY), "Workbox");
  expect(workbox).toContain("| Пакет | Где работает | За что отвечает |");
  for (const [pkg, environment] of [
    ["build", "При сборке"], ["routing", "В Service Worker"], ["strategies", "В Service Worker"],
    ["precaching", "В Service Worker"], ["window", "На странице"],
  ]) expect(workbox).toMatch(new RegExp(`\\| \`workbox-${pkg}\` \\| ${environment} \\| [^|]+\\|`));
  const pluginProse = section(read(THEORY), "vite-plugin-pwa").split("```mermaid")[0] ?? "";
  for (const name of ["workbox-build", "generateSW", "injectManifest"]) expect(pluginProse).toContain(`\`${name}\``);
});

test("offline: сетевой ответ возвращается независимо от разрешения кешировать", () => {
  const strategies = read(STRATEGIES);
  const shared = section(strategies, "Перед выбором стратегии");
  for (const pattern of [/разные факты/, /независимо от статуса/, /отдельной политики/, /503/, /не означает сетевой отказ/]) expect(shared).toMatch(pattern);
  for (const strategy of ["CacheFirst", "NetworkFirst"]) {
    const part = section(strategies, strategy);
    const diagram = diagrams(part)[0]?.[1] ?? "";
    expect(diagram, strategy).toContain('N{"Получен ответ сети?"}');
    expect(diagram, strategy).toContain('N -->|"да"| Rnet["Вернуть сетевой ответ"]');
    expect(diagram, strategy).toContain('Rnet -.->|"если разрешено"| Save["Сохранить в кеш"]');
  }
  const swr = section(strategies, "StaleWhileRevalidate");
  const diagram = diagrams(swr)[0]?.[1] ?? "";
  expect(diagram.match(/opt Разрешено кеширование/g)).toHaveLength(2);
  const miss = diagram.split("else Промах")[1] ?? "";
  expect(miss).toContain("alt Получен ответ");
  expect(miss.indexOf("N-->>Q: Текущий сетевой ответ")).toBeGreaterThan(-1);
  expect(miss.indexOf("N-->>Q: Текущий сетевой ответ")).toBeLessThan(miss.indexOf("opt Разрешено кеширование"));
});

test("offline: навигация и RPC не сохраняют личные данные", () => {
  const resources = section(read(ARCHITECTURE), "Что кешируем");
  for (const needle of ["NetworkOnly", "персональный HTML", "RPC", "не кешируем", "офлайн-страниц", "версионированные"]) expect(resources.toLowerCase(), needle).toContain(needle.toLowerCase());
  const offline = section(read(ARCHITECTURE), "Открытие без сети");
  for (const needle of ["исходный адрес", "bootstrap", "SPA", "CDN", "неперсональн"]) expect(offline, needle).toContain(needle);
});

test("offline: HTTP 503 отличается от сетевого отказа", () => {
  const online = section(read(ARCHITECTURE), "Открытие с сетью");
  for (const needle of ["401", "403", "404", "503", "сетевой отказ", "не заменяется"]) expect(online.toLowerCase(), needle).toContain(needle);
});

test("offline: первый визит и удалённый кеш ограничивают гарантии", () => {
  const limits = section(read(ARCHITECTURE), "Границы режима");
  for (const pattern of [/перв\S* визит/i, /удал[её]н\S* кеш/i, /не гарант/i, /сесси/, /личных данных/]) expect(limits).toMatch(pattern);
});

test("offline: индикатор сети — подсказка, сессия не сбрасывается", () => {
  const loss = section(read(ARCHITECTURE), "Потеря сети в открытом приложении");
  for (const needle of ["navigator.onLine", "подсказк", "результат", "BFF", "не означает выход", "предупреждение"]) expect(loss, needle).toContain(needle);
});

test("offline: переходы между документами и обратно без якорей", () => {
  for (const link of ["./offline/theory", "./offline/caching-strategies", "./offline/architecture", "./offline/deployment", "./offline/checks"]) expect(read(TRACK)).toContain(`](${link})`);
  expect(read(THEORY)).toContain("](./architecture)");
  expect(read(ARCHITECTURE)).toContain("](./theory)");
  for (const file of PAGES) expect(read(file)).toContain("](../offline)");
});

test("offline: учебные страницы не содержат кода приложения и чувствительных значений", () => {
  for (const file of [TRACK, ...PAGES]) {
    const md = read(file);
    expect(md.replace(/^```mermaid[^\n]*\n[\s\S]*?^```[ \t]*$/gm, ""), file).not.toContain("```");
    expect(md, file).not.toMatch(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);
    expect(md, file).not.toMatch(/gh[pousr]_[A-Za-z0-9]+|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|(?:token|secret|password)\s*[:=]\s*["'][^"']+/i);
    expect(md.replace(/^```[\s\S]*?^```/gm, ""), file).not.toContain("{{");
    expect(md, file).not.toMatch(/registerRoute\(|navigator\.serviceWorker\.register\(|VitePWA\(/);
  }
});

// Перенесённые темы должны открываться прямо у владельца; старые закладки сохраняют резюме.
test("offline: перенесённые якоря сохраняют понятные переходы", () => {
  for (const [source, id, target, title, summary] of [
    [THEORY, "стратегии-кеширования", "./caching-strategies#стратегии-кеширования", "# Стратегии кеширования", "источник ответа"],
    ...["CacheOnly", "NetworkOnly", "CacheFirst", "NetworkFirst", "StaleWhileRevalidate"].map((name) =>
      [THEORY, name.toLowerCase(), `./caching-strategies#${name.toLowerCase()}`, `## ${name}`, name]),
    [ARCHITECTURE, "размещение-и-обновление", "./deployment#размещение-и-обновление", "# Размещение и обновление", "комплект"],
    [ARCHITECTURE, "вопросы-для-реализации", "./checks#вопросы-для-реализации", "## Вопросы для реализации", "Обоснуйте"],
    [ARCHITECTURE, "сценарии-проверки", "./checks#сценарии-проверки", "## Сценарии проверки", "после реализации"],
  ]) {
    const md = read(source!);
    const stub = md.split(`{#${id}}`)[1]?.split(/\n##? /)[0] ?? "";
    expect(stub, id).toContain(summary!);
    expect(stub, id).toContain(`](${target})`);
    expect(read(`site/modules/2/tracks/offline/${target!.slice(2).split("#")[0]}.md`)).toContain(title!);
  }
});

test("offline: размещение показывает роли и незавершённый каркас, обновление — ограничения", () => {
  const md = read(DEPLOYMENT);
  const address = section(md, "Адрес и scope");
  for (const needle of ["- **Адрес SW:**", "https://cellestial.ru/sw.js", "- **Scope:**", "- **Размещение:**", "origin", "CDN"]) expect(address).toContain(needle);
  const roles = section(md, "Кто за что отвечает");
  for (const role of ["Сборка", "Публичная статика BFF", "Браузер", "SW", "CDN"]) expect(roles).toContain(`| ${role} |`);
  expect(roles).toMatch(/::: info[\s\S]*список файлов пока пуст[\s\S]*не уже готовые маршруты[\s\S]*:::/);
  for (const needle of ["без сессии", "Go API", "bootstrap", "студент выбирает", "предварительное сохранение"]) expect(roles).toContain(needle);
  const updates = section(md, "Обновление комплекта");
  expect(updates.match(/^- /gm)).toHaveLength(3);
  for (const needle of ["согласованный комплект", "прежний контроллер", "не является универсальным решением"]) expect(updates).toContain(needle);
});

test("offline: вопросы и все десять сценариев остаются проверками после реализации", () => {
  const md = read(CHECKS);
  expect(md).toContain("Проверить после реализации");
  expect(section(md, "Вопросы для реализации").match(/^- /gm)).toHaveLength(10);
  expect(section(md, "Сценарии проверки").match(/^\| [^ -]/gm)).toHaveLength(11);
  for (const needle of ["HTTP 401 / 403 / 404 / HTML 503", "прерванная установка", "HTML не попадает в RPC", "не является отчётом", "собственные проверки"]) expect(md).toContain(needle);
});
