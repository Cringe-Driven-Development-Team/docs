import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mermaidFiles, mmdcArgs } from "./check-mermaid.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

test("mermaidFiles: Markdown files with a mermaid block, nested folders included, sorted", () => {
  const root = mkdtempSync(join(tmpdir(), "check-mermaid-"));
  dirs.push(root);
  mkdirSync(join(root, "security", "csrf"), { recursive: true });
  writeFileSync(join(root, "index.md"), "# Главная\n");
  writeFileSync(join(root, "security", "csrf", "scenarios.md"), "## A\n\n```mermaid\nsequenceDiagram\n```\n");
  writeFileSync(join(root, "security", "csrf", "index.md"), "```mermaid\nflowchart LR\n```\n");
  writeFileSync(join(root, "notes.txt"), "```mermaid\n```\n");
  expect(mermaidFiles(root)).toEqual([join(root, "security/csrf/index.md"), join(root, "security/csrf/scenarios.md")]);
});

test("mmdcArgs: input, output by flattened path, puppeteer config, quiet", () => {
  expect(mmdcArgs("site/security/csrf/index.md", "tmp-mermaid", "tmp-mermaid/puppeteer.json")).toEqual([
    "-i", "site/security/csrf/index.md", "-o", "tmp-mermaid/site_security_csrf_index.md",
    "-p", "tmp-mermaid/puppeteer.json", "-q",
  ]);
});
