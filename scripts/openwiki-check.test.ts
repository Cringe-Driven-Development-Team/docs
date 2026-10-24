import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { checkOpenWiki } from "./openwiki-check.ts";

const roots: string[] = [];
const script = resolve(import.meta.dir, "openwiki-check.ts");

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function git(root: string, ...args: string[]): string {
  const result = Bun.spawnSync(["git", ...args], { cwd: root });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  return result.stdout.toString().trim();
}

function write(root: string, path: string, contents: string) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), contents);
}

function commit(root: string): string {
  git(root, "add", "--all");
  git(root, "commit", "-qm", "fixture");
  return git(root, "rev-parse", "HEAD");
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "docs openwiki "));
  roots.push(root);
  git(root, "init", "-q");
  git(root, "config", "user.name", "Wiki Test");
  git(root, "config", "user.email", "wiki@example.invalid");
  write(root, "site/a.md", "source\n");
  write(root, "AGENTS.md", "instructions\n");
  write(root, ".github/workflows/openwiki-check.yml", "workflow\n");
  const sourceSha = commit(root);
  checkpoint(root, { gitHead: sourceSha, status: "complete", updatedAt: "2026-10-24T00:00:00.000Z" });
  write(root, "openwiki/quickstart.md", "# Wiki\n");
  const targetSha = commit(root);
  return { root, sourceSha, targetSha };
}

function checkpoint(root: string, value: unknown) {
  write(root, "openwiki/.last-update.json", JSON.stringify(value));
}

function cli(root: string, ...args: string[]) {
  return Bun.spawnSync([process.execPath, script, ...args], { cwd: root });
}

test("complete ancestor checkpoint stays fresh after a wiki-only commit", async () => {
  const { root, sourceSha, targetSha } = fixture();
  expect(await checkOpenWiki(root, targetSha)).toEqual({ sourceSha, targetSha, changedPaths: [], fresh: true });
});

test("checkpoint at the target commit is fresh regardless of its age", async () => {
  const { root, sourceSha } = fixture();
  checkpoint(root, { gitHead: sourceSha, status: "complete", updatedAt: "2000-01-01T00:00:00Z" });
  expect((await checkOpenWiki(root, sourceSha)).fresh).toBe(true);
});

for (const path of ["site/a.md", "AGENTS.md", "CLAUDE.md", ".github/workflows/openwiki-check.yml", ".agents/skills/example/SKILL.md", ".claude/skills/example/SKILL.md", "dist/tracked.txt", "node_modules/tracked.txt"]) {
  test(`tracked source change in ${path} makes the wiki stale`, async () => {
    const { root, sourceSha } = fixture();
    write(root, path, "changed\n");
    const targetSha = commit(root);
    expect(await checkOpenWiki(root, targetSha)).toEqual({ sourceSha, targetSha, changedPaths: [path], fresh: false });
  });
}

test("NUL-delimited paths preserve spaces, newlines, deleted sources and source-to-wiki moves", async () => {
  const { root } = fixture();
  write(root, "site/space and\nnewline.md", "new\n");
  git(root, "mv", "site/a.md", "openwiki/moved.md");
  const targetSha = commit(root);
  expect((await checkOpenWiki(root, targetSha)).changedPaths).toEqual(["site/a.md", "site/space and\nnewline.md"]);
});

test("the explicit target is used even when the checkout has newer source changes", async () => {
  const { root, targetSha } = fixture();
  write(root, "site/a.md", "new source\n");
  commit(root);
  expect((await checkOpenWiki(root, targetSha)).fresh).toBe(true);
});

for (const value of [null, [], {}, { status: "complete" }, { status: "complete", gitHead: "HEAD" }, { status: "complete", gitHead: "f".repeat(40) }, { status: "interrupted", gitHead: "f".repeat(40) }]) {
  test(`rejects unusable checkpoint ${JSON.stringify(value)}`, async () => {
    const { root, targetSha } = fixture();
    checkpoint(root, value);
    await expect(checkOpenWiki(root, targetSha)).rejects.toThrow();
  });
}

test("rejects interrupted generation even at a valid source SHA", async () => {
  const { root, sourceSha, targetSha } = fixture();
  checkpoint(root, { status: "interrupted", gitHead: sourceSha });
  await expect(checkOpenWiki(root, targetSha)).rejects.toThrow(/status/);
});

test("rejects a checkpoint outside the target ancestry", async () => {
  const { root, sourceSha, targetSha } = fixture();
  git(root, "checkout", "-q", "--detach", sourceSha);
  write(root, "other.md", "different history\n");
  const otherSha = commit(root);
  git(root, "checkout", "-q", "--detach", targetSha);
  checkpoint(root, { status: "complete", gitHead: otherSha });
  await expect(checkOpenWiki(root, targetSha)).rejects.toThrow(/ancestor/);
});

test("rejects a SHA pointing to a blob instead of a commit", async () => {
  const { root, targetSha } = fixture();
  checkpoint(root, { status: "complete", gitHead: git(root, "rev-parse", "HEAD:site/a.md") });
  await expect(checkOpenWiki(root, targetSha)).rejects.toThrow();
});

for (const path of ["openwiki", "openwiki/.last-update.json", "openwiki/quickstart.md"]) {
  test(`rejects missing ${path}`, async () => {
    const { root, targetSha } = fixture();
    rmSync(join(root, path), { recursive: true });
    await expect(checkOpenWiki(root, targetSha)).rejects.toThrow();
  });
}

test("rejects malformed JSON", async () => {
  const { root, targetSha } = fixture();
  write(root, "openwiki/.last-update.json", "{");
  await expect(checkOpenWiki(root, targetSha)).rejects.toThrow();
});

for (const target of ["", "HEAD", "--help", "f".repeat(40)]) {
  test(`rejects invalid or nonexistent target ${JSON.stringify(target)}`, async () => {
    const { root } = fixture();
    await expect(checkOpenWiki(root, target)).rejects.toThrow();
  });
}

test("CLI prints source, explicit target and observation timestamp, exits 0 only when fresh", () => {
  const { root, sourceSha, targetSha } = fixture();
  const fresh = cli(root, "--against", targetSha);
  expect(fresh.exitCode).toBe(0);
  expect(fresh.stdout.toString()).toContain(sourceSha);
  expect(fresh.stdout.toString()).toContain(targetSha);
  expect(fresh.stdout.toString()).toContain("2026-10-24T00:00:00.000Z");
  write(root, "site/a.md", "changed\n");
  const newerSha = commit(root);
  const stale = cli(root, "--against", newerSha);
  expect(stale.exitCode).toBe(1);
  expect(stale.stdout.toString()).toContain("site/a.md");
  expect(stale.stdout.toString()).toContain(newerSha);
});

test("CLI reports checkpoint failures and rejects a missing or extra argument", () => {
  const { root, targetSha } = fixture();
  rmSync(join(root, "openwiki"), { recursive: true });
  const missing = cli(root, "--against", targetSha);
  expect(missing.exitCode).toBe(1);
  expect(missing.stderr.toString()).toContain("openwiki");
  for (const args of [[], ["--against"], ["--against", targetSha, "extra"]]) {
    const result = cli(root, ...args);
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("--against");
  }
});
