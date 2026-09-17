import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { diagramNames, renderIndex } from "./build-index.ts";

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

test("diagramNames: names of *.json relative to the dir without extension, subfolders with /, sorted", async () => {
  const dir = mkdtempSync(join(tmpdir(), "index-"));
  tempDirs.push(dir);
  await Bun.write(join(dir, "cd.json"), "{}");
  await Bun.write(join(dir, "ci.json"), "{}");
  await Bun.write(join(dir, "README.md"), "");
  await Bun.write(join(dir, "frozen-k3s", "ci.json"), "{}");
  expect(diagramNames(dir)).toEqual(["cd", "ci", "frozen-k3s/ci"]);
});

test("renderIndex: one card per diagram with html link, png link and preview", () => {
  const html = renderIndex(["deployment", "ci"]);
  expect(html).toMatch(/^<!doctype html>/i);
  expect(html).toMatch(/<h2>deployment<\/h2>/);
  expect(html).toMatch(/href="deployment\.html"/);
  expect(html).toMatch(/href="deployment\.png"/);
  expect(html).toMatch(/<img src="deployment\.png"/);
  expect(html).toMatch(/<h2>ci<\/h2>/);
  expect(html).not.toMatch(/<link|<script/);
});

test("renderIndex: links branch previews only when previewsHref is given", () => {
  expect(renderIndex(["ci"], { previewsHref: "branches/" })).toMatch(/<a href="branches\/">Превью веток<\/a>/);
  expect(renderIndex(["ci"])).not.toMatch(/Превью веток/);
});

test("renderIndex: root diagrams and each subfolder become tabs, the root tab first and checked", () => {
  const html = renderIndex(["ci", "frozen-k3s/cd", "frozen-k3s/ci"]);
  expect(html).toContain('<input type="radio" name="tab" id="tab-0" class="tab-radio" checked>');
  expect(html).toContain('<input type="radio" name="tab" id="tab-1" class="tab-radio">');
  expect(html).toContain('<label for="tab-0">mvp</label>');
  expect(html).toContain('<label for="tab-1">frozen-k3s</label>');
  expect(html.indexOf('<label for="tab-0">')).toBeLessThan(html.indexOf('<label for="tab-1">'));
  expect(html).toContain("#tab-0:checked ~ #panel-0 { display: block; }");
  expect(html).toContain("#tab-1:checked ~ #panel-1 { display: block; }");
  expect(html).not.toMatch(/<script|<link/);
});

test("renderIndex: each tab panel holds only its own cards, all with h2 titles and folder paths in links", () => {
  const html = renderIndex(["ci", "frozen-k3s/cd", "frozen-k3s/ci"]);
  const rootPanel = html.slice(html.indexOf('id="panel-0"'), html.indexOf('id="panel-1"'));
  const folderPanel = html.slice(html.indexOf('id="panel-1"'), html.indexOf('<nav class="tabs">'));
  expect(rootPanel).toContain("<h2>ci</h2>");
  expect(rootPanel).toContain('href="ci.html"');
  expect(rootPanel).not.toContain("frozen-k3s/");
  expect(folderPanel).toContain("<h2>cd</h2>");
  expect(folderPanel).toContain('href="frozen-k3s/cd.html"');
  expect(folderPanel).toContain('<img src="frozen-k3s/ci.png" alt="frozen-k3s/ci">');
  expect(html).not.toMatch(/<h3>|class="folder"/);
});

test("renderIndex: the tab bar comes after the panels and carries the branch previews link", () => {
  const html = renderIndex(["ci", "frozen-k3s/cd"], { previewsHref: "branches/" });
  const bar = html.slice(html.indexOf('<nav class="tabs">'), html.indexOf("</nav>"));
  expect(html.indexOf('id="panel-1"')).toBeLessThan(html.indexOf('<nav class="tabs">'));
  expect(bar).toContain('<a href="branches/">Превью веток</a>');
  expect(html.match(/Превью веток/g)).toHaveLength(1);
});

test("renderIndex: without subfolders there are no tabs, the page is a plain list of cards", () => {
  const html = renderIndex(["deployment", "ci"], { previewsHref: "branches/" });
  expect(html).not.toMatch(/class="tabs"|type="radio"|class="panel"/);
  expect(html).toMatch(/<p><a href="branches\/">Превью веток<\/a><\/p>/);
});

test("renderIndex: with only subfolders the first folder is the first, checked tab", () => {
  const html = renderIndex(["a/x", "b/y"]);
  expect(html).toContain('<label for="tab-0">a</label>');
  expect(html).toContain('<label for="tab-1">b</label>');
  expect(html).not.toContain(">mvp<");
});
