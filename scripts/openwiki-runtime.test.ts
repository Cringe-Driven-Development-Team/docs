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

test("preflight marks an excluded source unresolved without allowing it as evidence", async () => {
  const root = directory();
  const entry = await prepareOpenWikiRuntime(directory(), root);
  const dist = pathToFileURL(`${dirname(dirname(entry))}/`);
  const { OpenWikiIgnore } = await import(new URL("agent/openwiki-ignore.js", dist).href);
  const { RepositoryEvidenceResolver } = await import(new URL("claims/evidence/repository/resolver.js", dist).href);
  const { runClaimsPreflight } = await import(new URL("claims/brains/code/preflight.js", dist).href);
  writeFileSync(join(root, ".openwikiignore"), "orval.config.ts\n");
  const resolver = new RepositoryEvidenceResolver({ rootDir: root, openWikiIgnore: await OpenWikiIgnore.load(root) });
  const page = "/openwiki/quickstart.md";
  const resource = "repo://orval.config.ts";
  const claim = { id: "claim-1", evidence: [{ resource, version: "previous" }] };
  const store = {
    discoverPages: async () => [page],
    loadPages: async () => new Map([[page, { claims: [claim] }]]),
    discoverSidecarPages: async () => [page],
  };

  expect((await runClaimsPreflight(store, resolver)).issues).toEqual([
    { page, kind: "unresolved", claimId: claim.id, resources: [resource] },
  ]);
  await expect(resolver.resolve(resource)).rejects.toThrow(/excluded by .openwikiignore/);
});
