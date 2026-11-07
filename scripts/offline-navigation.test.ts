import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import config from "../site/.vitepress/config.mts";

const read = (file: string) => readFileSync(file, "utf8");
const overview = "/documentation/offline/";
const build = "/documentation/offline/build-and-registration";
const infrastructure = "/documentation/offline/infrastructure";

test("offline navigation: один родитель и две дочерние страницы", () => {
  const sidebar = (config.themeConfig!.sidebar as Record<string, unknown>)["/documentation/"] as { items: { text: string; link: string; collapsed?: boolean; items?: {text: string; link: string}[] }[] }[];
  const parents = sidebar[0]!.items.filter(item => item.link === overview);
  expect(parents).toHaveLength(1);
  expect(parents[0]).toEqual({ text: "Офлайн-режим", link: overview, collapsed: true,
    items: [{ text: "Сборка и регистрация SW", link: build }, { text: "Инфраструктура PWA", link: infrastructure }] });
});

test("offline navigation: вход и взаимные ссылки имеют страницы назначения", () => {
  expect(read("site/documentation/current-state.md")).toContain(`](${overview})`);
  expect(read("site/documentation/offline/index.md")).toContain(`](${build})`);
  expect(read("site/documentation/offline/build-and-registration.md")).toContain(`](${overview})`);
  for (const file of ["site/documentation/current-state.md", "site/documentation/offline/index.md", "site/documentation/offline/build-and-registration.md"]) expect(read(file)).toContain(`](${infrastructure})`);
  for (const file of ["site/documentation/offline/index.md", "site/documentation/offline/build-and-registration.md", "site/documentation/offline/infrastructure.md"]) expect(existsSync(file)).toBe(true);
  const infra = read("site/documentation/offline/infrastructure.md");
  expect(infra).toContain(`](${overview})`);
  expect(infra).toContain(`](${build})`);
});

test("offline navigation: шесть учебных страниц начинают текст с плашки Сделано", () => {
  for (const file of ["site/modules/2/tracks/offline.md", ...["theory", "caching-strategies", "architecture", "deployment", "checks"].map(name => `site/modules/2/tracks/offline/${name}.md`)]) {
    const text = read(file).replace(/^---\n[\s\S]*?\n---\n/, "").replace(/^\s*# [^\n]+\n/, "").trimStart();
    expect(text.startsWith("::: info Сделано\n")).toBe(true);
    const banner = text.split("\n:::")[0];
    expect(banner).toContain(`](${overview})`);
    expect(banner).toContain(`](${build})`);
  }
});
