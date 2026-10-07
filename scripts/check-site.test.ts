import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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
    "bff/ci.html": "",
    "branches/x/index.html": "",
    "diagrams/index.html": "",
    "security/csrf/index.html": "",
  });
  expect(htmlPages(dist, ["contract", "bff/ci"])).toEqual(["diagrams/index.html", "index.html", "security/csrf/index.html"]);
});

test("checkSite: broken link, missing anchor and missing image are reported, diagrams/ resolves to its index", () => {
  const dist = site({
    "index.html":
      '<a href="/docs/diagrams/">a</a><a href="/docs/security/csrf/#how">b</a><a href="/docs/nope">c</a>' +
      '<a href="/docs/security/csrf/#missing">d</a><img src="/docs/x.png"><a href="https://example.ru/">e</a>',
    "diagrams/index.html": '<a href="../contract.html">x</a><a href="#contract">y</a><section id="contract"></section>',
    "contract.html": "",
    "security/csrf/index.html": '<h2 id="how">How</h2>',
  });
  expect(checkSite(dist, "/docs/", ["contract"])).toEqual([
    "index.html: битая ссылка /docs/nope",
    "index.html: битая ссылка /docs/security/csrf/#missing",
    "index.html: нет картинки /docs/x.png",
  ]);
});
