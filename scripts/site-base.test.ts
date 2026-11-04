import { HIDDEN_FOLDERS, LEGACY_FOLDERS, ROOT_NAMES } from '../site/.vitepress/diagram-names.ts';
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { diagramTarget } from "../site/.vitepress/site.ts";

test('якорь тематической схемы ведёт к её HTML, а не к обзору архитектуры', () => {
  expect(diagramTarget('#security/csrf-client', ROOT_NAMES, [...HIDDEN_FOLDERS, ...LEGACY_FOLDERS]))
    .toBe('security/csrf-client.html');
});

test("diagramTarget uses documentation namespace", () => {
  expect(diagramTarget("#ci", ["ci"], ["bff"])).toBe("documentation/architecture/#ci");
  expect(diagramTarget("#bff/ci", ["ci"], ["bff"])).toBe("bff/ci.html");
  expect(diagramTarget("#nope", ["ci"], ["bff"])).toBe("documentation/architecture/");
  expect(diagramTarget("#other/ci", ["ci"], ["bff"])).toBe("documentation/architecture/");
  expect(diagramTarget("", ["ci"], ["bff"])).toBeNull();
  expect(diagramTarget("#", ["ci"], ["bff"])).toBeNull();
  expect(diagramTarget("#%D1%86", ["ci"], ["bff"])).toBe("documentation/architecture/");
  expect(diagramTarget("#%E0%A4%A", ["ci"], ["bff"])).toBe("documentation/architecture/");
});

test("shared site helpers load in a browser without Node process", () => {
  const source = new Bun.Transpiler({ loader: "ts" }).transformSync(
    readFileSync("site/.vitepress/site.ts", "utf8"),
  ).replace(/^export /gm, "");
  expect(runInNewContext(`${source}\nSITE_BASE`)).toBe("/");
  expect(runInNewContext(`${source}\nSITE_BASE`, { process: { env: { SITE_BASE: "/branches/vitepress-2" } } })).toBe("/branches/vitepress-2/");
});


test('diagramTarget keeps deleted k3s anchors reachable through legacy redirects', () => {
  const folders = [...HIDDEN_FOLDERS, ...LEGACY_FOLDERS];
  for (const hash of ['#frozen-k3s/ci', '#frozen-k3s%2Fci']) {
    expect(diagramTarget(hash, ROOT_NAMES, folders)).toBe('frozen-k3s/ci.html');
  }
  expect(diagramTarget('#nope', ROOT_NAMES, folders)).toBe('documentation/architecture/');
});
