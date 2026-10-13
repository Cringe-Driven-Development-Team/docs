import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { SITE_BASE } from "../site/.vitepress/site.ts";
import { branchSiteBase } from "./build-site.ts";
import { checkSite, htmlPages } from "./check-site.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function site(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "check-site-"));
  dirs.push(dir);
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), body);
  }
  return dir;
}

test("htmlPages: skips 404.html, branches/ and the given diagram pages", () => {
  const dist = site({
    "index.html": "",
    "404.html": "",
    "contract.html": "",
    "frozen-k3s/ci.html": "",
    "branches/x/index.html": "",
    "diagrams/index.html": "",
    "security/csrf/index.html": "",
  });
  expect(htmlPages(dist, ["contract", "frozen-k3s/ci"])).toEqual(["diagrams/index.html", "index.html", "security/csrf/index.html"]);
});

test("checkSite: broken link, missing anchor and missing image are reported, diagrams/ resolves to its index", () => {
  const dist = site({
    "index.html":
      '<a href="/diagrams/">a</a><a href="/security/csrf/#how">b</a><a href="/nope">c</a>' +
      '<a href="/security/csrf/#missing">d</a><img src="/x.png"><a href="https://example.ru/">e</a>',
    "diagrams/index.html": '<a href="../contract.html">x</a><a href="#contract">y</a><section id="contract"></section>',
    "contract.html": "",
    "security/csrf/index.html": '<h2 id="how">How</h2>',
  });
  expect(checkSite(dist, "/", ["contract"])).toEqual([
    "index.html: битая ссылка /nope",
    "index.html: битая ссылка /security/csrf/#missing",
    "index.html: нет картинки /x.png",
  ]);
});

test("checkSite: iframe src must exist, links into branches/ are skipped", () => {
  const missing = site({ "index.html": '<iframe src="/x.html"></iframe><a href="/branches/">p</a>' });
  expect(checkSite(missing, "/", [])).toEqual(["index.html: битая ссылка /x.html"]);
  const present = site({ "index.html": '<iframe src="/x.html" loading="lazy"></iframe>', "x.html": "" });
  expect(checkSite(present, "/", ["x"])).toEqual([]);
});

test("main: CSS, JS and favicon resolve from the custom domain root", () => {
  const dist = site({
    "index.html":
      `<link rel="preload stylesheet" href="${SITE_BASE}assets/style.css" as="style">` +
      `<script type="module" src="${SITE_BASE}assets/app.js"></script>` +
      `<link rel="icon" href="${SITE_BASE}favicon.svg">` +
      '<a href="/architecture/#contract">Архитектура</a>',
    "assets/style.css": "body { color: black; }",
    "assets/app.js": "",
    "favicon.svg": "<svg></svg>",
    "architecture/index.html": '<h2 id="contract">Контракт</h2>',
  });
  expect(checkSite(dist, "/", [])).toEqual([]);
});

test("preview: CSS, JS and diagrams resolve under /branches/<slug>/", () => {
  const base = branchSiteBase("fix-domain");
  const dist = site({
    "index.html":
      `<link rel="preload stylesheet" href="${base}assets/style.css" as="style">` +
      `<script type="module" src="${base}assets/app.js"></script>` +
      `<iframe src="${base}contract.html"></iframe>`,
    "assets/style.css": "body { color: black; }",
    "assets/app.js": "",
    "contract.html": "",
  });
  expect(checkSite(dist, "/branches/fix-domain/", ["contract"])).toEqual([]);
});
