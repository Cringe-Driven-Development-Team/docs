import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { prepareOpenWikiRuntime } from "./openwiki-runtime.ts";

const roots: string[] = [];
afterAll(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }); });
function directory() {
  const root = mkdtempSync(join(tmpdir(), "openwiki runtime "));
  roots.push(root);
  return root;
}

for (const metadata of [{ name: "other", version: "0.7.2" }, { name: "openwiki", version: "0.7.3" }]) {
  test(`refuses unreviewed runtime ${JSON.stringify(metadata)}`, async () => {
    const root = directory();
    writeFileSync(join(root, "package.json"), JSON.stringify(metadata));
    await expect(prepareOpenWikiRuntime(directory(), root, root)).rejects.toThrow(/pinned/);
  });
}
for (const anchor of ["// missing setup", readFileSync(join(dirname(require.resolve("openwiki/package.json")), "dist/generation/repository-run.js"), "utf8").repeat(2)]) {
  test(`refuses ${anchor.startsWith("//") ? "missing" : "ambiguous"} setup patch anchor`, async () => {
    const root = directory();
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "openwiki", version: "0.7.2" }));
    mkdirSync(join(root, "dist/generation"), { recursive: true });
    writeFileSync(join(root, "dist/generation/repository-run.js"), anchor);
    await expect(prepareOpenWikiRuntime(directory(), root, root)).rejects.toThrow(/anchor/);
  });
}

test("runtime copy preserves stock setup for init and other roots, without modifying the installed package", async () => {
  const root = directory();
  const other = directory();
  const installed = join(dirname(require.resolve("openwiki/package.json")), "dist/generation/repository-run.js");
  const original = readFileSync(installed, "utf8");
  const entry = await prepareOpenWikiRuntime(directory(), root);
  const { beginRepositoryRun } = await import(pathToFileURL(join(dirname(dirname(entry)), "generation/repository-run.js")).href);
  for (const [repo, mode] of [[other, "update"], [root, "init"]] as const) {
    writeFileSync(join(repo, "AGENTS.md"), "# Original rules\n");
    try { await beginRepositoryRun({ root: repo, mode, language: "ru", actor: { producer: "codex", model: "test" } }); } catch {
      // No Git repo: only setup side effects matter for these out-of-scope calls.
    }
    expect(readFileSync(join(repo, "AGENTS.md"), "utf8")).toContain("<!-- OPENWIKI:START -->");
  }
  expect(readFileSync(installed, "utf8")).toBe(original);
});
