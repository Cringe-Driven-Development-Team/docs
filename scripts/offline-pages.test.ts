import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadModuleDir } from "@tp-prepare/vitepress-module-graph/node";

const TRACK = "site/modules/2/tracks/offline.md";
const THEORY = "site/modules/2/tracks/offline/theory.md";
const ARCHITECTURE = "site/modules/2/tracks/offline/architecture.md";
const read = (file: string) => readFileSync(file, "utf8");
const section = (md: string, title: string) => md.split(`\n## ${title}\n`)[1]?.split(/\n## /)[0] ?? "";
const diagrams = (md: string) => [...md.matchAll(/^```mermaid\n([\s\S]*?)^```/gm)];

test("offline: подстраницы зарегистрированы в порядке чтения", () => {
  const track = loadModuleDir("site/modules").modules
    .find((module) => module.id === "2")?.tracks.find((track) => track.id === "offline");
  expect(track?.pages.map((page) => page.title)).toEqual([
    "Теория офлайн-режима", "Архитектура офлайн-режима Cellestial",
  ]);
});

test("offline: теория и архитектура идут от основ к самостоятельной проверке", () => {
  for (const [file, headings] of [
    [THEORY, ["Service Worker", "Жизненный цикл", "Где хранится кеш", "Когда наполняется кеш", "Стратегии кеширования", "Workbox", "vite-plugin-pwa", "Что проверить в понимании"]],
    [ARCHITECTURE, ["Основа: SPA и BFF", "Открытие с сетью", "Открытие без сети", "Потеря сети в открытом приложении", "Что кешируем", "Размещение и обновление", "Границы режима", "Вопросы для реализации", "Сценарии проверки"]],
  ] as const) {
    expect(read(file).match(/^## .+$/gm)?.map((line) => line.slice(3))).toEqual([...headings]);
  }
});

test("offline: 10 схем теории и 3 схемы архитектуры", () => {
  const theory = read(THEORY);
  const architecture = read(ARCHITECTURE);
  expect(diagrams(theory)).toHaveLength(10);
  expect(diagrams(architecture)).toHaveLength(3);
  for (const strategy of ["CacheOnly", "NetworkOnly", "CacheFirst", "NetworkFirst", "StaleWhileRevalidate"]) {
    const part = theory.split(`\n### ${strategy}\n`)[1]?.split(/\n### |\n## /)[0] ?? "";
    expect(diagrams(part), strategy).toHaveLength(1);
  }
  for (const mode of ["generateSW", "injectManifest"]) expect(section(theory, "vite-plugin-pwa")).toContain(mode);
  for (const heading of ["Открытие с сетью", "Открытие без сети", "Потеря сети в открытом приложении"]) {
    expect(diagrams(section(architecture, heading)), heading).toHaveLength(1);
  }
});

test("offline: сетевой ответ возвращается независимо от разрешения кешировать", () => {
  const strategies = section(read(THEORY), "Стратегии кеширования");
  for (const strategy of ["CacheFirst", "NetworkFirst"]) {
    const part = strategies.split(`\n### ${strategy}\n`)[1]?.split(/\n### /)[0] ?? "";
    const diagram = diagrams(part)[0]?.[1] ?? "";
    expect(diagram, strategy).toContain('N{"Получен ответ сети?"}');
    expect(diagram, strategy).toContain('N -->|"да"| Rnet["Вернуть сетевой ответ"]');
    expect(diagram, strategy).toContain('Rnet -.->|"если разрешено"| Save["Сохранить в кеш"]');
  }
  const swr = strategies.split("\n### StaleWhileRevalidate\n")[1] ?? "";
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
  for (const link of ["./offline/theory", "./offline/architecture"]) expect(read(TRACK)).toContain(`](${link})`);
  expect(read(THEORY)).toContain("](./architecture)");
  expect(read(ARCHITECTURE)).toContain("](./theory)");
  for (const file of [THEORY, ARCHITECTURE]) expect(read(file)).toContain("](../offline)");
});

test("offline: учебные страницы не содержат кода приложения и чувствительных значений", () => {
  for (const file of [TRACK, THEORY, ARCHITECTURE]) {
    const md = read(file);
    expect(md.replace(/^```mermaid[^\n]*\n[\s\S]*?^```[ \t]*$/gm, ""), file).not.toContain("```");
    expect(md, file).not.toMatch(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);
    expect(md, file).not.toMatch(/gh[pousr]_[A-Za-z0-9]+|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|(?:token|secret|password)\s*[:=]\s*["'][^"']+/i);
    expect(md.replace(/^```[\s\S]*?^```/gm, ""), file).not.toContain("{{");
    expect(md, file).not.toMatch(/registerRoute\(|navigator\.serviceWorker\.register\(|VitePWA\(/);
  }
});
