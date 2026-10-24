import { afterAll, expect, test } from "bun:test";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const roots: string[] = [];
const workflow = Bun.YAML.parse(readFileSync(resolve(import.meta.dir, "../.github/workflows/openwiki-freshness.yml"), "utf8")) as {
  jobs: { freshness: { steps: { run?: string; if?: string }[] } };
};
afterAll(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }); });

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
  const root = mkdtempSync(join(tmpdir(), "wiki PR "));
  roots.push(root);
  git(root, "init", "-q");
  git(root, "config", "user.name", "Wiki Test");
  git(root, "config", "user.email", "wiki@example.invalid");
  write(root, "site/a.md", "canonical source\n");
  write(root, "AGENTS.md", "source instructions\n");
  write(root, "package.json", JSON.stringify({ scripts: { "wiki:check": "bun scripts/openwiki-check.ts" } }));
  mkdirSync(join(root, "scripts"));
  for (const file of ["openwiki-check.ts", "openwiki-check-pr.ts"]) {
    if (existsSync(join(import.meta.dir, file))) copyFileSync(join(import.meta.dir, file), join(root, "scripts", file));
  }
  const source = commit(root);
  write(root, "openwiki/quickstart.md", "# Wiki\n");
  write(root, "openwiki/.last-update.json", JSON.stringify({ status: "complete", gitHead: source }));
  const base = commit(root);
  write(root, "openwiki/.last-update.json", JSON.stringify({ status: "complete", gitHead: base }));
  return { root, base };
}
function runWorkflow(root: string, base: string, head: string) {
  let output = "";
  for (const step of workflow.jobs.freshness.steps) {
    if (!step.run || step.if === "always()") continue;
    const result = Bun.spawnSync(["bash", "-e", "-o", "pipefail", "-c", step.run], {
      cwd: root,
      env: { ...process.env, TARGET_SHA: base, PR_HEAD_SHA: head, RUNNER_TEMP: root },
    });
    output += result.stdout.toString() + result.stderr.toString();
    if (result.exitCode !== 0) return { exitCode: result.exitCode, output };
  }
  return { exitCode: 0, output };
}

test("freshness workflow accepts a wiki-only PR against its base", () => {
  const { root, base } = fixture();
  const result = runWorkflow(root, base, commit(root));
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain("Wiki: fresh");
});

for (const path of ["site/a.md", "AGENTS.md", "site/space and\nnewline.md"]) {
  test(`freshness workflow rejects mixed wiki and source PR: ${JSON.stringify(path)}`, () => {
    const { root, base } = fixture();
    write(root, path, "source changed after generation\n");
    const result = runWorkflow(root, base, commit(root));
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain(JSON.stringify(path));
  });
}

test("freshness workflow rejects a source-to-wiki move even when Git detects a rename", () => {
  const { root, base } = fixture();
  git(root, "mv", "site/a.md", "openwiki/moved.md");
  const head = commit(root);
  expect(git(root, "diff", "--name-status", "-M", `${base}...${head}`)).toContain("R100");
  const result = runWorkflow(root, base, head);
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('"site/a.md"');
});

test("freshness workflow still rejects a wiki-only PR with an outdated checkpoint", () => {
  const { root, base } = fixture();
  write(root, "site/a.md", "new main source\n");
  const newerBase = commit(root);
  write(root, "openwiki/quickstart.md", "# Outdated wiki edit\n");
  const result = runWorkflow(root, newerBase, commit(root));
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain("Wiki: stale");
  expect(result.output).toContain('"site/a.md"');
  expect(result.output).toContain(base);
});
