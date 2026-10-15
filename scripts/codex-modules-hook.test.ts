import { afterAll, expect, test } from "bun:test";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

type HookGroup = { matcher: string; hooks: { command: string }[] };
const project = resolve(import.meta.dir, "..");
const config = join(project, ".codex/hooks.json");
const groups: HookGroup[] = existsSync(config)
  ? JSON.parse(readFileSync(config, "utf8")).hooks.PostToolUse
  : [];
const fixtures: string[] = [];

afterAll(() => {
  for (const root of fixtures) rmSync(root, { recursive: true, force: true });
});

function fixture(withPackage = true): string {
  const root = mkdtempSync(join(tmpdir(), "docs codex hook "));
  fixtures.push(root);
  const init = Bun.spawnSync(["git", "init", "-q", root]);
  expect(init.exitCode).toBe(0);
  mkdirSync(join(root, "scripts"));
  const script = join(project, "scripts/codex-modules-hook.ts");
  if (existsSync(script)) copyFileSync(script, join(root, "scripts/codex-modules-hook.ts"));
  if (withPackage) symlinkSync(join(project, "node_modules"), join(root, "node_modules"), "junction");
  mkdirSync(join(root, "site/modules/2/tracks"), { recursive: true });
  writeFileSync(join(root, "site/modules/people.yaml"), "- login: student\n  name: Студент\n  role: фронт\n  area: front\n");
  writeFileSync(join(root, "site/modules/2/index.md"), "---\ntitle: Модуль\n---\n");
  writeFileSync(join(root, "site/modules/2/tracks/example.md"), "---\ntitle: Трек\narea: front\ndo:\n  student: front\n---\n");
  return root;
}

function runHooks(root: string, tool: string, cwd = root) {
  return groups.filter((group) => new RegExp(group.matcher).test(tool)).flatMap((group) =>
    group.hooks.map(({ command }) => Bun.spawnSync(["bash", "-c", command], {
      cwd,
      stdin: Buffer.from(JSON.stringify({
        session_id: "hook-test",
        transcript_path: join(root, "transcript.jsonl"),
        cwd,
        hook_event_name: "PostToolUse",
        tool_name: tool,
        tool_use_id: "test-call",
        tool_input: { command: tool === "apply_patch" ? "*** Begin Patch\n*** End Patch" : "python3 edit.py" },
        tool_response: { output: "", exit_code: 0 },
      })),
    })),
  );
}

for (const tool of ["apply_patch", "Bash"]) {
  test(`${tool}: ошибка модуля передаётся агенту с кодом 2`, () => {
    const root = fixture();
    writeFileSync(join(root, "site/modules/2/tracks/example.md"), "---\ntitle: Трек\narea: unknown\ndo:\n  student: front\n---\n");
    const results = runHooks(root, tool);
    expect(results).toHaveLength(1);
    const result = results[0]!;
    expect(result.exitCode).toBe(2);
    expect(result.stdout.toString()).toBe("");
    expect(result.stderr.toString()).toContain("example.md");
    expect(result.stderr.toString()).toContain("area");
  });
}

test("корректные модули: молчит и возвращает 0 из подкаталога с пробелами в пути", () => {
  const root = fixture();
  const results = runHooks(root, "apply_patch", join(root, "site/modules/2"));
  expect(results).toHaveLength(1);
  expect(results[0]!.exitCode).toBe(0);
  expect(results[0]!.stdout.toString()).toBe("");
  expect(results[0]!.stderr.toString()).toBe("");
});

test("без установленного пакета: молча пропускает проверку", () => {
  const root = fixture(false);
  const results = runHooks(root, "Bash");
  expect(results).toHaveLength(1);
  expect(results[0]!.exitCode).toBe(0);
  expect(results[0]!.stdout.toString()).toBe("");
  expect(results[0]!.stderr.toString()).toBe("");
});

test(".git-файл: проверяет данные своей копии из подкаталога", () => {
  const root = fixture();
  const admin = join(root, "git-admin");
  renameSync(join(root, ".git"), admin);
  writeFileSync(join(root, ".git"), `gitdir: ${admin}\n`);
  writeFileSync(join(root, "site/modules/2/tracks/example.md"), "---\ntitle: Трек\narea: unknown\ndo:\n  student: front\n---\n");
  const results = runHooks(root, "Bash", join(root, "site/modules"));
  expect(results).toHaveLength(1);
  expect(results[0]!.exitCode).toBe(2);
  expect(results[0]!.stdout.toString()).toBe("");
  expect(results[0]!.stderr.toString()).toContain("example.md");
});

test("старая ветка без скрипта хука: молча пропускает проверку", () => {
  const root = fixture();
  unlinkSync(join(root, "scripts/codex-modules-hook.ts"));
  const results = runHooks(root, "Bash");
  expect(results).toHaveLength(1);
  expect(results[0]!.exitCode).toBe(0);
  expect(results[0]!.stdout.toString()).toBe("");
  expect(results[0]!.stderr.toString()).toBe("");
});
