import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

test("favicon: SVG in site/public, linked from head with the site base", () => {
  expect(existsSync("site/public/favicon.svg")).toBe(true);
  expect(readFileSync("site/public/favicon.svg", "utf8")).toStartWith("<svg");
  const config = readFileSync("site/.vitepress/config.mts", "utf8");
  // VitePress не добавляет base к ссылкам в head: без SITE_BASE иконка потеряется в превью веток
  expect(config).toContain("['link', { rel: 'icon', type: 'image/svg+xml', href: `${SITE_BASE}favicon.svg` }]");
});
