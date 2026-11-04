import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

const FILE = "site/documentation/offline/index.md";
const read = () => existsSync(FILE) ? readFileSync(FILE, "utf8") : "";
const section = (title: string) => read().split(`\n## ${title}\n`)[1]?.split(/\n## /)[0] ?? "";

test("offline runtime: страница ведёт от хранения к реализации и границам проверки", () => {
  expect(read()).toMatch(/^---\ntitle: Офлайн-режим\n---/);
  expect(read()).toContain("# Офлайн-режим\n");
  expect(read().match(/^## .+$/gm)?.map(line => line.slice(3))).toEqual([
    "Где хранится Service Worker", "Три механизма хранения", "Disable cache и обновление SW",
    "Как работает Cellestial", "Проверка на проде", "Границы проверки",
  ]);
});

test("offline runtime: три хранилища не смешаны с работающим контекстом SW", () => {
  const storage = section("Три механизма хранения");
  for (const name of ["HTTP-кеш", "Установленный Service Worker", "Cache Storage", "Request", "Response"]) expect(storage).toContain(name);
  const lifetime = section("Где хранится Service Worker");
  expect(lifetime).toContain("регистрация");
  expect(lifetime).toContain("контекст");
  expect(lifetime).toContain("событи");
  const devtools = section("Disable cache и обновление SW");
  expect(devtools).toContain("Disable cache");
  expect(devtools).toContain("не удаляет");
  expect(devtools).toContain("Update on reload");
  expect(devtools).toContain("Application");
});

test("offline runtime: явно задана граница персональных ответов и офлайн-комплекта", () => {
  const policy = section("Как работает Cellestial");
  for (const pattern of [
    /\| Персональный HTML BFF \| Нет \|/,
    /\| RPC \/ API \| Нет \|/,
    /\| `offline\.html` \| Да \|/,
    /\| `offline\.css` \| Да \|/,
    /\| `manifest\.webmanifest` \| Да \|/,
    /\| JS\/CSS и остальные ассеты SPA \| Нет \|/,
  ]) expect(policy).toMatch(pattern);
  expect(policy).toContain("NetworkOnly");
  expect(policy).toContain("503");
  expect(policy).toContain("сетевой отказ");
});

test("offline runtime: свидетельство отделено от непроверенных сценариев", () => {
  const evidence = section("Проверка на проде");
  expect(evidence).toMatch(/\b[0-9a-f]{40}\b/);
  expect(evidence).toMatch(/\d{2}\.\d{2}\.2026/);
  expect(evidence).toContain("UTC+3");
  expect(evidence).toContain("Chrome");
  expect(section("Границы проверки")).toContain("Safari");
  expect(section("Границы проверки")).toContain("Go");
});

test("offline runtime: три схемы и публичные источники без готового SW", () => {
  const md = read();
  expect([...md.matchAll(/^```mermaid\n/gm)]).toHaveLength(3);
  expect(md).toMatch(/https:\/\/github\.com\/Cringe-Driven-Development-Team\/frontend\/blob\/[0-9a-f]{40}\//);
  expect(md).not.toMatch(/\b\d{1,3}(?:\.\d{1,3}){3}\b|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY/);
  expect(md).not.toContain("navigator.serviceWorker.register(");
});
